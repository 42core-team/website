jest.mock("./entities/team.entity", () => ({
  TeamEntity: class TeamEntity {},
  RepositoryStatus: { READY: "READY" },
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
      Reflect.set(service, "teamRepository", {
        find,
        findOneOrFail: jest.fn().mockResolvedValue({
          repositoryStatus: "READY",
          locked: false,
          event: {
            startDate: new Date(0),
            submissionDeadline: new Date("2099-01-01"),
          },
        }),
      });

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
      pictureSmallUploadId: "u-small",
      pictureLargeUploadId: "u-large",
      backgroundLargeUploadId: "u-bg",
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
            id: "u-small",
            objectKey: "small.webp",
          },
          {
            id: "u-large",
            objectKey: "large.webp",
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
    expect(result[0]).toMatchObject({ userCount: 2, credits: 0 });
    expect(result[0]).not.toHaveProperty("updatedAt");
    expect(calculateBuchholzPointsForTeams).not.toHaveBeenCalled();
  });

  function publicListSetup() {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [
          {
            id: "team-1",
            name: "Team One",
            score: 4,
            buchholzPoints: 12,
            hadBye: false,
            credits: 7,
            repositoryStatus: "LOCKED",
            repositoryError: "error",
            tournamentExcluded: false,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          } as TeamEntity,
        ],
        raw: [{ user_count: "1" }],
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
    jest
      .spyOn(service, "getPublicStandings")
      .mockResolvedValue(
        new Map([["team-1", { score: 1, buchholzPoints: 2 }]]),
      );
    jest.spyOn(service, "getLocationTagsForTeams").mockResolvedValue(new Map());
    return { service, queryBuilder };
  }

  it("returns only the public list fields to a non-admin", async () => {
    const { service } = publicListSetup();
    const [team] = await service.getSearchedTeamsForEvent(
      "event-1",
      undefined,
      undefined,
      undefined,
      "user-1",
      true,
    );
    expect(Object.keys(team).sort()).toEqual(
      [
        "buchholzPoints",
        "createdAt",
        "hadBye",
        "id",
        "name",
        "picture",
        "score",
        "tags",
        "userCount",
      ].sort(),
    );
    expect(team).toMatchObject({ score: 1, buchholzPoints: 2 });
  });

  it.each(["updatedAt", "locked", "credits", "repositoryStatus"])(
    "ignores sorting by %s",
    async (sortBy) => {
      const { service, queryBuilder } = publicListSetup();
      await service.getSearchedTeamsForEvent(
        "event-1",
        undefined,
        "desc",
        sortBy,
        "user-1",
      );
      expect(queryBuilder.orderBy).not.toHaveBeenCalled();
    },
  );

  it("refuses to sort by queue score for a non-admin", async () => {
    const { service, queryBuilder } = publicListSetup();
    await expect(
      service.getSearchedTeamsForEvent(
        "event-1",
        undefined,
        "desc",
        "queueScore",
        "user-1",
        true,
      ),
    ).rejects.toThrow("Queue scores are hidden");
    expect(queryBuilder.orderBy).not.toHaveBeenCalled();
  });

  it("sorts by queue score with the name as tie-break for an admin", async () => {
    const { service, queryBuilder } = publicListSetup();
    Reflect.set(service, "eventService", {
      isEventAdmin: jest.fn().mockResolvedValue(true),
    });
    await service.getSearchedTeamsForEvent(
      "event-1",
      undefined,
      "desc",
      "queueScore",
      "admin-1",
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      "team.queueScore",
      "DESC",
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith("team.name", "ASC");
  });
});
