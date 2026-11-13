jest.mock("../team/team.service", () => ({ TeamService: class {} }));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class {},
}));
jest.mock("../match/match.service", () => ({ MatchService: class {} }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { authzTestingModule, principalWith } from "../authz/testing";
import { UserRole } from "../authz";
import { UserRoleEntity } from "../user/entities/user-role.entity";
import { AdminEventsController } from "./admin-events.controller";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";

const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("admin event lookup (PostgreSQL)", () => {
  const schema = `admin_events_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  let events: EventEntity[];

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
    const service = new EventService(
      database.getRepository(EventEntity),
      database.getRepository(UserRoleEntity),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      database,
      {} as never,
    );
    const principals = {
      admin: principalWith("admin", UserRole.ADMIN),
      moderator: principalWith("moderator", UserRole.MODERATOR),
      creator: principalWith("creator", UserRole.PUBLIC_EVENT_CREATOR),
      eventAdmin: principalWith("eventAdmin", UserRole.ADMIN, randomUUID()),
      member: principalWith("member"),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [authzTestingModule(async (id) => principals[id] ?? null)],
      controllers: [AdminEventsController],
      providers: [{ provide: EventService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    events = await database.getRepository(EventEntity).save(
      Array.from({ length: 55 }, (_, i) => ({
        name:
          i === 54
            ? "Finals %_\\ Cup"
            : i === 53
              ? "Finals xyz Cup"
              : `Event ${i}`,
        isPrivate: i % 2 === 0,
        startDate: new Date(Date.UTC(2020, 0, i + 1)),
        submissionDeadline: new Date("2099-01-01"),
        scheduledEndDate: new Date("2099-01-01"),
        endDate: new Date("2099-01-01"),
        githubOrg: "org",
        minTeamSize: 1,
        maxTeamSize: 4,
      })),
    );
  });

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  function get(query: object = {}, user: string | null = "admin") {
    const req = request(app.getHttpServer()).get("/admin/events").query(query);
    return user ? req.set("x-test-user", user) : req;
  }

  const response = (event: EventEntity) => ({
    id: event.id,
    name: event.name,
    isPrivate: event.isPrivate,
    startDate: event.startDate.toISOString(),
  });

  it("returns the latest 20 events including private events with only lookup fields", async () => {
    const result = await get().expect(200);
    expect(result.body).toEqual(events.slice(-20).reverse().map(response));
    const empty = await get({ q: "" }).expect(200);
    expect(empty.body).toEqual(result.body);
  });

  it("matches names case-insensitively", async () => {
    const result = await get({ q: "fInAlS" }).expect(200);
    expect(result.body).toEqual(events.slice(-2).reverse().map(response));
    await get({ q: "no such event" }).expect(200, []);
  });

  it.each(["%", "_", "\\", "%_\\"])("matches %s literally", async (q) => {
    await get({ q }).expect(200, [response(events[54])]);
  });

  it.each([1, 50])("accepts limit %s", async (limit) => {
    const result = await get({ limit }).expect(200);
    expect(result.body).toEqual(events.slice(-limit).reverse().map(response));
  });

  it.each(["0", "-1", "51", "1.5", "nope", "", ["1", "2"]])(
    "rejects invalid limit %p",
    async (limit) => {
      await get({ limit }).expect(400);
    },
  );

  it("rejects repeated search parameters", async () => {
    await get({ q: ["a", "b"] }).expect(400);
  });

  it.each(["member", "moderator", "creator", "eventAdmin"])(
    "denies %s",
    async (user) => {
      await get({}, user).expect(403);
    },
  );

  it("denies guests", async () => {
    await get({}, null).expect(401);
  });
});
