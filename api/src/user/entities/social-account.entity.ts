import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Unique,
} from "typeorm";
import { UserEntity } from "./user.entity";

export enum SocialPlatform {
  FORTYTWO = "42",
}

export const SOCIAL_ACCOUNT_PLATFORM_USER_ID_UNIQUE_CONSTRAINT =
  "UQ_social_accounts_platform_platform_user_id";

@Entity("social_accounts")
@Unique(["userId", "platform"]) // Ensure one account per platform per user
@Unique(SOCIAL_ACCOUNT_PLATFORM_USER_ID_UNIQUE_CONSTRAINT, [
  "platform",
  "platformUserId",
])
export class SocialAccountEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: SocialPlatform })
  platform: SocialPlatform;

  @Column()
  username: string; // Username from the social platform

  @Column()
  platformUserId: string; // User ID from the social platform

  @Column()
  userId: string; // Reference to our user

  @Column({ default: false })
  isPiscineStudent: boolean; // 42 intra: enrolled in a piscine cursus

  @Column({ default: false })
  isCursusStudent: boolean; // 42 intra: enrolled in the 42cursus

  @ManyToOne(() => UserEntity, (user) => user.socialAccounts, {
    onDelete: "CASCADE",
  })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
