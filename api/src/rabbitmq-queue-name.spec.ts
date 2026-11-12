import { ConfigService } from "@nestjs/config";
import { rabbitmqQueueName } from "./rabbitmq-queue-name";

describe("rabbitmqQueueName", () => {
  it.each([
    [undefined, "game_queue", "game_queue"],
    ["", "game_queue", "game_queue"],
    ["dev_", "game_queue", "dev_game_queue"],
    ["dev_", "game_results", "dev_game_results"],
    ["dev_", "github_service", "dev_github_service"],
    ["dev_", "github-service-results", "dev_github-service-results"],
  ])("resolves %s prefix and %s to %s", (prefix, baseName, expected) => {
    const configService = {
      get: jest.fn().mockReturnValue(prefix),
    } as unknown as ConfigService;

    expect(rabbitmqQueueName(configService, baseName)).toBe(expected);
  });
});
