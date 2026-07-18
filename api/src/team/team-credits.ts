export const QUEUE_CREDIT_INTERVAL_MS = 15 * 60 * 1000;

interface CreditAccruingTeam {
  credits: number;
  lastCreditGrantedAt: Date;
}

export function accrueQueueCredits(
  team: CreditAccruingTeam,
  maxCredits: number,
  creditIntervalMs: number,
  now: Date = new Date(),
): number {
  team.credits = Math.min(team.credits, maxCredits);
  const elapsed = now.getTime() - team.lastCreditGrantedAt.getTime();
  const intervals = Math.floor(elapsed / creditIntervalMs);
  if (intervals <= 0) return 0;

  const granted = Math.min(intervals, Math.max(0, maxCredits - team.credits));
  team.credits += granted;
  team.lastCreditGrantedAt = new Date(
    team.lastCreditGrantedAt.getTime() + intervals * creditIntervalMs,
  );
  return granted;
}
