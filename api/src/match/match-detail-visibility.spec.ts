jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { NotFoundException } from "@nestjs/common";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchService } from "./match.service";

function setup(phase: MatchPhase, isRevealed: boolean, isAdmin: boolean) {
  const match = Object.assign(new MatchEntity(), {
    id: "match",
    phase,
    round: 0,
    state: MatchState.FINISHED,
    isRevealed,
    teams: [
      { id: "a", name: "A", event: { id: "event" } },
      { id: "b", name: "B", event: { id: "event" } },
    ],
    winner: { id: "a", name: "A" },
    results: [{ team: { id: "a", name: "A" }, score: 1 }],
    stats: { actionsExecuted: 918273 },
  });
  const isEventAdmin = jest.fn().mockResolvedValue(isAdmin);
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    eventService: { isEventAdmin },
    matchRepository: {
      findOne: jest.fn().mockResolvedValue(match),
      find: jest.fn().mockResolvedValue([match]),
    },
  });
  return { service, isEventAdmin };
}

describe("MatchService.getMatchResponseById", () => {
  it.each([MatchPhase.SWISS, MatchPhase.ELIMINATION])(
    "answers 404 for an unrevealed %s match",
    async (phase) => {
      for (const [isAdmin, adminReveal] of [
        [false, false],
        [false, true],
        [true, false],
      ]) {
        const { service } = setup(phase, false, isAdmin);
        await expect(
          service.getMatchResponseById("match", "user", adminReveal),
        ).rejects.toThrow(NotFoundException);
      }
    },
  );

  it("does not ask for admin rights without reveal mode", async () => {
    const { service, isEventAdmin } = setup(MatchPhase.SWISS, false, true);
    await expect(
      service.getMatchResponseById("match", "admin", false),
    ).rejects.toThrow(NotFoundException);
    expect(isEventAdmin).not.toHaveBeenCalled();
  });

  it("gives a verified admin in reveal mode the result", async () => {
    const { service, isEventAdmin } = setup(MatchPhase.SWISS, false, true);
    const response = await service.getMatchResponseById("match", "admin", true);
    expect(isEventAdmin).toHaveBeenCalledWith("event", "admin");
    expect(response).toMatchObject({
      id: "match",
      winner: { id: "a" },
      stats: { actionsExecuted: 918273 },
    });
  });

  it("keeps the id of an unrevealed queue match but hides its result", async () => {
    const { service } = setup(MatchPhase.QUEUE, false, false);
    const response = await service.getMatchResponseById("match", "user", false);
    expect(response).toMatchObject({
      id: "match",
      state: MatchState.PLANNED,
    });
    for (const field of ["winner", "results", "stats", "updatedAt"])
      expect(response).not.toHaveProperty(field);
  });

  it("answers 404 for an unknown match", async () => {
    const { service } = setup(MatchPhase.SWISS, true, false);
    Reflect.set(service, "matchRepository", {
      findOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getMatchResponseById("missing", "user", false),
    ).rejects.toThrow(NotFoundException);
  });
});
