import type { Repository, SelectQueryBuilder } from "typeorm";
import { MatchEntity, MatchState } from "./entites/match.entity";

/**
 * How long a started match may go without a result before it is restarted.
 * Longer than the game Job's ActiveDeadlineSeconds (30 minutes, see
 * buildGameResources in k8s-service/internal/kube/game.go), so a Job that
 * Kubernetes still lets run is never replaced.
 */
export const STALE_MATCH_TIMEOUT_MINUTES = 35;

/**
 * Matches whose last start is older than this are ignored. Every restart sets
 * startedAt again, so this bounds the window from the last start: a match the
 * cron gave up on is logged for at most this long and then left alone.
 */
export const STALE_MATCH_MAX_AGE_HOURS = 24;

/** Starts per match, the first one included, before the cron gives up. */
export const MAX_START_ATTEMPTS = 3;

export type StaleMatch = Pick<MatchEntity, "id" | "state" | "startAttempts">;

// Matches started before startedAt existed have it NULL and are never touched.
const STARTED_IN_WINDOW = (column: string) =>
  `(${column} < now() - make_interval(mins => :timeoutMinutes)
    AND ${column} > now() - make_interval(hours => :maxAgeHours))`;

const WINDOW_PARAMETERS = {
  timeoutMinutes: STALE_MATCH_TIMEOUT_MINUTES,
  maxAgeHours: STALE_MATCH_MAX_AGE_HOURS,
};

/**
 * IN_PROGRESS matches whose last start is inside the window, plus PLANNED
 * matches that were started before but put back (a restart whose start threw,
 * or an API crash between the two steps of a restart). Fresh PLANNED matches
 * have no startedAt and are left to their own flow.
 */
function whereStale(query: SelectQueryBuilder<MatchEntity>) {
  return query
    .where(`"match"."state" IN (:inProgress, :planned)`)
    .andWhere(STARTED_IN_WINDOW(`"match"."startedAt"`))
    .setParameters({
      inProgress: MatchState.IN_PROGRESS,
      planned: MatchState.PLANNED,
      ...WINDOW_PARAMETERS,
    });
}

export function findStaleMatches(
  matches: Repository<MatchEntity>,
): Promise<StaleMatch[]> {
  return whereStale(
    matches
      .createQueryBuilder("match")
      .select(["match.id", "match.state", "match.startAttempts"]),
  )
    .orderBy("match.id")
    .getMany();
}

/**
 * Puts a stale IN_PROGRESS match back to PLANNED, but only if it is still the
 * same stale run: a result that arrived meanwhile (FINISHED) or another start
 * (startAttempts changed) wins. Returns whether this caller flipped it.
 */
export async function resetStaleMatch(
  matches: Repository<MatchEntity>,
  match: StaleMatch,
): Promise<boolean> {
  const result = await matches
    .createQueryBuilder()
    .update(MatchEntity)
    .set({ state: MatchState.PLANNED })
    .where("id = :id", { id: match.id })
    .andWhere("state = :inProgress", { inProgress: MatchState.IN_PROGRESS })
    .andWhere(`"startAttempts" = :startAttempts`, {
      startAttempts: match.startAttempts,
    })
    .andWhere(STARTED_IN_WINDOW(`"startedAt"`), WINDOW_PARAMETERS)
    .execute();
  return result.affected === 1;
}
