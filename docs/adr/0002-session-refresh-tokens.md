# 0002 – Session refresh tokens

- Status: Accepted
- Date: 2026-10-19
- Issue: [#684 – token refresh logic so you do not have to login](https://github.com/42core-team/website/issues/684)
- See also: [ADR 0003 – End sessions when the GitHub grant is revoked](0003-github-grant-check.md)

## Context

Login (GitHub OAuth) sets a single httpOnly `token` cookie containing a JWT
signed with `JWT_SECRET` and a **fixed 30-day expiry**
(`api/src/auth/auth.module.ts`, `api/src/auth/auth.controller.ts`). The token is
never re-issued, so even users who are active every day are logged out on day 30
and have to go through OAuth again.

`POST /auth/logout` only clears the cookie; the JWT itself stays valid until it
expires. The only server-side kill switch is deleting the user, because
`JwtStrategy.validate` reloads the user on every request.

The frontend is a client-side SPA that sends the cookie via axios
(`withCredentials: true`). `useSession` treats any `/auth/me` failure as
"unauthenticated" and there is no 401 handling.

## Decision

1. **Goal:** active users are never forced to log in again; only inactive
   sessions expire.
2. **Mechanism:** replace the single long-lived JWT with an **access + refresh
   token pair**:
   - a short-lived access JWT (still the `token` cookie, still validated by
     `JwtStrategy`);
   - an opaque refresh token, stored **hashed** in the database and **rotated**
     on every use;
   - a `POST /auth/refresh` endpoint that exchanges a valid refresh token for a
     new pair;
   - an axios interceptor in the frontend that, on 401, calls `/auth/refresh`
     and retries the original request.

   This gives real server-side revocation: logout invalidates the session.
3. **Lifetime:** a session expires after **90 days of inactivity** (no refresh
   within 90 days). There is **no absolute cap**: an active session lives
   indefinitely.

4. **Access token lifetime: 15 minutes.** This is also the longest time a
   revoked session can keep working.
5. **Rotation and reuse detection.**
   - *Token family:* each login starts a family. Each refresh rotates the
     token (T0 → T1 → T2 …), and all of them belong to the same family. The
     family is the session.
   - *Grace window (30 s):* browser tabs share cookies, so tabs that get a 401
     at the same time send the same refresh token. If an already-rotated token
     is presented within 30 s of its rotation, we treat it as a harmless race:
     the response carries a **new access JWT only**. The refresh cookie is not
     touched, and the browser keeps the successor set by the first response.
     (We can't re-send the successor because only hashes are stored.)
   - *Family kill:* if an already-rotated token is presented after the grace
     window, we treat it as theft and revoke the whole family. Everyone
     holding that session, legitimate user included, has to log in again.
6. **Migration:** new access JWTs carry a `fid` (family id) claim. A JWT
   without `fid` is a *legacy* token. `JwtStrategy` rejects legacy tokens
   with 401, so the frontend calls `/auth/refresh`. For a transition period,
   `/auth/refresh` accepts a valid legacy 30-day JWT (when there's no refresh
   cookie) and mints a new family, so the deploy doesn't log anyone out.
   The exchange is not tracked server-side, so it is not limited to one use
   (see Consequences).
7. **Revocation scope for #684:**
   - `POST /auth/logout` revokes the current family.
   - "Log out everywhere" revokes all of the user's families.
   - Out of scope: admin session kill and an active-sessions list.

8. **Cookies:**
   - `token`: access JWT, httpOnly, Secure, SameSite=Lax, Max-Age 15 min.
   - `refresh_token`: opaque refresh token, httpOnly, Secure, SameSite=Lax,
     `path=/auth` (sent only to `/auth/*`, never on normal API calls),
     Max-Age 90 days, renewed on every rotation.
9. **CSRF:** `createCsrfProtection` currently checks only when the `token`
   cookie is present. It must also check when `refresh_token` is present.
   Otherwise `POST /auth/refresh` and `POST /auth/logout` skip the check after
   the access cookie has expired.
10. **Legacy upgrade path is temporary:** legacy JWTs expire on their own
    within 30 days of deploy. A follow-up PR removes the upgrade branch after
    that, tracked by a TODO and an issue.
11. **Frontend refresh is reactive and single-flight:** an axios response
    interceptor catches a 401 from any endpoint except `/auth/refresh` and
    `/auth/logout` (it does include `/auth/me`, which `useSession` calls on
    page load). It starts one shared in-flight `POST /auth/refresh` per tab,
    then retries the original request once. If the refresh fails, the session
    query is set to `null` and the logged-out UI shows. No forced redirect.

12. **"Log out everywhere"** (`POST /auth/logout-all`, behind `JwtAuthGuard`,
    so an expired access token gets refreshed first, then retried) revokes all of the
    user's families, including the current one. It's a button with a confirm
    dialog on `/profile` (`frontend/src/routes/profile.tsx`). We accept that
    access JWTs already issued on other devices keep working for up to 15 min.
13. **Cleanup:** a daily `@nestjs/schedule` cron job deletes refresh-token rows
    that have expired (idle for more than 90 days), or that were revoked or
    rotated more than a day ago.
14. **Refresh re-checks the user:** `/auth/refresh` loads the user, the same
    way `JwtStrategy.validate` does, and fails if the user no longer exists.

### API contract

| Endpoint | Auth | Success | Failure |
| --- | --- | --- | --- |
| `POST /auth/refresh` | `refresh_token` cookie (or legacy JWT in `token`) | 204; sets `token` (and `refresh_token` on rotation) | 401; clears both cookies |
| `POST /auth/logout` | none (uses `refresh_token` if present) | 204; revokes the family, clears both cookies | — |
| `POST /auth/logout-all` | `JwtAuthGuard` | 204; revokes all of the user's families, clears both cookies | 401 |

The GitHub OAuth callback starts a new family and sets both cookies.

### Sketch

```
refresh_tokens(
  id, userId → users, familyId, tokenHash (SHA-256, unique),
  expiresAt,             -- now + 90 days, renewed on rotation
  rotatedAt NULL,        -- set when exchanged for a successor
  revokedAt NULL,
  createdAt
)

POST /auth/refresh
  legacy: no refresh cookie, but a valid legacy JWT in `token`
          → start a new family (temporary, see 10)
  row = find(hash(cookie)); missing / expired / revoked → 401
  if row.rotated_at:
    if now - rotated_at < 30s → set new access cookie only
    else                      → revoke family, 401
  else → mark row rotated, insert successor in same family,
         set both cookies
```

## Consequences

- Active users stay logged in indefinitely. A session ends only after 90 days
  of inactivity, on logout, on "log out everywhere", or when theft is detected.
- Logout actually revokes. Any revocation takes effect within at most 15 min
  (the lifetime of the access token).
- New state: a `refresh_tokens` table plus a migration in `api/db/migrations`,
  and a daily cleanup job.
- The frontend now depends on the 401 → refresh → retry interceptor. Any new
  auth endpoint that must not trigger a refresh has to be added to its
  exclusion list.
- Rare false positive: a reuse more than 30 s after rotation (for example a
  tab that was suspended mid-request) logs that session out.
- Accepted risk: a legacy JWT stolen before the deploy can be exchanged for
  new families repeatedly until it expires (at most 30 days after deploy), and
  "log out everywhere" does not stop that. Families it created keep living
  under the normal 90-day idle rule.
- Follow-up: remove the legacy upgrade path 30 days after deploy (#785).
