import { Controller, Logger } from "@nestjs/common";
import { AppService } from "./app.service";
import { EventPattern } from "@nestjs/microservices";

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @EventPattern("remove_write_permissions")
  async handleRemoveWritePermissions(data: {
    username: string;
    repoOwner: string;
    repoName: string;
    encryptedSecret: string;
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
      data.repoOwner,
      data.repoName,
      data.encryptedSecret,
    );
  }

  @EventPattern("add_user_to_repository")
  async handleAddUserToRepository(data: {
    repositoryName: string;
    username: string;
    githubOrg: string;
    encryptedSecret: string;
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
      data.githubOrg,
      data.encryptedSecret,
      data.githubAccessToken,
    );
  }

  @EventPattern("remove_user_from_repository")
  async handleRemoveUserFromRepository(data: {
    repositoryName: string;
    username: string;
    githubOrg: string;
    encryptedSecret: string;
  }) {
    const safeData = {
      repositoryName: data.repositoryName,
      username: data.username,
      githubOrg: data.githubOrg,
    };
    this.logger.log(
      `remove_user_from_repository event received ${JSON.stringify(safeData)}`,
    );
    return await this.appService.removeUserFromRepository(
      data.repositoryName,
      data.username,
      data.githubOrg,
      data.encryptedSecret,
    );
  }

  @EventPattern("delete_repository")
  async handleDeleteRepository(data: {
    repositoryName: string;
    githubOrg: string;
    encryptedSecret: string;
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
      data.encryptedSecret,
    );
  }

  @EventPattern("create_team_repository")
  async handleCreateTeamRepository(data: {
    name: string;
    teamName: string;
    username: string;
    userGithubAccessToken: string;
    githubOrg: string;
    encryptedSecret: string;
    teamId: string;
    monoRepoUrl: string;
    monoRepoVersion: string;
    myCoreBotDockerImage: string;
    visualizerDockerImage: string;
    eventId: string;
  }) {
    const safeData = {
      name: data.name,
      teamName: data.teamName,
      username: data.username,
      githubOrg: data.githubOrg,
      monoRepoVersion: data.monoRepoVersion,
      teamId: data.teamId,
      eventId: data.eventId,
    };
    this.logger.log(
      `create_team_repository event received ${JSON.stringify(safeData)}`,
    );
    await this.appService.createTeamRepository(
      data.name,
      data.teamName,
      data.username,
      data.userGithubAccessToken,
      data.githubOrg,
      data.encryptedSecret,
      data.teamId,
      data.monoRepoUrl,
      data.monoRepoVersion,
      data.myCoreBotDockerImage,
      data.visualizerDockerImage,
      data.eventId,
    );
  }
}
