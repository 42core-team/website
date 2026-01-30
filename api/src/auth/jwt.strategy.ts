import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { UserService } from "../user/user.service";

export interface JwtPayload {
  sub: string; // user id
  email?: string;
  username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {
    const cookieName = config.get<string>("AUTH_COOKIE_NAME") || "token";

    super({
      jwtFromRequest: (req: Request) => {
        if (!req) return null;
        const cookies: any = (req as any).cookies;
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
    // Load current user; if missing, reject token
    const user = await this.users.getUserById(userId).catch(() => null);
    if (!user) throw new UnauthorizedException();
    return user; // attaches to request.user
  }
}
