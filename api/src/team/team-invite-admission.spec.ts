import { TeamController } from "./team.controller";

jest.mock("./team.service", () => ({ TeamService: class {} }));

describe("team invitation admission", () => {
  function setup(registered: boolean) {
    const teamService = {
      isTeamFull: jest.fn().mockResolvedValue(false),
      getTeamOfUserForEvent: jest.fn().mockResolvedValue(null),
      isUserInvitedToTeam: jest.fn().mockResolvedValue(false),
    };
    const userService = {
      addTeamInvite: jest.fn().mockResolvedValue(undefined),
    };
    const eventService = {
      isUserRegisteredForEvent: jest.fn().mockResolvedValue(registered),
    };
    return {
      controller: new TeamController(
        teamService as never,
        userService as never,
        eventService as never,
      ),
      eventService,
      userService,
    };
  }

  it("rejects an invite for an unregistered user", async () => {
    const { controller, eventService, userService } = setup(false);
    await expect(
      controller.sendInviteToTeam(
        "event",
        { userToInviteId: "invitee" },
        { id: "team" } as never,
        "inviter",
      ),
    ).rejects.toThrow("This user is not registered for this event.");
    expect(eventService.isUserRegisteredForEvent).toHaveBeenCalledWith(
      "event",
      "invitee",
    );
    expect(userService.addTeamInvite).not.toHaveBeenCalled();
  });

  it("sends an invite to an eligible user", async () => {
    const { controller, userService } = setup(true);
    await controller.sendInviteToTeam(
      "event",
      { userToInviteId: "invitee" },
      { id: "team" } as never,
      "inviter",
    );
    expect(userService.addTeamInvite).toHaveBeenCalledWith("invitee", "team");
  });
});
