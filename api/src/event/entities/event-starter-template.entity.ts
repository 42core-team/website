import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { EventEntity } from "./event.entity";
import { Exclude } from "class-transformer";

@Entity("event_starter_templates")
export class EventStarterTemplateEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  basePath: string;

  @Column()
  myCoreBotDockerImage: string;

  @Exclude()
  @ManyToOne(() => EventEntity, (event) => event.starterTemplates, {
    onDelete: "CASCADE",
  })
  event: EventEntity;
}
