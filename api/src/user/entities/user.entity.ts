import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToMany,
  OneToMany,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";
import { EventEntity } from "../../event/entities/event.entity";
import { TeamEntity } from "../../team/entities/team.entity";
import { SocialAccountEntity } from "./social-account.entity";
import { Exclude } from "class-transformer";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  githubId: string;

  @Exclude()
  @Column()
  githubAccessToken: string;

  @Column()
  email: string;

  @Column()
  username: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  profilePicture: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Exclude()
  @ManyToMany(() => TeamEntity, (team) => team.users)
  teams: TeamEntity[];

  @Exclude()
  @ManyToMany(() => TeamEntity, (team) => team.teamInvites)
  teamInvites: TeamEntity[];

  @Exclude()
  @ManyToMany(() => EventEntity, (event) => event.users)
  events: EventEntity[];

  @OneToMany(() => SocialAccountEntity, (socialAccount) => socialAccount.user)
  socialAccounts: SocialAccountEntity[];

  @Exclude()
  @OneToMany(
    () => UserEventPermissionEntity,
    (permission: UserEventPermissionEntity) => permission.user,
  )
  permissions: UserEventPermissionEntity[];

  @Exclude()
  @Column({ default: false })
  canCreateEvent: boolean;
}

export enum PermissionRole {
  USER = "USER",
  ADMIN = "ADMIN",
}

@Entity("user_event_permissions")
export class UserEventPermissionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: PermissionRole, default: PermissionRole.USER })
  role: PermissionRole;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.permissions, {
    onDelete: "CASCADE",
  })
  user: UserEntity;

  @Exclude()
  @ManyToOne(() => EventEntity, (event: EventEntity) => event.permissions, {
    onDelete: "CASCADE",
  })
  event: EventEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
