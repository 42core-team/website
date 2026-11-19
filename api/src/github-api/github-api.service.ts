import { Injectable, Logger } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { getRabbitmqConfig } from "../main";
import { lastValueFrom, timeout } from "rxjs";
import { GithubAuth } from "./github-auth";

export type RepositoryActivityStatus = "active" | "inactive" | "unknown";

export interface RepositoryActivityResult {
  repositoryName: string;
  status: RepositoryActivityStatus;
}

const REPOSITORY_ACTIVITY_TIMEOUT_MS = 60000;
// github-service checks 5 at a time with a 10 second limit each, so even a batch
// of unresponsive requests finishes within the timeout.
const REPOSITORY_ACTIVITY_BATCH_SIZE = 25;

@Injectable()
export class GithubApiService {
  private githubClient: ClientProxy;
  private readonly logger = new Logger(GithubApiService.name);

  constructor(private configService: ConfigService) {
    this.githubClient = ClientProxyFactory.create(
      getRabbitmqConfig(configService, "github_service"),
    );
  }

  async removeWritePermissions(
    username: string,
    githubId: string,
    repoOwner: string,
    repoName: string,
    githubAuth: GithubAuth,
  ) {
    this.githubClient.emit("remove_write_permissions", {
      username,
      githubId,
      repoOwner,
      repoName,
      githubAuth,
    });
  }

  async addWritePermissions(
    username: string,
    githubId: string,
    repoOwner: string,
    repoName: string,
    githubAuth: GithubAuth,
  ) {
    this.githubClient.emit("add_write_permissions", {
      username,
      githubId,
      repoOwner,
      repoName,
      githubAuth,
    });
  }

  async addUserToRepository(
    repositoryName: string,
    username: string,
    githubId: string,
    githubOrg: string,
    githubAuth: GithubAuth,
    githubAccessToken: string,
  ) {
    this.githubClient.emit("add_user_to_repository", {
      repositoryName,
      username,
      githubId,
      githubOrg,
      githubAuth,
      githubAccessToken,
    });
  }

  async deleteRepository(
    repositoryName: string,
    githubOrg: string,
    githubAuth: GithubAuth,
  ) {
    this.githubClient.emit("delete_repository", {
      repositoryName,
      githubOrg,
      githubAuth,
    });
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
    githubAuth: GithubAuth,
    teamId: string,
    monoRepoUrl: string,
    monoRepoVersion: string,
    myCoreBotDockerImage: string,
    visualizerDockerImage: string,
    eventId: string,
    basePath: string,
    gameConfig: string,
    serverConfig: string,
    starterTemplateId?: string,
    operationId?: string,
    submissionDeadline?: string,
  ) {
    await lastValueFrom(
      this.githubClient.emit("create_team_repository", {
        operationId,
        submissionDeadline,
        name,
        teamName,
        githubUsers,
        githubOrg,
        githubAuth,
        teamId,
        monoRepoUrl,
        monoRepoVersion,
        myCoreBotDockerImage,
        visualizerDockerImage,
        eventId,
        basePath,
        gameConfig,
        serverConfig,
        starterTemplateId,
        apiBaseUrl: this.configService.getOrThrow<string>("API_BASE_URL"),
      }),
    );
  }

  /**
   * Checks repositories in batches so a late failure keeps earlier results. It
   * stops once a batch times out or none of it could be checked; repositories
   * left out of the result were not checked.
   */
  async getRepositoryActivity(
    repositoryNames: string[],
    githubOrg: string,
    githubAuth: GithubAuth,
  ) {
    const results: RepositoryActivityResult[] = [];
    for (
      let start = 0;
      start < repositoryNames.length;
      start += REPOSITORY_ACTIVITY_BATCH_SIZE
    ) {
      let batch: RepositoryActivityResult[];
      try {
        batch = await lastValueFrom(
          this.githubClient
            .send<RepositoryActivityResult[]>("get_repository_activity", {
              repositoryNames: repositoryNames.slice(
                start,
                start + REPOSITORY_ACTIVITY_BATCH_SIZE,
              ),
              githubOrg,
              githubAuth,
            })
            .pipe(timeout(REPOSITORY_ACTIVITY_TIMEOUT_MS)),
        );
      } catch (error) {
        if (results.length === 0) throw error;
        this.logger.error("Repository activity batch failed", error);
        break;
      }
      results.push(...batch);
      if (batch.every(({ status }) => status === "unknown")) break;
    }
    return results;
  }

  async setRepositoryAccess(data: {
    teamId: string;
    operationId: string;
    repositoryName: string;
    githubOrg: string;
    githubAuth: GithubAuth;
    locked: boolean;
    githubUsers: {
      username: string;
      githubId: string;
      githubAccessToken: string;
    }[];
  }) {
    await lastValueFrom(this.githubClient.emit("set_repository_access", data));
  }
}
