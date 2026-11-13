import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserId } from "../guards/UserGuard";
import { ProfileService } from "./profile.service";
import type { ProfileResponse } from "./profile-response";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Signed in only, like the match histories the profile lists.
  @UseGuards(JwtAuthGuard)
  @Get(":username")
  getProfile(
    @Param("username") username: string,
    @UserId() viewerId: string,
  ): Promise<ProfileResponse> {
    return this.profileService.getProfile(username, viewerId);
  }
}
