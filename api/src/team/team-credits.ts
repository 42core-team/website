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
  if (team.credits >= maxCredits) return 0;

  const elapsed = now.getTime() - team.lastCreditGrantedAt.getTime();
  const intervals = Math.floor(elapsed / creditIntervalMs);
  if (intervals <= 0) return 0;

  const granted = Math.min(intervals, maxCredits - team.credits);
  team.credits += granted;
  team.lastCreditGrantedAt = new Date(
    team.lastCreditGrantedAt.getTime() + granted * creditIntervalMs,
  );
  return granted;
}

export function spendQueueCredits(
  team: CreditAccruingTeam,
  credits: number,
  maxCredits: number,
  now: Date = new Date(),
): void {
  const wasFull = team.credits >= maxCredits;
  team.credits -= credits;

  if (wasFull && team.credits < maxCredits) team.lastCreditGrantedAt = now;
}
