import {
  Controller,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { UserId } from "../guards/UserGuard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get("canCreateEvent")
  async canCreateEvent(@UserId() id: string) {
    return this.userService.canCreateEvent(id);
  }

  @Get("github/:githubId")
  async getUserByGithubId(@Param("githubId") githubId: string) {
    return this.userService.getUserByGithubId(githubId);
  }

  @Get("email/:email")
  async getUserByEmail(@Param("email") email: string) {
    return this.userService.getUserByEmail(email);
  }
}
