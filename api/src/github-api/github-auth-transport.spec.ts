/// <reference types="jest" />

import { ClientProxyFactory } from "@nestjs/microservices";
import { GithubApiService } from "./github-api.service";
import { of } from "rxjs";

jest.mock("../main", () => ({
  getRabbitmqConfig: jest.fn().mockReturnValue({}),
}));

describe("GitHub credentials transport", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the event credentials unchanged to the GitHub service", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new GithubApiService({
      getOrThrow: jest.fn().mockReturnValue("https://api.example.com"),
    } as never);
    const githubAuth = { installationId: 42 };

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
      expect.objectContaining({ githubAuth }),
    );
  });
});
