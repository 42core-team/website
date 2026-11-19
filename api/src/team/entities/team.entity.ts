import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { EventEntity } from "src/event/entities/event.entity";
import { UserEntity } from "src/user/entities/user.entity";
import { MatchEntity } from "src/match/entites/match.entity";
import { EventStarterTemplateEntity } from "src/event/entities/event-starter-template.entity";
import { Exclude } from "class-transformer";

import { EagerMediaArtwork } from "../../media/entities/media-artwork-columns";

export enum RepositoryStatus {
  PENDING = "PENDING",
  PROVISIONING = "PROVISIONING",
  READY = "READY",
  LOCKING = "LOCKING",
  LOCKED = "LOCKED",
  UNLOCKING = "UNLOCKING",
  FAILED = "FAILED",
}

@Entity("teams")
export class TeamEntity extends EagerMediaArtwork {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ default: false })
  locked: boolean;

  @Column({ type: "varchar", default: RepositoryStatus.PENDING })
  repositoryStatus: RepositoryStatus;

  @Column({ type: "uuid", nullable: true })
  repositoryOperationId: string | null;

  @Column({ type: "text", nullable: true })
  repositoryError: string | null;

  @Column({ default: false })
  tournamentExcluded: boolean;

  @Column({ nullable: true })
  repo: string;

  @Column({ nullable: true, type: "timestamp" })
  startedRepoCreationAt: Date | null;

  @Column({ default: 0 })
  score: number;

  @Column({ default: 0 })
  buchholzPoints: number;

  @Exclude()
  @Column({ default: 1000 })
  queueScore: number;

  @Column({ default: 0 })
  credits: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastCreditGrantedAt: Date;

  @Exclude()
  @ManyToOne(() => EventEntity, (event) => event.teams)
  event: EventEntity;

  @RelationId((team: TeamEntity) => team.event)
  eventId: string;

  @ManyToOne(() => EventStarterTemplateEntity, { nullable: true })
  starterTemplate: EventStarterTemplateEntity;

  @JoinTable({ name: "teams_users" })
  @ManyToMany(() => UserEntity, (user) => user.teams)
  users: UserEntity[];

  @ManyToMany(() => MatchEntity, (match) => match.teams)
  matches: MatchEntity[];

  @Column({ default: false })
  hadBye: boolean;

  @JoinTable({ name: "teams_invites_users" })
  @ManyToMany(() => UserEntity, (user) => user.teamInvites)
  teamInvites: UserEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
