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
    const pageQuery = {
      select: jest.fn().mockReturnThis(),
      withDeleted: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[match], 1]),
    };
    const service = Object.create(MatchService.prototype) as MatchService;
    Object.assign(service, {
      matchRepository: {
        find,
        createQueryBuilder: jest.fn().mockReturnValue(pageQuery),
      },
      teamService: {
        getTeamById: jest.fn().mockResolvedValue(team),
        getTeamOfUserForEvent: jest.fn(async (_eventId, userId: string) =>
          userId === "member" ? team : null,
        ),
      },
    });
    return { service, find };
  }

  const artworkTeam = {
    id: team.id,
    name: team.name,
    picture: team.picture,
    background: team.background,
  };

  const queueMatchesQuery = { page: 1, pageSize: 20 };

  it("getQueueMatches preserves artwork without exposing private fields or results", async () => {
    const { service } = setup();
    const response = await service.getQueueMatches("event", "member");
    expect(response[0].teams).toEqual([artworkTeam]);
    expect(response[0].winner).toEqual(artworkTeam);
    expect(response[0]).not.toHaveProperty("results");
  });

  it("getAllQueueMatches preserves artwork without exposing private fields or results", async () => {
    const { service } = setup();
    const { matches } = await service.getAllQueueMatches(
      "event",
      queueMatchesQuery,
    );
    const historyTeam = { ...artworkTeam, deletedAt: null };
    expect(matches[0].teams).toEqual([historyTeam]);
    expect(matches[0].winner).toEqual(historyTeam);
    expect(matches[0]).not.toHaveProperty("results");
  });

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
    const { matches } = await service.getAllQueueMatches(
      "event",
      queueMatchesQuery,
    );
    expect(matches[0].teams).toEqual([
      { ...artworkTeam, deletedAt: null, picture: null, background: null },
    ]);
    expect(matches[0].winner).toBeNull();
  });
});
