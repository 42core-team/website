# 0003 – End sessions when the GitHub grant is revoked

- Status: Accepted
- Date: 2026-10-19
- Issue: [#787](https://github.com/42core-team/website/issues/787)
- Builds on: [ADR 0002 – Session refresh tokens](0002-session-refresh-tokens.md)

## Context

With ADR 0002, an active session can live indefinitely. Login is a GitHub
**OAuth App**. Every login stores the user's GitHub access token encrypted
in `users.githubAccessToken`, overwriting the previous one, so each user has
exactly one stored token: the one from their latest login. `github-service`
also uses that token to accept team repo invites for the user.

If the user revokes our app on GitHub, or GitHub revokes the token, their
session here keeps working, and repo invites quietly start failing.

What GitHub documents for OAuth App tokens (fetched 2026-10-19):

- **They don't expire on their own** unless expiring tokens are opted into,
  which this app doesn't do.
- **Events that revoke a token:**
  - the user revokes the app;
  - the token leaks to a public repo or gist, or is reported through the
    credential revocation API;
  - the app owner deletes the grant;
  - the user has more than 10 tokens for the same app and scope;
  - **one year without use.**
- **`POST /applications/{client_id}/token` ("Check a token")** returns 200 for
  a valid token and 404 for an invalid one. 422 means "validation failed or
  spammed". Rate limits come back as 403 or 429. Undocumented: a wrong client
  ID or secret probably also returns 404.

## Decision

1. **What it does:** after a successful `/auth/refresh`, the API checks with
   GitHub whether the user's stored token is still valid. It calls
   **`GET https://api.github.com/user` with the user's own token**, not
   "Check a token":

   | GitHub answer | Meaning | Action |
   | --- | --- | --- |
   | 200 | valid | set `githubCheckedAt = now`, sync profile (decision 6) |
   | 401 | revoked | revoke all families, log `github_grant_revoked` |
   | anything else, network error, timeout | unknown | fail open (decision 5) |

   Why `GET /user`:
   - A 401 for the user's own token can't be confused with our app being
     misconfigured. With "Check a token", a wrong client secret would
     probably also return 404 and log everyone out.
   - It counts as using the token, so GitHub's "unused for a year"
     auto-revocation never hits a user who is logged in.
   - It spends the user's own rate limit, not the app's shared one.

   When the token is revoked, the API revokes **all** of the user's
   refresh-token families. Their
   next refresh fails, and they log in via GitHub again, which re-grants
   access and stores a fresh token.
2. **Throttle:** at most **once per hour per user**, tracked in a new
   `users.githubCheckedAt` column.
3. **Which refresh paths:** the normal rotation and the legacy JWT upgrade
   (ADR 0002 decision 6). It is skipped on the 30 s grace path, which only
   follows a rotation that was just checked.
4. **Runs in the background** (with a 10 s timeout): the refresh response doesn't wait for GitHub.
   The check runs afterwards, so refresh latency is unchanged. A revocation
   takes effect at the user's next refresh: within 15 min after the check,
   or about 1 h 15 min in the worst case.
5. **Fails open:** if GitHub can't answer (timeout, 5xx, rate limit, 422), or
   the user has no usable stored token (empty, or it can't be decrypted), the
   session is kept and a warning is logged. `githubCheckedAt` is not advanced,
   so the next refresh tries again. Only an explicit 401 ends sessions.
6. **Profile sync:** on a 200, update `username` (from `login`), `name` (falls
   back to `login`) and `profilePicture` (from `avatar_url`), and write only
   when something changed. Users can't edit these fields in our app, so
   nothing of theirs is overwritten. Email stays login-only, because private
   emails would need an extra `/user/emails` call. This works alongside the
   existing `github_username_changed` event from `github-service`.
7. **No duplicate-check protection:** prod runs 2 API replicas, so the same
   user may occasionally be checked twice at once. `GET /user` is idempotent
   and cheap, so the throttle is best-effort.
8. **No special frontend message:** a user whose grant was revoked sees the
   normal logged-out state at their next failed refresh.

## Consequences

- Revoking the app on GitHub ends the user's sessions here within about
  1 h 15 min. Already-issued access JWTs keep working for up to 15 min (as in
  ADR 0002).
- Logged-in users' tokens stay "used", so they never hit GitHub's one-year
  auto-revocation, and repo-invite acceptance keeps a valid token.
- Usernames, names and avatars stay current within about an hour of a
  GitHub change, which keeps repo invites by username working.
- New column `users.githubCheckedAt` (nullable timestamp) plus a migration.
- At most one extra GitHub request per active user per hour, on the user's
  own rate limit.
- While GitHub is down, a warning is logged on each refresh per active user
  until it recovers, because `githubCheckedAt` isn't advanced.
- A bug in the background job can't break refresh, because it runs after the
  response and fails open. A bug that misreads a 401 could log users out,
  so the 401 path needs explicit tests.
