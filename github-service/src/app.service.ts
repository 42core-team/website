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

  private async resolveUsername(
    githubId: string,
    currentUsername: string,
    userApi: UserApi,
  ): Promise<string | null> {
    try {
      const user = await userApi.getUserById(githubId);
      if (user.login !== currentUsername) {
        this.logger.log(
          `Username changed for githubId ${githubId}: ${currentUsername} -> ${user.login}`,
        );
        this.githubServiceResultsClient.emit("github_username_changed", {
          oldUsername: currentUsername,
          newUsername: user.login,
          newName: user.name || user.login,
          githubId: githubId,
        });
        return user.login;
      }
    } catch (e) {
      this.logger.warn(`Failed to resolve user by ID ${githubId}`, e);
    }
    return null;
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

  private async executeGitHubAction<T>(
    username: string,
    githubId: string,
    encryptedSecret: string,
    actionName: string,
    context: Record<string, unknown>,
    action: (
      username: string,
      repositoryApi: RepositoryApi,
      userApi: UserApi,
    ) => Promise<T>,
  ): Promise<T> {
    this.logger.log(`${actionName} ${JSON.stringify(context)}`);
    try {
      const secret = this.decryptSecret(encryptedSecret);
      const githubApi = new GitHubApiClient({
        token: secret,
        logErrors: false,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      const userApi = new UserApi(githubApi);

      const result = await action(username, repositoryApi, userApi);

      this.logger.log(`Completed ${actionName} ${JSON.stringify(context)}`);
      return result;
    } catch (error) {
      if (githubId) {
        try {
          const secret = this.decryptSecret(encryptedSecret);
          const githubApi = new GitHubApiClient({ token: secret });
          const userApi = new UserApi(githubApi);

          const newUsername = await this.resolveUsername(
            githubId,
            username,
            userApi,
          );

          if (newUsername) {
            const repositoryApi = new RepositoryApi(githubApi);
            return await action(newUsername, repositoryApi, userApi);
          }
        } catch (innerError) {
          this.logger.error(
            "Failed to retry with resolved username",
            innerError as Error,
          );
        }
      }
      this.logger.error(
        `Failed ${actionName} ${JSON.stringify(context)}`,
        error as Error,
      );
      throw error;
    }
  }

  async removeWritePermissionsForUser(
    username: string,
    githubId: string,
    repoOwner: string,
    repoName: string,
    encryptedSecret: string,
  ) {
    return this.executeGitHubAction(
      username,
      githubId,
      encryptedSecret,
      "Removing write permissions for user",
      { username, repoOwner, repoName },
      async (user, repositoryApi) => {
        return repositoryApi.updateCollaboratorPermission(
          repoOwner,
          repoName,
          user,
          "pull",
        );
      },
    );
  }

  async addWritePermissionsForUser(
    username: string,
    githubId: string,
    repoOwner: string,
    repoName: string,
    encryptedSecret: string,
  ) {
    return this.executeGitHubAction(
      username,
      githubId,
      encryptedSecret,
      "Adding write permissions for user",
      { username, repoOwner, repoName },
      async (user, repositoryApi) => {
        return repositoryApi.updateCollaboratorPermission(
          repoOwner,
          repoName,
          user,
          "push",
        );
      },
    );
  }

  async addUserToRepository(
    repositoryName: string,
    username: string,
    githubId: string,
    githubOrg: string,
    encryptedSecret: string,
    encryptedGithubAccessToken: string,
  ) {
    return this.executeGitHubAction(
      username,
      githubId,
      encryptedSecret,
      "Adding user to repository",
      { repositoryName, username, githubOrg },
      async (user, repositoryApi, userApi) => {
        const githubAccessToken = this.decryptSecret(
          encryptedGithubAccessToken,
        );
        await repositoryApi.addCollaborator(
          githubOrg,
          repositoryName,
          user,
          "push",
        );
        await userApi.acceptRepositoryInvitationByRepo(
          githubOrg,
          repositoryName,
          githubAccessToken,
        );
      },
    );
  }

  async removeUserFromRepository(
    repositoryName: string,
    username: string,
    githubId: string,
    githubOrg: string,
    encryptedSecret: string,
  ) {
    return this.executeGitHubAction(
      username,
      githubId,
      encryptedSecret,
      "Removing user from repository",
      { repositoryName, username, githubOrg },
      async (user, repositoryApi) => {
        await repositoryApi.removeCollaborator(githubOrg, repositoryName, user);
      },
    );
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
    githubUsers: {
      username: string;
      githubId: string;
      githubAccessToken: string;
    }[],
    githubOrg: string,
    encryptedSecret: string,
    teamId: string,
    monoRepoUrl: string,
    monoRepoVersion: string,
    myCoreBotDockerImage: string,
    visualizerDockerImage: string,
    eventId: string,
    basePath: string,
    gameConfig: string,
    serverConfig: string,
    apiBaseUrl: string,
    starterTemplateId?: string,
  ) {
    this.logger.log(
      `Creating team repository ${JSON.stringify({
        name,
        teamName,
        githubOrg,
        teamId,
        apiBaseUrl,
      })}`,
    );
    try {
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
              basePath,
              gameConfig,
              serverConfig,
              apiBaseUrl,
              starterTemplateId,
            );
          })(),
        ]);

        await this.repoUtils.pushToTeamRepo(
          repo,
          secret,
          tempFolderPath,
          gitRepo,
          basePath,
        );
      } catch (e) {
        this.logger.error(
          `Failed to clone mono repo and push to team repo for repo ${name}`,
          e as Error,
        );
        await this.deleteRepository(name, githubOrg, secret);
        // Error is handled by the outer catch block; do not re-throw here.
      } finally {
        await fs.rm(tempFolderPath, { recursive: true, force: true });
        this.logger.log(`Removed temp folder ${tempFolderPath}`);
      }

      this.githubServiceResultsClient.emit("repository_created", {
        repositoryName: name,
        teamId: teamId,
      });

      await Promise.all(
        githubUsers.map(async (user) => {
          const { username } = user;
          const { githubAccessToken, githubId } = user;
          this.logger.log(
            `Adding user ${username} to repository ${name} in org ${githubOrg}`,
          );

          await this.executeGitHubAction(
            username,
            githubId,
            encryptedSecret,
            "Adding user to team repository",
            { username, name, githubOrg },
            async (u, repoApi) => {
              return repoApi.addCollaborator(githubOrg, name, u, "push");
            },
          );

          const decryptedGithubAccessToken =
            this.decryptSecret(githubAccessToken);

          await userApi.acceptRepositoryInvitationByRepo(
            githubOrg,
            name,
            decryptedGithubAccessToken,
          );
        }),
      );

      this.logger.log(
        `Created team repository ${JSON.stringify({
          name,
          githubOrg,
          teamId,
          repoName: name,
        })}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create team repository ${JSON.stringify({
          name,
          githubOrg,
          teamId,
        })}`,
        error as Error,
      );
      throw error;
    }
  }
}
