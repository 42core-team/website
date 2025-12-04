import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";
import { SocialAccountService } from "../user/social-account.service";
import { Strategy } from "passport-oauth2";

interface FortyTwoProfile {
  id: number;
  login: string;
  email: string | null;
  image_url: string | null;
  displayname: string | null;
}

@Injectable()
export class FortyTwoOAuthStrategy extends PassportStrategy(Strategy, "42") {
  constructor(
    config: ConfigService,
    private readonly users: UserService,
    private readonly socialAccounts: SocialAccountService,
  ) {
    super({
      authorizationURL: "https://api.intra.42.fr/oauth/authorize",
      tokenURL: "https://api.intra.42.fr/oauth/token",
      clientID: config.getOrThrow<string>("FORTYTWO_CLIENT_ID"),
      clientSecret: config.getOrThrow<string>("FORTYTWO_CLIENT_SECRET"),
      callbackURL: config.getOrThrow<string>("FORTYTWO_CALLBACK_URL"),
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    _params: any,
    done: (err: any, user?: any) => void,
  ) {
    try {
      const res = await fetch("https://api.intra.42.fr/v2/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        console.error("42 API error:", res.status, await res.text());
        return done(new Error(`42 API error: ${res.status}`));
      }
      const data = (await res.json()) as FortyTwoProfile;

      const platformUserId = String(data.id);
      const username = data.login;
      const email = data.email ?? undefined;

      done(null, {
        fortyTwoAccount: {
          platformUserId,
          username,
          email,
        },
      });
    } catch (err) {
      done(err, undefined);
    }
  }
}
