import { randomUUID } from "node:crypto";
import { Swiss } from "tournament-pairings";
import { DataSource, EntityManager } from "typeorm";
import { LockKeys } from "../constants";
import { EventEntity } from "../event/entities/event.entity";
import { EventState, isRegistrationOpen } from "../event/event-lifecycle";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import {
  UserEntity,
  UserEventPermissionEntity,
} from "../user/entities/user.entity";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const scenarios: {
  name: string;
  location: string;
  state: EventState;
  startDay: number;
  deadlineDay: number;
  teamCount: number;
}[] = [
  {
    name: "CORE Helsinki",
    location: "Helsinki",
    state: EventState.REGISTRATION,
    startDay: 14,
    deadlineDay: 16,
    teamCount: 4,
  },
  {
    name: "CORE Lisbon",
    location: "Lisbon",
    state: EventState.REGISTRATION,
    startDay: 35,
    deadlineDay: 38,
    teamCount: 0,
  },
  {
    name: "CORE Berlin",
    location: "Berlin",
    state: EventState.PLAYING,
    startDay: -3,
    deadlineDay: 14,
    teamCount: 18,
  },
  {
    name: "CORE Prague",
    location: "Prague",
    state: EventState.PLAYING,
    startDay: -2,
    deadlineDay: 7,
    teamCount: 8,
  },
  {
    name: "CORE Madrid",
    location: "Madrid",
    state: EventState.SUBMISSIONS_CLOSED,
    startDay: -5,
    deadlineDay: -1,
    teamCount: 6,
  },
  {
    name: "CORE Vienna",
    location: "Vienna",
    state: EventState.SUBMISSIONS_CLOSED,
    startDay: -7,
    deadlineDay: -3,
    teamCount: 10,
  },
  {
    name: "CORE Amsterdam",
    location: "Amsterdam",
    state: EventState.SHOWCASE,
    startDay: -8,
    deadlineDay: -2,
    teamCount: 12,
  },
  {
    name: "CORE Stockholm",
    location: "Stockholm",
    state: EventState.SHOWCASE,
    startDay: -10,
    deadlineDay: -4,
    teamCount: 16,
  },
  {
    name: "CORE Paris",
    location: "Paris",
    state: EventState.COMPLETED,
    startDay: -9,
    deadlineDay: -5,
    teamCount: 20,
  },
  {
    name: "CORE Barcelona",
    location: "Barcelona",
    state: EventState.COMPLETED,
    startDay: -42,
    deadlineDay: -38,
    teamCount: 24,
  },
];

export async function seedLocalDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query("SELECT pg_advisory_xact_lock($1)", [
      LockKeys.LOCAL_DATABASE_SEED,
    ]);
    const schema = dataSource.getMetadata(EventEntity).schema;
    const markerTable = schema
      ? `${dataSource.driver.escape(schema)}."local_database_seeds"`
      : '"local_database_seeds"';
    await manager.query(
      `CREATE TABLE IF NOT EXISTS ${markerTable} (name text PRIMARY KEY)`,
    );
    const inserted: { name: string }[] = await manager.query(
      `INSERT INTO ${markerTable} (name) VALUES ($1)
       ON CONFLICT DO NOTHING RETURNING name`,
      ["default-events"],
    );
    if (inserted.length === 0 || (await manager.exists(EventEntity))) return;

    const now = Date.now();
    for (const scenario of scenarios) {
      await seedEvent(manager, scenario, now);
    }
  });
}

async function seedEvent(
  manager: EntityManager,
  scenario: (typeof scenarios)[number],
  now: number,
) {
  const { name, location, state, startDay, deadlineDay, teamCount } = scenario;
  const startDate = new Date(now + startDay * DAY);
  const submissionDeadline = new Date(now + deadlineDay * DAY);
  const completed = state === EventState.COMPLETED;
  const hasBracket = state === EventState.SHOWCASE || completed;
  const scheduledEndDate = new Date(
    submissionDeadline.getTime() + (completed ? 2 : 5) * DAY,
  );
  const open = isRegistrationOpen(
    { state, startDate, submissionDeadline },
    new Date(now),
  );
  const createdAt = new Date(Math.min(now, startDate.getTime()) - 7 * DAY);
  const city = location.toLowerCase();
  const users = await manager.save(
    UserEntity,
    Array.from({ length: teamCount * 2 }, (_, index) => ({
      name: `${location} Player ${index + 1}`,
      username: `${city}-player-${index + 1}`,
      githubId: `local-seed-${city}-${index + 1}`,
      githubAccessToken: "",
      email: `${city}-player-${index + 1}@example.com`,
      createdAt,
    })),
  );
  const event = await manager.save(EventEntity, {
    name,
    location,
    description: `Build and compete with autonomous CORE bots in ${location}.`,
    githubOrg: "",
    state,
    startDate,
    submissionDeadline,
    repoLockDate: submissionDeadline,
    scheduledEndDate,
    endDate: scheduledEndDate,
    completedAt: completed ? scheduledEndDate : null,
    lockedAt: open ? null : submissionDeadline,
    canCreateTeam: open,
    processQueue: open,
    gamblingEnabled: open,
    minTeamSize: 2,
    maxTeamSize: 3,
    tournamentAdvancementLimit: hasBracket ? 4 : null,
    currentRound: hasBracket ? 1 : 0,
    createdAt,
    users,
  });
  if (!teamCount) return;

  await manager.insert(
    UserEventPermissionEntity,
    users.map((user) => ({ event, user })),
  );
  const teams = Array.from({ length: teamCount }, (_, index) => {
    const id = randomUUID();
    return manager.create(TeamEntity, {
      id,
      name: `Team ${index + 1}`,
      repo: `sim-${id}`,
      repositoryStatus: open ? RepositoryStatus.READY : RepositoryStatus.LOCKED,
      locked: !open,
      score: 0,
      buchholzPoints: 0,
      queueScore: 1000,
      credits: 5,
      createdAt,
      event,
      users: users.slice(index * 2, index * 2 + 2),
    });
  });
  const matches: ReturnType<typeof finishedMatch>[] = [];

  if (state !== EventState.REGISTRATION) {
    const queueUntil = Math.min(now, submissionDeadline.getTime());
    for (let i = 0; i < teams.length; i += 2) {
      const pair: [TeamEntity, TeamEntity] = [teams[i], teams[i + 1]];
      const winner = pair[(i / 2) % 2];
      // Each team has one queue match starting at the default 1000 rating.
      pair.forEach((team) => (team.queueScore += team === winner ? 16 : -16));
      matches.push(
        finishedMatch(pair, winner, {
          phase: MatchPhase.QUEUE,
          round: 0,
          createdAt: new Date(queueUntil - (i + 1) * HOUR),
          isRevealed: false,
        }),
      );
    }
  }

  if (hasBracket) {
    matches.push(...tournamentMatches(teams, submissionDeadline, completed));
  }
  await manager.save(TeamEntity, teams);
  if (matches.length) await manager.save(MatchEntity, matches);
}

function tournamentMatches(
  teams: TeamEntity[],
  deadline: Date,
  completed: boolean,
) {
  const matches: ReturnType<typeof finishedMatch>[] = [];
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const opponents = new Map<string, string[]>(
    teams.map((team) => [team.id, []]),
  );
  const rounds = Math.ceil(Math.log2(teams.length));
  for (let round = 0; round < rounds; round++) {
    const pairings = Swiss(
      teams.map((team) => ({
        id: team.id,
        score: team.score,
        rating: team.score,
        avoid: opponents.get(team.id),
      })),
      round,
    );
    for (const [index, { player1, player2 }] of pairings.entries()) {
      const left = teamsById.get(String(player1));
      const right = teamsById.get(String(player2));
      if (!left || !right)
        throw new Error("Expected two teams in each seeded Swiss match");
      opponents.get(left.id)!.push(right.id);
      opponents.get(right.id)!.push(left.id);
      const winner = (round + index) % 3 === 0 ? right : left;
      winner.score++;
      matches.push(
        finishedMatch([left, right], winner, {
          phase: MatchPhase.SWISS,
          round,
          createdAt: new Date(
            deadline.getTime() + (round + 1) * HOUR + index * 60_000,
          ),
          isRevealed: completed || round < rounds - 1,
        }),
      );
    }
  }
  for (const match of matches) {
    const [left, right] = match.teams;
    match.winner.buchholzPoints += (match.winner === left ? right : left).score;
  }
  const [first, second, third, fourth] = [...teams].sort(
    (a, b) => b.score - a.score || b.buchholzPoints - a.buchholzPoints,
  );
  const semiFinals = new Date(deadline.getTime() + DAY);
  const finals = new Date(semiFinals.getTime() + HOUR);
  matches.push(
    finishedMatch([first, fourth], first, {
      phase: MatchPhase.ELIMINATION,
      round: 0,
      createdAt: semiFinals,
      isRevealed: true,
    }),
    finishedMatch([second, third], third, {
      phase: MatchPhase.ELIMINATION,
      round: 0,
      createdAt: new Date(semiFinals.getTime() + 60_000),
      isRevealed: true,
    }),
    finishedMatch([first, third], first, {
      phase: MatchPhase.ELIMINATION,
      round: 1,
      createdAt: finals,
      isRevealed: completed,
    }),
    finishedMatch([fourth, second], second, {
      phase: MatchPhase.ELIMINATION,
      round: 1,
      createdAt: new Date(finals.getTime() + 60_000),
      isRevealed: completed,
    }),
  );
  return matches;
}

function finishedMatch(
  teams: [TeamEntity, TeamEntity],
  winner: TeamEntity,
  details: Pick<MatchEntity, "phase" | "round" | "createdAt" | "isRevealed">,
) {
  const unitsSpawned =
    20 + (Math.floor(details.createdAt.getTime() / 60_000) % 73);
  return {
    ...details,
    teams,
    winner,
    leftTeamId: teams[0].id,
    rightTeamId: teams[1].id,
    state: MatchState.FINISHED,
    stats: {
      unitsSpawned,
      actionsExecuted: unitsSpawned * 142,
      damageTotal: unitsSpawned * 385,
      gemsGained: unitsSpawned * 74,
    },
    // Elimination matches use the winner directly. The other phases record
    // each team's standing at the time of the result.
    results:
      details.phase === MatchPhase.ELIMINATION
        ? []
        : teams.map((team) => ({
            team: { id: team.id },
            score:
              details.phase === MatchPhase.QUEUE ? team.queueScore : team.score,
          })),
  };
}
