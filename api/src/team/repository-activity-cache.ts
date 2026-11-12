import type {
  RepositoryActivityResult,
  RepositoryActivityStatus,
} from "../github-api/github-api.service";

const CONFIRMED_STATUS_TTL_MS = 30000;

/**
 * Keeps repeated activity checks from spending the event's GitHub quota: checks
 * of one event run one at a time and reuse recently confirmed statuses. An
 * "unknown" status is not kept, so checking again can still resolve it.
 */
export class RepositoryActivityCache {
  private readonly confirmed = new Map<
    string,
    Map<string, { status: RepositoryActivityStatus; expiresAt: number }>
  >();
  private readonly running = new Map<string, Promise<unknown>>();

  async get(
    eventId: string,
    scope: string,
    repositoryNames: string[],
    fetchActivity: (
      repositoryNames: string[],
    ) => Promise<RepositoryActivityResult[]>,
  ): Promise<Map<string, RepositoryActivityStatus>> {
    while (this.running.has(eventId))
      await this.running.get(eventId)?.catch(() => undefined);

    // Checks run per event, but a result is only reusable within its scope.
    const cacheKey = `${eventId}:${scope}`;
    const entries = this.freshEntries(cacheKey);
    const statuses = new Map(
      [...entries].map(([name, entry]) => [name, entry.status]),
    );
    const missing = repositoryNames.filter((name) => !statuses.has(name));
    if (missing.length === 0) return statuses;

    const run = fetchActivity(missing);
    this.running.set(eventId, run);
    try {
      const results = await run;
      const expiresAt = Date.now() + CONFIRMED_STATUS_TTL_MS;
      for (const { repositoryName, status } of results) {
        statuses.set(repositoryName, status);
        if (status !== "unknown")
          entries.set(repositoryName, { status, expiresAt });
      }
      this.confirmed.set(cacheKey, entries);
      return statuses;
    } finally {
      this.running.delete(eventId);
    }
  }

  private freshEntries(cacheKey: string) {
    const now = Date.now();
    return new Map(
      [...(this.confirmed.get(cacheKey) ?? [])].filter(
        ([, entry]) => entry.expiresAt > now,
      ),
    );
  }
}
