import { RepositoryStatus, type TeamEntity } from "./entities/team.entity";

/** A team may enter new participant matches only with confirmed write access. */
export function isMatchmakingReady(
  team: Pick<TeamEntity, "repositoryStatus" | "locked">,
) {
  return team.repositoryStatus === RepositoryStatus.READY && !team.locked;
}
