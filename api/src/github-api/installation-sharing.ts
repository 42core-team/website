import type { GithubInstallationEntity } from "./entities/github-installation.entity";

/** Whether any event creator may link the installation without the owner check. */
export function isSharedInstallation(
  installation: Pick<GithubInstallationEntity, "sharedAt" | "deletedAt"> | null,
): installation is GithubInstallationEntity {
  return !!installation?.sharedAt && !installation.deletedAt;
}
