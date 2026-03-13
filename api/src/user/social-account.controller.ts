import {
  Controller,
  Delete,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SocialAccountService } from "./social-account.service";
import {
  SocialAccountEntity,
  SocialPlatform,
} from "./entities/social-account.entity";
import { UserId } from "../guards/UserGuard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@ApiTags("social-accounts")
@Controller("social-accounts")
export class SocialAccountController {
  constructor(private readonly socialAccountService: SocialAccountService) {}

  @Delete(":platform")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Unlink a social account from the authenticated user",
  })
  @ApiResponse({
    status: 204,
    description: "Social account unlinked successfully",
  })
  @ApiResponse({ status: 404, description: "Social account link not found" })
  async unlinkSocialAccount(
    @UserId() userId: string,
    @Param("platform") platform: SocialPlatform,
  ): Promise<void> {
    await this.socialAccountService.unlinkSocialAccount(userId, platform);
  }

  @Get()
  @ApiOperation({
    summary: "Get all social accounts for the authenticated user",
  })
  @ApiResponse({
    status: 200,
    description: "Social accounts retrieved successfully",
  })
  async getSocialAccounts(
    @UserId() userId: string,
  ): Promise<SocialAccountEntity[]> {
    return await this.socialAccountService.getSocialAccounts(userId);
  }

  @Get(":platform")
  @ApiOperation({
    summary: "Get a specific social account for the authenticated user",
  })
  @ApiResponse({
    status: 200,
    description: "Social account retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Social account not found" })
  async getSocialAccountByPlatform(
    @UserId() userId: string,
    @Param("platform") platform: SocialPlatform,
  ): Promise<SocialAccountEntity | null> {
    return await this.socialAccountService.getSocialAccountByPlatform(
      userId,
      platform,
    );
  }
}
