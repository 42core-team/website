import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { UserEntity } from "../../user/entities/user.entity";

@Entity("refresh_tokens")
@Unique("UQ_refresh_tokens_token_hash", ["tokenHash"])
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "PK_refresh_tokens",
  })
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({
    name: "userId",
    foreignKeyConstraintName: "FK_refresh_tokens_user",
  })
  user: UserEntity;

  @Column({ type: "uuid" })
  @Index("IDX_refresh_tokens_user_id")
  userId: string;

  /** The family is the session: every rotation of one login shares it. */
  @Column({ type: "uuid" })
  @Index("IDX_refresh_tokens_family_id")
  familyId: string;

  /** SHA-256 hex of the opaque token; the token itself is never stored. */
  @Column({ type: "varchar", length: 64 })
  tokenHash: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  rotatedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
