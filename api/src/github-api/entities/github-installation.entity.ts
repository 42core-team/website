import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from "typeorm";

/** Postgres returns bigint as a string; GitHub IDs stay well within Number.MAX_SAFE_INTEGER. */
const bigintToNumber: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** An installation of the CORE GitHub App on an organization. */
@Entity("github_installations")
export class GithubInstallationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "bigint", unique: true, transformer: bigintToNumber })
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

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
