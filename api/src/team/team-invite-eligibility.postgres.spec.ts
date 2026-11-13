// match.service imports the application bootstrap for its queue config.
jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import {
  authzTestingModule,
  createAuthorizationService,
} from "../authz/testing";
import { AllExceptionsFilter } from "../common/AllExceptionsFilter";
import { TypeormExceptionFilter } from "../common/TypeormExceptionFilter";
import { EventEntity } from "../event/entities/event.entity";
import { EventStarterTemplateEntity } from "../event/entities/event-starter-template.entity";
import {
  EventWhitelistEntity,
  WhitelistPlatform,
} from "../event/entities/event-whitelist.entity";
import { EventController } from "../event/event.controller";
import { EventService } from "../event/event.service";
import { MatchService } from "../match/match.service";
import { UserEntity } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import { TeamEntity } from "./entities/team.entity";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";
import { UserRoleEntity } from "../user/entities/user-role.entity";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("team invite eligibility (PostgreSQL)", () => {
  const schema = `invite_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;

  beforeAll(async () => {
    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [join(__dirname, "../**/*.entity.ts")],
    });
    await database.initialize();
    await database.query(`CREATE SCHEMA "${schema}"`);
    await database.synchronize();

    const eventService = new EventService(
      database.getRepository(EventEntity),
      database.getRepository(UserRoleEntity),
      database.getRepository(EventStarterTemplateEntity),
      database.getRepository(EventWhitelistEntity),
      {} as never,
      {} as never,
      database,
    );
    const teamService = new TeamService(
      database.getRepository(TeamEntity),
      {} as never,
      {} as never,
      eventService,
      {} as never,
      database,
      await createAuthorizationService(database),
    );
    Object.assign(eventService, { teamService });
    const userService = new UserService(
      database.getRepository(UserEntity),
      {} as never,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        authzTestingModule(
          (id) =>
            database.getRepository(UserEntity).findOne({
              where: { id },
              relations: { roles: true },
            }),
          database,
        ),
      ],
      controllers: [TeamController, EventController],
      providers: [
        { provide: TeamService, useValue: teamService },
        { provide: EventService, useValue: eventService },
        { provide: UserService, useValue: userService },
        { provide: MatchService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same global setup as main.ts.
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    app.useGlobalFilters(
      new AllExceptionsFilter(app.get(HttpAdapterHost)),
      new TypeormExceptionFilter(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
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
      username: `user-${id}`,
      name: id,
    });
  }

  async function createEvent(isPrivate: boolean) {
    return database.getRepository(EventEntity).save({
      name: randomUUID().slice(0, 30),
      githubOrg: "org",
      githubOrgSecret: "secret",
      isPrivate,
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2099-01-01"),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
    });
  }

  async function whitelist(event: EventEntity, user: UserEntity) {
    return database.getRepository(EventWhitelistEntity).save({
      event: { id: event.id },
      username: user.username,
      platform: WhitelistPlatform.GITHUB,
    });
  }

  const put = (path: string, userId: string) =>
    request(app.getHttpServer()).put(path).set("x-test-user", userId);
  const post = (path: string, userId: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set("x-test-user", userId)
      .send(body);

  const register = (event: EventEntity, user: UserEntity) =>
    put(`/event/${event.id}/join`, user.id).expect(200);

  async function createTeamOf(event: EventEntity, user: UserEntity) {
    const created = await post(`/team/event/${event.id}/create`, user.id, {
      name: randomUUID().slice(0, 20),
    }).expect(201);
    return created.body.id as string;
  }

  const invite = (event: EventEntity, inviter: UserEntity, inviteeId: string) =>
    post(`/team/event/${event.id}/sendInvite`, inviter.id, {
      userToInviteId: inviteeId,
    });
  const accept = (event: EventEntity, teamId: string, user: UserEntity) =>
    put(`/team/event/${event.id}/acceptInvite/${teamId}`, user.id);

  function isMember(teamId: string, userId: string) {
    return database.getRepository(TeamEntity).exists({
      where: { id: teamId, users: { id: userId } },
    });
  }

  function isInvited(teamId: string, userId: string) {
    return database.getRepository(TeamEntity).exists({
      where: { id: teamId, teamInvites: { id: userId } },
    });
  }

  // A private event with a whitelist and one registered member with a team.
  async function privateEventWithTeam() {
    const event = await createEvent(true);
    const member = await createUser();
    await whitelist(event, member);
    await register(event, member);
    const teamId = await createTeamOf(event, member);
    return { event, member, teamId };
  }

  it("does not invite a user who is neither whitelisted nor registered", async () => {
    const { event, member, teamId } = await privateEventWithTeam();
    const outsider = await createUser();
    await put(`/event/${event.id}/join`, outsider.id).expect(401);

    const response = await invite(event, member, outsider.id);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "This user is not registered or not whitelisted for this private event.",
    );
    expect(await isInvited(teamId, outsider.id)).toBe(false);
  });

  it("does not invite a whitelisted user who has not registered", async () => {
    const { event, member, teamId } = await privateEventWithTeam();
    const invitee = await createUser();
    await whitelist(event, invitee);

    const response = await invite(event, member, invitee.id);

    expect(response.status).toBe(400);
    expect(await isInvited(teamId, invitee.id)).toBe(false);
  });

  it("does not invite an unregistered user to a private event without a whitelist", async () => {
    const event = await createEvent(true);
    const member = await createUser();
    await register(event, member);
    const teamId = await createTeamOf(event, member);
    const outsider = await createUser();

    expect((await invite(event, member, outsider.id)).status).toBe(400);
    expect(await isInvited(teamId, outsider.id)).toBe(false);
  });

  it("lets a whitelisted, registered user be invited and accept", async () => {
    const { event, member, teamId } = await privateEventWithTeam();
    const invitee = await createUser();
    await whitelist(event, invitee);
    await register(event, invitee);

    await invite(event, member, invitee.id).expect(201);
    await accept(event, teamId, invitee).expect(200);

    expect(await isMember(teamId, invitee.id)).toBe(true);
  });

  it("rejects an accept after the user was removed from the whitelist", async () => {
    const { event, member, teamId } = await privateEventWithTeam();
    const invitee = await createUser();
    const entry = await whitelist(event, invitee);
    await register(event, invitee);
    await invite(event, member, invitee.id).expect(201);

    await database.getRepository(EventWhitelistEntity).delete(entry.id);
    const response = await accept(event, teamId, invitee);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You are not registered or not whitelisted for this private event.",
    );
    expect(await isMember(teamId, invitee.id)).toBe(false);
    expect(await isInvited(teamId, invitee.id)).toBe(true);
  });

  it("rejects an accept after the user's registration was removed", async () => {
    const { event, member, teamId } = await privateEventWithTeam();
    const invitee = await createUser();
    await whitelist(event, invitee);
    await register(event, invitee);
    await invite(event, member, invitee.id).expect(201);

    await database
      .createQueryBuilder()
      .relation(UserEntity, "events")
      .of(invitee.id)
      .remove(event.id);
    const response = await accept(event, teamId, invitee);

    expect(response.status).toBe(403);
    expect(await isMember(teamId, invitee.id)).toBe(false);
  });

  it("keeps public events open to any user, whitelist or not", async () => {
    const event = await createEvent(false);
    const member = await createUser();
    const invitee = await createUser();
    // A whitelist on a public event does not restrict who can join.
    await whitelist(event, member);
    const teamId = await createTeamOf(event, member);

    await invite(event, member, invitee.id).expect(201);
    await accept(event, teamId, invitee).expect(200);

    expect(await isMember(teamId, invitee.id)).toBe(true);
  });

  it("freezes invites and accepts when team creation is turned off", async () => {
    const event = await createEvent(false);
    const [owner, invitee, late] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);
    const teamId = await createTeamOf(event, owner);
    await invite(event, owner, invitee.id).expect(201);
    await database
      .getRepository(EventEntity)
      .update(event.id, { canCreateTeam: false });

    await invite(event, owner, late.id).expect(400);
    expect(await isInvited(teamId, late.id)).toBe(false);
    await accept(event, teamId, invitee).expect(400);
    expect(await isMember(teamId, invitee.id)).toBe(false);
  });

  it("answers an invite for an unknown user with not found", async () => {
    const event = await createEvent(false);
    const member = await createUser();
    await createTeamOf(event, member);

    const response = await invite(event, member, randomUUID());

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found.");
  });
});
