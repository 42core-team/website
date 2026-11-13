// These services pull in the application bootstrap; the joins never use them.
jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class GithubApiService {},
}));
jest.mock("../match/match.service", () => ({
  MatchService: class MatchService {},
}));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource, EntityManager, QueryRunner } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { isUserRegisteredForEvent } from "../event/event-registration";
import { UserEntity } from "../user/entities/user.entity";
import { TeamEntity } from "./entities/team.entity";
import { LockKeys } from "../constants";
import { TeamService } from "./team.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("team membership concurrency (PostgreSQL)", () => {
  const schema = `team_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let service: TeamService;
  let blocker: QueryRunner | undefined;

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
    service = new TeamService(
      database.getRepository(TeamEntity),
      {} as never,
      {} as never,
      // No whitelists here, so eligibility is the registration check.
      {
        isUserEligibleForEvent: (
          eventId: string,
          userId: string,
          manager: EntityManager,
        ) =>
          isUserRegisteredForEvent(
            manager.getRepository(EventEntity),
            eventId,
            userId,
          ),
      } as never,
      {} as never,
      database,
    );
  });

  afterEach(async () => {
    if (blocker?.isTransactionActive) await blocker.rollbackTransaction();
    await blocker?.release();
    blocker = undefined;
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createUser() {
    const id = randomUUID();
    return database.getRepository(UserEntity).save({
      githubId: id,
      githubAccessToken: "token",
      email: `${id}@example.com`,
      username: id,
      name: id,
    });
  }

  async function createEvent(maxTeamSize: number) {
    return database.getRepository(EventEntity).save({
      name: randomUUID(),
      githubOrg: "org",
      githubOrgSecret: "secret",
      minTeamSize: 1,
      maxTeamSize,
      startDate: new Date("2099-01-01"),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
    });
  }

  async function createTeam(
    event: EventEntity,
    users: UserEntity[],
    invites: UserEntity[],
  ) {
    return database.getRepository(TeamEntity).save({
      name: randomUUID(),
      event: { id: event.id },
      users,
      teamInvites: invites,
    });
  }

  // Holds the given team rows so both competing requests queue up behind
  // them, then releases them at once instead of relying on timing.
  async function holdTeams(teamIds: string[]) {
    blocker = database.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    await blocker.query(
      `SELECT id FROM "${schema}"."teams" WHERE id = ANY($1) FOR UPDATE`,
      [teamIds],
    );
  }

  // Holds the team name lock that createTeam takes for this event and name.
  async function holdTeamName(eventId: string, name: string) {
    blocker = database.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    await blocker.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [
      LockKeys.TEAM_NAME,
      `${eventId}:${name}`,
    ]);
  }

  async function waitForLockWaiters(count: number) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const waiting: { count: string }[] = await database.query(
        `SELECT count(*) FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'`,
        [schema],
      );
      if (Number(waiting[0].count) >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Expected ${count} requests waiting on a lock`);
  }

  async function release() {
    await blocker!.commitTransaction();
  }

  function rejectionMessages(results: PromiseSettledResult<unknown>[]) {
    return results
      .filter((result) => result.status === "rejected")
      .map((result) => (result.reason as Error).message);
  }

  async function memberCount(teamId: string) {
    const rows: { count: string }[] = await database.query(
      `SELECT count(*) FROM "${schema}"."teams_users" WHERE "teamsId" = $1`,
      [teamId],
    );
    return Number(rows[0].count);
  }

  it("requires registration for a private event at acceptance, but permits public invitees", async () => {
    const event = await createEvent(4);
    await database
      .getRepository(EventEntity)
      .update(event.id, { isPrivate: true });
    const [owner, invitee] = await Promise.all([createUser(), createUser()]);
    const team = await createTeam(event, [owner], [invitee]);

    await expect(service.acceptTeamInvite(invitee.id, team.id)).rejects.toThrow(
      "You are not registered or not whitelisted for this private event.",
    );
    expect(await memberCount(team.id)).toBe(1);
    expect(
      await database.getRepository(TeamEntity).existsBy({
        id: team.id,
        teamInvites: { id: invitee.id },
      }),
    ).toBe(true);

    await database
      .createQueryBuilder()
      .relation(EventEntity, "users")
      .of(event.id)
      .add(invitee.id);
    await service.acceptTeamInvite(invitee.id, team.id);
    expect(await memberCount(team.id)).toBe(2);

    const publicEvent = await createEvent(4);
    const publicInvitee = await createUser();
    const publicTeam = await createTeam(publicEvent, [owner], [publicInvitee]);
    await service.acceptTeamInvite(publicInvitee.id, publicTeam.id);
    expect(await memberCount(publicTeam.id)).toBe(2);
  });

  it("lets only one of two invitees take the last free spot", async () => {
    const event = await createEvent(2);
    const [member, first, second] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);
    const team = await createTeam(event, [member], [first, second]);

    await holdTeams([team.id]);
    const accepts = Promise.allSettled([
      service.acceptTeamInvite(first.id, team.id),
      service.acceptTeamInvite(second.id, team.id),
    ]);
    await waitForLockWaiters(2);
    await release();
    const results = await accepts;

    expect(rejectionMessages(results)).toEqual(["This team is full."]);
    expect(await memberCount(team.id)).toBe(2);
  });

  it("lets a user join only one of two teams accepted at the same time", async () => {
    const event = await createEvent(4);
    const [owner, user] = await Promise.all([createUser(), createUser()]);
    const teamA = await createTeam(event, [owner], [user]);
    const teamB = await createTeam(event, [], [user]);

    await holdTeams([teamA.id, teamB.id]);
    const accepts = Promise.allSettled([
      service.acceptTeamInvite(user.id, teamA.id),
      service.acceptTeamInvite(user.id, teamB.id),
    ]);
    await waitForLockWaiters(2);
    await release();
    const results = await accepts;

    expect(rejectionMessages(results)).toEqual([
      "You are already part of a team for this event.",
    ]);
    expect((await memberCount(teamA.id)) + (await memberCount(teamB.id))).toBe(
      2,
    );
  });

  it("rejects a duplicate leave without deleting the remaining member's team", async () => {
    const event = await createEvent(3);
    const [departing, remaining] = await Promise.all([
      createUser(),
      createUser(),
    ]);
    const team = await createTeam(event, [departing, remaining], []);

    await holdTeams([team.id]);
    const leaves = Promise.allSettled([
      service.leaveTeam(team.id, departing.id),
      service.leaveTeam(team.id, departing.id),
    ]);
    await waitForLockWaiters(2);
    await release();
    const results = await leaves;

    expect(rejectionMessages(results)).toEqual([
      "You are not part of a team for this event.",
    ]);
    const current = await database.getRepository(TeamEntity).findOneOrFail({
      where: { id: team.id },
      relations: { users: true },
    });
    expect(current.users.map((user) => user.id)).toEqual([remaining.id]);
  });

  it("keeps a successful invite acceptance from racing last-member deletion", async () => {
    const event = await createEvent(3);
    const [departing, invitee] = await Promise.all([
      createUser(),
      createUser(),
    ]);
    const team = await createTeam(event, [departing], [invitee]);

    await holdTeams([team.id]);
    const leave = service.leaveTeam(team.id, departing.id);
    const accept = service.acceptTeamInvite(invitee.id, team.id);
    const resultsPromise = Promise.allSettled([leave, accept]);
    await waitForLockWaiters(2);
    await release();
    const [leaveResult, acceptResult] = await resultsPromise;
    expect(leaveResult.status).toBe("fulfilled");
    const current = await database.getRepository(TeamEntity).findOne({
      where: { id: team.id },
      relations: { users: true },
    });
    if (acceptResult.status === "fulfilled") {
      expect(current?.users.map((user) => user.id)).toEqual([invitee.id]);
    } else {
      expect(current).toBeNull();
    }
  });

  it("lets only one of two users create a team with the same name", async () => {
    const event = await createEvent(4);
    const [first, second] = await Promise.all([createUser(), createUser()]);
    const name = "same-name";

    await holdTeamName(event.id, name);
    const creates = Promise.allSettled([
      service.createTeam(name, first.id, event.id),
      service.createTeam(name, second.id, event.id),
    ]);
    await waitForLockWaiters(2);
    await release();
    const results = await creates;

    expect(rejectionMessages(results)).toEqual([
      "A team with this name already exists for this event.",
    ]);
    expect(
      await database
        .getRepository(TeamEntity)
        .countBy({ name, event: { id: event.id } }),
    ).toBe(1);
  });
});
