jest.mock("../user/user.service", () => ({
  UserService: class UserService {},
}));
jest.mock("../user/social-account.service", () => ({
  SocialAccountService: class SocialAccountService {},
}));
jest.mock("./oauth-state.service", () => ({
  OAuthStateService: class OAuthStateService {},
}));
jest.mock("./github.strategy", () => ({
  GithubOAuthClient: class GithubOAuthClient {},
}));
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import cookieParser from "cookie-parser";
import request from "supertest";
import { UserService } from "../user/user.service";
import { SocialAccountService } from "../user/social-account.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { GithubOAuthClient } from "./github.strategy";
import { JwtStrategy } from "./jwt.strategy";
import { OAuthStateService } from "./oauth-state.service";
import { RefreshTokenService } from "./refresh-token.service";
import { createInMemoryRefreshTokenRepository } from "./testing/in-memory-refresh-token-repository";
import { encryptSecret } from "../common/encryption";
import { BackgroundTasks } from "./background-tasks";
import { GithubGrantChecker } from "./github-grant-checker";
import { GithubGrantService } from "./github-grant.service";

const JWT_SECRET = "test-secret";
const ENCRYPTION_KEY = "test-encryption-key";
const GITHUB_TOKEN = "gho_user_token";
const ENCRYPTED_GITHUB_TOKEN = encryptSecret(GITHUB_TOKEN, ENCRYPTION_KEY);
const USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "user@example.com",
  username: "user",
};
const GITHUB_PROFILE = {
  id: 123,
  login: "user",
  name: "User Name",
  avatar_url: "https://example.com/avatar.png",
};
const ONE_HOUR_MS = 60 * 60 * 1000;

type TestUser = typeof USER & {
  name: string;
  profilePicture: string;
  githubAccessToken: string;
  githubCheckedAt: Date | null;
};

function createUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    ...USER,
    name: GITHUB_PROFILE.name,
    profilePicture: GITHUB_PROFILE.avatar_url,
    githubAccessToken: ENCRYPTED_GITHUB_TOKEN,
    githubCheckedAt: null,
    ...overrides,
  };
}

function githubResponse(status: number, body: unknown = GITHUB_PROFILE) {
  return new Response(JSON.stringify(body), { status });
}
const FIFTEEN_MINUTES_S = 15 * 60;
const NINETY_DAYS_S = 90 * 24 * 60 * 60;

type Cookie = {
  name: string;
  value: string;
  attributes: Record<string, string | true>;
};

function parseSetCookies(response: request.Response): Map<string, Cookie> {
  const header = response.headers["set-cookie"] as unknown as
    string[] | undefined;
  const cookies = new Map<string, Cookie>();
  for (const line of header ?? []) {
    const [pair, ...rest] = line.split(";").map((part) => part.trim());
    const [name, value] = pair.split("=");
    const attributes: Record<string, string | true> = {};
    for (const attribute of rest) {
      const [key, attrValue] = attribute.split("=");
      attributes[key.toLowerCase()] = attrValue ?? true;
    }
    cookies.set(name, { name, value: decodeURIComponent(value), attributes });
  }
  return cookies;
}

function isCleared(cookie: Cookie | undefined): boolean {
  return (
    cookie !== undefined &&
    cookie.value === "" &&
    new Date(cookie.attributes.expires as string).getTime() < Date.now()
  );
}

describe("AuthController sessions", () => {
  let app: INestApplication;
  let jwt: JwtService;
  let users: Map<string, TestUser>;
  let backgroundTasks: BackgroundTasks;
  let fetchMock: jest.SpyInstance;
  let recordGithubCheck: jest.Mock;

  beforeEach(async () => {
    users = new Map([[USER.id, createUser()]]);
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => githubResponse(200));
    recordGithubCheck = jest.fn(
      async (
        id: string,
        checkedAt: Date,
        profile: Partial<
          Pick<TestUser, "username" | "name" | "profilePicture">
        >,
      ) => {
        const user = users.get(id);
        if (user) Object.assign(user, profile, { githubCheckedAt: checkedAt });
      },
    );
    const userService = {
      getUserById: jest.fn(async (id: string) => {
        const user = users.get(id);
        if (!user) throw new Error("EntityNotFound");
        return { ...user };
      }),
      getUserWithSocialAccounts: jest.fn(async (id: string) => users.get(id)),
      recordGithubCheck,
    };

    const module = await Test.createTestingModule({
      imports: [
        PassportModule.register({ session: false }),
        JwtModule.register({ secret: JWT_SECRET }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        RefreshTokenService,
        JwtStrategy,
        BackgroundTasks,
        GithubGrantChecker,
        GithubGrantService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_SECRET,
            API_SECRET_ENCRYPTION_KEY: ENCRYPTION_KEY,
            NODE_ENV: "production",
            OAUTH_SUCCESS_REDIRECT_URL: "https://coregame.sh",
          }),
        },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: createInMemoryRefreshTokenRepository((id) => users.get(id))
            .repository,
        },
        { provide: UserService, useValue: userService },
        { provide: SocialAccountService, useValue: {} },
        {
          provide: OAuthStateService,
          useValue: { consume: async () => ({ codeVerifier: "verifier" }) },
        },
        {
          provide: GithubOAuthClient,
          useValue: { authenticate: async () => USER },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    jwt = module.get(JwtService);
    backgroundTasks = module.get(BackgroundTasks);
  });

  afterEach(async () => {
    await backgroundTasks.drain();
    jest.useRealTimers();
    jest.restoreAllMocks();
    await app.close();
  });

  async function login(): Promise<{ token: string; refreshToken: string }> {
    const response = await request(app.getHttpServer())
      .get("/auth/github/callback")
      .query({ code: "code", state: "state" })
      .expect(302);
    const cookies = parseSetCookies(response);
    return {
      token: cookies.get("token")!.value,
      refreshToken: cookies.get("refresh_token")!.value,
    };
  }

  it("GitHub login starts a session with a 15 min access and a 90 day refresh cookie", async () => {
    const response = await request(app.getHttpServer())
      .get("/auth/github/callback")
      .query({ code: "code", state: "state" })
      .expect(302);

    const cookies = parseSetCookies(response);
    const access = cookies.get("token")!;
    expect(access.attributes).toMatchObject({
      "max-age": String(FIFTEEN_MINUTES_S),
      httponly: true,
      secure: true,
      samesite: "Lax",
    });
    const payload = jwt.verify<{ fid: string; exp: number; iat: number }>(
      access.value,
    );
    expect(payload).toMatchObject({ sub: USER.id, fid: expect.any(String) });
    expect(payload.exp - payload.iat).toBe(FIFTEEN_MINUTES_S);
    const refresh = cookies.get("refresh_token")!;
    expect(refresh.attributes).toMatchObject({
      "max-age": String(NINETY_DAYS_S),
      path: "/auth",
      httponly: true,
      secure: true,
      samesite: "Lax",
    });

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `token=${access.value}`)
      .expect(200);
  });

  it("refresh rotates the refresh token and issues a new access token", async () => {
    const session = await login();

    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(204);

    const cookies = parseSetCookies(response);
    const refresh = cookies.get("refresh_token")!;
    expect(refresh.value).not.toBe(session.refreshToken);
    expect(refresh.attributes).toMatchObject({
      path: "/auth",
      "max-age": String(NINETY_DAYS_S),
    });
    const access = cookies.get("token")!;
    expect(access.attributes["max-age"]).toBe(String(FIFTEEN_MINUTES_S));
    expect(jwt.decode<{ fid: string }>(access.value).fid).toBe(
      jwt.decode<{ fid: string }>(session.token).fid,
    );
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `token=${access.value}`)
      .expect(200);
  });

  it("refresh with a just-rotated token (other tab) sets only a new access token", async () => {
    const session = await login();
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(204);

    const cookies = parseSetCookies(response);
    expect(cookies.has("refresh_token")).toBe(false);
    expect(cookies.get("token")!.value).not.toBe("");
  });

  it("refresh without any session cookie fails and clears both cookies", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .expect(401);

    const cookies = parseSetCookies(response);
    expect(isCleared(cookies.get("token"))).toBe(true);
    const refresh = cookies.get("refresh_token");
    expect(isCleared(refresh)).toBe(true);
    expect(refresh!.attributes.path).toBe("/auth");
  });

  it("refresh with a stolen token reused after the grace window kills the session", async () => {
    const session = await login();
    const rotated = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(204);
    const successor = parseSetCookies(rotated).get("refresh_token")!.value;
    jest.useFakeTimers({
      now: Date.now() + 31 * 1000,
      doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval"],
    });

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${successor}`)
      .expect(401);
  });

  it("refresh fails when the user no longer exists", async () => {
    const session = await login();
    users.delete(USER.id);

    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(401);

    expect(isCleared(parseSetCookies(response).get("token"))).toBe(true);
  });

  describe("legacy 30-day JWT without a family id", () => {
    function signLegacyToken(expiresIn = "30d"): string {
      return jwt.sign(
        { sub: USER.id, email: USER.email, username: USER.username },
        { expiresIn: expiresIn as "30d" },
      );
    }

    it("is rejected by protected endpoints so the client refreshes", async () => {
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", `token=${signLegacyToken()}`)
        .expect(401);
    });

    it("is upgraded once into a new session by refresh", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", `token=${signLegacyToken()}`)
        .expect(204);

      const cookies = parseSetCookies(response);
      const access = cookies.get("token")!.value;
      expect(jwt.verify<{ fid: string }>(access).fid).toEqual(
        expect.any(String),
      );
      expect(cookies.get("refresh_token")!.value).not.toBe("");
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", `token=${access}`)
        .expect(200);
    });

    it("is not upgraded when expired", async () => {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", `token=${signLegacyToken("-1s")}`)
        .expect(401);
    });

    it("is not upgraded when its user no longer exists", async () => {
      users.delete(USER.id);

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", `token=${signLegacyToken()}`)
        .expect(401);
    });
  });

  it("refresh does not accept a current access token in place of a refresh token", async () => {
    const session = await login();

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `token=${session.token}`)
      .expect(401);
  });

  it("logout revokes the current session and clears both cookies", async () => {
    const session = await login();
    const otherDevice = await login();

    const response = await request(app.getHttpServer())
      .post("/auth/logout")
      .set(
        "Cookie",
        `token=${session.token}; refresh_token=${session.refreshToken}`,
      )
      .expect(204);

    const cookies = parseSetCookies(response);
    expect(isCleared(cookies.get("token"))).toBe(true);
    expect(isCleared(cookies.get("refresh_token"))).toBe(true);
    expect(cookies.get("refresh_token")!.attributes.path).toBe("/auth");
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${otherDevice.refreshToken}`)
      .expect(204);
  });

  it("logout without any session still succeeds", async () => {
    await request(app.getHttpServer()).post("/auth/logout").expect(204);
  });

  it("logout-all revokes every session of the user", async () => {
    const laptop = await login();
    const phone = await login();

    const response = await request(app.getHttpServer())
      .post("/auth/logout-all")
      .set("Cookie", `token=${laptop.token}`)
      .expect(204);

    const cookies = parseSetCookies(response);
    expect(isCleared(cookies.get("token"))).toBe(true);
    expect(isCleared(cookies.get("refresh_token"))).toBe(true);
    for (const session of [laptop, phone]) {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", `refresh_token=${session.refreshToken}`)
        .expect(401);
    }
  });

  it("logout-all requires a valid access token", async () => {
    const session = await login();

    await request(app.getHttpServer())
      .post("/auth/logout-all")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${session.refreshToken}`)
      .expect(204);
  });

  describe("GitHub grant check after refresh", () => {
    async function refresh(refreshToken: string, status = 204) {
      return request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", `refresh_token=${refreshToken}`)
        .expect(status);
    }

    function nextRefreshToken(response: request.Response): string {
      return parseSetCookies(response).get("refresh_token")!.value;
    }

    function githubCalls(): number {
      return fetchMock.mock.calls.filter(
        ([url]) => url === "https://api.github.com/user",
      ).length;
    }

    it("ends every session of the user when GitHub answers 401", async () => {
      const laptop = await login();
      const phone = await login();
      fetchMock.mockImplementation(async () => githubResponse(401));

      const response = await refresh(laptop.refreshToken);
      await backgroundTasks.drain();

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get("Authorization")).toBe(
        `Bearer ${GITHUB_TOKEN}`,
      );
      await refresh(nextRefreshToken(response), 401);
      await refresh(phone.refreshToken, 401);
      expect(users.get(USER.id)!.githubCheckedAt).toBeNull();
    });

    it("records the check and syncs only changed profile fields when GitHub answers 200", async () => {
      const session = await login();
      fetchMock.mockImplementation(async () =>
        githubResponse(200, {
          ...GITHUB_PROFILE,
          login: "renamed",
          name: null,
        }),
      );
      const before = Date.now();

      const response = await refresh(session.refreshToken);
      await backgroundTasks.drain();

      const user = users.get(USER.id)!;
      expect(user.githubCheckedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(user).toMatchObject({
        username: "renamed",
        name: "renamed",
        email: USER.email,
        profilePicture: GITHUB_PROFILE.avatar_url,
      });
      expect(recordGithubCheck).toHaveBeenCalledWith(
        USER.id,
        expect.any(Date),
        { username: "renamed", name: "renamed" },
      );
      await refresh(nextRefreshToken(response));
    });

    it("writes no profile fields when nothing changed on GitHub", async () => {
      const session = await login();

      await refresh(session.refreshToken);
      await backgroundTasks.drain();

      expect(recordGithubCheck).toHaveBeenCalledWith(
        USER.id,
        expect.any(Date),
        {},
      );
    });

    it.each([
      ["a 5xx", () => Promise.resolve(githubResponse(502))],
      ["a rate limit", () => Promise.resolve(githubResponse(403))],
      ["a network error", () => Promise.reject(new TypeError("fetch failed"))],
      [
        "a timeout",
        () =>
          Promise.reject(
            new DOMException("The operation timed out.", "TimeoutError"),
          ),
      ],
    ])(
      "keeps the session and retries on the next refresh after %s",
      async (_, answer) => {
        const session = await login();
        fetchMock.mockImplementation(answer);

        const response = await refresh(session.refreshToken);
        await backgroundTasks.drain();

        expect(users.get(USER.id)!.githubCheckedAt).toBeNull();
        await refresh(nextRefreshToken(response));
        await backgroundTasks.drain();
        expect(githubCalls()).toBe(2);
      },
    );

    it.each([
      ["empty", ""],
      ["undecryptable", encryptSecret(GITHUB_TOKEN, "another-key")],
    ])(
      "keeps the session without asking GitHub when the stored token is %s",
      async (_, githubAccessToken) => {
        users.set(USER.id, createUser({ githubAccessToken }));
        const session = await login();

        const response = await refresh(session.refreshToken);
        await backgroundTasks.drain();

        expect(githubCalls()).toBe(0);
        expect(users.get(USER.id)!.githubCheckedAt).toBeNull();
        await refresh(nextRefreshToken(response));
      },
    );

    it("checks at most once per hour", async () => {
      const session = await login();
      const first = await refresh(session.refreshToken);
      await backgroundTasks.drain();
      const second = await refresh(nextRefreshToken(first));
      await backgroundTasks.drain();
      expect(githubCalls()).toBe(1);

      jest.useFakeTimers({
        now: Date.now() + ONE_HOUR_MS + 1000,
        doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval"],
      });
      await refresh(nextRefreshToken(second));
      await backgroundTasks.drain();
      expect(githubCalls()).toBe(2);
    });

    it("does not check on the grace path of a just-rotated token", async () => {
      const session = await login();
      await refresh(session.refreshToken);
      await backgroundTasks.drain();
      users.get(USER.id)!.githubCheckedAt = null;

      await refresh(session.refreshToken);
      await backgroundTasks.drain();

      expect(githubCalls()).toBe(1);
    });

    it("does not check when the refresh is rejected", async () => {
      await refresh("unknown-token", 401);
      await backgroundTasks.drain();

      expect(githubCalls()).toBe(0);
    });

    it("checks after a legacy JWT is upgraded", async () => {
      fetchMock.mockImplementation(async () => githubResponse(401));
      const legacy = jwt.sign(
        { sub: USER.id, email: USER.email, username: USER.username },
        { expiresIn: "30d" },
      );

      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", `token=${legacy}`)
        .expect(204);
      await backgroundTasks.drain();

      expect(githubCalls()).toBe(1);
      await refresh(nextRefreshToken(response), 401);
    });

    it("answers the refresh without waiting for GitHub", async () => {
      const session = await login();
      let answerGithub!: (response: Response) => void;
      fetchMock.mockImplementation(
        () => new Promise<Response>((resolve) => (answerGithub = resolve)),
      );

      const response = await refresh(session.refreshToken);

      expect(githubCalls()).toBe(1);
      expect(users.get(USER.id)!.githubCheckedAt).toBeNull();
      answerGithub(githubResponse(401));
      await backgroundTasks.drain();
      await refresh(nextRefreshToken(response), 401);
    });

    it("keeps a session from a login during the check when GitHub answers 401", async () => {
      const session = await login();
      let answerGithub!: (response: Response) => void;
      fetchMock.mockImplementation(
        () => new Promise<Response>((resolve) => (answerGithub = resolve)),
      );

      await refresh(session.refreshToken);
      await new Promise((resolve) => setImmediate(resolve));
      expect(githubCalls()).toBe(1);
      users.get(USER.id)!.githubAccessToken = encryptSecret(
        "gho_new_token",
        ENCRYPTION_KEY,
      );
      const relogin = await login();
      answerGithub(githubResponse(401));
      await backgroundTasks.drain();

      fetchMock.mockImplementation(async () => githubResponse(200));
      await refresh(relogin.refreshToken);
    });

    it("keeps refresh working when recording the check fails", async () => {
      const session = await login();
      recordGithubCheck.mockRejectedValue(new Error("database down"));

      const response = await refresh(session.refreshToken);
      await backgroundTasks.drain();

      await refresh(nextRefreshToken(response));
    });
  });
});
