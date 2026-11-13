import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { GithubInstallationEntity } from "../../github-api/entities/github-installation.entity";
import { UserEntity } from "../../user/entities/user.entity";
import type { PresetSettingsDto } from "../dtos/preset-settings.dto";

/** A starter template as a preset stores it; copied into each new event. */
export interface PresetStarterTemplate {
  name: string;
  basePath: string;
  myCoreBotDockerImage: string;
}

/**
 * An admin-managed template of event settings. Creating an event copies the
 * values, so later edits do not change existing events.
 */
@Entity("event_presets")
@Unique("UQ_event_presets_name", ["name"])
@Index("UQ_event_presets_default", ["isDefault"], {
  unique: true,
  where: `"isDefault"`,
})
@Check(
  "CHK_event_presets_default_not_archived",
  `NOT ("isDefault" AND "archivedAt" IS NOT NULL)`,
)
export class EventPresetEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "PK_event_presets",
  })
  id: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  /** Used when a create request names no preset; at most one row. */
  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: "timestamptz", nullable: true })
  archivedAt: Date | null;

  /** Starts at 1 and grows with every change, for optimistic locking. */
  @Column({ type: "int", default: 1 })
  version: number;

  @Column({ type: "jsonb" })
  settings: PresetSettingsDto;

  @Column({ type: "jsonb", default: () => "'[]'" })
  starterTemplates: PresetStarterTemplate[];

  /** A shared installation that new events link. */
  @Column({ type: "uuid", nullable: true })
  githubInstallationId: string | null;

  @ManyToOne(() => GithubInstallationEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "githubInstallationId",
    foreignKeyConstraintName: "FK_event_presets_github_installation",
  })
  githubInstallation: GithubInstallationEntity | null;

  @Column({ type: "uuid", nullable: true })
  createdById: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "createdById",
    foreignKeyConstraintName: "FK_event_presets_created_by",
  })
  createdBy: UserEntity | null;

  @Column({ type: "uuid", nullable: true })
  updatedById: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "updatedById",
    foreignKeyConstraintName: "FK_event_presets_updated_by",
  })
  updatedBy: UserEntity | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
