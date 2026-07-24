export const WINNING_TEAM_PERCENT = 20;

export interface GamblingPayoutBet {
  id: string;
  amount: number;
  predictedWinnerId: string;
}

export function calculateGamblingPayouts(
  bets: GamblingPayoutBet[],
  winnerId: string,
) {
  const totalPool = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const winningBets = bets.filter((bet) => bet.predictedWinnerId === winnerId);
  const winningStake = winningBets.reduce((sum, bet) => sum + bet.amount, 0);
  const payouts = new Map<string, number>();

  if (winningStake === 0) {
    return { totalPool, winnerTeamPayout: totalPool, payouts };
  }

  const baseWinnerTeamPayout = Math.floor(
    (totalPool * WINNING_TEAM_PERCENT) / 100,
  );
  const bettorPool = totalPool - baseWinnerTeamPayout;
  let paidToBettors = 0;

  for (const bet of winningBets) {
    const payout = Math.floor((bettorPool * bet.amount) / winningStake);
    payouts.set(bet.id, payout);
    paidToBettors += payout;
  }

  return {
    totalPool,
    winnerTeamPayout: totalPool - paidToBettors,
    payouts,
  };
}
