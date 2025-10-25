import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { MatchEntity } from "./match.entity";

@Entity("match_stats")
export class MatchStatsEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => MatchEntity, (match) => match.stats, { onDelete: "CASCADE" })
  @JoinColumn()
  match: MatchEntity;

  @Column({ type: "int", default: 0 })
  actionsExecuted: number;

  @Column({ type: "int", default: 0 })
  damageDeposits: number;

  @Column({ type: "int", default: 0 })
  gempilesDestroyed: number;

  @Column({ type: "int", default: 0 })
  damageTotal: number;

  @Column({ type: "int", default: 0 })
  damageSelf: number;

  @Column({ type: "int", default: 0 })
  damageOpponent: number;

  @Column({ type: "int", default: 0 })
  damageUnits: number;

  @Column({ type: "int", default: 0 })
  damageCores: number;

  @Column({ type: "int", default: 0 })
  damageWalls: number;

  @Column({ type: "int", default: 0 })
  unitsSpawned: number;

  @Column({ type: "int", default: 0 })
  unitsDestroyed: number;

  @Column({ type: "int", default: 0 })
  coresDestroyed: number;

  @Column({ type: "int", default: 0 })
  wallsDestroyed: number;

  @Column({ type: "int", default: 0 })
  gemsTransferred: number;

  @Column({ type: "int", default: 0 })
  tilesTraveled: number;

  @Column({ type: "int", default: 0 })
  gemsGained: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
