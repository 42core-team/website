import { Controller, Logger } from "@nestjs/common";
import { AppService } from "./app.service";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { GithubAuth } from "./github-auth";

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @EventPattern("set_repository_access")
  async handleSetRepositoryAccess(
    data: Parameters<AppService["setRepositoryAccess"]>[0],
  ) {
    await this.appService.runRepositoryOperation(
      data.teamId,
      data.operationId,
      () => this.appService.setRepositoryAccess(data),
    );
  }

  @EventPattern("remove_write_permissions")
  async handleRemoveWritePermissions(data: {
    username: string;
    githubId: string;
    repoOwner: string;
    repoName: string;
    githubAuth: GithubAuth;
  }) {
    const safeData = {
      username: data.username,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
    };
    this.logger.log(
      `remove_write_permissions event received ${JSON.stringify(safeData)}`,
    );
    return await this.appService.removeWritePermissionsForUser(
      data.username,
      data.githubId,
      data.repoOwner,
      data.repoName,
      data.githubAuth,
    );
  }

  @EventPattern("add_write_permissions")
  async handleAddWritePermissions(data: {
    username: string;
    githubId: string;
    repoOwner: string;
    repoName: string;
    githubAuth: GithubAuth;
  }) {
    const safeData = {
      username: data.username,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
    };
    this.logger.log(
      `add_write_permissions event received ${JSON.stringify(safeData)}`,
    );
    return await this.appService.addWritePermissionsForUser(
      data.username,
      data.githubId,
      data.repoOwner,
      data.repoName,
      data.githubAuth,
    );
  }

  @EventPattern("add_user_to_repository")
  async handleAddUserToRepository(data: {
    repositoryName: string;
    username: string;
    githubId: string;
    githubOrg: string;
    githubAuth: GithubAuth;
    githubAccessToken: string;
  }) {
    const safeData = {
      repositoryName: data.repositoryName,
      username: data.username,
      githubOrg: data.githubOrg,
    };
    this.logger.log(
      `add_user_to_repository event received ${JSON.stringify(safeData)}`,
    );
    return await this.appService.addUserToRepository(
      data.repositoryName,
      data.username,
      data.githubId,
      data.githubOrg,
      data.githubAuth,
      data.githubAccessToken,
    );
  }

  @MessagePattern("remove_user_from_repository")
  async handleRemoveUserFromRepository(data: {
    repositoryName: string;
    username: string;
    githubId: string;
    githubOrg: string;
    githubAuth: GithubAuth;
  }) {
    const safeData = {
      repositoryName: data.repositoryName,
      username: data.username,
      githubOrg: data.githubOrg,
    };
    this.logger.log(
      `remove_user_from_repository event received ${JSON.stringify(safeData)}`,
    );
    await this.appService.removeUserFromRepository(
      data.repositoryName,
      data.username,
      data.githubId,
      data.githubOrg,
      data.githubAuth,
    );
    return { success: true };
  }

  @MessagePattern("get_repository_activity")
  handleGetRepositoryActivity(data: {
    repositoryNames: string[];
    githubOrg: string;
    githubAuth: GithubAuth;
  }) {
    this.logger.log(
      `get_repository_activity event received ${JSON.stringify({
        repositoryCount: data.repositoryNames.length,
        githubOrg: data.githubOrg,
      })}`,
    );
    return this.appService.getRepositoryActivity(
      data.repositoryNames,
      data.githubOrg,
      data.githubAuth,
    );
  }

  @EventPattern("delete_repository")
  async handleDeleteRepository(data: {
    repositoryName: string;
    githubOrg: string;
    githubAuth: GithubAuth;
  }) {
    const safeData = {
      repositoryName: data.repositoryName,
      githubOrg: data.githubOrg,
    };
    this.logger.log(
      `delete_repository event received ${JSON.stringify(safeData)}`,
    );
    return await this.appService.deleteRepository(
      data.repositoryName,
      data.githubOrg,
      data.githubAuth,
    );
  }

  @EventPattern("create_team_repository")
  async handleCreateTeamRepository(data: {
    name: string;
    teamName: string;
    githubUsers: {
      username: string;
      githubId: string;
      githubAccessToken: string;
    }[];
    githubOrg: string;
    githubAuth: GithubAuth;
    teamId: string;
    monoRepoUrl: string;
    monoRepoVersion: string;
    myCoreBotDockerImage: string;
    visualizerDockerImage: string;
    eventId: string;
    basePath: string;
    gameConfig: string;
    serverConfig: string;
    starterTemplateId?: string;
    operationId?: string;
    submissionDeadline?: string;
    apiBaseUrl: string;
  }) {
    const safeData = {
      name: data.name,
      teamName: data.teamName,
      githubUsers: data.githubUsers.map((user) => ({
        username: user.username,
      })),
      githubOrg: data.githubOrg,
      monoRepoVersion: data.monoRepoVersion,
      teamId: data.teamId,
      eventId: data.eventId,
      basePath: data.basePath,
      gameConfig: data.gameConfig.slice(0, 50),
      serverConfig: data.serverConfig.slice(0, 50),
      starterTemplateId: data.starterTemplateId,
      apiBaseUrl: data.apiBaseUrl,
    };
    this.logger.log(
      `create_team_repository event received ${JSON.stringify(safeData)}`,
    );
    await this.appService.runRepositoryOperation(
      data.teamId,
      data.operationId,
      () =>
        this.appService.createTeamRepository(
          data.name,
          data.teamName,
          data.githubUsers,
          data.githubOrg,
          data.githubAuth,
          data.teamId,
          data.monoRepoUrl,
          data.monoRepoVersion,
          data.myCoreBotDockerImage,
          data.visualizerDockerImage,
          data.eventId,
          data.basePath,
          data.gameConfig,
          data.serverConfig,
          data.apiBaseUrl,
          data.starterTemplateId,
          data.operationId,
          data.submissionDeadline,
        ),
    );
  }
}
