import {
  EventState,
  getEventState,
  isPlaying,
  isRegistrationOpen,
} from "./event-lifecycle";
import { EventService } from "./event.service";
import { EventEntity } from "./entities/event.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { EventController } from "./event.controller";

jest.mock("../team/team.service", () => ({ TeamService: class {} }));

describe("event lifecycle", () => {
  const startDate = new Date("2026-01-01T10:00:00Z");
  const submissionDeadline = new Date("2026-01-01T12:00:00Z");
  const event = {
    startDate,
    submissionDeadline,
    state: EventState.REGISTRATION,
  };

  it("advances at exact start and deadline boundaries and allows playing registration", () => {
    expect(getEventState(event, new Date(startDate.getTime() - 1))).toBe(
      EventState.REGISTRATION,
    );
    expect(isPlaying(event, startDate)).toBe(true);
    expect(
      isRegistrationOpen(event, new Date(submissionDeadline.getTime() - 1)),
    ).toBe(true);
    expect(getEventState(event, submissionDeadline)).toBe(
      EventState.SUBMISSIONS_CLOSED,
    );
    expect(isRegistrationOpen(event, submissionDeadline)).toBe(false);
  });

  it.each([
    EventState.SUBMISSIONS_CLOSED,
    EventState.SHOWCASE,
    EventState.COMPLETED,
  ])("preserves explicit %s even before start", (state) => {
    expect(
      getEventState({ ...event, state }, new Date(startDate.getTime() - 1)),
    ).toBe(state);
  });

  it("does not use the informational scheduled end to close submissions", () => {
    const extended = {
      ...event,
      endDate: startDate,
      scheduledEndDate: startDate,
    };
    expect(getEventState(extended, startDate)).toBe(EventState.PLAYING);
  });

  function harness(state: EventState, teams: Partial<TeamEntity>[] = []) {
    const stored = Object.assign(new EventEntity(), event, {
      id: "event",
      state,
      teams,
      completedAt: new Date(),
      scheduledEndDate: submissionDeadline,
      introLeadMinutes: 15,
      introEnabled: false,
      gamblingEnabled: true,
    });
    const repository = {
      findBy: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue(stored),
      findOneByOrFail: jest.fn().mockResolvedValue(stored),
      update: jest.fn().mockImplementation((_id, update) => {
        Object.assign(stored, update);
        return Promise.resolve({ affected: 1 });
      }),
    };
    const teamRepository = {
      find: jest.fn().mockResolvedValue(teams),
      update: jest.fn().mockResolvedValue({ affected: teams.length }),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === EventEntity ? repository : teamRepository,
    };
    const teamService = {
      lockTeam: jest.fn().mockResolvedValue(undefined),
      unlockTeamsForEvent: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: () => ({
        connect: jest.fn(),
        query: jest.fn().mockResolvedValue([{ pg_try_advisory_lock: true }]),
        release: jest.fn(),
      }),
      transaction: (callback: (manager: unknown) => Promise<unknown>) =>
        callback(manager),
    };
    const service = new EventService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      teamService as never,
      dataSource as never,
    );
    return { stored, repository, teamService, service };
  }

  it("disables capabilities before dispatching locks and does not claim confirmation", async () => {
    const { service, stored, teamService } = harness(EventState.PLAYING, [
      { id: "team" },
    ]);
    teamService.lockTeam.mockImplementation(async () => {
      expect(stored.state).toBe(EventState.SUBMISSIONS_CLOSED);
      expect(stored.canCreateTeam).toBe(false);
      expect(stored.processQueue).toBe(false);
      // Lifecycle closes new bets; keep the feature available for viewing/settlement.
      expect(stored.gamblingEnabled).toBe(true);
      expect(stored.lockedAt).toBeNull();
    });
    await service.lockEvent("event");
    expect(teamService.lockTeam).toHaveBeenCalledWith("team");
  });

  it("blocks showcase until nonexcluded repositories are confirmed locked", async () => {
    const { service, repository } = harness(EventState.SUBMISSIONS_CLOSED, [
      { repositoryStatus: "LOCKING" as never },
    ]);
    await expect(
      service.transitionLifecycle("event", { action: "showcase" }),
    ).rejects.toThrow("confirmed LOCKED");
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("does not let a stale cron snapshot close an event reopened with a future deadline", async () => {
    const { service, stored, repository, teamService } = harness(
      EventState.PLAYING,
      [{ id: "team" }],
    );
    const expiredSnapshot = { ...stored };
    const future = Date.now() + 60000;
    repository.findBy.mockImplementation(async () => {
      await service.transitionLifecycle("event", {
        action: "reopen",
        submissionDeadline: future,
      });
      return [expiredSnapshot];
    });
    await service.autoLockEvents();
    expect(stored.state).toBe(EventState.PLAYING);
    expect(stored.submissionDeadline.getTime()).toBe(future);
    expect(stored.canCreateTeam).toBe(true);
    expect(teamService.lockTeam).not.toHaveBeenCalled();
  });

  it("allows rescheduling startDate into the future and updates state to registration", async () => {
    const { service, stored, repository } = harness(EventState.PLAYING);
    const now = Date.now();
    stored.submissionDeadline = new Date(now + 180000);
    stored.scheduledEndDate = stored.submissionDeadline;
    await service.updateEventSettings("event", {
      startDate: now + 60000,
      introEnabled: true,
    });
    expect(repository.findOneOrFail).toHaveBeenLastCalledWith({
      where: { id: "event" },
      lock: { mode: "pessimistic_write" },
    });
    expect(stored.startDate.getTime()).toBe(now + 60000);
    expect(stored.state).toBe(EventState.REGISTRATION);
    expect(stored.introEnabled).toBe(true);
  });

  it("closes an expired event only after a locked fresh read", async () => {
    const { service, stored, repository, teamService } = harness(
      EventState.PLAYING,
      [{ id: "team" }],
    );
    await service.lockEvent("event", true);
    expect(repository.findOneOrFail).toHaveBeenCalledWith({
      where: { id: "event" },
      lock: { mode: "pessimistic_write" },
    });
    expect(stored.state).toBe(EventState.SUBMISSIONS_CLOSED);
    expect(teamService.lockTeam).toHaveBeenCalledWith("team");
  });

  it("preserves manual closure before the deadline", async () => {
    const { service, stored, teamService } = harness(EventState.PLAYING, [
      { id: "team" },
    ]);
    stored.submissionDeadline = new Date(Date.now() + 60000);
    await service.lockEvent("event");
    expect(stored.state).toBe(EventState.SUBMISSIONS_CLOSED);
    expect(teamService.lockTeam).toHaveBeenCalledWith("team");
  });

  it.each([EventState.SHOWCASE, EventState.COMPLETED])(
    "ignores stale scheduled closure after transition to %s",
    async (state) => {
      const { service, repository, teamService } = harness(state);
      await expect(service.lockEvent("event", true)).resolves.toMatchObject({
        affected: 0,
      });
      expect(repository.update).not.toHaveBeenCalled();
      expect(teamService.lockTeam).not.toHaveBeenCalled();
    },
  );

  it("allows an explicit exclusion to unblock showcase and records completion only on complete", async () => {
    const { service, stored } = harness(EventState.SUBMISSIONS_CLOSED, [
      { repositoryStatus: "FAILED" as never, tournamentExcluded: true },
    ]);
    await service.transitionLifecycle("event", { action: "showcase" });
    expect(stored.state).toBe(EventState.SHOWCASE);
    await service.transitionLifecycle("event", { action: "complete" });
    expect(stored.state).toBe(EventState.COMPLETED);
    expect(stored.completedAt).toBeInstanceOf(Date);
    expect(stored.gamblingEnabled).toBe(true);
  });

  it.each([
    EventState.SUBMISSIONS_CLOSED,
    EventState.SHOWCASE,
    EventState.COMPLETED,
  ])(
    "reopens %s with future deadline, restored capabilities and repository unlock",
    async (state) => {
      const { service, stored, teamService } = harness(state);
      await expect(
        service.transitionLifecycle("event", { action: "reopen" }),
      ).rejects.toThrow("future submissionDeadline");
      await expect(
        service.transitionLifecycle("event", {
          action: "reopen",
          submissionDeadline: Date.now() - 1,
        }),
      ).rejects.toThrow("future submissionDeadline");
      const future = Date.now() + 60000;
      await service.transitionLifecycle("event", {
        action: "reopen",
        submissionDeadline: future,
      });
      expect(stored.state).toBe(EventState.PLAYING);
      expect(stored.completedAt).toBeNull();
      expect(stored.lockedAt).toBeNull();
      expect(stored.submissionDeadline.getTime()).toBe(future);
      expect(stored.repoLockDate).toEqual(stored.submissionDeadline);
      expect(
        stored.canCreateTeam && stored.processQueue && stored.gamblingEnabled,
      ).toBe(true);
      expect(teamService.unlockTeamsForEvent).toHaveBeenCalledWith("event");
    },
  );

  it("rejects settings that bypass reopening", async () => {
    const { service } = harness(EventState.COMPLETED);
    await expect(
      service.updateEventSettings("event", { canCreateTeam: true }),
    ).rejects.toThrow("Reopen");
    await expect(
      service.updateEventSettings("event", {
        submissionDeadline: Date.now() + 60000,
      }),
    ).rejects.toThrow("reopen");
  });

  it("validates date ordering and intro lead time on settings updates", async () => {
    const { service } = harness(EventState.REGISTRATION);
    await expect(
      service.updateEventSettings("event", {
        startDate: submissionDeadline.getTime() + 1,
      }),
    ).rejects.toThrow("Submission deadline must follow start");
    await expect(
      service.updateEventSettings("event", { introLeadMinutes: -1 }),
    ).rejects.toThrow("nonnegative integer");
  });

  it("gates private joins after the deadline before whitelist lookup or mutation", async () => {
    const userService = {
      joinEvent: jest.fn(),
      getUserWithSocialAccounts: jest.fn(),
    };
    const eventService = {
      isUserRegisteredForEvent: jest.fn().mockResolvedValue(false),
      getEventById: jest.fn().mockResolvedValue({ ...event, isPrivate: true }),
      isUserWhitelisted: jest.fn(),
    };
    const controller = new EventController(
      eventService as never,
      {} as never,
      userService as never,
    );
    await expect(controller.joinEvent("event", "user")).rejects.toThrow(
      "Registration is closed",
    );
    expect(userService.joinEvent).not.toHaveBeenCalled();
    expect(eventService.isUserWhitelisted).not.toHaveBeenCalled();
  });

  it("automatically starts and closes events under the shared cron lock", async () => {
    const now = Date.now();
    const repository = {
      findBy: jest.fn().mockResolvedValue([
        {
          id: "starting",
          state: EventState.REGISTRATION,
          startDate: new Date(now - 1000),
          submissionDeadline: new Date(now + 60000),
        },
        {
          id: "closing",
          state: EventState.PLAYING,
          startDate,
          submissionDeadline,
        },
      ]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const runner = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue([{ pg_try_advisory_lock: true }]),
      release: jest.fn(),
    };
    const service = new EventService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        createQueryRunner: () => runner,
        query: jest.fn().mockResolvedValue([]),
      } as never,
    );
    const close = jest
      .spyOn(service, "lockEvent")
      .mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
    await service.autoLockEvents();
    expect(repository.update).toHaveBeenCalledWith(
      { id: "starting", state: EventState.REGISTRATION },
      { state: EventState.PLAYING },
    );
    expect(close).toHaveBeenCalledWith("closing", true);
    expect(runner.query).toHaveBeenLastCalledWith(
      "SELECT pg_advisory_unlock($1)",
      expect.any(Array),
    );
    expect(runner.release).toHaveBeenCalled();
  });
});
