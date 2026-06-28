import { Effect, Layer } from "effect";
import { GitHubFactoryLive } from "./github/gitHubClient";
import { RepoUtilsLive } from "./repo/repoUtils";
import { RabbitMQ, RabbitMQLive } from "./rabbitmq/consumer";
import { handleMessage } from "./program";
import { BunFileSystem } from "@effect/platform-bun";
import { FetchHttpClient } from "@effect/platform";
import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OpenTelemetryConfigConfig } from "./layers/config";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const InfraLayer = Layer.mergeAll(FetchHttpClient.layer, BunFileSystem.layer);

const ServiceLayer = Layer.mergeAll(
  GitHubFactoryLive(),
  RepoUtilsLive,
  RabbitMQLive,
).pipe(Layer.provide(InfraLayer));

const OpenTelemetryLayer = Layer.unwrapEffect(
  Effect.map(OpenTelemetryConfigConfig, (config) => {
    const spanProcessor = config.tracesEnabled
      ? new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: config.tracesEndpoint,
          }),
        )
      : undefined;

    return NodeSdk.layer(() => ({
      resource: {
        serviceName: "github-service",
      },
      spanProcessor,
      metricReader: new PrometheusExporter({
        host: config.metricsHost,
        port: config.metricsPort,
        endpoint: config.metricsEndpoint,
      }),
    }));
  }),
);

const AppLayer = Layer.mergeAll(InfraLayer, ServiceLayer, OpenTelemetryLayer);

const consumer = Effect.scoped(
  Effect.gen(function* () {
    const mq = yield* RabbitMQ;
    yield* mq.consume((msg) =>
      handleMessage(msg).pipe(
        Effect.tapError((err) =>
          Effect.logError(`Unhandled error: ${String(err)}`),
        ),
      ),
    );

    yield* Effect.never;
  }).pipe(
    Effect.provide(AppLayer),
    Effect.catchTag("RabbitMQError", (err) => Effect.logError(err)),
  ),
);

Effect.runFork(consumer);
