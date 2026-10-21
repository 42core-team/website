import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decryptSecret } from "../common/encryption";
import { UserEntity } from "../user/entities/user.entity";
import { GithubSyncedProfile, UserService } from "../user/user.service";
import { BackgroundTasks } from "./background-tasks";
import { GithubGrantChecker, GithubProfile } from "./github-grant-checker";
import { RefreshTokenService } from "./refresh-token.service";
import { GITHUB_GRANT_CHECK_INTERVAL_MS } from "./session.constants";

type GrantUser = Pick<
  UserEntity,
  | "id"
  | "username"
  | "name"
  | "profilePicture"
  | "githubAccessToken"
  | "githubCheckedAt"
>;

/**
 * Ends a user's sessions once GitHub no longer accepts their stored OAuth
 * token, and keeps their GitHub profile in sync (ADR 0003).
 */
@Injectable()
export class GithubGrantService {
  private readonly logger = new Logger(GithubGrantService.name);

  constructor(
    private readonly checker: GithubGrantChecker,
    private readonly users: UserService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: ConfigService,
    private readonly tasks: BackgroundTasks,
  ) {}

  /**
   * Starts a grant check in the background when the last successful one is
   * older than the throttle interval. Never waits and never throws.
   */
  checkInBackground(user: GrantUser): void {
    const checkedAt = user.githubCheckedAt?.getTime();
    if (
      checkedAt !== undefined &&
      Date.now() - checkedAt < GITHUB_GRANT_CHECK_INTERVAL_MS
    ) {
      return;
    }
    this.tasks.run("github_grant_check", () => this.check(user));
  }

  private async check(user: GrantUser): Promise<void> {
    const token = this.decryptToken(user);
    if (!token) {
      this.logger.warn({
        action: "github_grant_check_skipped",
        userId: user.id,
        reason: "no usable stored GitHub token",
      });
      return;
    }

    const result = await this.checker.check(token);
    switch (result.status) {
      case "valid":
        await this.users.recordGithubCheck(
          user.id,
          new Date(),
          this.changedProfileFields(user, result.profile),
        );
        return;
      case "revoked": {
        // A login during the check stores a fresh token and starts a new
        // session; the 401 for the old token must not end that session.
        const revoked =
          await this.refreshTokens.revokeAllForUserIfGithubTokenMatches(
            user.id,
            user.githubAccessToken,
          );
        if (!revoked) {
          this.logger.log({
            action: "github_grant_revoke_skipped",
            userId: user.id,
            reason: "stored GitHub token changed during the check",
          });
          return;
        }
        this.logger.log({ action: "github_grant_revoked", userId: user.id });
        return;
      }
      case "unknown":
        this.logger.warn({
          action: "github_grant_check_failed",
          userId: user.id,
          reason: result.reason,
        });
        return;
    }
  }

  private decryptToken(user: GrantUser): string | null {
    if (!user.githubAccessToken) return null;
    try {
      return (
        decryptSecret(
          user.githubAccessToken,
          this.config.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
        ) || null
      );
    } catch {
      return null;
    }
  }

  private changedProfileFields(
    user: GrantUser,
    profile: GithubProfile,
  ): GithubSyncedProfile {
    const current: GithubSyncedProfile = {
      username: profile.login,
      name: profile.name || profile.login,
      profilePicture: profile.avatar_url || user.profilePicture,
    };
    const changed: GithubSyncedProfile = {};
    for (const key of Object.keys(current) as (keyof GithubSyncedProfile)[]) {
      if (current[key] !== user[key]) changed[key] = current[key];
    }
    return changed;
  }
}
