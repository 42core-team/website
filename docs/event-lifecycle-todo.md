# Event lifecycle implementation

Decision record: [ADR 0001](adr/0001-event-lifecycle.md).

- [x] Add event states, schedule validation, automatic transitions, and admin transitions.
- [x] Migrate existing events and repository status data.
- [x] Track acknowledged repository creation, locking, unlocking, errors, and retries.
- [x] Apply registration, roster, matchmaking, and repository-readiness rules.
- [x] Gate tournament generation on confirmed locks and explicit exclusions.
- [x] Close new betting at the deadline and restore eligibility on reopening.
- [x] Update admin controls, participant notices, event listings, and API contracts.
- [x] Record the lifecycle, date meanings, reopening policy, and submission trade-off in an ADR.
- [x] Add domain terminology and link the documentation from the README.
- [x] Run service tests, frontend checks, builds, and migration verification.
- [x] Review cross-service integration and resolve remaining issues.

## Verification

- API: 213 tests passed, including roster-race, gambling-gate, and Swiss-resume regressions.
- GitHub service: 15 tests passed, including former-collaborator reconciliation.
- Frontend: 118 tests passed, TypeScript check and production build passed.
- API and GitHub service builds passed; targeted lint and diff checks passed.
- Both migrations passed upgrade/backfill/downgrade checks in isolated PostgreSQL verification, including repository-lock confirmation behavior.
