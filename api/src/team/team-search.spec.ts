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

describe("TeamService.getSearchedTeamsForEvent", () => {
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
    expect(calculateBuchholzPointsForTeams).not.toHaveBeenCalled();
  });
});
