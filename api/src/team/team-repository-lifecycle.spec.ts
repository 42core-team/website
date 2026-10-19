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

import { TeamService } from "./team.service";

function setup(status = "PROVISIONING", closed = false) {
  const event = {
    id: "event",
    startDate: new Date(0),
    submissionDeadline: new Date(closed ? 0 : "2099-01-01"),
  };
  const team = {
    id: "team",
    eventId: "event",
    event,
    repo: "",
    users: [],
    locked: false,
    repositoryStatus: status,
    repositoryOperationId: "current",
    repositoryError: null,
    tournamentExcluded: false,
    credits: 10,
  };
  const repository = {
    findOne: jest.fn().mockResolvedValue(team),
    findOneOrFail: jest.fn().mockResolvedValue(team),
    update: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue(team),
  };
  const manager = {
    getRepository: () => repository,
    findOneOrFail: jest.fn().mockResolvedValue(event),
    find: jest.fn().mockResolvedValue([team, { ...team, id: "opponent" }]),
    save: jest.fn(),
  };
  const service = Object.create(TeamService.prototype) as TeamService;
  Reflect.set(service, "teamRepository", repository);
  Reflect.set(service, "dataSource", {
    transaction: (action: (value: typeof manager) => unknown) =>
      action(manager),
  });
  const github = {
    setRepositoryAccess: jest.fn().mockResolvedValue(undefined),
    createTeamRepository: jest.fn(),
  };
  Reflect.set(service, "githubApiService", github);
  return { service, team, event, repository, manager, github };
}

describe("repository lifecycle", () => {
  it.each([false, true])(
    "preserves admin exclusion=%s through unlock acknowledgements and errors",
    async (excluded) => {
      const { service, team } = setup("UNLOCKING");
      team.tournamentExcluded = excluded;
      await service.completeRepositoryOperation({
        teamId: "team",
        operationId: "current",
        repositoryName: "repo",
      });
      expect(team.tournamentExcluded).toBe(excluded);
      team.repositoryStatus = "LOCKING";
      team.repositoryOperationId = "next";
      await service.completeRepositoryOperation({
        teamId: "team",
        operationId: "next",
        repositoryName: "repo",
        error: "denied",
      });
      expect(team.tournamentExcluded).toBe(excluded);
    },
  );

  it.each([false, true])(
    "preserves admin exclusion=%s on retries and reopening",
    async (excluded) => {
      const { service, team, repository, github } = setup("FAILED");
      team.repo = "repo";
      team.tournamentExcluded = excluded;
      repository.update.mockImplementation(async (_id, data) =>
        Object.assign(team, data),
      );
      await service.retryRepositoryOperation("team");
      expect(team.tournamentExcluded).toBe(excluded);
      expect(github.setRepositoryAccess).toHaveBeenCalledWith(
        expect.objectContaining({ locked: false }),
      );
      expect(
        repository.update.mock.calls.every(
          ([, data]) => !("tournamentExcluded" in data),
        ),
      ).toBe(true);
    },
  );

  it("marks missing repositories FAILED without silently satisfying the showcase gate or retrying every minute", async () => {
    const { service, team, repository, github } = setup("PENDING", true);
    Reflect.set(team, "repositoryOperationId", null);
    repository.update.mockImplementation(async (_id, data) =>
      Object.assign(team, data),
    );
    Reflect.set(repository, "find", jest.fn().mockResolvedValue([team]));
    const runner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([{ pg_try_advisory_lock: true }]),
    };
    Reflect.set(service, "dataSource", { createQueryRunner: () => runner });
    Reflect.set(service, "logger", { log: jest.fn(), error: jest.fn() });
    await service.autoCreateRepos();
    expect(team.repositoryStatus).toBe("FAILED");
    expect(team.repositoryError).toEqual(
      expect.stringContaining("explicitly exclude"),
    );
    expect(team.tournamentExcluded).toBe(false);
    expect(team.tournamentExcluded || team.repositoryStatus === "LOCKED").toBe(
      false,
    );
    await service.autoCreateRepos();
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(github.setRepositoryAccess).not.toHaveBeenCalled();
  });

  it("keeps a timed-out missing repository nonexcluded and failed at closure", async () => {
    const { service, team, repository } = setup("PROVISIONING", true);
    repository.update.mockImplementation(async (_id, data) =>
      Object.assign(team, data),
    );
    await service.retryRepositoryOperation("team");
    expect(team.repositoryStatus).toBe("FAILED");
    expect(team.repo).toBe("");
    expect(team.tournamentExcluded).toBe(false);
    expect(team.repositoryError).toEqual(
      expect.stringContaining("explicitly exclude"),
    );
  });

  it("rechecks event policy when a delayed closure dispatch arrives after reopen", async () => {
    const { service, team, repository, github } = setup("LOCKED");
    team.repo = "repo";
    team.locked = true;
    Reflect.set(team, "repositoryOperationId", null);
    repository.update.mockImplementation(async (_id, data) =>
      Object.assign(team, data),
    );
    await service.lockTeam("team");
    expect(team.repositoryStatus).toBe("UNLOCKING");
    expect(github.setRepositoryAccess).toHaveBeenCalledWith(
      expect.objectContaining({ locked: false }),
    );
  });

  it("allows an explicit manual lock to override an open event", async () => {
    const { service, team, github } = setup("READY");
    team.repo = "repo";
    Reflect.set(team, "repositoryOperationId", null);
    await service.lockTeam("team", false);
    expect(github.setRepositoryAccess).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it.each(["READY", "PENDING", "LOCKING"])(
    "reconciles migrated closed events with %s repositories",
    async (status) => {
      const { service, team, repository } = setup(status, true);
      Reflect.set(team, "repositoryOperationId", null);
      Reflect.set(repository, "find", jest.fn().mockResolvedValue([team]));
      const runner = {
        connect: jest.fn(),
        release: jest.fn(),
        query: jest.fn().mockResolvedValue([{ pg_try_advisory_lock: true }]),
      };
      Reflect.set(service, "dataSource", { createQueryRunner: () => runner });
      Reflect.set(service, "logger", { log: jest.fn(), error: jest.fn() });
      const lock = jest.spyOn(service, "lockTeam").mockResolvedValue(undefined);
      await service.autoCreateRepos();
      expect(lock).toHaveBeenCalledWith("team");
    },
  );

  it("ignores stale acknowledgements without mutating the repository", async () => {
    const { service, repository } = setup();
    await service.completeRepositoryOperation({
      teamId: "team",
      operationId: "stale",
      repositoryName: "repo",
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("does not expose late creation as READY and dispatches a lock", async () => {
    const { service, team, github } = setup("PROVISIONING", true);
    await service.completeRepositoryOperation({
      teamId: "team",
      operationId: "current",
      repositoryName: "repo",
    });
    expect(team.repositoryStatus).toBe("LOCKING");
    expect(team.locked).toBe(true);
    // Reconciliation dispatches the complete collaborator permission operation.
    expect(github.setRepositoryAccess).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true, repositoryName: "repo" }),
    );
  });

  it("surfaces permission failures without claiming a successful lock", async () => {
    const { service, team } = setup("LOCKING", true);
    await service.completeRepositoryOperation({
      teamId: "team",
      operationId: "current",
      repositoryName: "repo",
      error: "permission denied",
    });
    expect(team.repositoryStatus).toBe("FAILED");
    expect(team.repositoryError).toBe("permission denied");
    expect(team.tournamentExcluded).toBe(false);
  });

  it("relocks after a stale unlock physically restores writes to an already LOCKED closed team", async () => {
    const { service, team, github, repository } = setup("LOCKED", true);
    team.repo = "repo";
    team.locked = true;
    await service.completeRepositoryOperation({
      teamId: "team",
      operationId: "old-unlock",
      repositoryName: "repo",
      action: "UNLOCK",
    });
    expect(repository.save).toHaveBeenCalled();
    expect(team.repositoryStatus).toBe("LOCKING");
    expect(github.setRepositoryAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        locked: true,
        repositoryName: "repo",
        operationId: expect.any(String),
      }),
    );
  });

  it("restores readiness only after an unlock acknowledgement", async () => {
    const { service, team } = setup("UNLOCKING");
    await service.completeRepositoryOperation({
      teamId: "team",
      operationId: "current",
      repositoryName: "repo",
    });
    expect(team.repositoryStatus).toBe("READY");
    expect(team.locked).toBe(false);
  });

  it("does not provision pending teams after the deadline", async () => {
    const { service, manager, github } = setup("PENDING", true);
    await service.createTeamRepository("team", manager as never);
    expect(github.createTeamRepository).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "rejects direct matches for closed events or unready repos (closed=%s)",
    async (closed) => {
      const { service, manager } = setup(
        closed ? "READY" : "PROVISIONING",
        closed,
      );
      await expect(
        service.createDirectMatch("team", "opponent"),
      ).rejects.toThrow("ready repositories");
      expect(manager.save).not.toHaveBeenCalled();
    },
  );

  it("blocks membership changes at the exact submission cutoff", async () => {
    const { service } = setup("READY", true);
    await expect(service.assertTeamMembershipOpen("team")).rejects.toThrow(
      "closed",
    );
  });
});
