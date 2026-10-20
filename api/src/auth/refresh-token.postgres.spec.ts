import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource, Repository } from "typeorm";
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { RefreshTokenService } from "./refresh-token.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

postgres("session concurrency (PostgreSQL)", () => {
  const schema = `session_test_${randomUUID().replaceAll("-", "")}`;
  const userId = randomUUID();
  let database: DataSource;
  let tokens: Repository<RefreshTokenEntity>;
  let service: RefreshTokenService;

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
    await database.query(
      `CREATE TABLE "${schema}".users (id uuid PRIMARY KEY, "githubAccessToken" text NOT NULL DEFAULT 'old-grant')`,
    );
    await database.query(`CREATE TABLE "${schema}".refresh_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES "${schema}".users(id),
      "familyId" uuid NOT NULL, "tokenHash" varchar(64) NOT NULL UNIQUE,
      "expiresAt" timestamptz NOT NULL, "rotatedAt" timestamptz, "revokedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    tokens = database.getRepository(RefreshTokenEntity);
    service = new RefreshTokenService(tokens);
  });

  beforeEach(async () => {
    await database.query(`TRUNCATE "${schema}".users CASCADE`);
    await database.query(`INSERT INTO "${schema}".users (id) VALUES ($1)`, [
      userId,
    ]);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  // Let the competing operation either finish (the bug) or reach a real DB
  // lock (the fix), rather than guessing how long its query needs to run.
  async function blockedOrFinished(operation: Promise<unknown>): Promise<void> {
    let finished = false;
    const completion = operation.finally(() => {
      finished = true;
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (finished) {
        await completion;
        return;
      }
      const waiting: { count: string }[] = await database.query(
        `SELECT count(*) FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'`,
        [schema],
      );
      if (Number(waiting[0].count) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      "Competing session operation neither finished nor reached a lock",
    );
  }

  it("concurrent refreshes issue one successor and one grace response", async () => {
    const login = await service.startFamily(userId);
    const results = await Promise.all([
      service.rotate(login.refreshToken),
      service.rotate(login.refreshToken),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "grace",
      "rotated",
    ]);
    expect(await tokens.count()).toBe(2);
  });

  it("rolls back the rotation claim when inserting the successor fails", async () => {
    const login = await service.startFamily(userId);
    const save = jest
      .spyOn(Repository.prototype, "save")
      .mockRejectedValueOnce(new Error("insert failed"));
    await expect(service.rotate(login.refreshToken)).rejects.toThrow(
      "insert failed",
    );
    save.mockRestore();
    expect(await tokens.count()).toBe(1);
    await expect(service.rotate(login.refreshToken)).resolves.toMatchObject({
      status: "rotated",
    });
  });

  it.each(["logout", "logout-all", "reuse"] as const)(
    "%s revokes a successor whose insertion overlaps revocation",
    async (kind) => {
      const login = await service.startFamily(userId);
      let refreshToken = login.refreshToken;
      if (kind === "reuse") {
        const first = await service.rotate(refreshToken);
        if (first.status !== "rotated") throw new Error("Expected rotation");
        refreshToken = first.refreshToken;
      }
      // Make the predecessor old enough to trigger reuse detection.
      if (kind === "reuse") {
        await database.query(
          `UPDATE "${schema}".refresh_tokens SET "rotatedAt" = now() - interval '31 seconds' WHERE "rotatedAt" IS NOT NULL`,
        );
      }
      const inserting = deferred();
      const resume = deferred();
      const save = Repository.prototype.save;
      jest
        .spyOn(Repository.prototype, "save")
        .mockImplementation(async function (
          this: Repository<RefreshTokenEntity>,
          ...args: Parameters<typeof save>
        ) {
          if (this.target === RefreshTokenEntity) {
            inserting.resolve();
            await resume.promise;
          }
          return save.apply(this, args);
        });
      const rotation = service.rotate(refreshToken);
      await inserting.promise;
      const revocation =
        kind === "logout"
          ? service.revokeFamilyOf(refreshToken)
          : kind === "logout-all"
            ? service.revokeAllForUser(userId)
            : service.rotate(login.refreshToken);
      try {
        await blockedOrFinished(revocation);
      } finally {
        resume.resolve();
      }
      const successor = await rotation;
      await revocation;
      if (successor.status !== "rotated") throw new Error("Expected rotation");
      await expect(service.rotate(successor.refreshToken)).resolves.toEqual({
        status: "rejected",
      });
    },
  );
});
