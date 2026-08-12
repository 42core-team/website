import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "node:crypto";
import { LessThanOrEqual, Repository } from "typeorm";
import { OAuthFlow, OAuthStateEntity } from "./entities/oauth-state.entity";

const STATE_TTL_MS = 10 * 60 * 1000;

export interface IssuedOAuthState {
  state: string;
  browserBinding: string;
  codeChallenge?: string;
}

@Injectable()
export class OAuthStateService {
  constructor(
    @InjectRepository(OAuthStateEntity)
    private readonly states: Repository<OAuthStateEntity>,
  ) {}

  async issue(
    flow: OAuthFlow,
    targetUserId: string | null = null,
    usePkce = false,
  ): Promise<IssuedOAuthState> {
    const state = randomBytes(32).toString("base64url");
    const browserBinding = randomBytes(32).toString("base64url");
    const codeVerifier = usePkce ? randomBytes(48).toString("base64url") : null;

    await this.states.delete({ expiresAt: LessThanOrEqual(new Date()) });
    await this.states.save(
      this.states.create({
        stateHash: this.hash(state),
        browserHash: this.hash(browserBinding),
        flow,
        targetUserId,
        codeVerifier,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      }),
    );

    return {
      state,
      browserBinding,
      codeChallenge: codeVerifier
        ? createHash("sha256").update(codeVerifier).digest("base64url")
        : undefined,
    };
  }

  async consume(
    flow: OAuthFlow,
    state: string | undefined,
    browserBinding: string | undefined,
  ): Promise<OAuthStateEntity> {
    if (!state || !browserBinding) {
      throw new BadRequestException("Invalid OAuth state.");
    }

    const result = await this.states
      .createQueryBuilder()
      .delete()
      .from(OAuthStateEntity)
      .where('"stateHash" = :stateHash', { stateHash: this.hash(state) })
      .andWhere('"browserHash" = :browserHash', {
        browserHash: this.hash(browserBinding),
      })
      .andWhere('"flow" = :flow', { flow })
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .returning("*")
      .execute();

    const consumed = (result.raw as OAuthStateEntity[])[0];
    if (!consumed) {
      throw new BadRequestException("Invalid or expired OAuth state.");
    }

    return consumed;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
