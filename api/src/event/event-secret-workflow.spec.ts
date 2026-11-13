/// <reference types="jest" />

import { decryptSecret } from "../common/encryption";
import { instanceToPlain } from "class-transformer";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";
import { eventSettings, NO_PRESET } from "../event-presets/testing";

jest.mock("../team/team.service", () => ({
  TeamService: class TeamService {},
}));

describe("event organization secret storage", () => {
  const encryptionKey = "event-secret-encryption-key";

  function createService() {
    const eventRepository = {
      create: jest.fn((event) => Object.assign(new EventEntity(), event)),
      save: jest.fn().mockImplementation((event) => Promise.resolve(event)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const roleRepository = { insert: jest.fn() };
    const dataSource = {
      transaction: (work: (manager: unknown) => unknown) =>
        work({
          getRepository: (entity: unknown) =>
            entity === EventEntity ? eventRepository : roleRepository,
        }),
    };
    const service = new EventService(
      eventRepository as never,
      {} as never,
      {} as never,
      {} as never,
      { getOrThrow: jest.fn().mockReturnValue(encryptionKey) } as never,
      {} as never,
      dataSource as never,
      {} as never,
    );

    return { eventRepository, roleRepository, service };
  }

  it("creates events without an organization token", async () => {
    const { eventRepository, roleRepository, service } = createService();

    await service.createEvent({
      userId: "user-id",
      settings: eventSettings(),
      ...NO_PRESET,
    });

    const storedEvent = eventRepository.save.mock.calls[0][0] as EventEntity;
    expect(storedEvent).toMatchObject({
      githubOrg: "",
      githubOrgSecret: null,
      githubInstallationId: null,
    });
    // The creator administers the event, granted in the same transaction.
    expect(roleRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-id", role: "ADMIN" }),
    );
  });

  it("encrypts a replacement token before updating a running event", async () => {
    const { eventRepository, service } = createService();
    jest.spyOn(service, "getEventById").mockResolvedValue({} as never);

    await service.updateEventSettings("event-id", {
      githubOrgSecret: "replacement-token",
    });

    const storedUpdate = eventRepository.update.mock.calls[0][1] as {
      githubOrgSecret: string;
    };
    expect(storedUpdate.githubOrgSecret).toMatch(/^v2:/);
    expect(storedUpdate.githubOrgSecret).not.toContain("replacement-token");
    expect(decryptSecret(storedUpdate.githubOrgSecret, encryptionKey)).toBe(
      "replacement-token",
    );
  });

  it("keeps the existing token when an update contains an empty value", async () => {
    const { eventRepository, service } = createService();
    jest.spyOn(service, "getEventById").mockResolvedValue({} as never);

    await service.updateEventSettings("event-id", { githubOrgSecret: "" });

    expect(eventRepository.update).not.toHaveBeenCalled();
  });

  it("excludes the encrypted token from serialized event responses", () => {
    const event = Object.assign(new EventEntity(), {
      id: "event-id",
      githubOrgSecret: "v2:encrypted-token",
    });

    expect(instanceToPlain(event)).not.toHaveProperty("githubOrgSecret");
  });
});
