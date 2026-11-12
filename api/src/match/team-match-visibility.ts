// A match id opens its replay and details, so match lists give it only to
// members of a team that played in the match.
export function canViewTeamMatchReplay(
  viewerTeamId: string | undefined,
  matchTeamIds: string[],
): boolean {
  return viewerTeamId !== undefined && matchTeamIds.includes(viewerTeamId);
}
