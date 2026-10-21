import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { UserService } from "../user/user.service";
import { getAuthCookieName } from "./session.constants";

export interface JwtPayload {
  sub: string; // user id
  email?: string;
  username?: string;
  /** Refresh token family (session) id; absent on legacy 30-day JWTs. */
  fid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {
    const cookieName = getAuthCookieName(config);

    super({
      jwtFromRequest: (req: Request) => {
        if (!req) return null;
        const cookies = (req as Request & { cookies: Record<string, string> })
          .cookies;
        if (!cookies) return null;
        return cookies[cookieName] || null;
      },
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;
    if (!userId) throw new UnauthorizedException();
    // Legacy tokens without a family id must be exchanged via /auth/refresh.
    if (!payload.fid) throw new UnauthorizedException();
    // Load current user; if missing, reject token
    const user = await this.users.getUserById(userId).catch(() => null);
    if (!user) throw new UnauthorizedException();
    return user; // attaches to request.user
  }
}
