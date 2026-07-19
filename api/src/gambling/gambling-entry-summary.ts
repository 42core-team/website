interface GamblingEntrySummarySource {
  team: { id: string; name: string } | null;
}

export function toGamblingEntrySummaries(
  entries: GamblingEntrySummarySource[],
) {
  return entries.flatMap((entry) =>
    entry.team ? [{ id: entry.team.id, name: entry.team.name }] : [],
  );
}
