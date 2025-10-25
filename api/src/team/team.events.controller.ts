import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { TeamService } from "./team.service";

@Controller("team.events")
export class TeamEventsController {
  constructor(private teamService: TeamService) {}
  @EventPattern("repository_created")
  async handleRepositoryCreated(data: {
    teamId: string;
    repositoryName: string;
  }) {
    await this.teamService.setTeamRepository(data.teamId, data.repositoryName);
  }
}
