import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Unique,
} from "typeorm";
import { EventEntity } from "./event.entity";

export enum WhitelistPlatform {
  GITHUB = "GITHUB",
  FORTYTWO = "FORTYTWO",
}

@Entity("event_whitelists")
@Unique(["event", "username", "platform"])
export class EventWhitelistEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "text" })
  platform: WhitelistPlatform;

  @Column()
  username: string;

  @ManyToOne(() => EventEntity, {
    onDelete: "CASCADE",
    nullable: false,
  })
  event: EventEntity;

  @CreateDateColumn()
  createdAt: Date;
}
