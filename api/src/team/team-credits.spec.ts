import { accrueQueueCredits, QUEUE_CREDIT_INTERVAL_MS } from "./team-credits";

describe("accrueQueueCredits", () => {
  const startedAt = new Date("2026-07-18T10:00:00.000Z");

  it("grants one credit for every complete interval", () => {
    const team = {
      credits: 0,
      lastCreditGrantedAt: startedAt,
    };

    const granted = accrueQueueCredits(
      team,
      new Date(startedAt.getTime() + QUEUE_CREDIT_INTERVAL_MS * 2 + 1),
    );

    expect(granted).toBe(2);
    expect(team.credits).toBe(2);
    expect(team.lastCreditGrantedAt).toEqual(
      new Date(startedAt.getTime() + QUEUE_CREDIT_INTERVAL_MS * 2),
    );
  });

  it("does not grant partial intervals", () => {
    const team = {
      credits: 0,
      lastCreditGrantedAt: startedAt,
    };

    expect(
      accrueQueueCredits(
        team,
        new Date(startedAt.getTime() + QUEUE_CREDIT_INTERVAL_MS - 1),
      ),
    ).toBe(0);
    expect(team.credits).toBe(0);
    expect(team.lastCreditGrantedAt).toEqual(startedAt);
  });

  it("preserves remainder time after granting credits", () => {
    const team = {
      credits: 3,
      lastCreditGrantedAt: startedAt,
    };

    expect(
      accrueQueueCredits(
        team,
        new Date(startedAt.getTime() + QUEUE_CREDIT_INTERVAL_MS * 2.5),
      ),
    ).toBe(2);
    expect(team.credits).toBe(5);
    expect(team.lastCreditGrantedAt).toEqual(
      new Date(startedAt.getTime() + QUEUE_CREDIT_INTERVAL_MS * 2),
    );
  });
});
