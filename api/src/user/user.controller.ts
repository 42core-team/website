import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UnauthorizedException,
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

  @UseGuards(JwtAuthGuard)
  @Get("search")
  async searchUsers(@UserId() userId: string, @Query("q") query: string) {
    if (!(await this.userService.canCreateEvent(userId))) {
      throw new UnauthorizedException("Only admins can search users");
    }

    const sanitizedQuery = (query || "").trim();
    if (!sanitizedQuery) {
      throw new BadRequestException("Search query must not be empty");
    }

    if (sanitizedQuery.length > 100) {
      throw new BadRequestException("Search query is too long");
    }

    return this.userService.searchUsers(sanitizedQuery);
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
