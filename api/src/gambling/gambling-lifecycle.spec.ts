jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { EventEntity } from "../event/entities/event.entity";
import { EventState } from "../event/event-lifecycle";
import { GamblingService } from "./gambling.service";
import { GamblingRoundPhase } from "./entities/gambling-round.entity";

function setup() {
  const event = Object.assign(new EventEntity(), {
    state: EventState.PLAYING,
    startDate: new Date(Date.now() - 10000),
    submissionDeadline: new Date(Date.now() + 10000),
    scheduledEndDate: new Date(Date.now() - 1000),
    gamblingEnabled: true,
    maxQueueCredits: 5,
  });
  const round = {
    id: "round",
    event,
    phase: GamblingRoundPhase.BETTING,
    phaseEndsAt: new Date(Date.now() + 10000),
    teamOne: { id: "one" },
    teamTwo: { id: "two" },
  };
  const team = { id: "bettor", credits: 5 };
  const manager = {
    query: jest.fn(),
    findOne: jest.fn().mockResolvedValue(team),
    findOneOrFail: jest
      .fn()
      .mockImplementation((entity) =>
        Promise.resolve(entity === EventEntity ? event : team),
      ),
    exists: jest.fn().mockResolvedValue(false),
    save: jest.fn(),
  };
  const transaction = jest.fn(
    async (callback: (value: typeof manager) => Promise<void>) =>
      callback(manager),
  );
  const service = Object.create(GamblingService.prototype) as GamblingService;
  Object.assign(service, {
    dataSource: { manager, transaction },
    advanceEvent: jest.fn(),
    getLatestRoundWithManager: jest.fn().mockResolvedValue(round),
  });
  const bet = () =>
    service.placeBet("event", "user", { predictedWinnerId: "one", amount: 1 });
  return { event, manager, transaction, bet, team, service, round };
}

describe("betting lifecycle mutation gate", () => {
  it.each([
    EventState.SUBMISSIONS_CLOSED,
    EventState.SHOWCASE,
    EventState.COMPLETED,
  ])("keeps the gambling snapshot viewable in %s", async (state) => {
    const { event, service, round } = setup();
    event.state = state;
    Object.assign(service, {
      getLatestRound: jest.fn().mockResolvedValue(round),
      getLatestSettledRound: jest.fn().mockResolvedValue(null),
      entryRepository: { find: jest.fn().mockResolvedValue([]) },
      betRepository: { find: jest.fn().mockResolvedValue([]) },
    });
    const snapshot = await service.getSnapshot("event", "user");
    expect(snapshot.round.id).toBe("round");
    expect(snapshot.myTeam.credits).toBe(5);
  });
  it.each([
    EventState.SUBMISSIONS_CLOSED,
    EventState.SHOWCASE,
    EventState.COMPLETED,
  ])("blocks bets in %s", async (state) => {
    const { event, manager, bet } = setup();
    event.state = state;
    await expect(bet()).rejects.toThrow("only available");
    expect(manager.save).not.toHaveBeenCalled();
  });

  it("rechecks the deadline inside the mutation transaction", async () => {
    const { event, manager, transaction, bet } = setup();
    transaction.mockImplementation(async (callback) => {
      event.submissionDeadline = new Date(Date.now() - 1);
      return callback(manager);
    });
    await expect(bet()).rejects.toThrow("only available");
    expect(manager.save).not.toHaveBeenCalled();
  });

  it("allows reopening without resetting credits, regardless of scheduled end", async () => {
    const { event, manager, bet, team } = setup();
    event.state = EventState.SUBMISSIONS_CLOSED;
    await expect(bet()).rejects.toThrow("only available");
    event.state = EventState.PLAYING;
    await bet();
    expect(team.credits).toBe(4);
    expect(manager.save).toHaveBeenCalledTimes(2);
  });

  it("still honors gamblingEnabled while playing", async () => {
    const { event, manager, bet } = setup();
    event.gamblingEnabled = false;
    await expect(bet()).rejects.toThrow("disabled");
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe("gambling entry and match scheduling lifecycle gate", () => {
  function readyTeam(id: string) {
    return { id, repositoryStatus: "READY", locked: false };
  }

  function expiredBettingRound() {
    const context = setup();
    Object.assign(context.round, {
      phaseEndsAt: new Date(Date.now() - 1000),
      teamOne: readyTeam("one"),
      teamTwo: readyTeam("two"),
    });
    const createMatch = jest.fn();
    Object.assign(context.service, { createGamblingMatch: createMatch });
    const advance = () =>
      Reflect.get(context.service, "getAdvanceAction").call(
        context.service,
        context.manager,
        "event",
      );
    return { ...context, createMatch, advance };
  }

  it.each([
    EventState.SUBMISSIONS_CLOSED,
    EventState.SHOWCASE,
    EventState.COMPLETED,
  ])("blocks entering in %s", async (state) => {
    const { event, manager, service } = setup();
    event.state = state;
    manager.findOne.mockResolvedValue(readyTeam("bettor"));
    await expect(service.join("event", "user")).rejects.toThrow(
      "only available",
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "PROVISIONING", "UNLOCKING", "LOCKED", "FAILED"])(
    "blocks entering with a %s repository",
    async (repositoryStatus) => {
      const { manager, service } = setup();
      manager.findOne.mockResolvedValue({
        ...readyTeam("bettor"),
        repositoryStatus,
      });
      await expect(service.join("event", "user")).rejects.toThrow(
        "ready repository",
      );
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it.each([
    EventState.SUBMISSIONS_CLOSED,
    EventState.SHOWCASE,
    EventState.COMPLETED,
  ])("creates no new match in %s", async (state) => {
    const { event, round, createMatch, advance } = expiredBettingRound();
    event.state = state;
    await expect(advance()).resolves.toBeNull();
    expect(createMatch).not.toHaveBeenCalled();
    expect(round.phase).toBe(GamblingRoundPhase.BETTING);
  });

  it("still settles an already-created match after closure", async () => {
    const { event, round, advance } = expiredBettingRound();
    event.state = EventState.SUBMISSIONS_CLOSED;
    Object.assign(round, {
      phase: GamblingRoundPhase.PLAYING,
      match: { id: "match", state: "FINISHED", winner: { id: "one" } },
    });
    await expect(advance()).resolves.toEqual({
      type: "settle",
      matchId: "match",
      winnerId: "one",
    });
  });

  it("waits for both selected teams to have ready repositories", async () => {
    const { round, createMatch, advance } = expiredBettingRound();
    Object.assign(round.teamTwo, { repositoryStatus: "UNLOCKING" });
    await expect(advance()).resolves.toBeNull();
    expect(createMatch).not.toHaveBeenCalled();
  });

  it("creates the match while playing with ready teams", async () => {
    const { createMatch, advance } = expiredBettingRound();
    createMatch.mockResolvedValue({ id: "match" });
    await expect(advance()).resolves.toEqual({
      type: "start",
      matchId: "match",
    });
    expect(createMatch).toHaveBeenCalledWith(expect.anything(), "one", "two");
  });
});
