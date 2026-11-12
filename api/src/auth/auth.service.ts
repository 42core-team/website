import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserEntity } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import { GithubGrantService } from "./github-grant.service";
import { JwtPayload } from "./jwt.strategy";
import { RefreshTokenService } from "./refresh-token.service";
import { ACCESS_TOKEN_TTL_MS } from "./session.constants";

type SessionUser = Pick<UserEntity, "id" | "email" | "username">;

export interface SessionTokens {
  accessToken: string;
  /** Present when a (new) refresh token must be set. */
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly users: UserService,
    private readonly githubGrant: GithubGrantService,
  ) {}

  /** Login: start a new session (token family) for the user. */
  async startSession(user: SessionUser): Promise<Required<SessionTokens>> {
    const { familyId, refreshToken } = await this.refreshTokens.startFamily(
      user.id,
    );
    return { accessToken: this.signAccessToken(user, familyId), refreshToken };
  }

  /**
   * Exchange a refresh token for new session tokens. Returns null when the
   * session cannot be continued (the caller must clear both cookies).
   */
  async refreshSession(
    refreshToken: string | undefined,
  ): Promise<SessionTokens | null> {
    if (!refreshToken) return null;

    const result = await this.refreshTokens.rotate(refreshToken);
    if (result.status === "rejected") return null;

    // Re-check the user exactly like JwtStrategy.validate does.
    const user = await this.users.getUserById(result.userId).catch(() => null);
    if (!user) return null;

    // The grace path only follows a rotation that was just checked.
    if (result.status === "rotated") this.githubGrant.checkInBackground(user);

    return {
      accessToken: this.signAccessToken(user, result.familyId),
      refreshToken:
        result.status === "rotated" ? result.refreshToken : undefined,
    };
  }

  /** Logout: revoke the session the refresh token belongs to, if any. */
  async endSession(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.refreshTokens.revokeFamilyOf(refreshToken);
  }

  /** "Log out everywhere": revoke all of the user's sessions. */
  async endAllSessions(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  private signAccessToken(user: SessionUser, familyId: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      fid: familyId,
    };
    return this.jwt.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
    });
  }
}
