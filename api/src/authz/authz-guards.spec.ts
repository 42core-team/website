jest.mock("../user/user.service", () => ({
  UserService: class UserService {},
}));

import { Test } from "@nestjs/testing";
import {
  Controller,
  Get,
  INestApplication,
  Logger,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  AuthorizationService,
  AuthzModule,
  Can,
  CurrentUser,
  EventPolicy,
  param,
  Public,
  SignedIn,
  UserRole,
  type Principal,
} from ".";
import { JwtStrategy } from "../auth/jwt.strategy";
import { EventAudience } from "./event-audience";
import { UserService } from "../user/user.service";
import type { UserEntity } from "../user/entities/user.entity";

const SECRET = "test-secret";
const EVENT = "11111111-1111-4111-8111-111111111111";
const OTHER_EVENT = "22222222-2222-4222-8222-222222222222";

@Controller("probe")
class ProbeController {
  constructor(private readonly authorization: AuthorizationService) {}

  @Public()
  @Get("public")
  open(@CurrentUser() user: UserEntity | null) {
    return { user: user?.id ?? null };
  }

  @SignedIn()
  @Get("me")
  me(@CurrentUser() user: UserEntity) {
    return { user: user.id, roles: user.roles.length };
  }

  @Can(EventPolicy, "administer", param("id"))
  @Get("events/:id")
  administer(@Param("id", new ParseUUIDPipe()) id: string) {
    return { id };
  }

  @SignedIn()
  @Get("events/:id/in-service")
  async inService(@Param("id") id: string, @CurrentUser() user: UserEntity) {
    await this.authorization.authorize(EventPolicy, "administer", user, id);
    return { id };
  }

  @Can(EventPolicy, "view", param("id"))
  @Get("events/:id/view")
  view(@Param("id", new ParseUUIDPipe()) id: string) {
    return { id };
  }

  @SignedIn()
  @Can(EventPolicy, "view", param("id"))
  @Get("events/:id/view-signed-in")
  viewSignedIn(@Param("id", new ParseUUIDPipe()) id: string) {
    return { id };
  }

  @Get("undecided")
  undecided() {
    return "reached";
  }
}

const users: Record<string, Principal> = {
  plain: { id: "plain", roles: [] },
  eventAdmin: {
    id: "eventAdmin",
    roles: [{ role: UserRole.ADMIN, eventId: EVENT }],
  },
  globalAdmin: {
    id: "globalAdmin",
    roles: [{ role: UserRole.ADMIN, eventId: null }],
  },
};

describe("global authentication and authorization guards", () => {
  let app: INestApplication;
  let jwt: JwtService;
  let startupErrors: unknown[][];
  const getUserWithRoles = jest.fn(async (id: string) => users[id] ?? null);
  // Only OTHER_EVENT is public.
  const audience = {
    isPublic: jest.fn(async (eventId: string) => eventId === OTHER_EVENT),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ session: false }),
        JwtModule.register({ secret: SECRET }),
        AuthzModule,
      ],
      controllers: [ProbeController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: SECRET }),
        },
        { provide: UserService, useValue: { getUserWithRoles } },
      ],
    })
      .overrideProvider(EventAudience)
      .useValue(audience)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    const logError = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    try {
      await app.init();
      startupErrors = [...logError.mock.calls];
    } finally {
      logError.mockRestore();
    }
    jwt = moduleRef.get(JwtService);
  });
  afterAll(async () => app?.close());

  const token = (
    sub: string,
    options: { fid?: string; expiresIn?: number } = {},
  ) =>
    jwt.sign(
      { sub, ...(options.fid !== "" && { fid: options.fid ?? "family" }) },
      { expiresIn: options.expiresIn ?? 60 },
    );
  const get = (path: string, cookie?: string) => {
    const req = request(app.getHttpServer()).get(`/probe/${path}`);
    return cookie ? req.set("Cookie", `token=${cookie}`) : req;
  };

  describe("a guest", () => {
    it.each([
      ["no token", undefined],
      ["a malformed token", "not-a-jwt"],
      [
        "a token signed with another key",
        new JwtService({ secret: "other" }).sign({ sub: "plain", fid: "f" }),
      ],
      ["an expired token", "expired"],
      ["a token without a session", "no-fid"],
      ["a token of a deleted user", "deleted"],
    ])(
      "with %s reaches public routes and gets 401 elsewhere",
      async (_, raw) => {
        const cookie =
          raw === "expired"
            ? token("plain", { expiresIn: -10 })
            : raw === "no-fid"
              ? token("plain", { fid: "" })
              : raw === "deleted"
                ? token("ghost")
                : raw;
        await get("public", cookie).expect(200, { user: null });
        await get("me", cookie).expect(401);
        await get(`events/${EVENT}`, cookie).expect(401);
        await get("undecided", cookie).expect(401);
      },
    );
  });

  it("passes the package's guard verification with the custom subclass", () => {
    // This deliberate undecided probe proves the package's startup scan ran.
    expect(startupErrors).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.stringContaining("ProbeController.undecided"),
        ]),
      ]),
    );
    const errors = startupErrors.flat().join("\n");
    expect(errors).not.toContain("@Can() is not enforced");
    expect(errors).not.toContain("AuthorizationGuard runs before");
  });

  it("attaches a signed-in user with their roles", async () => {
    await get("public", token("plain")).expect(200, { user: "plain" });
    await get("me", token("eventAdmin")).expect(200, {
      user: "eventAdmin",
      roles: 1,
    });
  });

  it("denies routes that declare no decision", async () => {
    await get("undecided", token("globalAdmin")).expect(403);
  });

  it("lets only the event's admins administer it", async () => {
    await get(`events/${EVENT}`, token("plain")).expect(403);
    await get(`events/${EVENT}`, token("eventAdmin")).expect(200, {
      id: EVENT,
    });
    await get(`events/${OTHER_EVENT}`, token("eventAdmin")).expect(403);
    await get(`events/${OTHER_EVENT}`, token("globalAdmin")).expect(200);
  });

  it("answers a malformed event id with 403 or 400, never 500", async () => {
    await get("events/not-a-uuid", token("eventAdmin")).expect(403);
    // A global admin passes the policy, so the pipe rejects the id.
    await get("events/not-a-uuid", token("globalAdmin")).expect(400);
  });

  it("turns a denial inside the handler into 403", async () => {
    await get(`events/${EVENT}/in-service`, token("plain")).expect(403);
    await get(`events/${EVENT}/in-service`, token("eventAdmin")).expect(200);
  });

  it("hides private events from guests and admits any signed-in viewer", async () => {
    await get(`events/${EVENT}/view`).expect(404, /Event not found/);
    await get(`events/${EVENT}/view`, token("plain")).expect(200);
    await get(`events/${EVENT}/view`, token("eventAdmin")).expect(200);
    await get(`events/${OTHER_EVENT}/view`).expect(200);
    await get(`events/${OTHER_EVENT}/view`, token("plain")).expect(200);
    await get("events/not-a-uuid/view", token("plain")).expect(400);
  });

  it("asks a guest to sign in before checking the event", async () => {
    await get(`events/${EVENT}/view-signed-in`).expect(401);
    await get(`events/${OTHER_EVENT}/view-signed-in`).expect(401);
    await get(`events/${EVENT}/view-signed-in`, token("plain")).expect(200);
    await get(`events/${OTHER_EVENT}/view-signed-in`, token("plain")).expect(
      200,
    );
  });

  it("does not treat a database outage as a guest", async () => {
    getUserWithRoles.mockRejectedValueOnce(new Error("database down"));
    await get("public", token("plain")).expect(500);
  });
});
