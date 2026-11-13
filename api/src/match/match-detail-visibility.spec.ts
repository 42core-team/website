jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { NotFoundException } from "@nestjs/common";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchService } from "./match.service";
import { EventPolicy } from "../authz";

const as = (id: string) => ({ id, roles: [] });

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
  const can = jest.fn().mockResolvedValue(isAdmin);
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    authorization: { can },
    matchRepository: {
      findOne: jest.fn().mockResolvedValue(match),
      find: jest.fn().mockResolvedValue([match]),
    },
  });
  return { service, can };
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
          service.getMatchResponseById("match", as("user"), adminReveal),
        ).rejects.toThrow(NotFoundException);
      }
    },
  );

  it("does not ask for admin rights without reveal mode", async () => {
    const { service, can } = setup(MatchPhase.SWISS, false, true);
    await expect(
      service.getMatchResponseById("match", as("admin"), false),
    ).rejects.toThrow(NotFoundException);
    expect(can).not.toHaveBeenCalled();
  });

  it("gives a verified admin in reveal mode the result", async () => {
    const { service, can } = setup(MatchPhase.SWISS, false, true);
    const response = await service.getMatchResponseById(
      "match",
      as("admin"),
      true,
    );
    expect(can).toHaveBeenCalledWith(
      EventPolicy,
      "viewUnrevealedResults",
      as("admin"),
      "event",
    );
    expect(response).toMatchObject({
      id: "match",
      winner: { id: "a" },
      stats: { actionsExecuted: 918273 },
    });
  });

  it.each([
    [false, false],
    [true, true],
  ])(
    "shows a queue match to anyone with its id (admin %s, reveal mode %s)",
    async (isAdmin, adminReveal) => {
      const { service, can } = setup(MatchPhase.QUEUE, false, isAdmin);
      const response = await service.getMatchResponseById(
        "match",
        as("user"),
        adminReveal,
      );
      expect(response).toMatchObject({
        id: "match",
        state: MatchState.FINISHED,
        winner: { id: "a" },
        stats: { actionsExecuted: 918273 },
      });
      expect(can).not.toHaveBeenCalled();
    },
  );

  it.each([MatchPhase.GAMBLING, MatchPhase.MANUAL])(
    "keeps the id of an unrevealed %s match but hides its result",
    async (phase) => {
      const { service } = setup(phase, false, false);
      const response = await service.getMatchResponseById(
        "match",
        as("user"),
        false,
      );
      expect(response).toMatchObject({
        id: "match",
        state: MatchState.PLANNED,
      });
      for (const field of ["winner", "results", "stats", "updatedAt"])
        expect(response).not.toHaveProperty(field);
    },
  );

  it("answers 404 for an unknown match", async () => {
    const { service } = setup(MatchPhase.SWISS, true, false);
    Reflect.set(service, "matchRepository", {
      findOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getMatchResponseById("missing", as("user"), false),
    ).rejects.toThrow(NotFoundException);
  });
});
