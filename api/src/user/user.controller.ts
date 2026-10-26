import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { UserId } from "../guards/UserGuard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PublicUserDto, toPublicUsers } from "./dtos/public-user.dto";

@Controller("user")
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get("canCreateEvent")
  async canCreateEvent(@UserId() id: string) {
    return this.userService.canCreateEvent(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("search")
  async searchUsers(
    @UserId() userId: string,
    @Query("q") query: string,
  ): Promise<PublicUserDto[]> {
    const sanitizedQuery = (query || "").trim();
    if (!sanitizedQuery) {
      throw new BadRequestException("Search query must not be empty");
    }

    if (sanitizedQuery.length > 100) {
      throw new BadRequestException("Search query is too long");
    }

    this.logger.log({ action: "search_users", userId, query: sanitizedQuery });

    return toPublicUsers(await this.userService.searchUsers(sanitizedQuery));
  }
}
