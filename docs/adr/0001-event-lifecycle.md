---
status: accepted
---

# Separate event lifecycle from repository operations and presentation timing

Events previously used independent dates and flags to control registration, repository access, matchmaking, and presentation. These could disagree: the coding deadline looked like the event's end, and asynchronous permission changes looked complete before GitHub confirmed them. We adopt an explicit event lifecycle with separately tracked repository operations.

## Lifecycle and schedule

`REGISTRATION → PLAYING → SUBMISSIONS_CLOSED → SHOWCASE → COMPLETED`

- Registration permits event joining (explicit and whitelisted for private events; implicit for public events, where every signed-in user counts as registered), team creation, and roster changes without repository creation.
- Playing begins automatically at `startDate`. Registration and roster changes remain open until `submissionDeadline`; late teams receive repositories during playing. Each team must have confirmed repository readiness before matchmaking.
- Submissions close automatically at `submissionDeadline`. New participant matches, registrations, roster changes, and bets stop immediately. Already-running matches may finish. Repository permission locking runs asynchronously.
- Admins enter Showcase after participating repositories are confirmed locked or affected teams are explicitly excluded. Existing Swiss/elimination execution and individual reveal controls remain the presentation workflow.
- Admins mark the event Completed, recording `completedAt`. Completion does not require every game to have been revealed. Viewing teams, existing replays, and published results remains available after submission closure.

`scheduledEndDate` is the advertised finish of the whole event, including showcase. It has no automatic completion effect. `completedAt` records the actual finish. The optional livestream intro is an informational milestone, defaulting to 15 minutes before `startDate` with configurable lead time; it is not another permission-changing state.

Participant-facing text names the phases Registration, Coding, Code freeze, Showtime, and Completed; the stored states keep their names. An optional stream URL is offered for the intro and during Showtime; an optional separate Showtime stream replaces it during Showtime only. A timed agenda for the period between code freeze and showtime is out of scope until separately decided.

## Repository operations

Provisioning, locking, and unlocking have their own progress, failure, and acknowledgement states. Publishing a message is not evidence that GitHub has completed an operation. Failed operations can be retried; delayed results must be reconciled with the current event phase. Tournament generation requires confirmed locks for all nonexcluded entrants.

The submission mechanism is repository permission locking, rather than immutable per-team commit snapshots. This is an explicit product choice: tournament execution continues to use repository contents. Consequently the scheduled cutoff and confirmed external push denial are distinct moments; operational progress must remain visible to admins. Participants only see repository failures; in-progress operations are not shown to them.

## Administrative reopening

Admins may reopen from Submissions closed, Showcase, or Completed, regardless of tournament progress. Reopening requires a new future submission deadline, clears `completedAt`, and restores registration, roster changes, matchmaking, and betting under their existing eligibility rules. Each team's matchmaking waits for confirmed restoration of write access.

Existing matches, tournament progress, reveals, standings, and bets are retained. Settled bets are not reopened or refunded automatically. No tournament-progress guard or automatic reset is introduced: the administrator intentionally controls reopening even after results exist.

## Migration

Existing `endDate` supplies the scheduled end; `repoLockDate` supplies the submission deadline. Historical events whose old end date has passed become Completed, using that end date as an inferred historical completion time. Other events are classified using their lock/deadline and start dates. These historical completion times are estimates, not newly observed admin actions.

## Consequences

Backend request-time checks enforce competition boundaries independently of scheduler latency. UI availability reflects the same lifecycle, while repository progress is shown separately on the admin dashboard. The scheduled event finish no longer removes an ongoing showcase from the live event experience. Reopening deliberately preserves previously computed results, so lifecycle transitions do not imply tournament resets.

The API and GitHub service must both support the acknowledged repository-operation protocol. Apply the database migrations and deploy both service changes together. Closing new betting is a lifecycle restriction, not disabling the betting feature: existing bets must remain viewable and eligible for settlement.
