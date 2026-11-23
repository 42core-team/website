import { Controller } from "@nestjs/common";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { TeamService } from "./team.service";
import { Public } from "../authz";

// Messages from our own services over RabbitMQ. The app's global guards
// never run on this transport; this only records the decision.
@Public()
@Controller("team.events")
export class TeamEventsController {
  constructor(private teamService: TeamService) {}

  @MessagePattern("repository_operation_current")
  isOperationCurrent(data: { teamId: string; operationId: string }) {
    return this.teamService.isRepositoryOperationCurrent(
      data.teamId,
      data.operationId,
    );
  }
  @EventPattern("repository_operation_completed")
  async handleRepositoryCreated(data: {
    teamId: string;
    repositoryName: string;
    operationId: string;
    error?: string;
    action?: "CREATE" | "LOCK" | "UNLOCK";
  }) {
    await this.teamService.completeRepositoryOperation(data);
  }
}
