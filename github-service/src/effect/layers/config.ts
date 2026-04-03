import { Config } from "effect";

export const ServiceConfigConfig = Config.all({
  rabbitmqUrl: Config.string("RABBITMQ_URL"),
  queue: Config.string("GITHUB_QUEUE").pipe(
    Config.withDefault("github_service"),
  ),
  resultsQueue: Config.string("GITHUB_RESULTS_QUEUE").pipe(
    Config.withDefault("github-service-results"),
  ),
  API_SECRET_ENCRYPTION_KEY: Config.nonEmptyString("API_SECRET_ENCRYPTION_KEY"),
})