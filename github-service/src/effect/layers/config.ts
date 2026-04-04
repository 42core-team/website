import { Config } from "effect";

export const ServiceConfigConfig = Config.all({
  rabbitmqUrl: Config.nonEmptyString("RABBITMQ_URL"),
  queue: Config.string("GITHUB_QUEUE").pipe(
    Config.withDefault("github_service"),
  ),
  resultsQueue: Config.string("GITHUB_RESULTS_QUEUE").pipe(
    Config.withDefault("github-service-results"),
  ),
  API_SECRET_ENCRYPTION_KEY: Config.nonEmptyString("API_SECRET_ENCRYPTION_KEY"),
});

export const OpenTelemetryConfigConfig = Config.all({
  metricsHost: Config.string("OTEL_METRICS_HOST").pipe(
    Config.withDefault("0.0.0.0"),
  ),
  metricsPort: Config.number("OTEL_METRICS_PORT").pipe(
    Config.withDefault(9464),
  ),
  metricsEndpoint: Config.string("OTEL_METRICS_ENDPOINT").pipe(
    Config.withDefault("/metrics"),
  ),
  tracesEnabled: Config.boolean("OTEL_TRACES_ENABLED").pipe(
    Config.withDefault(true),
  ),
  tracesEndpoint: Config.string("OTEL_TRACES_ENDPOINT").pipe(
    Config.withDefault("http://localhost:4318/v1/traces"),
  ),
});
