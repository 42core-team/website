import { createHash, randomUUID } from "node:crypto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DataSource } from "typeorm";
import { SharedGithubInstallations1793100000000 } from "../../db/migrations/1793100000000-shared-github-installations";
import {
  DEFAULT_PRESET_SETTINGS,
  EventPresets1793200000000,
  seedDefaultPreset,
} from "../../db/migrations/1793200000000-event-presets";
import { PresetSettingsDto } from "./dtos/preset-settings.dto";
import { resolvePresetSettings } from "./preset-resolver";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("EventPresets migrations (PostgreSQL)", () => {
  const schema = `preset_migration_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;

  async function run(direction: "up" | "down") {
    const queryRunner = database.createQueryRunner();
    const migrations = [
      new SharedGithubInstallations1793100000000(),
      new EventPresets1793200000000(),
    ];
    if (direction === "down") migrations.reverse();
    for (const migration of migrations) await migration[direction](queryRunner);
    await queryRunner.release();
  }

  beforeAll(async () => {
    const setup = new DataSource({ type: "postgres", url: databaseUrl });
    await setup.initialize();
    await setup.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.destroy();

    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      // public holds uuid_generate_v4().
      extra: { options: `-c search_path=${schema},public` },
    });
    await database.initialize();
    await database.query(`CREATE TABLE users (id uuid PRIMARY KEY)`);
    await database.query(`CREATE TABLE events (id uuid PRIMARY KEY)`);
    await database.query(
      `CREATE TABLE github_installations (id uuid PRIMARY KEY)`,
    );
    await run("up");
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  it("seeds a valid default preset", async () => {
    const presets = await database.query(
      `SELECT name, "isDefault", version, "archivedAt", settings, "starterTemplates" FROM event_presets`,
    );
    expect(presets).toEqual([
      {
        name: "Default",
        isDefault: true,
        version: 1,
        archivedAt: null,
        settings: DEFAULT_PRESET_SETTINGS,
        starterTemplates: [],
      },
    ]);
    const settings = plainToInstance(PresetSettingsDto, presets[0].settings);
    expect(
      await validate(settings, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toEqual([]);
    expect(createHash("sha256").update(settings.gameConfig).digest("hex")).toBe(
      "af1e4d72a1c0f63baddb748293ef4f25c761f5d4e915109ceedec10966f01d6c",
    );
    expect(
      createHash("sha256").update(settings.serverConfig).digest("hex"),
    ).toBe("ff48996cf78efe8cab5eb0290e85c14cf1e3a1701dff6f8d5ccb6f54997b8c0c");
    expect(JSON.parse(settings.gameConfig)).toHaveProperty("gridSize");
    expect(JSON.parse(settings.serverConfig)).toHaveProperty("timeoutTicks");
    expect(resolvePresetSettings(settings)).toMatchObject({
      gameServerDockerImage: "ghcr.io/42core-team/server:dev",
      basePath: "bots/c/bot",
      monorepoVersion: "dev",
    });
  });

  it("seeds idempotently without overwriting admin changes", async () => {
    await database.query(
      `UPDATE event_presets SET description = 'Edited by an admin' WHERE name = 'Default'`,
    );
    const runner = database.createQueryRunner();
    try {
      await seedDefaultPreset(runner);
      await seedDefaultPreset(runner);
    } finally {
      await runner.release();
    }
    expect(
      await database.query(`SELECT name, description FROM event_presets`),
    ).toEqual([{ name: "Default", description: "Edited by an admin" }]);
  });

  it("allows one default and no archived default", async () => {
    await expect(
      database.query(
        `INSERT INTO event_presets (name, "isDefault", settings) VALUES ('Second', true, '{}')`,
      ),
    ).rejects.toMatchObject({ driverError: { code: "23505" } });
    await expect(
      database.query(
        `UPDATE event_presets SET "archivedAt" = now() WHERE "isDefault"`,
      ),
    ).rejects.toMatchObject({ driverError: { code: "23514" } });
    await database.query(
      `INSERT INTO event_presets (name, settings) VALUES ('Other', '{}'), ('Third', '{}')`,
    );
  });

  it("adds the event and installation columns", async () => {
    const columns = await database.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = $1 AND column_name IN ('presetId', 'presetVersion', 'sharedAt', 'sharedById')
       ORDER BY table_name, column_name`,
      [schema],
    );
    expect(columns).toEqual([
      { table_name: "events", column_name: "presetId" },
      { table_name: "events", column_name: "presetVersion" },
      { table_name: "github_installations", column_name: "sharedAt" },
      { table_name: "github_installations", column_name: "sharedById" },
    ]);
  });

  it("reverts and reapplies", async () => {
    await run("down");
    const [{ exists }] = await database.query(
      `SELECT to_regclass('event_presets') IS NOT NULL AS exists`,
    );
    expect(exists).toBe(false);
    await run("up");
    const [{ count }] = await database.query(
      `SELECT COUNT(*)::int AS count FROM event_presets WHERE "isDefault"`,
    );
    expect(count).toBe(1);
  });
});
