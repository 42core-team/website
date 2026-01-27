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

// Custom extractor to read JWT from an httpOnly cookie instead of the Authorization header
const cookieJwtExtractor = (req: Request): string | null => {
  if (!req) return null;
  // If you later decide to sign cookies with cookie-parser, you can switch to req.signedCookies
  const cookies: any = (req as any).cookies;
  if (!cookies) return null;
  const token = cookies["token"];
  return token || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {
    super({
      jwtFromRequest: cookieJwtExtractor,
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
