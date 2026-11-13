import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { UserEntity } from "./user.entity";
import { EventEntity } from "../../event/entities/event.entity";

export enum UserRole {
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
  PUBLIC_EVENT_CREATOR = "PUBLIC_EVENT_CREATOR",
  PRIVATE_EVENT_CREATOR = "PRIVATE_EVENT_CREATOR",
}

/** Roles that can be granted for a single event as well as globally. */
export const EVENT_SCOPED_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.MODERATOR,
];

/**
 * A role granted to a user, globally (eventId null) or for one event. The
 * migration declares the unique constraint NULLS NOT DISTINCT, so a global
 * role can be granted only once; TypeORM cannot express that here.
 */
@Entity("user_roles")
@Unique("UQ_user_roles_user_role_event", ["userId", "role", "eventId"])
@Check(
  "CHK_user_roles_event_scope",
  `"eventId" IS NULL OR "role" IN ('ADMIN', 'MODERATOR')`,
)
@Index("IDX_user_roles_event", ["eventId"])
export class UserRoleEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.roles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: UserEntity;

  @Column({ type: "enum", enum: UserRole, enumName: "user_role" })
  role: UserRole;

  @Column({ type: "uuid", nullable: true })
  eventId: string | null;

  @ManyToOne(() => EventEntity, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "eventId" })
  event: EventEntity | null;

  @Column({ type: "uuid", nullable: true })
  grantedById: string | null;

  @ManyToOne(() => UserEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "grantedById" })
  grantedBy: UserEntity | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
