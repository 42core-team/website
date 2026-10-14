jest.mock("./entities/team.entity", () => ({
  TeamEntity: class TeamEntity {},
}));
jest.mock("../event/entities/event.entity", () => ({
  EventEntity: class EventEntity {},
}));
jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class GithubApiService {},
}));
jest.mock("../match/match.service", () => ({
  MatchService: class MatchService {},
}));
jest.mock("../user/user.service", () => ({
  UserService: class UserService {},
}));

import type { TeamEntity } from "./entities/team.entity";
import { TeamService } from "./team.service";

describe("TeamService.getQueueOpponents", () => {
  it.each([{ small: "small.webp", large: "large.webp" }, null])(
    "preserves opponent pictures without exposing other fields: %p",
    async (picture) => {
      const find = jest.fn().mockResolvedValue([
        {
          id: "opponent",
          name: "Opponent",
          picture,
          queueScore: 1234,
          repo: "private-repo",
          credits: 99,
        },
      ]);
      const service = Object.create(TeamService.prototype) as TeamService;
      Reflect.set(service, "teamRepository", { find });

      await expect(service.getQueueOpponents("event", "team")).resolves.toEqual(
        [{ id: "opponent", name: "Opponent", picture }],
      );
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, name: true },
        }),
      );
    },
  );
});

describe("TeamService.getSearchedTeamsForEvent", () => {
  it("searches team names without regard to case", async () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [],
        raw: [],
      }),
    };
    const service = Object.create(TeamService.prototype) as TeamService;

    Reflect.set(service, "teamRepository", {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      manager: { find: jest.fn().mockResolvedValue([]) },
    });
    Reflect.set(service, "eventService", {
      isEventAdmin: jest.fn().mockResolvedValue(false),
    });
    Reflect.set(service, "matchService", {
      calculateBuchholzPointsForTeams: jest.fn().mockResolvedValue(new Map()),
    });
    jest.spyOn(service, "getLocationTagsForTeams").mockResolvedValue(new Map());

    await service.getSearchedTeamsForEvent(
      "event-1",
      "tEaM oNe",
      undefined,
      undefined,
      "user-1",
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "team.name ILIKE :searchName",
      { searchName: "%tEaM oNe%" },
    );
  });

  it("returns the persisted Buchholz score for the admin reveal view", async () => {
    const team = {
      id: "team-1",
      name: "Team One",
      locked: false,
      score: 4,
      buchholzPoints: 12,
      hadBye: false,
      credits: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as TeamEntity;

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [team],
        raw: [{ user_count: "2" }],
      }),
    };
    const calculateBuchholzPointsForTeams = jest
      .fn()
      .mockResolvedValue(new Map([["team-1", 8]]));
    const service = Object.create(TeamService.prototype) as TeamService;

    Reflect.set(service, "teamRepository", {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      manager: {
        find: jest.fn().mockResolvedValue([
          {
            teamId: "team-1",
            kind: "picture",
            variant: "small",
            objectKey: "small.webp",
          },
          {
            teamId: "team-1",
            kind: "picture",
            variant: "large",
            objectKey: "large.webp",
          },
          {
            teamId: "team-1",
            kind: "background",
            variant: "large",
            objectKey: "background.webp",
          },
        ]),
      },
    });
    Reflect.set(service, "eventService", {
      isEventAdmin: jest.fn().mockResolvedValue(true),
    });
    Reflect.set(service, "matchService", {
      calculateBuchholzPointsForTeams,
    });
    jest
      .spyOn(service, "getLocationTagsForTeams")
      .mockResolvedValue(new Map([["team-1", []]]));

    const result = await service.getSearchedTeamsForEvent(
      "event-1",
      undefined,
      undefined,
      undefined,
      "admin-1",
      true,
    );

    expect(result[0].buchholzPoints).toBe(12);
    expect(result[0].picture).toEqual({
      small: "small.webp",
      large: "large.webp",
    });
    expect(result[0].background).toEqual({ large: "background.webp" });
    expect(calculateBuchholzPointsForTeams).not.toHaveBeenCalled();
  });
});
