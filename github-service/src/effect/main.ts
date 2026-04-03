import { Effect, Layer } from "effect";
import { GitHubFactoryLive } from "./github/gitHubClient";
import { RepoUtilsLive } from "./repo/repoUtils";
import { RabbitMQ, RabbitMQLive } from "./rabbitmq/consumer";
import { handleMessage } from "./program";
import { BunFileSystem } from "@effect/platform-bun";
import { FetchHttpClient } from "@effect/platform";

const InfraLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  BunFileSystem.layer,
);

const ServiceLayer = Layer.mergeAll(
  GitHubFactoryLive(),
  RepoUtilsLive,
  RabbitMQLive,

).pipe(Layer.provide(InfraLayer));

const AppLayer = Layer.merge(InfraLayer, ServiceLayer);

const program = Effect.gen(function* () {
  const mq = yield* RabbitMQ;
  yield* mq.consume((msg) =>
    handleMessage(msg).pipe(
      Effect.catchAll((err) => Effect.log(`Unhandled error: ${String(err)}`)),
    ),
  );
}).pipe(
  Effect.provide(AppLayer),
  Effect.catchTag("RabbitMQError", (err) => Effect.logError(err)),
);

Effect.runPromise(program)
