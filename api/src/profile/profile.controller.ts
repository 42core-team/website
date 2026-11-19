import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserId } from "../guards/UserGuard";
import { ProfileService } from "./profile.service";
import { ProfileMatchesQueryDto } from "./profile-matches-query.dto";
import type {
  ProfileMatchesResponse,
  ProfileResponse,
} from "./profile-response";

// Signed in only, like the match histories the profile lists.
@UseGuards(JwtAuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(":username")
  getProfile(
    @Param("username") username: string,
    @UserId() viewerId: string,
  ): Promise<ProfileResponse> {
    return this.profileService.getProfile(username, viewerId);
  }

  @Get(":username/matches")
  getMatches(
    @Param("username") username: string,
    @UserId() viewerId: string,
    @Query(new ValidationPipe({ transform: true }))
    query: ProfileMatchesQueryDto,
  ): Promise<ProfileMatchesResponse> {
    return this.profileService.getMatches(username, viewerId, query);
  }
}
