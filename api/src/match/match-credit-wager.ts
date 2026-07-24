interface CreditWagerMatch {
  creditWager: number;
  creditWagerTeam: { id: string } | null;
}

export function getCreditWagerRefund(
  match: CreditWagerMatch,
  winnerId: string,
): number {
  return match.creditWagerTeam?.id === winnerId ? match.creditWager : 0;
}
