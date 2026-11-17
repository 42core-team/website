import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Exclude } from "class-transformer";
import { TeamEntity } from "../../team/entities/team.entity";
import { MatchTeamResultEntity } from "./match.team.result.entity";
import { MatchStatsEntity } from "./matchStats.entity";

export enum MatchState {
  PLANNED = "PLANNED",
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED",
}

export enum MatchPhase {
  SWISS = "SWISS",
  ELIMINATION = "ELIMINATION",
  QUEUE = "QUEUE",
  GAMBLING = "GAMBLING",
  MANUAL = "MANUAL",
}

@Entity("matches")
export class MatchEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: MatchState })
  state: MatchState;

  @Column()
  round: number;

  @ManyToOne(() => TeamEntity)
  winner: TeamEntity | null;

  @Column({ default: 0 })
  creditWager: number;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: "SET NULL" })
  creditWagerTeam: TeamEntity | null;

  // Set when the result arrives: the game server's team IDs are not kept, so
  // the side can't be worked out later. Null when it is unknown.
  @Column({ type: "uuid", nullable: true })
  leftTeamId: string | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "leftTeamId" })
  leftTeam?: TeamEntity | null;

  @Column({ type: "uuid", nullable: true })
  rightTeamId: string | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "rightTeamId" })
  rightTeam?: TeamEntity | null;

  @Column({ type: "enum", enum: MatchPhase, default: MatchPhase.SWISS })
  phase: MatchPhase;

  @ManyToMany(() => TeamEntity, (team) => team.matches)
  @JoinTable({ name: "matches_teams" })
  teams: TeamEntity[];

  @OneToMany(() => MatchTeamResultEntity, (result) => result.match, {
    cascade: true,
    onUpdate: "CASCADE",
  })
  results: MatchTeamResultEntity[];

  @Column({ default: false })
  isRevealed: boolean;

  // How often the match was flipped PLANNED -> IN_PROGRESS. The stale-match
  // cron stops restarting a match once this reaches MAX_START_ATTEMPTS.
  @Exclude()
  @Column({ type: "int", default: 0 })
  startAttempts: number;

  // When the current game run was started. Null for matches started before
  // this column existed; the stale-match cron never touches those. updatedAt
  // is no substitute: reveals also bump it.
  @Exclude()
  @Column({ type: "timestamptz", nullable: true })
  startedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => MatchStatsEntity, (stats) => stats.match, {
    cascade: true,
    onUpdate: "CASCADE",
    eager: true,
  })
  stats: MatchStatsEntity;
}
