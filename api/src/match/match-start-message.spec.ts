jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { MatchService } from "./match.service";

const TOKEN = "ghp_secretOrgToken";

function setup(overrides: { githubOrg?: string; repos?: string[] } = {}) {
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
    githubApiService: { decryptSecret: jest.fn().mockReturnValue(TOKEN) },
    gameQueue: { emit },
  });
  return { service, emit };
}

describe("new_match message", () => {
  it("sends clean repository URLs and the token in a separate field", async () => {
    const { service, emit } = setup();

    await service.startMatch("match");

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
      const { service, emit } = setup({ githubOrg });
      await expect(service.startMatch("match")).rejects.toThrow(
        "invalid GitHub organization",
      );
      expect(emit).not.toHaveBeenCalled();
    },
  );

  it.each(["..", "repo/../../x", "repo';id;'", "https://github.com/a/b"])(
    "refuses an invalid repository name (%p)",
    async (repo) => {
      const { service, emit } = setup({ repos: ["valid-repo", repo] });
      await expect(service.startMatch("match")).rejects.toThrow(
        "invalid repository name",
      );
      expect(emit).not.toHaveBeenCalled();
    },
  );
});
