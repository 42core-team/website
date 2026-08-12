import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";

export enum OAuthFlow {
  GITHUB = "github",
  FORTYTWO = "42",
}

@Entity("oauth_states")
export class OAuthStateEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  stateHash: string;

  @Column({ type: "varchar", length: 64 })
  browserHash: string;

  @Column({ type: "varchar", length: 16 })
  flow: OAuthFlow;

  @Column({ type: "uuid", nullable: true })
  targetUserId: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  codeVerifier: string | null;

  @Column({ type: "timestamptz" })
  @Index("IDX_oauth_states_expires_at")
  expiresAt: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
