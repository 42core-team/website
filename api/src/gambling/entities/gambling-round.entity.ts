import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { EventEntity } from "../../event/entities/event.entity";
import { MatchEntity } from "../../match/entites/match.entity";
import { TeamEntity } from "../../team/entities/team.entity";

export enum GamblingRoundPhase {
  JOINING = "JOINING",
  BETTING = "BETTING",
  PLAYING = "PLAYING",
  SETTLED = "SETTLED",
}

@Entity("gambling_rounds")
export class GamblingRoundEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => EventEntity, { nullable: false, onDelete: "CASCADE" })
  event: EventEntity;

  @Column({ type: "enum", enum: GamblingRoundPhase })
  phase: GamblingRoundPhase;

  @Column({ type: "timestamp", nullable: true })
  phaseEndsAt: Date | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: "SET NULL" })
  teamOne: TeamEntity | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: "SET NULL" })
  teamTwo: TeamEntity | null;

  @ManyToOne(() => MatchEntity, { nullable: true, onDelete: "SET NULL" })
  match: MatchEntity | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: "SET NULL" })
  winner: TeamEntity | null;

  @Column({ type: "int", default: 0 })
  totalPool: number;

  @Column({ type: "int", default: 0 })
  winnerTeamPayout: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
