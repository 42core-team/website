/// <reference types="jest" />

import { decryptSecret } from "../common/encryption";
import { instanceToPlain } from "class-transformer";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";

jest.mock("../team/team.service", () => ({
  TeamService: class TeamService {},
}));

describe("event organization secret storage", () => {
  const encryptionKey = "event-secret-encryption-key";

  function createService() {
    const eventRepository = {
      save: jest.fn().mockImplementation((event) => Promise.resolve(event)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new EventService(
      eventRepository as never,
      {} as never,
      {} as never,
      {} as never,
      { getOrThrow: jest.fn().mockReturnValue(encryptionKey) } as never,
      {} as never,
      {} as never,
    );

    return { eventRepository, service };
  }

  it("encrypts the organization token when creating an event", async () => {
    const { eventRepository, service } = createService();

    await service.createEvent(
      "user-id",
      "event-name",
      "description",
      "github-org",
      "plaintext-token",
      "location",
      Date.now(),
      Date.now() + 1_000,
      1,
      2,
      "game-image",
      "bot-image",
      "visualizer-image",
      "https://github.com/example/mono.git",
      "main",
      "base-path",
      "{}",
      "{}",
    );

    const storedEvent = eventRepository.save.mock.calls[0][0] as {
      githubOrgSecret: string;
    };
    expect(storedEvent.githubOrgSecret).toMatch(/^v2:/);
    expect(storedEvent.githubOrgSecret).not.toContain("plaintext-token");
    expect(decryptSecret(storedEvent.githubOrgSecret, encryptionKey)).toBe(
      "plaintext-token",
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
