interface GamblingBetSummarySource {
  predictedWinnerId: string;
  amount: number;
  payout: number;
}

export function toGamblingBetSummary(bet: GamblingBetSummarySource) {
  return {
    predictedWinnerId: bet.predictedWinnerId,
    amount: bet.amount,
    payout: bet.payout,
  };
}

export function toSettledGamblingBetSummary(
  bet: GamblingBetSummarySource,
  winnerId: string | null,
) {
  return {
    ...toGamblingBetSummary(bet),
    net: bet.payout - bet.amount,
    wasCorrect: bet.predictedWinnerId === winnerId,
  };
}
