import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import { TeamEntity } from "src/team/entities/team.entity";
import { GamblingRoundEntity } from "./gambling-round.entity";

@Entity("gambling_bets")
@Unique("UQ_gambling_bets_round_bettor", ["round", "bettorTeam"])
export class GamblingBetEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GamblingRoundEntity, {
    nullable: false,
    onDelete: "CASCADE",
  })
  round: GamblingRoundEntity;

  @ManyToOne(() => TeamEntity, { nullable: false, onDelete: "CASCADE" })
  bettorTeam: TeamEntity | null;

  @RelationId((bet: GamblingBetEntity) => bet.bettorTeam)
  bettorTeamId: string;

  @ManyToOne(() => TeamEntity, { nullable: false, onDelete: "CASCADE" })
  predictedWinner: TeamEntity | null;

  @RelationId((bet: GamblingBetEntity) => bet.predictedWinner)
  predictedWinnerId: string;

  @Column({ type: "int" })
  amount: number;

  @Column({ type: "int", default: 0 })
  payout: number;

  @CreateDateColumn()
  createdAt: Date;
}
