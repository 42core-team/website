import {MatchPhase} from "src/match/entites/match.entity";

type TeamMatchVisibility = {
  phase: string;
  isRevealed: boolean;
};

export function canViewTeamMatchReplay(
  match: TeamMatchVisibility,
  isTeamMember: boolean,
): boolean {
  if (match.phase === MatchPhase.QUEUE) return isTeamMember;

  return match.isRevealed;
}
