import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EventEntity } from "../../event/entities/event.entity";
import { TeamEntity } from "../../team/entities/team.entity";

@Entity("gambling_entries")
@Unique("UQ_gambling_entries_event_team", ["event", "team"])
export class GamblingEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => EventEntity, { nullable: false, onDelete: "CASCADE" })
  event: EventEntity;

  @ManyToOne(() => TeamEntity, { nullable: false, onDelete: "CASCADE" })
  team: TeamEntity;

  @CreateDateColumn()
  createdAt: Date;
}
