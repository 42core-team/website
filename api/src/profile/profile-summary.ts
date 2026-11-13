import { MatchPhase } from "../match/entites/match.entity";

export type ProfileMatchResult = "WIN" | "LOSS" | "DRAW";

/** One listed match from the player's side. */
export interface ProfileMatchRow {
  id: string;
  phase: MatchPhase;
  round: number;
  createdAt: Date;
  teamId: string;
  eventId: string;
  opponentId: string | null;
  result: ProfileMatchResult;
}

export interface MatchRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface RivalCount {
  opponentId: string;
  eventId: string;
  wins: number;
  losses: number;
  total: number;
}

export interface MatchSummary {
  record: MatchRecord;
  /** The latest matches, oldest first. */
  form: ProfileMatchRow[];
  streaks: {
    longestWin: number;
    current: { result: ProfileMatchResult; length: number } | null;
  };
  phases: Array<{ phase: MatchPhase } & MatchRecord>;
  /** Matches per UTC day, for the days from `since` through today. */
  activity: { since: string; days: Array<{ day: string; count: number }> };
  rivals: {
    /** Beat the player most often. */
    nemesis: RivalCount | null;
    /** Lost to the player most often. */
    favourite: RivalCount | null;
    mostPlayed: RivalCount | null;
  };
  /** Per team of the player: all its matches, and its Swiss ones. */
  teams: Map<string, { record: MatchRecord; swiss: MatchRecord }>;
}

export const FORM_LENGTH = 20;
export const ACTIVITY_DAYS = 365;
const RIVAL_MINIMUM = 2;
const PHASE_ORDER: MatchPhase[] = [
  MatchPhase.QUEUE,
  MatchPhase.SWISS,
  MatchPhase.ELIMINATION,
  MatchPhase.GAMBLING,
  MatchPhase.MANUAL,
];

function emptyRecord(): MatchRecord {
  return { wins: 0, losses: 0, draws: 0 };
}

function count(record: MatchRecord, result: ProfileMatchResult) {
  if (result === "WIN") record.wins++;
  else if (result === "LOSS") record.losses++;
  else record.draws++;
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The profile's numbers, computed on the server so they need no full list. */
export function summarizeMatches(
  matches: ProfileMatchRow[],
  now: Date,
): MatchSummary {
  const sorted = [...matches].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const record = emptyRecord();
  const phases = new Map<MatchPhase, MatchRecord>();
  const teams = new Map<string, { record: MatchRecord; swiss: MatchRecord }>();
  const rivals = new Map<string, RivalCount>();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const since = utcDay(new Date(today - (ACTIVITY_DAYS - 1) * 86_400_000));
  const days = new Map<string, number>();
  let longestWin = 0;
  let run = 0;
  let current = null as MatchSummary["streaks"]["current"];

  for (const match of sorted) {
    count(record, match.result);

    const phase = phases.get(match.phase) ?? emptyRecord();
    count(phase, match.result);
    phases.set(match.phase, phase);

    const team = teams.get(match.teamId) ?? {
      record: emptyRecord(),
      swiss: emptyRecord(),
    };
    count(team.record, match.result);
    if (match.phase === MatchPhase.SWISS) count(team.swiss, match.result);
    teams.set(match.teamId, team);

    run = match.result === "WIN" ? run + 1 : 0;
    longestWin = Math.max(longestWin, run);
    current =
      current?.result === match.result
        ? { result: match.result, length: current.length + 1 }
        : { result: match.result, length: 1 };

    const day = utcDay(match.createdAt);
    if (day >= since) days.set(day, (days.get(day) ?? 0) + 1);

    if (match.opponentId) {
      const rival = rivals.get(match.opponentId) ?? {
        opponentId: match.opponentId,
        eventId: match.eventId,
        wins: 0,
        losses: 0,
        total: 0,
      };
      rival.total++;
      if (match.result === "WIN") rival.wins++;
      if (match.result === "LOSS") rival.losses++;
      rivals.set(match.opponentId, rival);
    }
  }

  const top = (score: (rival: RivalCount) => number) => {
    let best: RivalCount | null = null;
    for (const rival of rivals.values()) {
      if (score(rival) < RIVAL_MINIMUM) continue;
      if (
        !best ||
        score(rival) > score(best) ||
        (score(rival) === score(best) && rival.total > best.total)
      )
        best = rival;
    }
    return best;
  };

  return {
    record,
    form: sorted.slice(-FORM_LENGTH),
    streaks: { longestWin, current },
    phases: PHASE_ORDER.filter((phase) => phases.has(phase)).map((phase) => ({
      phase,
      ...phases.get(phase)!,
    })),
    activity: {
      since,
      days: [...days]
        .map(([day, matchCount]) => ({ day, count: matchCount }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    },
    rivals: {
      nemesis: top((rival) => rival.losses),
      favourite: top((rival) => rival.wins),
      mostPlayed: top((rival) => rival.total),
    },
    teams,
  };
}
