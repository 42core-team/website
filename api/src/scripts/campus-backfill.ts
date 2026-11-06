import { FortyTwoProfile, getPrimaryCampus } from "../auth/fortytwo.strategy";

/** Lookup errors that will fail for every account, so the backfill stops. */
export class FatalLookupError extends Error {}

const INTRA_API_URL = "https://api.intra.42.fr";
// The default 42 application limit is 2 requests per second.
const REQUEST_INTERVAL_MS = 600;
const MAX_ATTEMPTS = 5;

export interface CampusAccount {
  id: string;
  platformUserId: string;
  username: string;
  campusId: number | null;
  campusName: string | null;
}

export type CampusLookup =
  { status: "found"; profile: FortyTwoProfile } | { status: "not_found" };

export interface BackfillOptions {
  accounts: CampusAccount[];
  lookup: (platformUserId: string) => Promise<CampusLookup>;
  save: (
    accountId: string,
    campus: { campusId: number; campusName: string },
  ) => Promise<void>;
  apply: boolean;
  log?: (message: string) => void;
}

export interface BackfillSummary {
  updated: number;
  unchanged: number;
  noPrimaryCampus: number;
  notFound: number;
  failed: number;
}

export async function backfillCampuses({
  accounts,
  lookup,
  save,
  apply,
  log = console.log,
}: BackfillOptions): Promise<BackfillSummary> {
  const summary: BackfillSummary = {
    updated: 0,
    unchanged: 0,
    noPrimaryCampus: 0,
    notFound: 0,
    failed: 0,
  };

  for (const [index, account] of accounts.entries()) {
    const prefix = `[${index + 1}/${accounts.length}] ${account.username}`;
    try {
      const result = await lookup(account.platformUserId);
      if (result.status === "not_found") {
        summary.notFound++;
        log(`${prefix}: not found on 42 intra`);
        continue;
      }
      const { campusId, campusName } = getPrimaryCampus(result.profile);
      if (campusId === null || campusName === null) {
        summary.noPrimaryCampus++;
        log(`${prefix}: no primary campus`);
        continue;
      }
      if (campusId === account.campusId && campusName === account.campusName) {
        summary.unchanged++;
        continue;
      }
      if (apply) await save(account.id, { campusId, campusName });
      summary.updated++;
      log(
        `${prefix}: ${account.campusName ?? "(none)"} -> ${campusName}${apply ? "" : " (dry run)"}`,
      );
    } catch (error) {
      if (error instanceof FatalLookupError) throw error;
      summary.failed++;
      log(
        `${prefix}: failed (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  return summary;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry-After as a delay in ms (delta-seconds or HTTP-date), else null. */
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  const delay = Number.isNaN(seconds)
    ? Date.parse(value) - now
    : seconds * 1000;
  return Number.isFinite(delay) && delay > 0 ? delay : null;
}

/** Looks up 42 users one by one, spaced to stay below the rate limit. */
export function createIntraLookup(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<unknown> = sleep,
) {
  let nextRequestAt = 0;

  return async (platformUserId: string): Promise<CampusLookup> => {
    for (let attempt = 1; ; attempt++) {
      const delay = nextRequestAt - Date.now();
      if (delay > 0) await wait(delay);
      nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

      const response = await fetchImpl(
        `${INTRA_API_URL}/v2/users/${encodeURIComponent(platformUserId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (response.ok)
        return {
          status: "found",
          profile: (await response.json()) as FortyTwoProfile,
        };
      // Release the connection of a response whose body is not read.
      await response.body?.cancel();
      if (response.status === 404) return { status: "not_found" };
      // A rejected or insufficient token fails the same way for every user.
      if (response.status === 401 || response.status === 403)
        throw new FatalLookupError(
          `The access token was rejected (${response.status}).`,
        );
      if (response.status === 429 || response.status >= 500) {
        const cooldown =
          parseRetryAfter(response.headers.get("retry-after")) ??
          2 ** attempt * 1000;
        if (attempt < MAX_ATTEMPTS) {
          await wait(cooldown);
          continue;
        }
        // The next account's lookup still has to wait out the cooldown.
        nextRequestAt = Date.now() + cooldown;
      }
      throw new Error(`42 API error ${response.status}`);
    }
  };
}
