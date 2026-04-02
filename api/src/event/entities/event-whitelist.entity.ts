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

  @Column({ type: "enum", enum: WhitelistPlatform })
  platform: WhitelistPlatform;

  @Column()
  username: string;

  @ManyToOne(() => EventEntity, {
    onDelete: "CASCADE",
  })
  event: EventEntity;

  @CreateDateColumn()
  createdAt: Date;
}
