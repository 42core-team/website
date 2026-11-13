import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { MatchStatsEntity } from "../match/entites/matchStats.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { ProfileService } from "./profile.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

// Stats of matches no viewer may see; no visible sum can reach them.
const HIDDEN_UNITS = 900_000;

postgres("ProfileService visibility (PostgreSQL)", () => {
  const schema = `profile_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let service: ProfileService;

  const users = {} as Record<
    "owner" | "teammate" | "participant" | "outsider" | "rival",
    UserEntity
  >;
  const teams = {} as Record<
    | "ownerPublic"
    | "rivalPublic"
    | "ownerPrivate"
    | "rivalPrivate"
    | "ownerCup"
    | "cupA"
    | "cupB"
    | "cupC",
    TeamEntity
  >;
  const events = {} as Record<"public" | "private" | "cup", EventEntity>;
  const matches = {} as Record<
    | "queue"
    | "swissRevealed"
    | "swissHidden"
    | "manual"
    | "privateQueue"
    | "cupThird",
    MatchEntity
  >;

  beforeAll(async () => {
    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [join(__dirname, "../**/*.entity.ts")],
      extra: { application_name: schema },
    });
    await database.initialize();
    await database.query(`CREATE SCHEMA "${schema}"`);
    await database.synchronize();
    service = new ProfileService(
      database.getRepository(UserEntity),
      database.getRepository(TeamEntity),
      database.getRepository(MatchEntity),
      database.getRepository(MatchStatsEntity),
    );
    await seed();
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createUser(name: string) {
    return database.getRepository(UserEntity).save({
      githubId: randomUUID(),
      githubAccessToken: "token",
      email: `${name}@example.com`,
      username: `${name}-${randomUUID().slice(0, 8)}`,
      name,
    });
  }

  async function createEvent(isPrivate: boolean, members: UserEntity[]) {
    return database.getRepository(EventEntity).save({
      name: randomUUID().slice(0, 30),
      githubOrg: "org",
      githubOrgSecret: "secret",
      minTeamSize: 1,
      maxTeamSize: 3,
      startDate: new Date("2020-01-01"),
      submissionDeadline: new Date("2020-02-01"),
      scheduledEndDate: new Date("2099-01-01"),
      endDate: new Date("2099-01-01"),
      isPrivate,
      users: members,
    });
  }

  async function createTeam(event: EventEntity, members: UserEntity[]) {
    return database.getRepository(TeamEntity).save({
      name: randomUUID().slice(0, 20),
      event: { id: event.id },
      repo: `repo-${randomUUID().slice(0, 8)}`,
      users: members,
    });
  }

  async function createMatch(
    phase: MatchPhase,
    round: number,
    playing: TeamEntity[],
    winner: TeamEntity | null,
    isRevealed: boolean,
    createdAt: string,
    units = 100,
  ) {
    const saved = await database.getRepository(MatchEntity).save({
      phase,
      round,
      state: MatchState.FINISHED,
      isRevealed,
      teams: playing.map((team) => ({ id: team.id })),
      winner: winner ? { id: winner.id } : null,
      stats: Object.assign(new MatchStatsEntity(), { unitsSpawned: units }),
    });
    await database
      .getRepository(MatchEntity)
      .update(saved.id, { createdAt: new Date(createdAt) });
    return saved;
  }

  async function seed() {
    for (const name of [
      "owner",
      "teammate",
      "participant",
      "outsider",
      "rival",
    ] as const)
      users[name] = await createUser(name);

    events.public = await createEvent(false, [users.owner]);
    events.private = await createEvent(true, [users.owner, users.participant]);
    events.cup = await createEvent(false, [users.owner]);

    teams.ownerPublic = await createTeam(events.public, [
      users.owner,
      users.teammate,
    ]);
    teams.rivalPublic = await createTeam(events.public, [users.rival]);
    teams.ownerPrivate = await createTeam(events.private, [users.owner]);
    teams.rivalPrivate = await createTeam(events.private, [users.participant]);
    teams.ownerCup = await createTeam(events.cup, [users.owner]);
    teams.cupA = await createTeam(events.cup, []);
    teams.cupB = await createTeam(events.cup, []);
    teams.cupC = await createTeam(events.cup, []);

    const { ownerPublic, rivalPublic, ownerPrivate, rivalPrivate } = teams;
    matches.queue = await createMatch(
      MatchPhase.QUEUE,
      0,
      [ownerPublic, rivalPublic],
      ownerPublic,
      false, // Queue matches are listed without being revealed.
      "2026-01-01T10:00:00Z",
    );
    matches.swissRevealed = await createMatch(
      MatchPhase.SWISS,
      0,
      [ownerPublic, rivalPublic],
      rivalPublic,
      true,
      "2026-01-02T10:00:00Z",
    );
    matches.swissHidden = await createMatch(
      MatchPhase.SWISS,
      1,
      [ownerPublic, rivalPublic],
      ownerPublic,
      false,
      "2026-01-03T10:00:00Z",
      HIDDEN_UNITS,
    );
    matches.manual = await createMatch(
      MatchPhase.MANUAL,
      0,
      [ownerPublic, rivalPublic],
      ownerPublic,
      true,
      "2026-01-04T10:00:00Z",
      HIDDEN_UNITS,
    );
    matches.privateQueue = await createMatch(
      MatchPhase.QUEUE,
      0,
      [ownerPrivate, rivalPrivate],
      ownerPrivate,
      false,
      "2026-01-05T10:00:00Z",
      1_000,
    );

    // A four-team bracket whose semifinals are still hidden, while the match
    // for third place is already revealed.
    const { ownerCup, cupA, cupB, cupC } = teams;
    await createMatch(
      MatchPhase.ELIMINATION,
      0,
      [ownerCup, cupA],
      cupA,
      false,
      "2026-02-01T10:00:00Z",
    );
    await createMatch(
      MatchPhase.ELIMINATION,
      0,
      [cupB, cupC],
      cupB,
      false,
      "2026-02-01T10:00:00Z",
    );
    await createMatch(
      MatchPhase.ELIMINATION,
      1,
      [cupA, cupB],
      cupA,
      false,
      "2026-02-01T11:00:00Z",
    );
    matches.cupThird = await createMatch(
      MatchPhase.ELIMINATION,
      1,
      [ownerCup, cupC],
      ownerCup,
      true,
      "2026-02-01T11:00:00Z",
    );
  }

  const teamIds = (profile: { teams: { id: string }[] }) =>
    profile.teams.map((team) => team.id).sort();

  it("hides private events, their matches and their totals from outsiders", async () => {
    const profile = await service.getProfile(
      users.owner.username,
      users.outsider.id,
    );
    expect(teamIds(profile)).toEqual(
      [teams.ownerPublic.id, teams.ownerCup.id].sort(),
    );
    // Queue, revealed Swiss and the revealed match for third place.
    expect(profile.summary.record).toEqual({ wins: 2, losses: 1, draws: 0 });
    expect(profile.combat).toMatchObject({ matches: 3, unitsSpawned: 300 });
    expect(profile.teams.every((team) => team.repo === null)).toBe(true);

    const history = await service.getMatches(
      users.owner.username,
      users.outsider.id,
      { offset: 0, limit: 25 },
    );
    expect(history.total).toBe(3);
    expect(history.matches.every((match) => match.id === null)).toBe(true);
  });

  it("never lists unrevealed tournament or manual matches", async () => {
    const history = await service.getMatches(
      users.owner.username,
      users.owner.id,
      { offset: 0, limit: 25 },
    );
    const ids = history.matches.map((match) => match.id);
    expect(ids).not.toContain(matches.swissHidden.id);
    expect(ids).not.toContain(matches.manual.id);
    expect(ids).toEqual([
      matches.cupThird.id,
      matches.privateQueue.id,
      matches.swissRevealed.id,
      matches.queue.id,
    ]);
  });

  it("shows the owner everything they may see, with replays and repos", async () => {
    const profile = await service.getProfile(
      users.owner.username,
      users.owner.id,
    );
    expect(teamIds(profile)).toEqual(
      [teams.ownerPublic.id, teams.ownerPrivate.id, teams.ownerCup.id].sort(),
    );
    expect(profile.combat).toMatchObject({ matches: 4, unitsSpawned: 1_300 });
    expect(profile.teams.every((team) => team.repo !== null)).toBe(true);
  });

  it("shows private events to people taking part, without others' repos", async () => {
    const profile = await service.getProfile(
      users.owner.username,
      users.participant.id,
    );
    expect(teamIds(profile)).toContain(teams.ownerPrivate.id);
    expect(profile.teams.every((team) => team.repo === null)).toBe(true);

    const history = await service.getMatches(
      users.owner.username,
      users.participant.id,
      { offset: 0, limit: 25 },
    );
    // The participant's team played only the private match.
    const withReplay = history.matches.filter((match) => match.id !== null);
    expect(withReplay.map((match) => match.id)).toEqual([
      matches.privateQueue.id,
    ]);
  });

  it("links repositories only for teams the viewer is on", async () => {
    const profile = await service.getProfile(
      users.owner.username,
      users.teammate.id,
    );
    const withRepo = profile.teams.filter((team) => team.repo !== null);
    expect(withRepo.map((team) => team.id)).toEqual([teams.ownerPublic.id]);
  });

  it("names third place while the semifinal is still hidden", async () => {
    const profile = await service.getProfile(
      users.owner.username,
      users.outsider.id,
    );
    const cup = profile.teams.find((team) => team.id === teams.ownerCup.id);
    expect(cup?.finish).toEqual({ kind: "THIRD", roundOf: 4 });
  });

  it("pages and filters the match history", async () => {
    const swiss = await service.getMatches(
      users.owner.username,
      users.owner.id,
      { offset: 0, limit: 25, phase: MatchPhase.SWISS },
    );
    expect(swiss.matches.map((match) => match.id)).toEqual([
      matches.swissRevealed.id,
    ]);

    const privateOnly = await service.getMatches(
      users.owner.username,
      users.owner.id,
      { offset: 0, limit: 25, eventId: events.private.id },
    );
    expect(privateOnly.total).toBe(1);

    const second = await service.getMatches(
      users.owner.username,
      users.owner.id,
      { offset: 1, limit: 2 },
    );
    expect(second.total).toBe(4);
    expect(second.matches.map((match) => match.id)).toEqual([
      matches.privateQueue.id,
      matches.swissRevealed.id,
    ]);
  });

  it("answers an unknown player like any missing resource", async () => {
    await expect(
      service.getProfile("nobody-by-this-name", users.owner.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
