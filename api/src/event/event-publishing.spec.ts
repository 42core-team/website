jest.mock("../team/team.service", () => ({
  TeamService: class TeamService {},
}));

import { ForbiddenException } from "@nestjs/common";
import { AuthorizationService, UserRole } from "../authz";
import { createAuthorizationService, principalWith } from "../authz/testing";
import { UserEntity } from "../user/entities/user.entity";
import { CreateEventDto } from "./dtos/createEventDto";
import { EventController } from "./event.controller";

const EVENT = "11111111-1111-4111-8111-111111111111";

describe("event publishing", () => {
  let authorization: AuthorizationService;
  beforeAll(async () => {
    authorization = await createAuthorizationService();
  });

  function setup(isPrivate: boolean) {
    const eventService = {
      getEventById: jest.fn().mockResolvedValue({ id: EVENT, isPrivate }),
      updateEventSettings: jest.fn().mockResolvedValue({ affected: 1 }),
      createEvent: jest.fn().mockResolvedValue({ id: EVENT }),
    };
    const controller = new EventController(
      eventService as never,
      {} as never,
      {} as never,
      authorization,
    );
    return { controller, eventService };
  }

  const eventAdmin = principalWith("a", UserRole.ADMIN, EVENT) as UserEntity;
  const publisher = {
    id: "p",
    roles: [
      { role: UserRole.ADMIN, eventId: EVENT },
      { role: UserRole.PUBLIC_EVENT_CREATOR, eventId: null },
    ],
  } as UserEntity;
  const globalAdmin = principalWith("g", UserRole.ADMIN) as UserEntity;

  it.each([true, false])(
    "requires publish whenever isPrivate=false (currently private: %s)",
    async (isPrivate) => {
      const { controller, eventService } = setup(isPrivate);
      await expect(
        controller.updateEventSettings(EVENT, eventAdmin, { isPrivate: false }),
      ).rejects.toThrow(ForbiddenException);
      expect(eventService.updateEventSettings).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a public event creator who administers it", publisher],
    ["a global admin", globalAdmin],
  ])("lets %s publish the event", async (_, user) => {
    const { controller, eventService } = setup(true);
    await controller.updateEventSettings(EVENT, user, { isPrivate: false });
    expect(eventService.updateEventSettings).toHaveBeenCalledWith(EVENT, {
      isPrivate: false,
    });
  });

  it.each([
    ["makes the event private", true, { isPrivate: true }],
    ["changes other settings", true, { name: "Renamed" }],
  ])(
    "lets an event admin who cannot publish %s",
    async (_, isPrivate, body) => {
      const { controller, eventService } = setup(isPrivate);
      await controller.updateEventSettings(EVENT, eventAdmin, body);
      expect(eventService.updateEventSettings).toHaveBeenCalledWith(
        EVENT,
        body,
      );
    },
  );

  it("creates every event private, whatever the request says", async () => {
    const { controller, eventService } = setup(true);
    await controller.createEvent("creator", {
      name: "Event",
      isPrivate: false,
    } as CreateEventDto);
    const args = eventService.createEvent.mock.calls[0];
    // createEvent(userId, ..., serverConfig, isPrivate, lifecycle)
    expect(args[0]).toBe("creator");
    expect(args[args.length - 2]).toBe(true);
  });
});
