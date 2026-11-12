import { Injectable, Logger } from "@nestjs/common";

/**
 * Runs fire-and-forget work after a request, e.g. the GitHub grant check
 * (ADR 0003). Callers never wait for a task, and a failing task is logged
 * instead of becoming an unhandled rejection.
 */
@Injectable()
export class BackgroundTasks {
  private readonly logger = new Logger(BackgroundTasks.name);
  private readonly pending = new Set<Promise<void>>();

  run(name: string, task: () => Promise<void>): void {
    // setImmediate, not a microtask: the task's synchronous part (e.g. the
    // scrypt in decryptSecret) must not run before the response is written.
    const promise = new Promise<void>((resolve) => setImmediate(resolve))
      .then(task)
      .catch((error: unknown) => {
        this.logger.error({
          action: "background_task_failed",
          task: name,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => this.pending.delete(promise));
    this.pending.add(promise);
  }

  /** Resolves once every task started so far (and any they start) is done. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all(this.pending);
    }
  }
}
