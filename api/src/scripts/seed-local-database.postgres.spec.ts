import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { EventState, getEventState } from "../event/event-lifecycle";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { seedLocalDatabase } from "./seed-local-database";

const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("local database seeding (PostgreSQL)", () => {
  jest.setTimeout(20_000);
  let database: DataSource;
  let schema: string;

  beforeEach(async () => {
    schema = `local_seed_test_${randomUUID().replaceAll("-", "")}`;
    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [join(__dirname, "../**/*.entity.ts")],
    });
    await database.initialize();
    await database.query(`CREATE SCHEMA "${schema}"`);
    await database.synchronize();
  });

  afterEach(async () => {
    if (database?.isInitialized) {
      try {
        await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await database.destroy();
      }
    }
  });

  it("loads coherent events, rosters and results once under concurrent starts", async () => {
    const counts = await Promise.all([
      seedLocalDatabase(database),
      seedLocalDatabase(database),
    ]);
    expect(counts.sort((a, b) => a - b)).toEqual([0, 10]);

    const events = await database.getRepository(EventEntity).find({
      relations: { users: true, teams: { users: true } },
      relationLoadStrategy: "query",
    });
    expect(
      events.map((event) => event.teams.length).sort((a, b) => a - b),
    ).toEqual([0, 4, 6, 8, 10, 12, 16, 18, 20, 24]);
    for (const state of Object.values(EventState)) {
      expect(
        events.filter((event) => getEventState(event) === state),
      ).toHaveLength(2);
    }
    for (const event of events) {
      expect(event.users).toHaveLength(event.teams.length * 2);
      for (const team of event.teams) {
        expect(team.users).toHaveLength(2);
        expect(team.repo).toBe(`sim-${team.id}`);
        expect(team.repositoryStatus).toBe(
          event.canCreateTeam
            ? RepositoryStatus.READY
            : RepositoryStatus.LOCKED,
        );
      }
    }

    const matches = await database.getRepository(MatchEntity).find({
      relationLoadStrategy: "query",
      relations: {
        teams: { event: true },
        winner: true,
        results: { team: true },
      },
    });
    expect(new Set(matches.map((match) => match.phase))).toEqual(
      new Set([MatchPhase.QUEUE, MatchPhase.SWISS, MatchPhase.ELIMINATION]),
    );
    expect(
      new Set(matches.map((match) => match.updatedAt.getTime())).size,
    ).toBeGreaterThan(1);
    expect(
      matches.some(
        (match) => match.phase === MatchPhase.ELIMINATION && !match.isRevealed,
      ),
    ).toBe(true);
    for (const match of matches) {
      expect(match.state).toBe(MatchState.FINISHED);
      expect(match.updatedAt.getTime()).toBeGreaterThan(
        match.createdAt.getTime(),
      );
      const [left, right] = match.teams;
      expect(left.event.id).toBe(right.event.id);
      expect(left.event.state).not.toBe(EventState.REGISTRATION);
      expect([left.id, right.id]).toContain(match.winner?.id);
      expect(match.stats.damageTotal).toBeGreaterThan(0);
      if (match.phase !== MatchPhase.ELIMINATION)
        expect(match.results).toHaveLength(2);
    }

    const eventId = events[0].id;
    await database.manager.update(EventEntity, eventId, {
      name: "Edited event",
    });
    expect(await seedLocalDatabase(database)).toBe(0);
    expect(
      await database.manager.findOneBy(EventEntity, { id: eventId }),
    ).toMatchObject({ name: "Edited event" });
  });

  it("keeps existing events and remembers the first-start decision", async () => {
    const now = new Date();
    const event = await database.manager.save(EventEntity, {
      name: "Existing event",
      githubOrg: "",
      minTeamSize: 2,
      maxTeamSize: 3,
      startDate: now,
      submissionDeadline: now,
      scheduledEndDate: now,
      endDate: now,
    });
    expect(await seedLocalDatabase(database)).toBe(0);
    const events = await database.manager.find(EventEntity);
    expect(events.map(({ id }) => id)).toEqual([event.id]);
    await database.manager.delete(EventEntity, event.id);
    expect(await seedLocalDatabase(database)).toBe(0);
    expect(await database.manager.count(EventEntity)).toBe(0);
  });

  it("rolls back a partial seed and allows retry", async () => {
    await database.query(`ALTER TABLE "${schema}".events
      ADD CONSTRAINT reject_fixture CHECK (name <> 'CORE Amsterdam')`);
    await expect(seedLocalDatabase(database)).rejects.toThrow("reject_fixture");
    for (const entity of [EventEntity, UserEntity, TeamEntity, MatchEntity]) {
      expect(await database.manager.count(entity)).toBe(0);
    }
    await database.query(
      `ALTER TABLE "${schema}".events DROP CONSTRAINT reject_fixture`,
    );
    expect(await seedLocalDatabase(database)).toBe(10);
  });
});
