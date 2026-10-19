import { Injectable } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { getRabbitmqConfig } from "../main";
import { decryptSecret } from "../common/encryption";
import { lastValueFrom, timeout } from "rxjs";

@Injectable()
export class GithubApiService {
  private githubClient: ClientProxy;

  constructor(private configService: ConfigService) {
    this.githubClient = ClientProxyFactory.create(
      getRabbitmqConfig(configService, "github_service"),
    );
  }

  decryptSecret(encryptedSecret: string): string {
    return decryptSecret(
      encryptedSecret,
      this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
    );
  }

  async removeWritePermissions(
    username: string,
    githubId: string,
    repoOwner: string,
    repoName: string,
    encryptedSecret: string,
  ) {
    this.githubClient.emit("remove_write_permissions", {
      username,
      githubId,
      repoOwner,
      repoName,
      encryptedSecret,
    });
  }

  async addWritePermissions(
    username: string,
    githubId: string,
    repoOwner: string,
    repoName: string,
    encryptedSecret: string,
  ) {
    this.githubClient.emit("add_write_permissions", {
      username,
      githubId,
      repoOwner,
      repoName,
      encryptedSecret,
    });
  }

  async addUserToRepository(
    repositoryName: string,
    username: string,
    githubId: string,
    githubOrg: string,
    encryptedSecret: string,
    githubAccessToken: string,
  ) {
    this.githubClient.emit("add_user_to_repository", {
      repositoryName,
      username,
      githubId,
      githubOrg,
      encryptedSecret,
      githubAccessToken,
    });
  }

  async removeUserFromRepository(
    repositoryName: string,
    username: string,
    githubId: string,
    githubOrg: string,
    encryptedSecret: string,
  ) {
    await lastValueFrom(
      this.githubClient
        .send("remove_user_from_repository", {
          repositoryName,
          username,
          githubId,
          githubOrg,
          encryptedSecret,
        })
        .pipe(timeout(60000)),
    );
  }

  async deleteRepository(
    repositoryName: string,
    githubOrg: string,
    encryptedSecret: string,
  ) {
    this.githubClient.emit("delete_repository", {
      repositoryName,
      githubOrg,
      encryptedSecret,
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
        encryptedSecret,
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
    await lastValueFrom(this.githubClient.emit("set_repository_access", data));
  }
}
