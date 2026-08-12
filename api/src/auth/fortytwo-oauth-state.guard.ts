import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { OAuthFlow, OAuthStateEntity } from "./entities/oauth-state.entity";
import { OAuthStateService } from "./oauth-state.service";

export const FORTYTWO_OAUTH_COOKIE = "oauth_42_browser";

export type FortyTwoOAuthRequest = Request & {
  oauthState: OAuthStateEntity;
};

@Injectable()
export class FortyTwoOAuthStateGuard implements CanActivate {
  constructor(
    private readonly oauthStates: OAuthStateService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FortyTwoOAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const state =
      typeof request.query.state === "string" ? request.query.state : undefined;
    const browserBinding = request.cookies?.[FORTYTWO_OAUTH_COOKIE] as
      string | undefined;

    this.clearCookie(response);
    const oauthState = await this.oauthStates.consume(
      OAuthFlow.FORTYTWO,
      state,
      browserBinding,
    );
    if (!oauthState.targetUserId) {
      throw new BadRequestException("Invalid OAuth state.");
    }

    request.oauthState = oauthState;
    return true;
  }

  private clearCookie(response: Response): void {
    response.clearCookie(FORTYTWO_OAUTH_COOKIE, {
      httpOnly: true,
      secure: this.config.get("NODE_ENV") !== "development",
      sameSite: this.config.get("NODE_ENV") === "development" ? "lax" : "none",
      path: "/auth/42/callback",
    });
  }
}
