jest.mock("./entities/team.entity", () => ({
  TeamEntity: class TeamEntity {},
  RepositoryStatus: Object.fromEntries(
    [
      "PENDING",
      "PROVISIONING",
      "READY",
      "LOCKING",
      "LOCKED",
      "UNLOCKING",
      "FAILED",
    ].map((value) => [value, value]),
  ),
}));
jest.mock("../event/entities/event.entity", () => ({
  EventEntity: class EventEntity {},
}));
jest.mock("../user/entities/user.entity", () => ({
  UserEntity: class UserEntity {},
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

import { UserEntity } from "../user/entities/user.entity";
import { TeamService } from "./team.service";

type Where = Record<string, unknown>;

// State the controller saw before the request; tests change it to simulate a
// concurrent request that committed while this one waited for the locks.
function setup() {
  const event = {
    id: "event",
    startDate: new Date("2099-01-01"),
    submissionDeadline: new Date("2100-01-01"),
    maxTeamSize: 2,
  };
  const team = {
    id: "team",
    event,
    repo: "",
    users: [{ id: "member" }],
    locked: false,
    repositoryStatus: "PENDING",
  };
  const state = { hasTeam: false, invited: true, nameTaken: false };
  const order: string[] = [];
  const repository = {
    findOneOrFail: jest.fn(async (options: { lock?: unknown }) => {
      if (options.lock) order.push("lock:team");
      return team;
    }),
    save: jest.fn(async () => {
      order.push("save");
      return { id: "new" };
    }),
  };
  const manager = {
    getRepository: () => repository,
    findOneOrFail: jest.fn(async (entity: unknown) => {
      if (entity !== UserEntity) return event;
      order.push("lock:user");
      return { id: "joins" };
    }),
    exists: jest.fn(async (_entity: unknown, options: { where: Where }) => {
      order.push("check");
      if ("teamInvites" in options.where) return state.invited;
      if ("users" in options.where) return state.hasTeam;
      return state.nameTaken;
    }),
    update: jest.fn(),
    createQueryBuilder: () => ({
      relation: (_entity: unknown, relation: string) => ({
        of: () => ({
          remove: jest.fn(async () => order.push(`remove:${relation}`)),
          add: jest.fn(async () => order.push(`add:${relation}`)),
        }),
      }),
    }),
  };
  const service = Object.create(TeamService.prototype) as TeamService;
  Reflect.set(service, "teamRepository", repository);
  Reflect.set(service, "dataSource", {
    transaction: (action: (value: typeof manager) => unknown) =>
      action(manager),
  });
  return { service, team, event, state, order, manager, repository };
}

describe("team membership under lock", () => {
  it("accepts an invite after locking the user before the team", async () => {
    const { service, order } = setup();
    await service.acceptTeamInvite("joins", "team");
    expect(order).toEqual([
      "lock:user",
      "lock:team",
      "check",
      "check",
      "remove:teamInvites",
      "add:users",
    ]);
  });

  it("rejects an accept when the user joined another team in the meantime", async () => {
    const { service, state, order } = setup();
    state.hasTeam = true;
    await expect(service.acceptTeamInvite("joins", "team")).rejects.toThrow(
      "You are already part of a team for this event.",
    );
    expect(order).not.toContain("add:users");
  });

  it("rejects an accept when the invite was removed in the meantime", async () => {
    const { service, state, order } = setup();
    state.invited = false;
    await expect(service.acceptTeamInvite("joins", "team")).rejects.toThrow(
      "You are not invited to this team.",
    );
    expect(order).not.toContain("add:users");
  });

  it("rejects an accept when the team filled up in the meantime", async () => {
    const { service, team, order } = setup();
    team.users.push({ id: "other" });
    await expect(service.acceptTeamInvite("joins", "team")).rejects.toThrow(
      "This team is full.",
    );
    expect(order).not.toContain("add:users");
  });

  it("treats a missing maximum team size as full", async () => {
    const { service, event } = setup();
    Reflect.set(event, "maxTeamSize", null);
    await expect(service.acceptTeamInvite("joins", "team")).rejects.toThrow(
      "This team is full.",
    );
  });

  it("still rejects an accept when membership changes are closed", async () => {
    const { service, team, order } = setup();
    team.locked = true;
    await expect(service.acceptTeamInvite("joins", "team")).rejects.toThrow(
      "Team membership changes are closed.",
    );
    expect(order).toEqual(["lock:user", "lock:team"]);
  });

  it("creates a team after locking the user and re-checking membership", async () => {
    const { service, order, manager } = setup();
    await expect(service.createTeam("name", "joins", "event")).resolves.toEqual(
      { id: "new" },
    );
    expect(order).toEqual(["lock:user", "check", "check", "save"]);
    expect(manager.findOneOrFail).toHaveBeenNthCalledWith(
      1,
      UserEntity,
      expect.objectContaining({
        where: { id: "joins" },
        lock: { mode: "pessimistic_write" },
      }),
    );
  });

  it("rejects a create when the user got a team in the meantime", async () => {
    const { service, state, repository } = setup();
    state.hasTeam = true;
    await expect(service.createTeam("name", "joins", "event")).rejects.toThrow(
      "You already have a team for this event.",
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("rejects a create when the name was taken in the meantime", async () => {
    const { service, state, repository } = setup();
    state.nameTaken = true;
    await expect(service.createTeam("name", "joins", "event")).rejects.toThrow(
      "A team with this name already exists for this event.",
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
