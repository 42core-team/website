import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IsNull, LessThan, LessThanOrEqual, Repository } from "typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import {
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_IDLE_TTL_MS,
  REFRESH_TOKEN_RETENTION_MS,
  REFRESH_TOKEN_ROTATION_GRACE_MS,
} from "./session.constants";

export interface IssuedRefreshToken {
  familyId: string;
  refreshToken: string;
}

export type RotationResult =
  /** Token exchanged for a successor; set both cookies. */
  | {
      status: "rotated";
      userId: string;
      familyId: string;
      refreshToken: string;
    }
  /** Multi-tab race within the grace window; issue a new access token only. */
  | { status: "grace"; userId: string; familyId: string }
  /** Missing, expired, revoked or reused token. */
  | { status: "rejected" };

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly tokens: Repository<RefreshTokenEntity>,
  ) {}

  /** Start a new token family (a session), e.g. on login. */
  async startFamily(userId: string): Promise<IssuedRefreshToken> {
    const session = await this.withLockedUser(userId, async (tokens) => {
      const familyId = randomUUID();
      const refreshToken = await this.issue(tokens, userId, familyId);
      return { familyId, refreshToken };
    });
    if (!session) throw new UnauthorizedException();
    return session;
  }

  async rotate(refreshToken: string): Promise<RotationResult> {
    // This lookup only identifies the lock owner. Re-read the token after
    // acquiring the lock: logout may have revoked it while we waited.
    const candidate = await this.findByToken(this.tokens, refreshToken);
    if (!candidate) return { status: "rejected" };

    return (
      (await this.withLockedUser<RotationResult>(
        candidate.userId,
        async (tokens) => {
          const row = await this.findByToken(tokens, refreshToken);
          const now = new Date();
          if (!row || row.revokedAt || row.expiresAt <= now) {
            return { status: "rejected" };
          }
          if (row.rotatedAt) return this.handleRotatedToken(tokens, row, now);

          // Claim and successor commit together. A failed insert rolls back
          // the claim; revocation cannot slip between these writes.
          await tokens.update({ id: row.id }, { rotatedAt: now });
          const successor = await this.issue(tokens, row.userId, row.familyId);
          return {
            status: "rotated",
            userId: row.userId,
            familyId: row.familyId,
            refreshToken: successor,
          };
        },
      )) ?? { status: "rejected" }
    );
  }

  private async handleRotatedToken(
    tokens: Repository<RefreshTokenEntity>,
    row: RefreshTokenEntity,
    now: Date,
  ): Promise<RotationResult> {
    if (
      now.getTime() - row.rotatedAt!.getTime() <
      REFRESH_TOKEN_ROTATION_GRACE_MS
    ) {
      return { status: "grace", userId: row.userId, familyId: row.familyId };
    }

    // Reuse after the grace window: assume theft and end the session.
    await this.revokeFamily(tokens, row.familyId);
    return { status: "rejected" };
  }

  /** Logout: revoke the session the presented token belongs to, if any. */
  async revokeFamilyOf(refreshToken: string): Promise<void> {
    const row = await this.findByToken(this.tokens, refreshToken);
    if (row) {
      await this.withLockedUser(row.userId, (tokens) =>
        this.revokeFamily(tokens, row.familyId),
      );
    }
  }

  /** "Log out everywhere": revoke every session of the user. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.withLockedUser(userId, (tokens) =>
      tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() }),
    );
  }

  /** Revoke only if this is still the GitHub grant that was checked. */
  async revokeAllForUserIfGithubTokenMatches(
    userId: string,
    githubAccessToken: string,
  ): Promise<boolean> {
    return (
      (await this.withLockedUser(userId, async (tokens, user) => {
        if (user.githubAccessToken !== githubAccessToken) return false;
        await tokens.update(
          { userId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return true;
      })) ?? false
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async deleteStaleTokens(): Promise<void> {
    const now = new Date();
    const retentionCutoff = new Date(
      now.getTime() - REFRESH_TOKEN_RETENTION_MS,
    );
    await this.tokens.delete({ expiresAt: LessThanOrEqual(now) });
    await this.tokens.delete({ revokedAt: LessThan(retentionCutoff) });
    await this.tokens.delete({ rotatedAt: LessThan(retentionCutoff) });
  }

  /**
   * All session mutations lock the same existing user row, across replicas.
   * Always acquire this lock before touching token rows to avoid deadlocks.
   * OAuth's user UPDATE takes the same row lock, so a grant check cannot
   * compare the old token and then revoke a family from a newer login.
   */
  private withLockedUser<T>(
    userId: string,
    work: (
      tokens: Repository<RefreshTokenEntity>,
      user: Pick<UserEntity, "id" | "githubAccessToken">,
    ) => Promise<T>,
  ): Promise<T | null> {
    return this.tokens.manager.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOne({
        select: { id: true, githubAccessToken: true },
        where: { id: userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!user) return null;
      return work(manager.getRepository(RefreshTokenEntity), user);
    });
  }

  private async revokeFamily(
    tokens: Repository<RefreshTokenEntity>,
    familyId: string,
  ): Promise<void> {
    await tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issue(
    tokens: Repository<RefreshTokenEntity>,
    userId: string,
    familyId: string,
  ): Promise<string> {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
    await tokens.save(
      tokens.create({
        userId,
        familyId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_IDLE_TTL_MS),
      }),
    );
    return refreshToken;
  }

  private findByToken(
    tokens: Repository<RefreshTokenEntity>,
    refreshToken: string,
  ) {
    return tokens.findOne({
      where: { tokenHash: this.hash(refreshToken) },
    });
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
