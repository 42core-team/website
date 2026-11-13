import type { GithubInstallationEntity } from "./entities/github-installation.entity";

/** Whether any event creator may link the installation without the owner check. */
export function isSharedInstallation(
  installation: Pick<
    GithubInstallationEntity,
    "sharedAt" | "deletedAt" | "suspendedAt"
  > | null,
): installation is GithubInstallationEntity & { sharedAt: Date } {
  return (
    !!installation?.sharedAt &&
    !installation.deletedAt &&
    !installation.suspendedAt
  );
}
