jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { MatchService } from "./match.service";
import { MatchState } from "./entites/match.entity";

const TOKEN = "ghp_secretOrgToken";

function setup(
  overrides: {
    githubOrg?: string;
    repos?: string[];
    decryptError?: Error;
  } = {},
) {
  const event = {
    id: "event",
    githubOrg: overrides.githubOrg ?? "core-org",
    githubOrgSecret: "encrypted",
    gameServerDockerImage: "ghcr.io/42core-team/game-server:v1",
    myCoreBotDockerImage: "ghcr.io/42core-team/my-core-bot:v1",
    gameConfig: "{}",
    serverConfig: "{}",
  };
  const repos = overrides.repos ?? ["event-team-one-1", "event-team-two-2"];
  const match = {
    id: "match",
    teams: repos.map((repo, index) => ({
      id: `team-${index}`,
      name: `Team ${index}`,
      repo,
      event,
      starterTemplate: null,
    })),
  };
  const emit = jest.fn();
  const execute = jest.fn().mockResolvedValue({ affected: 1 });
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute,
  };
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    matchRepository: {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn().mockResolvedValue(match),
    },
    configService: { get: jest.fn().mockReturnValue(undefined) },
    githubApiService: {
      decryptSecret: jest.fn().mockImplementation(() => {
        if (overrides.decryptError) throw overrides.decryptError;
        return TOKEN;
      }),
    },
    gameQueue: { emit },
  });
  return { service, emit, queryBuilder };
}

function stateUpdates(queryBuilder: { set: jest.Mock }) {
  return queryBuilder.set.mock.calls.map(([values]) => values.state);
}

describe("new_match message", () => {
  it("sends clean repository URLs and the token in a separate field", async () => {
    const { service, emit, queryBuilder } = setup();

    await service.startMatch("match");

    expect(stateUpdates(queryBuilder)).toEqual([MatchState.IN_PROGRESS]);
    expect(emit).toHaveBeenCalledTimes(1);
    const [pattern, payload] = emit.mock.calls[0];
    expect(pattern).toBe("new_match");
    expect(payload.bots).toEqual([
      expect.objectContaining({
        id: "team-0",
        repoURL: "https://github.com/core-org/event-team-one-1",
        repoToken: TOKEN,
      }),
      expect.objectContaining({
        id: "team-1",
        repoURL: "https://github.com/core-org/event-team-two-2",
        repoToken: TOKEN,
      }),
    ]);
    for (const bot of payload.bots) {
      expect(bot.repoURL).not.toContain(TOKEN);
      expect(bot.repoURL).not.toContain("@");
    }
  });

  it.each(["core org", "-core", "core:x@evil.example/", ""])(
    "refuses an invalid GitHub organization (%p)",
    async (githubOrg) => {
      const { service, emit, queryBuilder } = setup({ githubOrg });
      await expect(service.startMatch("match")).rejects.toThrow(
        "invalid GitHub organization",
      );
      expect(emit).not.toHaveBeenCalled();
      expect(stateUpdates(queryBuilder)).toEqual([
        MatchState.IN_PROGRESS,
        MatchState.PLANNED,
      ]);
    },
  );

  it.each(["..", "repo/../../x", "repo';id;'", "https://github.com/a/b"])(
    "refuses an invalid repository name (%p)",
    async (repo) => {
      const { service, emit, queryBuilder } = setup({
        repos: ["valid-repo", repo],
      });
      await expect(service.startMatch("match")).rejects.toThrow(
        "invalid repository name",
      );
      expect(emit).not.toHaveBeenCalled();
      expect(stateUpdates(queryBuilder)).toEqual([
        MatchState.IN_PROGRESS,
        MatchState.PLANNED,
      ]);
    },
  );

  it("puts the match back to PLANNED when the token cannot be decrypted", async () => {
    const { service, emit, queryBuilder } = setup({
      decryptError: new Error("bad ciphertext"),
    });
    await expect(service.startMatch("match")).rejects.toThrow("bad ciphertext");
    expect(emit).not.toHaveBeenCalled();
    expect(stateUpdates(queryBuilder)).toEqual([
      MatchState.IN_PROGRESS,
      MatchState.PLANNED,
    ]);
  });
});
