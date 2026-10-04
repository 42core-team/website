import { ConfigService } from "@nestjs/config";
import { rabbitmqQueueName } from "./rabbitmq-queue-name";

describe("rabbitmqQueueName", () => {
  it.each([
    [undefined, "game_queue"],
    ["", "game_queue"],
    ["dev_", "dev_game_queue"],
    ["dev_", "dev_game_results"],
    ["dev_", "dev_github_service"],
    ["dev_", "dev_github-service-results"],
  ])("resolves %s prefix to %s", (prefix, expected) => {
    const configService = {
      get: jest.fn().mockReturnValue(prefix),
    } as unknown as ConfigService;
    const baseName = expected.startsWith("dev_")
      ? expected.slice("dev_".length)
      : expected;

    expect(rabbitmqQueueName(configService, baseName)).toBe(expected);
  });
});
