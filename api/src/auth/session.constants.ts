import type { ConfigService } from "@nestjs/config";

/**
 * Session lifetimes (ADR 0002 – session refresh tokens). Every timing constant
 * of the access/refresh token pair lives here so they stay consistent.
 */
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Lifetime of the access JWT and of its `token` cookie. */
export const ACCESS_TOKEN_TTL_MS = 15 * MINUTE_MS;

/** A session expires after this much inactivity; renewed on every rotation. */
export const REFRESH_TOKEN_IDLE_TTL_MS = 90 * DAY_MS;

/** Re-presenting a rotated token within this window is a harmless multi-tab race. */
export const REFRESH_TOKEN_ROTATION_GRACE_MS = 30 * SECOND_MS;

/** Revoked or rotated rows are kept this long before the cleanup job deletes them. */
export const REFRESH_TOKEN_RETENTION_MS = DAY_MS;

export const REFRESH_TOKEN_BYTES = 32;

/** The user's GitHub grant is re-checked at most this often (ADR 0003). */
export const GITHUB_GRANT_CHECK_INTERVAL_MS = 60 * MINUTE_MS;

/** A GitHub grant check that takes longer than this counts as "unknown". */
export const GITHUB_GRANT_CHECK_TIMEOUT_MS = 10 * SECOND_MS;

export const REFRESH_COOKIE_NAME = "refresh_token";

/** The refresh cookie is only sent to `/auth/*`, never on normal API calls. */
export const REFRESH_COOKIE_PATH = "/auth";

/** Name of the access-token cookie (`token` unless AUTH_COOKIE_NAME is set). */
export function getAuthCookieName(config: Pick<ConfigService, "get">): string {
  return config.get<string>("AUTH_COOKIE_NAME") || "token";
}
