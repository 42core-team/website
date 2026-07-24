export function getMaximumGamblingBet(
  currentCredits: number,
  maxCredits: number,
) {
  return Math.max(0, currentCredits + maxCredits);
}
