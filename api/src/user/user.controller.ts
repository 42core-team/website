import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dtos/user.dto";
import { UserGuard, UserId } from "../guards/UserGuard";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() user: CreateUserDto) {
    return this.userService.createUser(
      user.email,
      user.username,
      user.name,
      user.profilePicture,
      user.githubId,
      user.githubAccessToken,
    );
  }

  @Put(":id")
  async updateUser(
    @Body() user: CreateUserDto,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.userService.updateUser(
      id,
      user.email,
      user.username,
      user.name,
      user.profilePicture,
      user.githubId,
      user.githubAccessToken,
    );
  }

  @UseGuards(UserGuard)
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
