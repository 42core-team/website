export interface ProfileRepo {
  name: string;
  url: string;
}

/**
 * A team's repository, only for viewers who are on the team: everyone else
 * has no access to it on GitHub, like on the team's own page.
 */
export function getVisibleRepo(
  team: { id: string; repo: string | null; event: { githubOrg: string } },
  viewerTeamIds: ReadonlySet<string>,
): ProfileRepo | null {
  if (!team.repo || !viewerTeamIds.has(team.id)) return null;
  return {
    name: team.repo,
    url: `https://github.com/${team.event.githubOrg}/${team.repo}`,
  };
}
