import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { ClearLegacyGithubTokens1792500000000 } from "../../db/migrations/1792500000000-clear-legacy-github-tokens";
import { encryptSecret } from "../common/encryption";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("ClearLegacyGithubTokens migration (PostgreSQL)", () => {
  const schema = `legacy_token_test_${randomUUID().replaceAll("-", "")}`;
  const currentToken = encryptSecret("gho_current", "test-key");
  const legacyToken = "U2FsdGVkX18AAQIDBAUGB5swTx/Yx+o+F0LJpOTx9FY=";
  const currentUser = randomUUID();
  const legacyUser = randomUUID();
  const clearedUser = randomUUID();
  let database: DataSource;

  beforeAll(async () => {
    const admin = new DataSource({ type: "postgres", url: databaseUrl });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.destroy();

    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      extra: { options: `-c search_path=${schema}` },
    });
    await database.initialize();
    await database.query(`CREATE TABLE users (
      id uuid PRIMARY KEY, "githubAccessToken" varchar NOT NULL,
      "githubCheckedAt" timestamptz
    )`);
    await database.query(`CREATE TABLE refresh_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL REFERENCES users(id),
      "revokedAt" timestamptz
    )`);
    await database.query(
      `INSERT INTO users (id, "githubAccessToken", "githubCheckedAt") VALUES
        ($1, $2, now()), ($3, $4, now()), ($5, '', NULL)`,
      [currentUser, currentToken, legacyUser, legacyToken, clearedUser],
    );
    await database.query(
      `INSERT INTO refresh_tokens ("userId") VALUES ($1), ($2), ($2)`,
      [currentUser, legacyUser],
    );

    const queryRunner = database.createQueryRunner();
    await new ClearLegacyGithubTokens1792500000000().up(queryRunner);
    await queryRunner.release();
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function user(id: string) {
    const [row] = await database.query(
      `SELECT "githubAccessToken", "githubCheckedAt" FROM users WHERE id = $1`,
      [id],
    );
    return row;
  }

  async function activeSessions(id: string): Promise<number> {
    const [{ count }] = await database.query(
      `SELECT count(*)::int AS count FROM refresh_tokens WHERE "userId" = $1 AND "revokedAt" IS NULL`,
      [id],
    );
    return count;
  }

  it("clears an old-format token and ends that user's sessions", async () => {
    expect(await user(legacyUser)).toEqual({
      githubAccessToken: "",
      githubCheckedAt: null,
    });
    expect(await activeSessions(legacyUser)).toBe(0);
  });

  it("keeps current-format tokens and their sessions", async () => {
    expect((await user(currentUser)).githubAccessToken).toBe(currentToken);
    expect(await activeSessions(currentUser)).toBe(1);
  });

  it("leaves no stored token outside the current format", async () => {
    const [{ count }] = await database.query(
      `SELECT count(*)::int AS count FROM users WHERE "githubAccessToken" NOT LIKE 'v2:%' AND "githubAccessToken" <> ''`,
    );
    expect(count).toBe(0);
  });
});
