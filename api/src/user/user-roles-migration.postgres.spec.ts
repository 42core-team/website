import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { UserRoles1793000000000 } from "../../db/migrations/1793000000000-user-roles";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("UserRoles migration (PostgreSQL)", () => {
  const schema = `user_roles_test_${randomUUID().replaceAll("-", "")}`;
  const creator = randomUUID();
  const admin = randomUUID();
  const plain = randomUUID();
  const event = randomUUID();
  const otherEvent = randomUUID();
  let database: DataSource;

  beforeAll(async () => {
    const setup = new DataSource({ type: "postgres", url: databaseUrl });
    await setup.initialize();
    await setup.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.destroy();

    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      migrations: [UserRoles1793000000000],
      // public holds uuid_generate_v4().
      extra: { options: `-c search_path=${schema},public` },
    });
    await database.initialize();
    await database.query(`CREATE TABLE users (
      id uuid PRIMARY KEY, "canCreateEvent" boolean NOT NULL DEFAULT false
    )`);
    await database.query(`CREATE TABLE events (id uuid PRIMARY KEY)`);
    await database.query(
      `CREATE TYPE "user_event_permissions_role_enum" AS ENUM('USER', 'ADMIN')`,
    );
    await database.query(`CREATE TABLE user_event_permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      role "user_event_permissions_role_enum" NOT NULL DEFAULT 'USER',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "userId" uuid REFERENCES users(id), "eventId" uuid REFERENCES events(id)
    )`);
    await database.query(
      `INSERT INTO users (id, "canCreateEvent") VALUES ($1, true), ($2, false), ($3, false)`,
      [creator, admin, plain],
    );
    await database.query(`INSERT INTO events (id) VALUES ($1), ($2)`, [
      event,
      otherEvent,
    ]);
    // The admin is listed twice for one event, as the old table allows.
    await database.query(
      `INSERT INTO user_event_permissions (role, "userId", "eventId") VALUES
        ('ADMIN', $1, $3), ('ADMIN', $1, $3), ('ADMIN', $2, $4), ('USER', $5, $3),
        ('ADMIN', NULL, $3)`,
      [admin, creator, event, otherEvent, plain],
    );

    const queryRunner = database.createQueryRunner();
    await new UserRoles1793000000000().up(queryRunner);
    await queryRunner.release();
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function roles(userId: string) {
    return database.query(
      `SELECT role, "eventId", "grantedById" FROM user_roles WHERE "userId" = $1 ORDER BY role, "eventId"`,
      [userId],
    );
  }

  async function insert(userId: string, role: string, eventId: string | null) {
    await database.query(
      `INSERT INTO user_roles ("userId", role, "eventId") VALUES ($1, $2, $3)`,
      [userId, role, eventId],
    );
  }

  it("grants PUBLIC_EVENT_CREATOR to users who could create events", async () => {
    expect(await roles(creator)).toEqual(
      expect.arrayContaining([
        { role: "PUBLIC_EVENT_CREATOR", eventId: null, grantedById: null },
      ]),
    );
  });

  it("copies each event ADMIN permission once and nothing else", async () => {
    expect(await roles(admin)).toEqual([
      { role: "ADMIN", eventId: event, grantedById: null },
    ]);
    expect(await roles(creator)).toEqual([
      { role: "ADMIN", eventId: otherEvent, grantedById: null },
      { role: "PUBLIC_EVENT_CREATOR", eventId: null, grantedById: null },
    ]);
    expect(await roles(plain)).toEqual([]);
  });

  it("allows a global role only once", async () => {
    await insert(plain, "MODERATOR", null);
    await expect(insert(plain, "MODERATOR", null)).rejects.toThrow(
      /UQ_user_roles_user_role_event/,
    );
  });

  it("allows an event role once per event", async () => {
    await expect(insert(admin, "ADMIN", event)).rejects.toThrow(
      /UQ_user_roles_user_role_event/,
    );
    await insert(admin, "ADMIN", otherEvent);
  });

  it("rejects creator roles scoped to an event", async () => {
    for (const role of ["PUBLIC_EVENT_CREATOR", "PRIVATE_EVENT_CREATOR"])
      await expect(insert(plain, role, event)).rejects.toThrow(
        /CHK_user_roles_event_scope/,
      );
  });

  it("cascades user and event deletion and clears the granter", async () => {
    const granter = randomUUID();
    const grantee = randomUUID();
    const doomed = randomUUID();
    await database.query(`INSERT INTO users (id) VALUES ($1), ($2)`, [
      granter,
      grantee,
    ]);
    await database.query(`INSERT INTO events (id) VALUES ($1)`, [doomed]);
    await database.query(
      `INSERT INTO user_roles ("userId", role, "eventId", "grantedById") VALUES
        ($1, 'ADMIN', NULL, $2), ($1, 'MODERATOR', $3, $2)`,
      [grantee, granter, doomed],
    );

    await database.query(`DELETE FROM events WHERE id = $1`, [doomed]);
    await database.query(`DELETE FROM users WHERE id = $1`, [granter]);
    expect(await roles(grantee)).toEqual([
      { role: "ADMIN", eventId: null, grantedById: null },
    ]);

    await database.query(`DELETE FROM users WHERE id = $1`, [grantee]);
    expect(await roles(grantee)).toEqual([]);
  });

  it("drops the table and the enum on down", async () => {
    const queryRunner = database.createQueryRunner();
    await new UserRoles1793000000000().down(queryRunner);
    await queryRunner.release();
    const [{ table, type }] = await database.query(
      `SELECT to_regclass('user_roles') AS table, to_regtype('user_role') AS type`,
    );
    expect({ table, type }).toEqual({ table: null, type: null });
    // Rollback retains the original legacy snapshot, not subsequent role changes.
    const [{ count }] = await database.query(
      `SELECT count(*)::int AS count FROM user_event_permissions`,
    );
    expect(count).toBe(5);
  });

  it("can apply again after down and skips an already recorded migration", async () => {
    expect(await database.runMigrations()).toHaveLength(1);
    expect(await database.runMigrations()).toHaveLength(0);
    expect(await roles(admin)).toEqual([
      { role: "ADMIN", eventId: event, grantedById: null },
    ]);
  });
});
