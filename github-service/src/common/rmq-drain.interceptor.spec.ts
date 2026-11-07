import { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, Subject, throwError } from "rxjs";
import {
  RMQ_DRAIN_TIMEOUT_MS,
  RmqDrainInterceptor,
} from "./rmq-drain.interceptor";

const createChannel = () => ({
  ack: jest.fn(),
  cancel: jest.fn().mockResolvedValue(undefined),
});

const createContext = (
  channel: ReturnType<typeof createChannel>,
  message: unknown,
) =>
  ({
    switchToRpc: () => ({
      getContext: () => ({
        getChannelRef: () => channel,
        getMessage: () => message,
      }),
    }),
  }) as unknown as ExecutionContext;

const message = { fields: { consumerTag: "consumer-1" } };

describe("RmqDrainInterceptor", () => {
  let interceptor: RmqDrainInterceptor;
  let channel: ReturnType<typeof createChannel>;

  beforeEach(() => {
    interceptor = new RmqDrainInterceptor();
    channel = createChannel();
  });

  const startHandler = () => {
    const handler = new Subject<void>();
    const result = lastValueFrom(
      interceptor.intercept(createContext(channel, message), {
        handle: () => handler,
      } as CallHandler),
      { defaultValue: undefined },
    );
    return { handler, result };
  };

  it("acknowledges only after the handler finished", async () => {
    const { handler, result } = startHandler();
    expect(channel.ack).not.toHaveBeenCalled();

    handler.complete();
    await result;

    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it("acknowledges a failed handler instead of retrying it forever", async () => {
    const result = lastValueFrom(
      interceptor.intercept(createContext(channel, message), {
        handle: () => throwError(() => new Error("failed")),
      }),
    );

    await expect(result).rejects.toThrow("failed");
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it("survives a channel that closed before the acknowledgement", async () => {
    channel.ack.mockImplementation(() => {
      throw new Error("Channel closed");
    });
    const { handler, result } = startHandler();

    handler.complete();

    await expect(result).resolves.toBeUndefined();
  });

  it("stops consuming and waits for running handlers on shutdown", async () => {
    const { handler, result } = startHandler();
    let drained = false;

    const shutdown = interceptor
      .beforeApplicationShutdown()
      .then(() => (drained = true));
    await new Promise((resolve) => setImmediate(resolve));

    expect(channel.cancel).toHaveBeenCalledWith("consumer-1");
    expect(drained).toBe(false);

    handler.complete();
    await Promise.all([result, shutdown]);
    expect(drained).toBe(true);
  });

  it("cancels a consumer that first appears during the drain", async () => {
    await interceptor.beforeApplicationShutdown();
    expect(channel.cancel).not.toHaveBeenCalled();

    startHandler();

    expect(channel.cancel).toHaveBeenCalledWith("consumer-1");
  });

  it("stops waiting after the timeout, leaving the message unacknowledged", async () => {
    jest.useFakeTimers();
    try {
      startHandler();

      const shutdown = interceptor.beforeApplicationShutdown();
      await jest.advanceTimersByTimeAsync(RMQ_DRAIN_TIMEOUT_MS);
      await shutdown;

      expect(channel.ack).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
