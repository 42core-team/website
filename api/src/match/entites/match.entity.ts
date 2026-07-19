import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
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
