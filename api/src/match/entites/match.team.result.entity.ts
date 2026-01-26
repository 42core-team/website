import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TeamEntity } from "../../team/entities/team.entity";
import { MatchEntity } from "./match.entity";

@Entity("match_team_results")
export class MatchTeamResultEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => TeamEntity, { onDelete: "CASCADE" })
  team: TeamEntity;

  @ManyToOne(() => MatchEntity, (match) => match.results, {
    onDelete: "CASCADE",
  })
  match: MatchEntity;

  @Column()
  score: number;
}
