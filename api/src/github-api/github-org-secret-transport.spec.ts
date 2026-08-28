/// <reference types="jest" />

import { ClientProxyFactory } from "@nestjs/microservices";
import { GithubApiService } from "./github-api.service";

jest.mock("../main", () => ({
  getRabbitmqConfig: jest.fn().mockReturnValue({}),
}));

describe("GitHub organization secret transport", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the encrypted event token unchanged to the GitHub service", async () => {
    const emit = jest.fn();
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new GithubApiService({
      getOrThrow: jest.fn().mockReturnValue("https://api.example.com"),
    } as never);
    const encryptedEventToken = "v2:encrypted-event-token";

    await service.createTeamRepository(
      "repository-name",
      "team-name",
      [],
      "github-org",
      encryptedEventToken,
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
      expect.objectContaining({ encryptedSecret: encryptedEventToken }),
    );
  });
});
