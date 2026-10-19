import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IsNull, LessThan, LessThanOrEqual, Repository } from "typeorm";
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
    const familyId = randomUUID();
    const refreshToken = await this.issue(userId, familyId);
    return { familyId, refreshToken };
  }

  async rotate(refreshToken: string): Promise<RotationResult> {
    const row = await this.findByToken(refreshToken);
    const now = new Date();
    if (!row || row.revokedAt || row.expiresAt <= now) {
      return { status: "rejected" };
    }
    if (row.rotatedAt) return this.handleRotatedToken(row, row.rotatedAt, now);

    // Conditional update so that two concurrent refreshes with the same
    // token cannot both mint a successor; the loser falls into the grace path.
    const claimed = await this.tokens.update(
      { id: row.id, rotatedAt: IsNull() },
      { rotatedAt: now },
    );
    if (!claimed.affected) {
      return this.handleRotatedToken(row, now, now);
    }

    let successor: string;
    try {
      successor = await this.issue(row.userId, row.familyId);
    } catch (error) {
      // Release the claim: otherwise the client's next retry (after the grace
      // window) would look like reuse and kill the whole session.
      await this.tokens.update({ id: row.id }, { rotatedAt: null });
      throw error;
    }

    return {
      status: "rotated",
      userId: row.userId,
      familyId: row.familyId,
      refreshToken: successor,
    };
  }

  private async handleRotatedToken(
    row: RefreshTokenEntity,
    rotatedAt: Date,
    now: Date,
  ): Promise<RotationResult> {
    if (now.getTime() - rotatedAt.getTime() < REFRESH_TOKEN_ROTATION_GRACE_MS) {
      return { status: "grace", userId: row.userId, familyId: row.familyId };
    }

    // Reuse after the grace window: assume theft and end the session.
    await this.revokeFamily(row.familyId);
    return { status: "rejected" };
  }

  /** Logout: revoke the session the presented token belongs to, if any. */
  async revokeFamilyOf(refreshToken: string): Promise<void> {
    const row = await this.findByToken(refreshToken);
    if (row) await this.revokeFamily(row.familyId);
  }

  /** "Log out everywhere": revoke every session of the user. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
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

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issue(userId: string, familyId: string): Promise<string> {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
    await this.tokens.save(
      this.tokens.create({
        userId,
        familyId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_IDLE_TTL_MS),
      }),
    );
    return refreshToken;
  }

  private findByToken(refreshToken: string) {
    return this.tokens.findOne({
      where: { tokenHash: this.hash(refreshToken) },
    });
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
