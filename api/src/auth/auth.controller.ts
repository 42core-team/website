import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { UserEntity } from "../user/entities/user.entity";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";
import { UserId } from "../guards/UserGuard";
import * as CryptoJS from "crypto-js";
import { SocialAccountService } from "../user/social-account.service";
import { SocialPlatform } from "../user/entities/social-account.entity";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly socialAccountService: SocialAccountService,
  ) {}

  @Get("/github/callback")
  @UseGuards(AuthGuard("github"))
  githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as UserEntity;
    this.logger.log({ action: "github_login", userId: user.id });

    const token = this.auth.signToken(user);
    this.setAuthCookie(res, token);

    return res.redirect(this.getOAuthSuccessRedirectUrl());
  }

  @Get("/42/getUrl")
  @UseGuards(JwtAuthGuard)
  getFortyTwoAuthUrl(@UserId() userId: string) {
    const encryptedUserId = CryptoJS.AES.encrypt(
      userId,
      this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
    ).toString();

    const base64EncodedEncryptedUserId =
      Buffer.from(encryptedUserId).toString("base64");

    return `https://api.intra.42.fr/oauth/authorize?client_id=${this.configService.getOrThrow<string>("FORTYTWO_CLIENT_ID")}&redirect_uri=${encodeURIComponent(this.configService.getOrThrow<string>("FORTYTWO_CALLBACK_URL"))}&response_type=code&state=${base64EncodedEncryptedUserId}`;
  }

  @Get("/42/callback")
  @UseGuards(AuthGuard("42"))
  async fortyTwoCallback(
    @Req()
    request: Request & {
      user: {
        fortyTwoAccount: {
          platformUserId: string;
          username: string;
          email: string;
        };
      };
    },
    @Res() res: Response,
    @Query("state") encryptedUserId: string,
  ) {
    try {
      const base64DecodedEncryptedUserId = Buffer.from(
        encryptedUserId,
        "base64",
      ).toString("utf-8");

      const userId = CryptoJS.AES.decrypt(
        base64DecodedEncryptedUserId,
        this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
      ).toString(CryptoJS.enc.Utf8);
      if (!userId) throw new BadRequestException("Invalid state parameter.");

      await this.socialAccountService.upsertSocialAccountForUser({
        userId,
        platform: SocialPlatform.FORTYTWO,
        platformUserId: request.user.fortyTwoAccount.platformUserId,
        username: request.user.fortyTwoAccount.username,
      });

      this.logger.log({ action: "fortytwo_link", userId });

      const redirectUrl = this.configService.getOrThrow<string>(
        "OAUTH_42_SUCCESS_REDIRECT_URL",
      );

      return res.redirect(redirectUrl);
    } catch (e) {
      const errorMessage = this.getFortyTwoErrorMessage(e);
      this.logger.warn({
        action: "fortytwo_link_failed",
        message: errorMessage,
      });
      return res.redirect(this.buildFortyTwoErrorRedirectUrl(errorMessage));
    }
  }

  @Get("/me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const user = req.user as UserEntity;
    return this.userService.getUserWithSocialAccounts(user.id);
  }

  @Post("/logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    this.clearAuthCookie(res);
  }

  private getFortyTwoErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (
        typeof response === "object" &&
        response !== null &&
        "message" in response
      ) {
        const message = (response as { message: unknown }).message;
        return Array.isArray(message) ? message.join(", ") : String(message);
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Failed to link 42 account";
  }

  private setAuthCookie(res: Response, token: string): void {
    const cookieName = this.getAuthCookieName();
    const cookieDomain = this.getAuthCookieDomain();
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: isDevelopment ? "lax" : "none",
      domain: cookieDomain,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookie(res: Response): void {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    res.clearCookie(this.getAuthCookieName(), {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: isDevelopment ? "lax" : "none",
      domain: this.getAuthCookieDomain(),
    });
  }

  private getAuthCookieName(): string {
    return this.configService.get<string>("AUTH_COOKIE_NAME") || "token";
  }

  private getAuthCookieDomain(): string {
    return (
      this.configService.get<string>("AUTH_COOKIE_DOMAIN") ||
      (this.configService.get("NODE_ENV") === "development"
        ? "localhost"
        : ".coregame.sh")
    );
  }

  private getOAuthSuccessRedirectUrl(): string {
    const configuredRedirectUrl =
      this.configService.get<string>("OAUTH_SUCCESS_REDIRECT_URL") ||
      "http://localhost:3000";
    const redirectUrl = new URL(configuredRedirectUrl);

    if (redirectUrl.pathname === "/auth/sso") {
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      redirectUrl.hash = "";
    }

    return redirectUrl.toString();
  }

  private buildFortyTwoErrorRedirectUrl(errorMessage: string): string {
    const redirectUrl = this.configService.getOrThrow<string>(
      "OAUTH_42_SUCCESS_REDIRECT_URL",
    );
    const url = new URL(redirectUrl);
    url.searchParams.set("error", errorMessage);
    return url.toString();
  }
}
