import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { MatchEntity } from "../../match/entites/match.entity";
import { TeamEntity } from "./team.entity";

export enum TeamChallengeStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  CANCELLED = "CANCELLED",
}

@Entity("team_challenges")
export class TeamChallengeEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => TeamEntity, { onDelete: "CASCADE" })
  challenger: TeamEntity;

  @RelationId((challenge: TeamChallengeEntity) => challenge.challenger)
  challengerId: string;

  @ManyToOne(() => TeamEntity, { onDelete: "CASCADE" })
  target: TeamEntity;

  @RelationId((challenge: TeamChallengeEntity) => challenge.target)
  targetId: string;

  @Column({ type: "enum", enum: TeamChallengeStatus })
  status: TeamChallengeStatus;

  @ManyToOne(() => MatchEntity, { nullable: true, onDelete: "SET NULL" })
  match: MatchEntity | null;

  @RelationId((challenge: TeamChallengeEntity) => challenge.match)
  matchId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true, type: "timestamp" })
  respondedAt: Date | null;
}
