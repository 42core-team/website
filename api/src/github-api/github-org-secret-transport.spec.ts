/// <reference types="jest" />

import { ClientProxyFactory } from "@nestjs/microservices";
import { GithubApiService } from "./github-api.service";
import { of } from "rxjs";

jest.mock("../main", () => ({
  getRabbitmqConfig: jest.fn().mockReturnValue({}),
}));

describe("GitHub organization secret transport", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the event credentials unchanged to the GitHub service", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new GithubApiService({
      getOrThrow: jest.fn().mockReturnValue("https://api.example.com"),
    } as never);
    const githubAuth = {
      kind: "token" as const,
      encryptedSecret: "v2:encrypted-event-token",
    };

    await service.createTeamRepository(
      "repository-name",
      "team-name",
      [],
      "github-org",
      githubAuth,
      "team-id",
      "https://github.com/example/mono.git",
      "main",
      "bot-image",
      "visualizer-image",
      "event-id",
      "base-path",
      "{}",
      "{}",
    );

    expect(emit).toHaveBeenCalledWith(
      "create_team_repository",
      expect.objectContaining({
        githubAuth,
        // Read by workers deployed before githubAuth existed.
        encryptedSecret: "v2:encrypted-event-token",
      }),
    );
  });

  it("sends no organizer token for App events", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new GithubApiService({} as never);
    const githubAuth = { kind: "installation" as const, installationId: 42 };

    await service.deleteRepository("repository-name", "github-org", githubAuth);

    const [, payload] = emit.mock.calls[0];
    expect(payload).toEqual({
      repositoryName: "repository-name",
      githubOrg: "github-org",
      githubAuth,
    });
  });
});
