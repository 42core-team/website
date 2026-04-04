import { Effect, Context, Layer, Data, Schedule, Stream } from "effect";
import * as AMQPChannel from "@effect-messaging/amqp/AMQPChannel";
import * as AMQPConnection from "@effect-messaging/amqp/AMQPConnection";
import type { AMQPConsumeMessage as ConsumeMessage } from "@effect-messaging/amqp/AMQPConsumeMessage";
import { ServiceConfigConfig } from "../layers/config";

export class RabbitMQError extends Data.TaggedError("RabbitMQError")<{
  message: string;
  cause?: unknown;
}> {}

export interface RabbitMQ {
  readonly consume: <E, R>(
    handler: (msg: ConsumeMessage) => Effect.Effect<void, E, R>,
  ) => Effect.Effect<void, RabbitMQError, R>;

  readonly publish: (
    pattern: string,
    data: unknown,
  ) => Effect.Effect<void, RabbitMQError>;
}

const retrySchedule = Schedule.intersect(
  Schedule.exponential(1000, 2),
  Schedule.recurs(5),
);

const reconnectSchedule = Schedule.exponential(1000, 2);
const connectionTimeout = "20 seconds";

export const RabbitMQ = Context.GenericTag<RabbitMQ>("RabbitMQ");

export const RabbitMQLive = Layer.scoped(
  RabbitMQ,
  Effect.gen(function* () {
    const cfg = yield* ServiceConfigConfig;
    yield* Effect.logInfo("Trying to connect to RabbitMQ");

    const connection = yield* AMQPConnection.make(cfg.rabbitmqUrl, {
      connectionTimeout,
      waitConnectionTimeout: connectionTimeout,
      retryConnectionSchedule: reconnectSchedule,
    }).pipe(
      Effect.mapError(
        (e) =>
          new RabbitMQError({
            message: `Failed to connect to RabbitMQ: ${e.reason}`,
            cause: e,
          }),
      ),
      Effect.tap(() => Effect.logInfo("RabbitMQ connection established")),
    );

    const channel = yield* AMQPChannel.make({
      waitChannelTimeout: connectionTimeout,
      retryConnectionSchedule: reconnectSchedule,
      retryConsumptionSchedule: reconnectSchedule,
    }).pipe(
      Effect.provideService(AMQPConnection.AMQPConnection, connection),
      Effect.mapError(
        (e) =>
          new RabbitMQError({
            message: `Failed to create RabbitMQ channel: ${e.reason}`,
            cause: e,
          }),
      ),
      Effect.tap(() => Effect.logInfo("RabbitMQ channel created")),
    );

    yield* channel
      .assertQueue(cfg.queue, {
        durable: true,
        arguments: { "x-queue-type": "quorum" },
      })
      .pipe(
        Effect.mapError(
          (e) =>
            new RabbitMQError({
              message: `Failed to assert queue '${cfg.queue}': ${e.reason}`,
              cause: e,
            }),
        ),
        Effect.tap(() =>
          Effect.logInfo(`RabbitMQ queue '${cfg.queue}' asserted`),
        ),
      );

    return RabbitMQ.of({
      consume: <E, R>(
        handler: (msg: ConsumeMessage) => Effect.Effect<void, E, R>,
      ): Effect.Effect<void, RabbitMQError, R> =>
        Effect.gen(function* () {
          const stream = yield* channel.consume(cfg.queue);
          yield* Stream.runForEach(stream, (msg) =>
            handler(msg).pipe(
              Effect.tap(() => channel.ack(msg)),
              Effect.catchAll((err) =>
                Effect.gen(function* () {
                  const payload = msg.content.toString("utf8");
                  yield* Effect.logError(
                    `Message handling failed: ${String(err)} | payload=${payload}`,
                  );
                  yield* channel.nack(msg, false, false);
                }),
              ),
            ),
          ).pipe(
            Effect.mapError(
              (e) =>
                new RabbitMQError({
                  message: `RabbitMQ consume failed: ${e.reason}`,
                  cause: e,
                }),
            ),
            Effect.retry(reconnectSchedule),
          );
        }),

      publish: (pattern, data): Effect.Effect<void, RabbitMQError> =>
        Effect.gen(function* () {
          const payload = Buffer.from(
            JSON.stringify({ pattern, data }),
            "utf8",
          );
          const sent = yield* channel
            .sendToQueue(cfg.resultsQueue, payload, {
              persistent: true,
            })
            .pipe(
              Effect.mapError(
                (e) =>
                  new RabbitMQError({
                    message: `Failed to publish to '${cfg.resultsQueue}': ${e.reason}`,
                    cause: e,
                  }),
              ),
            );
          if (!sent) {
            yield* Effect.fail(
              new RabbitMQError({
                message: "Channel buffer full, message not sent",
                cause: undefined,
              }),
            );
          }
        }).pipe(Effect.retry(retrySchedule)),
    });
  }).pipe(Effect.retry(reconnectSchedule)),
);
