import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import request from "supertest";
import { DataSource, EntityManager, IsNull } from "typeorm";
import { authzTestingModule } from "../authz/testing";
import { EventEntity } from "../event/entities/event.entity";
import { UserRole, UserRoleEntity } from "../user/entities/user-role.entity";
import { UserEntity } from "../user/entities/user.entity";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("role admin API (PostgreSQL)", () => {
  const schema = `roles_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  let admin: UserEntity;
  let member: UserEntity;
  let event: EventEntity;

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
    // TypeORM cannot declare NULLS NOT DISTINCT; recreate it as the migration does.
    await database.query(
      `ALTER TABLE "${schema}"."user_roles" DROP CONSTRAINT "UQ_user_roles_user_role_event",
       ADD CONSTRAINT "UQ_user_roles_user_role_event" UNIQUE NULLS NOT DISTINCT ("userId", "role", "eventId")`,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        authzTestingModule((id) =>
          database.getRepository(UserEntity).findOne({
            where: { id },
            relations: { roles: true },
          }),
        ),
      ],
      controllers: [RolesController],
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(UserRoleEntity),
          useValue: database.getRepository(UserRoleEntity),
        },
        { provide: DataSource, useValue: database },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    admin = await createUser();
    member = await createUser();
    await database
      .getRepository(UserRoleEntity)
      .insert({ userId: admin.id, role: UserRole.ADMIN, eventId: null });
    event = await database.getRepository(EventEntity).save({
      name: "Event",
      githubOrg: "org",
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2020-01-01"),
      submissionDeadline: new Date("2099-01-01"),
      scheduledEndDate: new Date("2099-01-01"),
      endDate: new Date("2099-01-01"),
    });
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
      username: `user-${id.slice(0, 8)}`,
      name: `Name ${id.slice(0, 8)}`,
      profilePicture: "https://example.com/p.png",
    });
  }

  const as = (user: UserEntity | null) => {
    const server = app.getHttpServer();
    const auth = <T extends request.Test>(req: T) =>
      user ? req.set("x-test-user", user.id) : req;
    return {
      get: (path: string) => auth(request(server).get(path)),
      post: (path: string, body: object) =>
        auth(request(server).post(path).send(body)),
      delete: (path: string) => auth(request(server).delete(path)),
    };
  };

  it("is for global admins only", async () => {
    await as(null).get("/admin/roles").expect(401);
    await as(member).get("/admin/roles").expect(403);
    await as(member)
      .post("/admin/roles", { userId: member.id, role: UserRole.ADMIN })
      .expect(403);
    await as(member).delete(`/admin/roles/${randomUUID()}`).expect(403);
  });

  it("grants a role and lists it with its user, event and granter", async () => {
    const created = await as(admin)
      .post("/admin/roles", {
        userId: member.id,
        role: UserRole.MODERATOR,
        eventId: event.id,
      })
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      role: UserRole.MODERATOR,
      eventId: event.id,
      event: { id: event.id, name: "Event" },
      user: {
        id: member.id,
        username: member.username,
        name: member.name,
        profilePicture: member.profilePicture,
      },
      grantedBy: { id: admin.id, username: admin.username },
      createdAt: expect.any(String),
    });

    const listed = await as(admin)
      .get(`/admin/roles?userId=${member.id}`)
      .expect(200);
    expect(listed.body).toEqual([created.body]);
    const byEvent = await as(admin)
      .get(`/admin/roles?eventId=${event.id}`)
      .expect(200);
    expect(byEvent.body).toEqual([created.body]);
  });

  it("lists global roles without event or a missing granter", async () => {
    const listed = await as(admin)
      .get(`/admin/roles?userId=${admin.id}`)
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({ role: UserRole.ADMIN, eventId: null }),
    ]);
    expect(listed.body[0]).not.toHaveProperty("event");
    expect(listed.body[0]).not.toHaveProperty("grantedBy");
  });

  it("answers 409 for a role the user already has, globally or per event", async () => {
    const grant = { userId: member.id, role: UserRole.PUBLIC_EVENT_CREATOR };
    await as(admin).post("/admin/roles", grant).expect(201);
    await as(admin).post("/admin/roles", grant).expect(409);
    await as(admin)
      .post("/admin/roles", {
        userId: member.id,
        role: UserRole.MODERATOR,
        eventId: event.id,
      })
      .expect(409);
  });

  it("answers 409 for a concurrent duplicate global grant", async () => {
    const body = { userId: member.id, role: UserRole.MODERATOR };
    const results = await Promise.all([
      as(admin).post("/admin/roles", body),
      as(admin).post("/admin/roles", body),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });

  it("answers 400 for a creator role scoped to an event and for bad input", async () => {
    for (const role of [
      UserRole.PUBLIC_EVENT_CREATOR,
      UserRole.PRIVATE_EVENT_CREATOR,
    ])
      await as(admin)
        .post("/admin/roles", { userId: member.id, role, eventId: event.id })
        .expect(400);
    await as(admin)
      .post("/admin/roles", { userId: member.id, role: "OWNER" })
      .expect(400);
    await as(admin)
      .post("/admin/roles", { userId: "nope", role: UserRole.ADMIN })
      .expect(400);
    await as(admin).get("/admin/roles?eventId=nope").expect(400);
  });

  it("answers 404 for an unknown user or event", async () => {
    await as(admin)
      .post("/admin/roles", { userId: randomUUID(), role: UserRole.ADMIN })
      .expect(404);
    await as(admin)
      .post("/admin/roles", {
        userId: member.id,
        role: UserRole.ADMIN,
        eventId: randomUUID(),
      })
      .expect(404);
    await as(admin).delete(`/admin/roles/${randomUUID()}`).expect(404);
  });

  it("revokes roles but never the last global admin", async () => {
    const [own] = (
      await as(admin).get(`/admin/roles?userId=${admin.id}`).expect(200)
    ).body;
    await as(admin).delete(`/admin/roles/${own.id}`).expect(409);

    const second = await as(admin)
      .post("/admin/roles", { userId: member.id, role: UserRole.ADMIN })
      .expect(201);
    await as(admin).delete(`/admin/roles/${own.id}`).expect(204);
    // The admin's own grant is gone, so they are no longer allowed.
    await as(admin).get("/admin/roles").expect(403);
    await as(member).delete(`/admin/roles/${second.body.id}`).expect(409);
  });

  it("serializes concurrent global admin revocations without deadlocking", async () => {
    const service = app.get(RolesService);
    const extra = await createUser();
    const second = await service.grant(
      { userId: extra.id, role: UserRole.ADMIN },
      member.id,
    );
    // member also has other roles; select the global admin grant explicitly.
    const own = (await service.list({ userId: member.id })).find(
      (row) => row.role === UserRole.ADMIN && row.eventId === null,
    )!;
    let arrivals = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    const concurrentService = new RolesService(
      database.getRepository(UserRoleEntity),
      {
        transaction: (work: (manager: EntityManager) => Promise<void>) =>
          database.transaction(async (manager) => {
            const repository = manager.getRepository(UserRoleEntity);
            const findOne = repository.findOne.bind(repository);
            jest
              .spyOn(repository, "findOne")
              .mockImplementation(async (options) => {
                const row = await findOne(options);
                if (++arrivals === 2) release();
                await bothRead;
                return row;
              });
            return work(manager);
          }),
      } as DataSource,
    );
    // Both revocations read their target before proceeding, forcing the race.
    const results = await Promise.allSettled([
      concurrentService.revoke(own.id),
      concurrentService.revoke(second.id),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: { status: 409 },
    });
    expect(
      await database.getRepository(UserRoleEntity).countBy({
        role: UserRole.ADMIN,
        eventId: IsNull(),
      }),
    ).toBe(1);
  });
});
