import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  ValueTransformer,
} from "typeorm";
import { UserEntity } from "../../user/entities/user.entity";

/** Postgres returns bigint as a string; GitHub IDs stay well within Number.MAX_SAFE_INTEGER. */
const bigintToNumber: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** An installation of the CORE GitHub App on an organization. */
@Entity("github_installations")
@Unique("UQ_github_installations_installation_id", ["installationId"])
export class GithubInstallationEntity {
  @PrimaryGeneratedColumn("uuid", {
    primaryKeyConstraintName: "PK_github_installations",
  })
  id: string;

  @Column({ type: "bigint", transformer: bigintToNumber })
  installationId: number;

  @Column({ type: "bigint", transformer: bigintToNumber })
  accountId: number;

  /** The organization login; GitHub logins can change, so `accountId` is authoritative. */
  @Column()
  accountLogin: string;

  @Column()
  accountType: string;

  @Column({ type: "timestamptz", nullable: true })
  suspendedAt: Date | null;

  /** Set when the App is uninstalled; the row is kept so events can show why they lost access. */
  @Column({ type: "timestamptz", nullable: true })
  deletedAt: Date | null;

  /**
   * Set when a global admin shares the installation: any event creator may
   * then link it without owning its organization. Unsharing leaves linked
   * events as they are.
   */
  @Column({ type: "timestamptz", nullable: true })
  sharedAt: Date | null;

  @Column({ type: "uuid", nullable: true })
  sharedById: string | null;

  @ManyToOne(() => UserEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({
    name: "sharedById",
    foreignKeyConstraintName: "FK_github_installations_shared_by",
  })
  sharedBy: UserEntity | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
