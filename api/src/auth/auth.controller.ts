import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
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
import { SocialAccountService } from "../user/social-account.service";
import { SocialPlatform } from "../user/entities/social-account.entity";
import { OAuthFlow } from "./entities/oauth-state.entity";
import { OAuthStateService } from "./oauth-state.service";
import {
  FORTYTWO_OAUTH_COOKIE,
  FortyTwoOAuthRequest,
  FortyTwoOAuthStateGuard,
} from "./fortytwo-oauth-state.guard";
import { GithubOAuthClient } from "./github.strategy";

const GITHUB_OAUTH_COOKIE = "oauth_github_browser";

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly socialAccountService: SocialAccountService,
    private readonly oauthStates: OAuthStateService,
    private readonly githubOAuth: GithubOAuthClient,
  ) {}

  @Get("/github/callback")
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const code =
      typeof req.query.code === "string" ? req.query.code : undefined;
    const state =
      typeof req.query.state === "string" ? req.query.state : undefined;

    if (!code && !state) {
      const issued = await this.oauthStates.issue(OAuthFlow.GITHUB, null, true);
      this.setOAuthBrowserCookie(
        res,
        GITHUB_OAUTH_COOKIE,
        issued.browserBinding,
        "/auth/github/callback",
      );
      return res.redirect(
        this.githubOAuth.getAuthorizationUrl(
          issued.state,
          issued.codeChallenge as string,
        ),
      );
    }

    const browserBinding = req.cookies?.[GITHUB_OAUTH_COOKIE] as
      string | undefined;
    this.clearOAuthBrowserCookie(
      res,
      GITHUB_OAUTH_COOKIE,
      "/auth/github/callback",
    );
    const oauthState = await this.oauthStates.consume(
      OAuthFlow.GITHUB,
      state,
      browserBinding,
    );
    if (!code || !oauthState.codeVerifier) {
      throw new BadRequestException("GitHub authorization was not completed.");
    }

    const user = await this.githubOAuth.authenticate(
      code,
      oauthState.codeVerifier,
    );
    this.logger.log({ action: "github_login", userId: user.id });

    const token = this.auth.signToken(user);
    this.setAuthCookie(res, token);

    return res.redirect(this.getOAuthSuccessRedirectUrl());
  }

  @Get("/42/getUrl")
  @UseGuards(JwtAuthGuard)
  async getFortyTwoAuthUrl(
    @UserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const issued = await this.oauthStates.issue(OAuthFlow.FORTYTWO, userId);
    this.setOAuthBrowserCookie(
      res,
      FORTYTWO_OAUTH_COOKIE,
      issued.browserBinding,
      "/auth/42/callback",
    );

    const url = new URL("https://api.intra.42.fr/oauth/authorize");
    url.searchParams.set(
      "client_id",
      this.configService.getOrThrow<string>("FORTYTWO_CLIENT_ID"),
    );
    url.searchParams.set(
      "redirect_uri",
      this.configService.getOrThrow<string>("FORTYTWO_CALLBACK_URL"),
    );
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", issued.state);
    return url.toString();
  }

  @Get("/42/callback")
  @UseGuards(FortyTwoOAuthStateGuard, AuthGuard("42"))
  async fortyTwoCallback(
    @Req()
    request: FortyTwoOAuthRequest & {
      user: {
        fortyTwoAccount: {
          platformUserId: string;
          username: string;
          email: string;
          campusId: number | null;
          campusName: string | null;
        };
      };
    },
    @Res() res: Response,
  ) {
    try {
      const userId = request.oauthState.targetUserId as string;

      await this.socialAccountService.upsertSocialAccountForUser({
        userId,
        platform: SocialPlatform.FORTYTWO,
        platformUserId: request.user.fortyTwoAccount.platformUserId,
        username: request.user.fortyTwoAccount.username,
        campusId: request.user.fortyTwoAccount.campusId,
        campusName: request.user.fortyTwoAccount.campusName,
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
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    this.clearLegacyDomainCookie(res);

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private setOAuthBrowserCookie(
    res: Response,
    name: string,
    value: string,
    path: string,
  ): void {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";
    res.cookie(name, value, {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: isDevelopment ? "lax" : "none",
      path,
      maxAge: 10 * 60 * 1000,
    });
  }

  private clearOAuthBrowserCookie(
    res: Response,
    name: string,
    path: string,
  ): void {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";
    res.clearCookie(name, {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: isDevelopment ? "lax" : "none",
      path,
    });
  }

  private clearAuthCookie(res: Response): void {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    res.clearCookie(this.getAuthCookieName(), {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: "lax",
    });
    this.clearLegacyDomainCookie(res);
  }

  private getAuthCookieName(): string {
    return this.configService.get<string>("AUTH_COOKIE_NAME") || "token";
  }

  private clearLegacyDomainCookie(res: Response): void {
    const legacyDomain = this.configService.get<string>("AUTH_COOKIE_DOMAIN");
    if (!legacyDomain) return;

    const isDevelopment = this.configService.get("NODE_ENV") === "development";
    res.clearCookie(this.getAuthCookieName(), {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: "lax",
      domain: legacyDomain,
    });
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
