import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  UserEntity,
  UserEventPermissionEntity,
} from "../../user/entities/user.entity";
import { TeamEntity } from "../../team/entities/team.entity";
import { Exclude } from "class-transformer";

export enum EventState {
  TEAM_FINDING = "TEAM_FINDING",
  CODING_PHASE = "CODING_PHASE",
  SWISS_ROUND = "SWISS_ROUND",
  ELIMINATION_ROUND = "ELIMINATION_ROUND",
  FINISHED = "FINISHED",
}

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

  @Exclude()
  @Column()
  githubOrgSecret: string;

  @Column({ default: "" })
  location: string;

  @Column()
  minTeamSize: number;

  @Column()
  maxTeamSize: number;

  @Column({ type: "timestamp" })
  startDate: Date;

  @Column({ type: "timestamp" })
  endDate: Date;

  @Column({ type: "timestamp", nullable: true })
  repoLockDate: Date | null;

  @Column({default: true})
  canCreateTeam: boolean;

  @Column({default: true})
  processQueue: boolean;

  @Column({type: "timestamp", nullable: true})
  lockedAt: Date | null;

  @Column({ type: "enum", enum: EventState, default: EventState.CODING_PHASE })
  state: EventState;

  @Column({ default: 0 })
  currentRound: number;

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

  @Column({ default: false })
  isPrivate: boolean;

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
}
