import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy } from "passport-oauth2";

export interface FortyTwoProfile {
  id: number;
  login: string;
  email: string | null;
  image_url: string | null;
  displayname: string | null;
  campus?: Array<{ id: number; name: string }>;
  campus_users?: Array<{ campus_id: number; is_primary: boolean }>;
}

export function getPrimaryCampus(profile: FortyTwoProfile): {
  campusId: number | null;
  campusName: string | null;
} {
  const primaryCampusUser = profile.campus_users?.find(
    (campusUser) => campusUser.is_primary,
  );
  const primaryCampus = profile.campus?.find(
    (campus) => campus.id === primaryCampusUser?.campus_id,
  );

  return primaryCampus
    ? { campusId: primaryCampus.id, campusName: primaryCampus.name }
    : { campusId: null, campusName: null };
}

@Injectable()
export class FortyTwoOAuthStrategy extends PassportStrategy(Strategy, "42") {
  constructor(config: ConfigService) {
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
      const primaryCampus = getPrimaryCampus(data);

      done(null, {
        fortyTwoAccount: {
          platformUserId,
          username,
          email,
          ...primaryCampus,
        },
      });
    } catch (err) {
      done(err instanceof Error ? err : new Error(String(err)), undefined);
    }
  }
}
