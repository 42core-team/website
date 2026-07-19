import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
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
  bettorTeam: TeamEntity;

  @ManyToOne(() => TeamEntity, { nullable: false, onDelete: "CASCADE" })
  predictedWinner: TeamEntity;

  @Column({ type: "int" })
  amount: number;

  @Column({ type: "int", default: 0 })
  payout: number;

  @CreateDateColumn()
  createdAt: Date;
}
