import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy as GitHubStrategy, Profile } from "passport-github2";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../user/user.service";

@Injectable()
export class GithubOAuthStrategy extends PassportStrategy(
  GitHubStrategy,
  "github",
) {
  constructor(
    config: ConfigService,
    private readonly users: UserService,
  ) {
    super({
      clientID: config.getOrThrow<string>("CLIENT_GITHUB_ID"),
      clientSecret: config.getOrThrow<string>("CLIENT_GITHUB_SECRET"),
      callbackURL: config.getOrThrow<string>("CALLBACK_GITHUB_URL"),
      scope: ["user:email", "repo:invite"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    try {
      const githubId = profile.id;
      const email = profile.emails?.[0]?.value;
      const username =
        profile.username || profile.displayName || email || githubId;
      const name = profile.displayName || username;
      const profilePicture = profile.photos?.[0]?.value;

      let user = await this.users.getUserByGithubId(githubId);

      if (user) {
        await this.users.updateUser(
          user.id,
          email || user.email,
          username || user.username,
          name || user.name,
          profilePicture || user.profilePicture,
          githubId,
          accessToken,
        );
        user = await this.users.getUserById(user.id);
      } else {
        user = await this.users.createUser(
          email || `${githubId}@users.noreply.github.com`,
          username,
          name,
          profilePicture,
          githubId,
          accessToken,
          false,
        );
      }

      done(null, user);
    } catch (err) {
      done(err, undefined);
    }
  }
}
