jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchService } from "./match.service";
import { TeamEntity } from "../team/entities/team.entity";

describe("match response artwork", () => {
  const team = {
    id: "team",
    name: "Team",
    deletedAt: null,
    picture: { small: "picture-small.webp", large: "picture-large.webp" },
    background: { large: "background.webp" },
    queueScore: 1234,
    repo: "private-repo",
    credits: 99,
    users: [{ id: "member" }],
  } as TeamEntity;
  const match = {
    id: "match",
    phase: MatchPhase.QUEUE,
    state: MatchState.FINISHED,
    teams: [team],
    winner: team,
    results: [{ team, score: 1234 }],
  } as MatchEntity;

  function setup() {
    const find = jest.fn().mockResolvedValue([match]);
    const service = Object.create(MatchService.prototype) as MatchService;
    Object.assign(service, {
      matchRepository: { find },
      teamService: { getTeamById: jest.fn().mockResolvedValue(team) },
    });
    return { service, find };
  }

  const artworkTeam = {
    id: team.id,
    name: team.name,
    picture: team.picture,
    background: team.background,
  };

  it.each(["getQueueMatches", "getAllQueueMatches"] as const)(
    "%s preserves artwork without exposing private fields or results",
    async (method) => {
      const { service } = setup();
      const response =
        method === "getQueueMatches"
          ? await service.getQueueMatches("event", "member")
          : await service.getAllQueueMatches("event");
      expect(response[0].teams).toEqual([artworkTeam]);
      expect(response[0].winner).toEqual(artworkTeam);
      expect(response[0]).not.toHaveProperty("results");
    },
  );

  it.each(["member", "visitor"])(
    "preserves artwork in team history for %s without exposing private fields",
    async (userId) => {
      const { service } = setup();
      const response = await service.getMatchesForTeam("team", userId);
      const historyTeam = { ...artworkTeam, deletedAt: null };
      expect(response[0].teams).toEqual([historyTeam]);
      expect(response[0].winner).toEqual(historyTeam);
      expect(response[0].results).toEqual([]);
      expect("id" in response[0]).toBe(userId === "member");
    },
  );

  it("preserves null artwork and a missing winner", async () => {
    const { service, find } = setup();
    find.mockResolvedValue([
      {
        ...match,
        teams: [{ ...team, picture: null, background: null }],
        winner: null,
      },
    ]);
    const response = await service.getAllQueueMatches("event");
    expect(response[0].teams).toEqual([
      { ...artworkTeam, picture: null, background: null },
    ]);
    expect(response[0].winner).toBeNull();
  });
});
