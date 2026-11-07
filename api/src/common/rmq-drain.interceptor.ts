import {
  BeforeApplicationShutdown,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { RmqContext } from "@nestjs/microservices";
import { finalize, Observable } from "rxjs";

// Must fit in terminationGracePeriodSeconds, with the preStop sleep and closing HTTP.
export const RMQ_DRAIN_TIMEOUT_MS = 30_000;

type RmqChannel = {
  ack(message: unknown): void;
  cancel(consumerTag: string): Promise<unknown>;
};

/**
 * Acknowledges a message once its handler has finished, so a message whose pod
 * dies mid-handler is redelivered instead of lost. Handlers can therefore run
 * twice for one message. A failed handler is still acknowledged, because only a
 * lost pod should cause a retry.
 *
 * On shutdown it stops consuming and waits for the running handlers.
 */
@Injectable()
export class RmqDrainInterceptor
  implements NestInterceptor, BeforeApplicationShutdown
{
  private readonly logger = new Logger(RmqDrainInterceptor.name);
  private readonly consumers = new Map<string, RmqChannel>();
  private inFlight = 0;
  private draining = false;
  private notifyIdle?: () => void;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rmqContext = context.switchToRpc().getContext<RmqContext>();
    const channel = rmqContext.getChannelRef() as RmqChannel;
    const message = rmqContext.getMessage() as {
      fields: { consumerTag: string };
    };
    this.trackConsumer(message.fields.consumerTag, channel);

    this.inFlight++;
    return next.handle().pipe(
      finalize(() => {
        this.acknowledge(channel, message);
        this.inFlight--;
        if (this.inFlight === 0) this.notifyIdle?.();
      }),
    );
  }

  async beforeApplicationShutdown() {
    if (this.draining) return;
    this.draining = true;
    this.consumers.forEach((channel, tag) => this.cancel(tag, channel));
    if (this.inFlight === 0) return;

    this.logger.log(`Waiting for ${this.inFlight} running message handlers`);
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      new Promise<void>((resolve) => (this.notifyIdle = resolve)),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          this.logger.warn(
            `${this.inFlight} message handlers still running, they will be redelivered`,
          );
          resolve();
        }, RMQ_DRAIN_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);
  }

  private trackConsumer(tag: string, channel: RmqChannel) {
    if (this.consumers.get(tag) === channel) return;
    this.consumers.set(tag, channel);
    // Only messages reveal a consumer, so one can first appear during the drain.
    if (this.draining) this.cancel(tag, channel);
  }

  private cancel(tag: string, channel: RmqChannel) {
    channel
      .cancel(tag)
      .catch((error) =>
        this.logger.warn(`Could not cancel consumer ${tag}: ${error}`),
      );
  }

  private acknowledge(channel: RmqChannel, message: unknown) {
    try {
      channel.ack(message);
    } catch (error) {
      // The channel is gone, so the broker redelivers the message by itself.
      this.logger.warn(`Could not acknowledge message: ${error}`);
    }
  }
}
