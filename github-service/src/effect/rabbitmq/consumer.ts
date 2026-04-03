import { Effect, Context, Layer, Data, Runtime, Schedule } from "effect";
import amqplib, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";
import { ServiceConfigConfig } from "../layers/config";

export class RabbitMQError extends Data.TaggedError("RabbitMQError")<{
  message: string;
  cause: unknown;
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

export const RabbitMQ = Context.GenericTag<RabbitMQ>("RabbitMQ");

export const RabbitMQLive = Layer.scoped(
  RabbitMQ,
  Effect.gen(function* () {
    const cfg = yield* ServiceConfigConfig;
    yield* Effect.logInfo("Trying to connect to RabbitMQ");

    const connection: ChannelModel = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => amqplib.connect(cfg.rabbitmqUrl),
        catch: (e) =>
          new RabbitMQError({
            message: "Failed to connect to RabbitMQ",
            cause: e,
          }),
      }),
      (conn) => Effect.promise(() => conn.close()).pipe(Effect.ignore),
    ).pipe(Effect.tap(() => Effect.logInfo("RabbitMQ connection established")));

    const channel: Channel = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => connection.createChannel(),
        catch: (e) =>
          new RabbitMQError({ message: "Failed to create channel", cause: e }),
      }),
      (chan) => Effect.promise(() => chan.close()).pipe(Effect.ignore),
    ).pipe(Effect.tap(() => Effect.logInfo("RabbitMQ channel created")));

    yield* Effect.tryPromise({
      try: () =>
        channel.assertQueue(cfg.queue, {
          durable: true,
          arguments: { "x-queue-type": "quorum" },
        }),
      catch: (e) =>
        new RabbitMQError({ message: "Failed to assert queue", cause: e }),
    }).pipe(
      Effect.tap(() =>
        Effect.logInfo(`RabbitMQ queue '${cfg.queue}' asserted`),
      ),
    );

    return RabbitMQ.of({
      consume: <E, R>(
        handler: (msg: ConsumeMessage) => Effect.Effect<void, E, R>,
      ): Effect.Effect<void, RabbitMQError, R> =>
        Effect.gen(function* () {
          const runtime = yield* Effect.runtime<R>();
          yield* Effect.tryPromise({
            try: () =>
              channel.consume(
                cfg.queue,
                (msg) => {
                  if (!msg) return;

                  Runtime.runFork(runtime)(
                    Effect.catchAll(handler(msg), (err) =>
                      Effect.log(
                        `ERROR: Message handling failed: ${String(err)}`,
                      ),
                    ).pipe(
                      Effect.tap(() => Effect.sync(() => channel.ack(msg))),
                    ),
                  );
                },
                { noAck: false },
              ),
            catch: (e) =>
              new RabbitMQError({ message: "Failed to consume", cause: e }),
          });
        }),

      publish: (pattern, data): Effect.Effect<void, RabbitMQError> =>
        Effect.gen(function* () {
          const payload = Buffer.from(
            JSON.stringify({ pattern, data }),
            "utf8",
          );
          yield* Effect.sync(() =>
            channel.sendToQueue(cfg.resultsQueue, payload, {
              persistent: true,
            }),
          );
        }),
    });
  }).pipe(
    Effect.retry(
      Schedule.intersect(
        Schedule.exponential(1000, 2),
        Schedule.recurs(5)
      ),
    ),
  ),
);
