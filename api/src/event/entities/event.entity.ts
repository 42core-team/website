import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  UserEntity,
  UserEventPermissionEntity,
} from "src/user/entities/user.entity";
import { TeamEntity } from "src/team/entities/team.entity";
import { Exclude, Transform } from "class-transformer";
import { EventStarterTemplateEntity } from "./event-starter-template.entity";
import { EventWhitelistEntity } from "./event-whitelist.entity";
import { EventState } from "../event-lifecycle";
import { GithubInstallationEntity } from "../../github-api/entities/github-installation.entity";
import { EventPresetEntity } from "../../event-presets/entities/event-preset.entity";

@Entity("events")
export class EventEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ default: "" })
  description: string;

  @Column()
  githubOrg: string;

  /** The organizer's encrypted token; null for events that only use the GitHub App. */
  @Exclude()
  @Column({ type: "varchar", nullable: true })
  githubOrgSecret: string | null;

  @Exclude()
  @Column({ type: "uuid", nullable: true })
  @Index("IDX_events_github_installation_id")
  githubInstallationId: string | null;

  /** When set, the event uses the CORE GitHub App instead of `githubOrgSecret`. */
  @Exclude()
  @ManyToOne(() => GithubInstallationEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "githubInstallationId",
    foreignKeyConstraintName: "FK_events_github_installation",
  })
  githubInstallation: GithubInstallationEntity | null;

  @Column({ default: "" })
  location: string;

  @Column()
  minTeamSize: number;

  @Column()
  maxTeamSize: number;

  @Column({ type: "timestamp" })
  startDate: Date;

  @Column({ type: "enum", enum: EventState, default: EventState.REGISTRATION })
  state: EventState;

  @Column({ type: "timestamp" })
  submissionDeadline: Date;

  @Column({ type: "timestamp" })
  scheduledEndDate: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date | null;

  @Column({ default: false })
  introEnabled: boolean;

  @Column({ default: 15 })
  introLeadMinutes: number;

  @Column({ type: "varchar", nullable: true })
  streamUrl: string | null;

  /** Separate Showtime stream; when null, Showtime uses `streamUrl`. */
  @Column({ type: "varchar", nullable: true })
  showtimeStreamUrl: string | null;

  @Column({ type: "timestamp" })
  endDate: Date;

  @Column({ type: "timestamp", nullable: true })
  repoLockDate: Date | null;

  @Column({ default: true })
  canCreateTeam: boolean;

  @Column({ default: true })
  processQueue: boolean;

  @Column({ default: true })
  gamblingEnabled: boolean;

  @Column({ default: 5 })
  maxQueueCredits: number;

  @Column({ default: 15 })
  queueCreditIntervalMinutes: number;

  @Column({ type: "timestamp", nullable: true })
  lockedAt: Date | null;

  @Column({ default: 0 })
  currentRound: number;

  /** Most teams that may enter the elimination bracket; null means no limit. */
  @Column({ type: "int", nullable: true })
  tournamentAdvancementLimit: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  gameServerDockerImage: string;

  @Column({ nullable: true })
  myCoreBotDockerImage: string;

  @Column({ nullable: true })
  visualizerDockerImage: string;

  @Column({ nullable: true })
  monorepoUrl: string;

  @Column({ nullable: true, default: "dev" })
  monorepoVersion: string;

  @Column({ nullable: false, default: "my-core-bot" })
  basePath: string;

  @Column({ nullable: true })
  gameConfig: string;

  @Column({ nullable: true })
  serverConfig: string;

  @Column({ default: false })
  isPrivate: boolean;

  /** The preset the event was created from, for provenance only. */
  @Exclude()
  @Column({ type: "uuid", nullable: true })
  @Index("IDX_events_preset_id")
  presetId: string | null;

  /** Only its id and name are exposed. */
  @Transform(({ value }: { value: EventPresetEntity | null | undefined }) =>
    value ? { id: value.id, name: value.name } : value,
  )
  @ManyToOne(() => EventPresetEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "presetId",
    foreignKeyConstraintName: "FK_events_preset",
  })
  preset: EventPresetEntity | null;

  /** The preset's version when the event was created. */
  @Column({ type: "int", nullable: true })
  presetVersion: number | null;

  @Exclude()
  @JoinTable({ name: "events_users" })
  @ManyToMany(() => UserEntity, (user) => user.events, {
    onUpdate: "CASCADE",
    cascade: true,
  })
  users: UserEntity[];

  @OneToMany(() => TeamEntity, (team) => team.event, { onDelete: "CASCADE" })
  teams: TeamEntity[];

  @OneToMany(
    () => UserEventPermissionEntity,
    (permission) => permission.event,
    {
      onUpdate: "CASCADE",
      cascade: true,
    },
  )
  permissions: UserEventPermissionEntity[];

  @OneToMany(() => EventStarterTemplateEntity, (template) => template.event, {
    cascade: true,
  })
  starterTemplates: EventStarterTemplateEntity[];

  @OneToMany(() => EventWhitelistEntity, (whitelist) => whitelist.event, {
    onDelete: "CASCADE",
  })
  whitelists: EventWhitelistEntity[];
}
