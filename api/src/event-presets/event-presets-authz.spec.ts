jest.mock("./event-presets.service", () => ({
  EventPresetsService: class EventPresetsService {},
}));

import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { UserRole } from "../authz";
import { authzTestingModule, principalWith } from "../authz/testing";
import { AdminEventPresetsController } from "./admin-event-presets.controller";
import { EventPresetsController } from "./event-presets.controller";
import { EventPresetsService } from "./event-presets.service";
import { PRESET_SETTINGS } from "./testing";

const ID = randomUUID();
const principals = {
  admin: principalWith("admin", UserRole.ADMIN),
  moderator: principalWith("moderator", UserRole.MODERATOR),
  publicCreator: principalWith("publicCreator", UserRole.PUBLIC_EVENT_CREATOR),
  privateCreator: principalWith(
    "privateCreator",
    UserRole.PRIVATE_EVENT_CREATOR,
  ),
  eventAdmin: principalWith("eventAdmin", UserRole.ADMIN, randomUUID()),
  member: principalWith("member"),
};
type Who = keyof typeof principals;

const preset = { name: "Preset", settings: PRESET_SETTINGS };
const creators: Who[] = ["admin", "publicCreator", "privateCreator"];

/** Each route, the users it lets in, and the status they get. */
const ROUTES: {
  method: "get" | "post" | "put";
  path: string;
  body?: object;
  status: number;
  allowed: Who[];
}[] = [
  { method: "get", path: "/event-presets", status: 200, allowed: creators },
  {
    method: "get",
    path: `/event-presets/${ID}/resolved`,
    status: 200,
    allowed: creators,
  },
  {
    method: "get",
    path: "/admin/event-presets",
    status: 200,
    allowed: ["admin"],
  },
  {
    method: "get",
    path: `/admin/event-presets/${ID}`,
    status: 200,
    allowed: ["admin"],
  },
  {
    method: "post",
    path: "/admin/event-presets",
    body: preset,
    status: 201,
    allowed: ["admin"],
  },
  {
    method: "put",
    path: `/admin/event-presets/${ID}`,
    body: { ...preset, version: 1 },
    status: 200,
    allowed: ["admin"],
  },
  {
    method: "post",
    path: `/admin/event-presets/${ID}/duplicate`,
    status: 201,
    allowed: ["admin"],
  },
  {
    method: "post",
    path: `/admin/event-presets/${ID}/archive`,
    status: 200,
    allowed: ["admin"],
  },
  {
    method: "post",
    path: `/admin/event-presets/${ID}/unarchive`,
    status: 200,
    allowed: ["admin"],
  },
];

describe("event preset route authorization", () => {
  let app: INestApplication;
  const answer = jest.fn(async () => ({ ok: true }));
  const service = {
    listForOrganizers: answer,
    getResolved: answer,
    listForAdmin: answer,
    getDetail: answer,
    create: answer,
    update: answer,
    duplicate: answer,
    archive: answer,
    unarchive: answer,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        authzTestingModule(async (id) => principals[id as Who] ?? null),
      ],
      controllers: [AdminEventPresetsController, EventPresetsController],
      providers: [{ provide: EventPresetsService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(() => app.close());

  const cases = ROUTES.flatMap((route) =>
    (Object.keys(principals) as Who[]).map(
      (who) => [route.method.toUpperCase(), route.path, who, route] as const,
    ),
  );

  it.each(cases)("%s %s as %s", async (_, path, who, route) => {
    const server = request(app.getHttpServer());
    const req = server[route.method](path).set("x-test-user", who);
    await (route.body ? req.send(route.body) : req).expect(
      route.allowed.includes(who) ? route.status : 403,
    );
  });

  it.each(
    ROUTES.map(
      (route) => [route.method.toUpperCase(), route.path, route] as const,
    ),
  )("%s %s as a guest", async (_, path, route) => {
    await request(app.getHttpServer())[route.method](path).expect(401);
  });
});
