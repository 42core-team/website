export function getEventLockKey(eventId: string): [number, number] {
  const hex = eventId.replace(/-/g, "");
  const part1 = parseInt(hex.slice(0, 8), 16) | 0;
  const part2 = parseInt(hex.slice(8, 16), 16) | 0;
  return [part1, part2];
}

/** Holds the event's advisory lock until the surrounding transaction ends. */
export function lockEvent(
  runner: { query(query: string, parameters?: unknown[]): Promise<unknown> },
  eventId: string,
) {
  return runner.query(
    "SELECT pg_advisory_xact_lock($1, $2)",
    getEventLockKey(eventId),
  );
}
