import { Controller } from "@nestjs/common";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { RepositoryLifecycleService } from "./repository-lifecycle.service";

@Controller("team.events")
export class RepositoryLifecycleEventsController {
  constructor(private repositoryLifecycle: RepositoryLifecycleService) {}

  @MessagePattern("repository_operation_current")
  isOperationCurrent(data: { teamId: string; operationId: string }) {
    return this.repositoryLifecycle.isRepositoryOperationCurrent(
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
    await this.repositoryLifecycle.completeRepositoryOperation(data);
  }
}
