import { Injectable, Logger } from "@nestjs/common";
import { GitHubApiClient, RepositoryApi, UserApi } from "./githubApi";
import * as CryptoJS from "crypto-js";
import { ConfigService } from "@nestjs/config";
import { ClientProxy, ClientProxyFactory } from "@nestjs/microservices";
import { getRabbitmqConfig } from "./main";
import * as fs from "fs/promises";
import { RepoUtils } from "./repo.utils";

@Injectable()
export class AppService {
  private githubServiceResultsClient: ClientProxy;
  private readonly logger = new Logger(AppService.name);
  private readonly repoUtils = new RepoUtils();

  private readonly TMP_FOLDER = "./tmp";

  constructor(private configService: ConfigService) {
    this.githubServiceResultsClient = ClientProxyFactory.create(
      getRabbitmqConfig(configService, "github-service-results"),
    );
    fs.mkdir(this.TMP_FOLDER)
      .then(() => {
        this.logger.log(`Created temp folder at ${this.TMP_FOLDER}`);
      })
      .catch((error) => {
        if (error.code !== "EXIST") {
          this.logger.warn(
            `Failed to create temp folder at ${this.TMP_FOLDER} because it already exists`,
          );
        }
      });
  }

  decryptSecret(encryptedSecret: string): string {
    try {
      return CryptoJS.AES.decrypt(
        encryptedSecret,
        this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
      ).toString(CryptoJS.enc.Utf8);
    } catch (error) {
      this.logger.error("Failed to decrypt secret", error as Error);
      throw error;
    }
  }

  async removeWritePermissionsForUser(
    username: string,
    repoOwner: string,
    repoName: string,
    encryptedSecret: string,
  ) {
    this.logger.log(
      `Removing write permissions for user ${JSON.stringify({ username, repoOwner, repoName })}`,
    );
    try {
      const secret = this.decryptSecret(encryptedSecret);
      const githubApi = new GitHubApiClient({
        token: secret,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      const result = await repositoryApi.updateCollaboratorPermission(
        repoOwner,
        repoName,
        username,
        "pull",
      );
      this.logger.log(
        `Removed write permissions for user ${JSON.stringify({ username, repoOwner, repoName })}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to remove write permissions for user ${JSON.stringify({
          username,
          repoOwner,
          repoName,
        })}`,
        error as Error,
      );
      throw error;
    }
  }

  async addUserToRepository(
    repositoryName: string,
    username: string,
    githubOrg: string,
    encryptedSecret: string,
    encryptedGithubAccessToken: string,
  ) {
    this.logger.log(
      `Adding user to repository ${JSON.stringify({ repositoryName, username, githubOrg })}`,
    );
    try {
      const secret = this.decryptSecret(encryptedSecret);
      const githubAccessToken = this.decryptSecret(encryptedGithubAccessToken);
      const githubApi = new GitHubApiClient({
        token: secret,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      const userApi = new UserApi(githubApi);
      await repositoryApi.addCollaborator(
        githubOrg,
        repositoryName,
        username,
        "push",
      );
      await userApi.acceptRepositoryInvitationByRepo(
        githubOrg,
        repositoryName,
        githubAccessToken,
      );
      this.logger.log(
        `Added user to repository ${JSON.stringify({ repositoryName, username, githubOrg })}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to add user to repository ${JSON.stringify({
          repositoryName,
          username,
          githubOrg,
        })}`,
        error as Error,
      );
      throw error;
    }
  }

  async removeUserFromRepository(
    repositoryName: string,
    username: string,
    githubOrg: string,
    encryptedSecret: string,
  ) {
    this.logger.log(
      `Removing user from repository ${JSON.stringify({ repositoryName, username, githubOrg })}`,
    );
    try {
      const secret = this.decryptSecret(encryptedSecret);
      const githubApi = new GitHubApiClient({
        token: secret,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      await repositoryApi.removeCollaborator(
        githubOrg,
        repositoryName,
        username,
      );
      this.logger.log(
        `Removed user from repository ${JSON.stringify({ repositoryName, username, githubOrg })}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove user from repository ${JSON.stringify({
          repositoryName,
          username,
          githubOrg,
        })}`,
        error as Error,
      );
      throw error;
    }
  }

  async deleteRepository(
    repositoryName: string,
    githubOrg: string,
    encryptedSecret: string,
  ) {
    this.logger.log(
      `Deleting repository ${JSON.stringify({ repositoryName, githubOrg })}`,
    );
    try {
      const secret = this.decryptSecret(encryptedSecret);
      const githubApi = new GitHubApiClient({
        token: secret,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      const result = await repositoryApi.deleteRepo(githubOrg, repositoryName);
      this.logger.log(
        `Deleted repository ${JSON.stringify({ repositoryName, githubOrg })}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to delete repository ${JSON.stringify({
          repositoryName,
          githubOrg,
        })}`,
        error as Error,
      );
      throw error;
    }
  }

  async createTeamRepository(
    name: string,
    teamName: string,
    username: string,
    encryptedUserGithubAccessToken: string,
    githubOrg: string,
    encryptedSecret: string,
    teamId: string,
    monoRepoUrl: string,
    monoRepoVersion: string,
    myCoreBotDockerImage: string,
    visualizerDockerImage: string,
    eventId: string,
  ) {
    this.logger.log(
      `Creating team repository ${JSON.stringify({
        name,
        teamName,
        username,
        githubOrg,
        teamId,
      })}`,
    );
    try {
      const githubAccessToken = this.decryptSecret(
        encryptedUserGithubAccessToken,
      );
      const secret = this.decryptSecret(encryptedSecret);
      const githubApi = new GitHubApiClient({
        token: secret,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      const userApi = new UserApi(githubApi);
      this.logger.log(`Creating repo ${name} in org ${githubOrg}`);

      const tempFolderPath = `${this.TMP_FOLDER}/${name}-${Date.now()}`;
      try {
        const [repo, gitRepo] = await Promise.all([
          (async () => {
            const repo = await repositoryApi.createRepo(
              {
                name,
                private: true,
              },
              githubOrg,
            );
            name = repo.name;
            return repo;
          })(),
          (async () => {
            await fs.mkdir(tempFolderPath);
            return await this.repoUtils.cloneMonoRepo(
              monoRepoUrl,
              monoRepoVersion,
              myCoreBotDockerImage,
              visualizerDockerImage,
              tempFolderPath,
              eventId,
              teamName,
            );
          })(),
        ]);

        await this.repoUtils.pushToTeamRepo(
          repo,
          secret,
          tempFolderPath,
          gitRepo,
        );
      } catch (e) {
        this.logger.error(
          `Failed to clone mono repo and push to team repo for repo ${name}`,
          e as Error,
        );
        await this.deleteRepository(name, githubOrg, secret);
        // Error is handled by the outer catch block; do not re-throw here.
      } finally {
        //await fs.rm(tempFolderPath, { recursive: true, force: true });
        this.logger.log(`Removed temp folder ${tempFolderPath}`);
      }

      this.githubServiceResultsClient.emit("repository_created", {
        repositoryName: name,
        teamId: teamId,
      });

      await repositoryApi.addCollaborator(
        githubOrg,
        name,
        username,
        "push",
      );
      await userApi.acceptRepositoryInvitationByRepo(
        githubOrg,
        name,
        githubAccessToken,
      );

      this.logger.log(
        `Created team repository ${JSON.stringify({
          name,
          username,
          githubOrg,
          teamId,
          repoName: name,
        })}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create team repository ${JSON.stringify({
          name,
          username,
          githubOrg,
          teamId,
        })}`,
        error as Error,
      );
      throw error;
    }
  }
}
