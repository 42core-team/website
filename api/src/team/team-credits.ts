export const QUEUE_CREDIT_INTERVAL_MS = 15 * 60 * 1000;

interface CreditAccruingTeam {
  credits: number;
  lastCreditGrantedAt: Date;
}

export function accrueQueueCredits(
  team: CreditAccruingTeam,
  now: Date = new Date(),
): number {
  const elapsed = now.getTime() - team.lastCreditGrantedAt.getTime();
  const intervals = Math.floor(elapsed / QUEUE_CREDIT_INTERVAL_MS);
  if (intervals <= 0) return 0;

  team.credits += intervals;
  team.lastCreditGrantedAt = new Date(
    team.lastCreditGrantedAt.getTime() + intervals * QUEUE_CREDIT_INTERVAL_MS,
  );
  return intervals;
}
