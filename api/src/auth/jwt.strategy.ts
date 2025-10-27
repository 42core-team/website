import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";

export interface JwtPayload {
  sub: string; // user id
  email?: string;
  username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService, private users: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
