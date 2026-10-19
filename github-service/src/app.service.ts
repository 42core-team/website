import { Injectable, Logger } from "@nestjs/common";
import { GitHubApiClient, RepositoryApi, UserApi } from "./githubApi";
import { ConfigService } from "@nestjs/config";
import { ClientProxy, ClientProxyFactory } from "@nestjs/microservices";
import { getRabbitmqConfig } from "./main";
import * as fs from "fs/promises";
import { RepoUtils } from "./repo.utils";
import { decryptSecret } from "./secret-crypto";
import { lastValueFrom, timeout } from "rxjs";

@Injectable()
export class AppService {
  private githubServiceResultsClient: ClientProxy;
  private readonly logger = new Logger(AppService.name);
  private readonly repoUtils = new RepoUtils();

  private readonly TMP_FOLDER = "./tmp";
  private readonly repositoryOperations = new Map<string, Promise<unknown>>();

  async runRepositoryOperation(
    teamId: string,
    operationId: string | undefined,
    action: () => Promise<void>,
  ) {
    const previous = this.repositoryOperations.get(teamId) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        if (!operationId) return;
        const current = await lastValueFrom(
          this.githubServiceResultsClient
            .send<boolean>("repository_operation_current", {
              teamId,
              operationId,
            })
            .pipe(timeout(60000)),
        );
        if (current) await action();
      });
    this.repositoryOperations.set(teamId, operation);
    try {
      await operation;
    } finally {
      if (this.repositoryOperations.get(teamId) === operation)
        this.repositoryOperations.delete(teamId);
    }
  }

  async reportRepositoryOperation(data: {
    teamId: string;
    operationId?: string;
    repositoryName: string;
    error?: string;
    action?: "CREATE" | "LOCK" | "UNLOCK";
  }) {
    await lastValueFrom(
      this.githubServiceResultsClient.emit(
        "repository_operation_completed",
        data,
      ),
    );
  }

  async setRepositoryAccess(data: {
    teamId: string;
    operationId: string;
    repositoryName: string;
    githubOrg: string;
    encryptedSecret: string;
    locked: boolean;
    githubUsers: {
      username: string;
      githubId: string;
      githubAccessToken: string;
    }[];
  }) {
    let error: string | undefined;
    try {
      // Await every collaborator before acknowledging: one failure must not hide
      // outstanding writes or let a retry race a still-running permission change.
      for (const user of data.githubUsers) {
        if (data.locked) {
          await this.removeWritePermissionsForUser(
            user.username,
            user.githubId,
            data.githubOrg,
            data.repositoryName,
            data.encryptedSecret,
          );
        } else {
          await this.addUserToRepository(
            data.repositoryName,
            user.username,
            user.githubId,
            data.githubOrg,
            data.encryptedSecret,
            user.githubAccessToken,
          );
        }
      }
    } catch (cause) {
      this.logger.error("Repository permission operation failed", cause);
      error =
        "GitHub collaborator permissions could not be updated. Check organization permissions and retry.";
    }
    await this.reportRepositoryOperation({
      teamId: data.teamId,
      operationId: data.operationId,
      repositoryName: data.repositoryName,
      error,
      action: data.locked ? "LOCK" : "UNLOCK",
    });
  }

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
      return decryptSecret(
        encryptedSecret,
        this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
      );
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
        await repositoryApi.updateCollaboratorPermission(
          repoOwner,
          repoName,
          user,
          "pull",
        );
        const permission = await repositoryApi.getCollaboratorPermission(
          repoOwner,
          repoName,
          user,
        );
        if (!["read", "none"].includes(permission))
          throw new Error(
            "Collaborator still has inherited write permissions.",
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
        if (
          !(await repositoryApi.isCollaborator(githubOrg, repositoryName, user))
        )
          throw new Error("Collaborator access was not established.");
        const permission = await repositoryApi.getCollaboratorPermission(
          githubOrg,
          repositoryName,
          user,
        );
        if (!["write", "admin", "maintain"].includes(permission))
          throw new Error("Collaborator write access was not established.");
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
    operationId?: string,
    submissionDeadline?: string,
  ) {
    let initialized = false;
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
      if (
        submissionDeadline &&
        Date.now() >= new Date(submissionDeadline).getTime()
      )
        throw new Error("Repository provisioning deadline has passed.");
      const secret = this.decryptSecret(encryptedSecret);
      const githubApi = new GitHubApiClient({
        token: secret,
      });
      const repositoryApi = new RepositoryApi(githubApi);
      this.logger.log(`Creating repo ${name} in org ${githubOrg}`);

      const tempFolderPath = `${this.TMP_FOLDER}/${name}-${Date.now()}`;
      let createdHere = false;
      try {
        let repo:
          Awaited<ReturnType<RepositoryApi["getRepository"]>> | undefined;
        if (operationId) {
          try {
            repo = await repositoryApi.getRepository(githubOrg, name);
          } catch (error) {
            if (!(
              error &&
              typeof error === "object" &&
              "status" in error &&
              error.status === 404
            ))
              throw error;
          }
        }
        if (!repo) {
          repo = await repositoryApi.createRepo(
            { name, private: true },
            githubOrg,
          );
          createdHere = true;
        }
        name = repo.name;
        // A retry must never overwrite a team's submitted code.
        if (createdHere || !(await repositoryApi.hasCommits(githubOrg, name))) {
          await fs.mkdir(tempFolderPath);
          const gitRepo = await this.repoUtils.cloneMonoRepo(
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
          await this.repoUtils.pushToTeamRepo(
            repo,
            secret,
            tempFolderPath,
            gitRepo,
            basePath,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to clone mono repo and push to team repo for repo ${name}`,
          error as Error,
        );
        try {
          if (createdHere)
            await this.deleteRepository(name, githubOrg, encryptedSecret);
        } catch (cleanupError) {
          this.logger.error(
            `Failed to clean up repository ${name} after setup failed`,
            cleanupError as Error,
          );
        }
        throw error;
      } finally {
        await fs.rm(tempFolderPath, { recursive: true, force: true });
        this.logger.log(`Removed temp folder ${tempFolderPath}`);
      }

      initialized = true;

      const collaboratorResults = await Promise.allSettled(
        githubUsers.map((user) =>
          submissionDeadline &&
          Date.now() >= new Date(submissionDeadline).getTime()
            ? this.removeWritePermissionsForUser(
                user.username,
                user.githubId,
                githubOrg,
                name,
                encryptedSecret,
              )
            : this.addUserToRepository(
                name,
                user.username,
                user.githubId,
                githubOrg,
                encryptedSecret,
                user.githubAccessToken,
              ),
        ),
      );

      const failure = collaboratorResults.find(
        (result) => result.status === "rejected",
      );
      if (failure?.status === "rejected") throw failure.reason;
      if (operationId)
        await this.reportRepositoryOperation({
          repositoryName: name,
          teamId,
          operationId,
          action: "CREATE",
        });

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
      if (!operationId) throw error;
      await this.reportRepositoryOperation({
        repositoryName: initialized ? name : "",
        teamId,
        operationId,
        action: "CREATE",
        error:
          "GitHub repository setup failed. Check repository and collaborator permissions and retry.",
      });
    }
  }
}
