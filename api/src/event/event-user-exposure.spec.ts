jest.mock("../team/team.service", () => ({ TeamService: class {} }));

import { instanceToPlain, plainToInstance } from "class-transformer";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";

const fullUser = {
  id: "user",
  githubId: "12345",
  githubAccessToken: "token",
  email: "user@example.com",
  username: "user",
  name: "User",
  profilePicture: "https://example.com/avatar.png",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("event responses do not expose user details", () => {
  it("never serializes the registered users of an event", () => {
    const event = plainToInstance(EventEntity, {
      id: "event",
      name: "Event",
    });
    event.users = [fullUser as never];

    expect(instanceToPlain(event)).not.toHaveProperty("users");
  });

  it("returns only public fields for event admins", async () => {
    const service = Object.create(EventService.prototype) as EventService;
    Reflect.set(service, "permissionRepository", {
      find: jest.fn().mockResolvedValue([{ user: fullUser }]),
    });

    const admins = await service.getEventAdmins("event");

    expect(admins).toHaveLength(1);
    expect(Object.keys(instanceToPlain(admins[0])).sort()).toEqual([
      "id",
      "name",
      "profilePicture",
      "username",
    ]);
  });
});
