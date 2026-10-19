import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { RefreshTokenService } from "./refresh-token.service";
import { createInMemoryRefreshTokenRepository } from "./testing/in-memory-refresh-token-repository";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";
const T0 = new Date("2026-10-19T12:00:00.000Z").getTime();
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

describe("RefreshTokenService", () => {
  let service: RefreshTokenService;
  let records: RefreshTokenEntity[];

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
    const created = createInMemoryRefreshTokenRepository();
    records = created.records;
    service = new RefreshTokenService(created.repository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rotates a fresh token into a successor in the same family", async () => {
    const login = await service.startFamily(USER_ID);

    const first = await service.rotate(login.refreshToken);
    expect(first).toEqual({
      status: "rotated",
      userId: USER_ID,
      familyId: login.familyId,
      refreshToken: expect.any(String),
    });
    if (first.status !== "rotated") throw new Error("unreachable");
    expect(first.refreshToken).not.toBe(login.refreshToken);

    const second = await service.rotate(first.refreshToken);
    expect(second).toMatchObject({
      status: "rotated",
      userId: USER_ID,
      familyId: login.familyId,
    });
  });

  it("stores only a SHA-256 hash of a 32+ byte base64url token", async () => {
    const login = await service.startFamily(USER_ID);

    expect(login.refreshToken).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(records).toHaveLength(1);
    expect(records[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(records)).not.toContain(login.refreshToken);
  });

  it("rejects an unknown token", async () => {
    await service.startFamily(USER_ID);

    await expect(service.rotate("not-a-real-token")).resolves.toEqual({
      status: "rejected",
    });
  });

  it("treats a rotated token re-presented within 30 s as a multi-tab race", async () => {
    const login = await service.startFamily(USER_ID);
    const first = await service.rotate(login.refreshToken);

    jest.advanceTimersByTime(29 * SECOND);

    await expect(service.rotate(login.refreshToken)).resolves.toEqual({
      status: "grace",
      userId: USER_ID,
      familyId: login.familyId,
    });
    if (first.status !== "rotated") throw new Error("unreachable");
    await expect(service.rotate(first.refreshToken)).resolves.toMatchObject({
      status: "rotated",
    });
  });

  it("revokes the whole family when a rotated token is reused after 30 s", async () => {
    const login = await service.startFamily(USER_ID);
    const first = await service.rotate(login.refreshToken);
    if (first.status !== "rotated") throw new Error("unreachable");

    jest.advanceTimersByTime(31 * SECOND);

    await expect(service.rotate(login.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
    await expect(service.rotate(first.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
  });

  it("expires a session after 90 days without a refresh", async () => {
    const login = await service.startFamily(USER_ID);

    jest.advanceTimersByTime(90 * DAY);

    await expect(service.rotate(login.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
  });

  it("renews the 90-day idle window on every rotation", async () => {
    const login = await service.startFamily(USER_ID);
    jest.advanceTimersByTime(89 * DAY);
    const first = await service.rotate(login.refreshToken);
    if (first.status !== "rotated") throw new Error("unreachable");

    jest.advanceTimersByTime(89 * DAY);

    await expect(service.rotate(first.refreshToken)).resolves.toMatchObject({
      status: "rotated",
    });
  });

  it("logout revokes the family of the presented token only", async () => {
    const session = await service.startFamily(USER_ID);
    const otherDevice = await service.startFamily(USER_ID);
    const first = await service.rotate(session.refreshToken);
    if (first.status !== "rotated") throw new Error("unreachable");

    await service.revokeFamilyOf(first.refreshToken);

    await expect(service.rotate(first.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
    // Even within the grace window, a revoked family stays dead.
    await expect(service.rotate(session.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
    await expect(
      service.rotate(otherDevice.refreshToken),
    ).resolves.toMatchObject({ status: "rotated" });
  });

  it("ignores logout with an unknown token", async () => {
    const session = await service.startFamily(USER_ID);

    await service.revokeFamilyOf("unknown");

    await expect(service.rotate(session.refreshToken)).resolves.toMatchObject({
      status: "rotated",
    });
  });

  it("log out everywhere revokes every family of that user only", async () => {
    const laptop = await service.startFamily(USER_ID);
    const phone = await service.startFamily(USER_ID);
    const someoneElse = await service.startFamily(OTHER_USER_ID);

    await service.revokeAllForUser(USER_ID);

    await expect(service.rotate(laptop.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
    await expect(service.rotate(phone.refreshToken)).resolves.toEqual({
      status: "rejected",
    });
    await expect(
      service.rotate(someoneElse.refreshToken),
    ).resolves.toMatchObject({ status: "rotated" });
  });

  it("cleanup deletes expired rows and rows revoked or rotated over a day ago", async () => {
    await service.startFamily(USER_ID); // idle, expires at day 90
    jest.advanceTimersByTime(80 * DAY);
    const revoked = await service.startFamily(USER_ID);
    await service.revokeFamilyOf(revoked.refreshToken);
    const active = await service.startFamily(USER_ID);
    const successor = await service.rotate(active.refreshToken);
    if (successor.status !== "rotated") throw new Error("unreachable");

    jest.advanceTimersByTime(10 * DAY + SECOND);
    const recentlyRevoked = await service.startFamily(OTHER_USER_ID);
    await service.revokeFamilyOf(recentlyRevoked.refreshToken);
    jest.advanceTimersByTime(DAY - SECOND);

    await service.deleteStaleTokens();

    // Left: the live successor and the row revoked less than a day ago.
    expect(records).toHaveLength(2);
    await expect(service.rotate(successor.refreshToken)).resolves.toMatchObject(
      { status: "rotated" },
    );
  });
});
