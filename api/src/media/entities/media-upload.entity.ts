import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { TeamEntity } from "../../team/entities/team.entity";
import { UserEntity } from "../../user/entities/user.entity";

export type MediaKind = "picture" | "background";
export type MediaVariant = "small" | "large";

/** One stored variant, owned by either a team or a user. */
@Entity("media_uploads")
@Check("media_uploads_owner_check", '("teamId" IS NULL) <> ("userId" IS NULL)')
@Check("media_uploads_kind_check", "\"kind\" IN ('picture', 'background')")
@Check("media_uploads_variant_check", "\"variant\" IN ('small', 'large')")
@Check(
  "media_uploads_background_check",
  "\"kind\" <> 'background' OR \"variant\" = 'large'",
)
@Index("media_uploads_team_variant_unique", ["teamId", "kind", "variant"], {
  unique: true,
  where: '"teamId" IS NOT NULL',
})
@Index("media_uploads_user_variant_unique", ["userId", "kind", "variant"], {
  unique: true,
  where: '"userId" IS NOT NULL',
})
export class MediaUploadEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  teamId: string | null;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @ManyToOne(() => TeamEntity, (team) => team.mediaUploads, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "teamId" })
  team: TeamEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: UserEntity | null;

  @Column({ type: "varchar" })
  kind: MediaKind;

  @Column({ type: "varchar" })
  variant: MediaVariant;

  @Column({ unique: true })
  objectKey: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
