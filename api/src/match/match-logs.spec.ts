jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { ForbiddenException } from "@nestjs/common";
import { MatchService } from "./match.service";

const K8S = "http://k8s.test";
const TEAM_ONE = "11111111-1111-4111-8111-111111111111";
const TEAM_TWO = "22222222-2222-4222-8222-222222222222";

function setup(
  options: {
    admin?: boolean;
    containers?: string[];
    teamOneUsers?: string[];
    teamTwoUsers?: string[];
    teamTwoDeleted?: boolean;
  } = {},
) {
  const event = { id: "event" };
  const match = {
    id: "match",
    teams: [
      {
        id: TEAM_ONE,
        name: "Team One",
        event,
        deletedAt: null,
        users: (options.teamOneUsers ?? ["alice"]).map((id) => ({ id })),
      },
      {
        id: TEAM_TWO,
        name: "Team Two",
        event,
        deletedAt: options.teamTwoDeleted ? new Date() : null,
        users: (options.teamTwoUsers ?? ["bob"]).map((id) => ({ id })),
      },
    ],
  };
  const containers = options.containers ?? [
    "game",
    `bot-${TEAM_ONE}`,
    `bot-${TEAM_TWO}`,
  ];
  const fetchMock = jest.fn(async (url: string) => {
    if (url.endsWith("/logs/containers"))
      return { json: async () => ({ id: "match", containers }) };
    const container = new URL(url).searchParams.get("container");
    return { text: async () => `${container} line 1\n${container} line 2\n` };
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  const isEventAdmin = jest.fn().mockResolvedValue(options.admin ?? false);
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    k8sServiceUrl: K8S,
    logger: { error: jest.fn(), warn: jest.fn() },
    matchRepository: { findOneOrFail: jest.fn().mockResolvedValue(match) },
    eventService: { isEventAdmin },
  });
  return { service, fetchMock, isEventAdmin };
}

function fetchedContainers(fetchMock: jest.Mock) {
  return fetchMock.mock.calls
    .map(([url]) => new URL(url).searchParams.get("container"))
    .filter((container) => container !== null);
}

describe("match logs access", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("gives event admins the game server and every bot", async () => {
    const { service, isEventAdmin } = setup({ admin: true });

    const logs = await service.getMatchLogs("match", "admin");

    expect(isEventAdmin).toHaveBeenCalledWith("event", "admin");
    expect(logs).toEqual([
      {
        container: "game",
        team: undefined,
        logs: ["game line 1", "game line 2"],
      },
      {
        container: `bot-${TEAM_ONE}`,
        team: "Team One",
        logs: [`bot-${TEAM_ONE} line 1`, `bot-${TEAM_ONE} line 2`],
      },
      {
        container: `bot-${TEAM_TWO}`,
        team: "Team Two",
        logs: [`bot-${TEAM_TWO} line 1`, `bot-${TEAM_TWO} line 2`],
      },
    ]);
  });

  it("gives team members only their own bot", async () => {
    const { service, fetchMock } = setup();

    const logs = await service.getMatchLogs("match", "alice");

    expect(logs).toEqual([
      {
        container: `bot-${TEAM_ONE}`,
        team: "Team One",
        logs: [`bot-${TEAM_ONE} line 1`, `bot-${TEAM_ONE} line 2`],
      },
    ]);
    expect(fetchedContainers(fetchMock)).toEqual([`bot-${TEAM_ONE}`]);
  });

  it("rejects users who are neither admins nor in the match", async () => {
    const { service, fetchMock } = setup();

    await expect(service.getMatchLogs("match", "mallory")).rejects.toThrow(
      ForbiddenException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives a user in both teams both bots but not the game server", async () => {
    const { service } = setup({
      teamOneUsers: ["alice"],
      teamTwoUsers: ["alice"],
    });

    const logs = await service.getMatchLogs("match", "alice");

    expect(logs.map((log) => log.container)).toEqual([
      `bot-${TEAM_ONE}`,
      `bot-${TEAM_TWO}`,
    ]);
  });

  it("gives an admin who is also a member everything", async () => {
    const { service } = setup({ admin: true });

    const logs = await service.getMatchLogs("match", "alice");

    expect(logs.map((log) => log.container)).toEqual([
      "game",
      `bot-${TEAM_ONE}`,
      `bot-${TEAM_TWO}`,
    ]);
  });

  it("leaves out containers that do not map to the member's team", async () => {
    const { service } = setup({
      containers: [
        "game",
        `bot-${TEAM_ONE}-extra`,
        "bot-unknown",
        `bot-${TEAM_ONE}`,
      ],
    });

    const logs = await service.getMatchLogs("match", "alice");

    expect(logs.map((log) => log.container)).toEqual([`bot-${TEAM_ONE}`]);
  });

  it("treats members of a deleted team as outsiders", async () => {
    const { service } = setup({ teamTwoDeleted: true });

    await expect(service.getMatchLogs("match", "bob")).rejects.toThrow(
      ForbiddenException,
    );
  });
});
