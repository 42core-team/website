import { EventState } from "../event/event-lifecycle";
import { UserService } from "./user.service";

describe("event registration mutation boundary", () => {
  const now = new Date("2026-10-19T12:00:00Z");

  afterEach(() => jest.useRealTimers());

  function setup(deadline: Date, state = EventState.PLAYING) {
    jest.useFakeTimers().setSystemTime(now);
    const add = jest.fn().mockResolvedValue(undefined);
    const builder = {
      relation: jest.fn().mockReturnThis(),
      of: jest.fn().mockReturnThis(),
      add,
    };
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({
        state,
        startDate: new Date(now.getTime() - 60_000),
        submissionDeadline: deadline,
      }),
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    const repository = {
      manager: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
    };
    return {
      service: new UserService(repository as never, {} as never),
      manager,
      add,
    };
  }

  it("rejects a request reaching the mutation exactly at the deadline", async () => {
    const { service, add } = setup(now);
    await expect(service.joinEvent("user", "event")).rejects.toThrow(
      "registration is closed",
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("rejects an event manually closed while eligibility was being checked", async () => {
    const { service, add } = setup(
      new Date(now.getTime() + 60_000),
      EventState.SUBMISSIONS_CLOSED,
    );
    await expect(service.joinEvent("user", "event")).rejects.toThrow(
      "registration is closed",
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("allows late registration during playing under the event row lock", async () => {
    const { service, manager, add } = setup(new Date(now.getTime() + 60_000));
    await service.joinEvent("user", "event");
    expect(manager.findOneOrFail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lock: { mode: "pessimistic_read" } }),
    );
    expect(add).toHaveBeenCalledWith("event");
  });
});
