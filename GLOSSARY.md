# CORE events

The vocabulary for participating in and presenting a CORE competition.

## Language

**Registration**:
The initial event phase in which participants join and form teams before coding begins. Joining and roster changes also remain possible during coding until coding closes.

**Coding**:
The competition phase in which teams develop their bots and participate in matchmaking. Stored as `PLAYING`.
_Avoid_: Playing (in participant-facing text)

**Submission deadline**:
The scheduled boundary after which development, participant matchmaking, registration, roster changes, and new bets close.
_Avoid_: Event end, repo lock date

**Coding closed**:
The phase between coding and showtime, during which repositories are locked and the tournament can be prepared. Stored as `SUBMISSIONS_CLOSED`.
_Avoid_: Submissions closed, Break (in participant-facing text)

**Showtime**:
The presentation phase in which administrators present tournament games and reveal results to participants and spectators. Stored as `SHOWCASE`.
_Avoid_: Showcase (in participant-facing text)

**Scheduled end**:
The advertised finish time of the whole event, including its showcase.
_Avoid_: Submission deadline

**Completion**:
The administrator-declared actual finish of the event, which may differ from its scheduled end.

**Livestream intro**:
An optional introductory presentation before coding starts, without changing participant permissions.

**Showtime stream**:
The optional stream link of an event, offered for the livestream intro and during showtime.

**Implicit registration**:
Every signed-in user counts as registered for a public event and can create or join a team directly. Private events require explicit joining, restricted by the whitelist.

**Reopening**:
An administrator's decision to resume playing with a new submission deadline while retaining existing tournament progress and results.

**Tournament exclusion**:
An explicit administrator decision to omit a team from tournament participation.
