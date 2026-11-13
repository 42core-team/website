import { Controller, Logger } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { UserService } from "./user.service";
import { Public } from "../authz";

// Messages from our own services over RabbitMQ. The app's global guards
// never run on this transport; this only records the decision.
@Public()
@Controller()
export class UserEventsController {
  private readonly logger = new Logger(UserEventsController.name);

  constructor(private readonly userService: UserService) {}

  @EventPattern("github_username_changed")
  async handleGithubUsernameChanged(data: {
    oldUsername: string;
    newUsername: string;
    newName: string;
    githubId: string;
  }) {
    this.logger.log(
      `Received github_username_changed event: ${JSON.stringify(data)}`,
    );
    await this.userService.updateUsername(
      data.githubId,
      data.newUsername,
      data.newName,
    );
  }
}
