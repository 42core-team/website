import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

export type MediaKind = "picture" | "background";
export type MediaVariant = "small" | "large";

/** One stored media object variant. */
@Entity("media_uploads")
export class MediaUploadEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  objectKey: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
