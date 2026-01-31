import { Controller, Logger } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { UserService } from "./user.service";

@Controller()
export class UserEventsController {
    private readonly logger = new Logger(UserEventsController.name);

    constructor(private readonly userService: UserService) { }

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
        await this.userService.updateUsername(data.githubId, data.newUsername, data.newName);
    }
}
