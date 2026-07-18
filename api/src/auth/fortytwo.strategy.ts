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
  cursus_users?: { cursus?: { slug?: string } }[];
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
    _params: unknown,
    done: (err: Error | null, user?: unknown) => void,
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

      // 42 intra has no single "role" field; membership is derived from the
      // cursus slugs returned on the user's profile.
      const cursusSlugs = (data.cursus_users ?? [])
        .map((cu) => cu.cursus?.slug)
        .filter((slug): slug is string => !!slug);
      const isCursusStudent = cursusSlugs.includes("42cursus");
      // 42 never removes the old piscine cursus_user record once a student
      // progresses to 42cursus, so "piscine student" must exclude cursus students.
      const isPiscineStudent =
        cursusSlugs.includes("c-piscine") && !isCursusStudent;

      done(null, {
        fortyTwoAccount: {
          platformUserId,
          username,
          email,
          isCursusStudent,
          isPiscineStudent,
        },
      });
    } catch (err) {
      done(err instanceof Error ? err : new Error(String(err)), undefined);
    }
  }
}
