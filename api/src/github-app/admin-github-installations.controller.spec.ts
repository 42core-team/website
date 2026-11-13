jest.mock("./github-app.service", () => ({
  GithubAppService: class GithubAppService {},
}));

import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { UserRole } from "../authz";
import { authzTestingModule, principalWith } from "../authz/testing";
import { AdminGithubInstallationsController } from "./admin-github-installations.controller";
import { GithubAppService } from "./github-app.service";

const ID = randomUUID();
const principals = {
  admin: principalWith("admin", UserRole.ADMIN),
  moderator: principalWith("moderator", UserRole.MODERATOR),
  creator: principalWith("creator", UserRole.PUBLIC_EVENT_CREATOR),
  eventAdmin: principalWith("eventAdmin", UserRole.ADMIN, randomUUID()),
  member: principalWith("member"),
};

describe("AdminGithubInstallationsController authorization", () => {
  let app: INestApplication;
  const service = {
    listForAdmin: jest.fn(async () => []),
    share: jest.fn(async (id: string) => ({ id })),
    unshare: jest.fn(async () => undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        authzTestingModule(
          async (id) => principals[id as keyof typeof principals] ?? null,
        ),
      ],
      controllers: [AdminGithubInstallationsController],
      providers: [{ provide: GithubAppService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(() => app.close());

  const routes = [
    ["get", "/admin/github-installations", 200],
    ["post", `/admin/github-installations/${ID}/share`, 200],
    ["delete", `/admin/github-installations/${ID}/share`, 204],
  ] as const;

  describe.each(routes)("%s %s", (method, path, status) => {
    const send = () => request(app.getHttpServer())[method](path);

    it("lets a global admin in", async () => {
      await send().set("x-test-user", "admin").expect(status);
    });

    it.each(["moderator", "creator", "eventAdmin", "member"])(
      "denies %s",
      async (user) => {
        await send().set("x-test-user", user).expect(403);
      },
    );

    it("denies guests", async () => {
      await send().expect(401);
    });
  });

  it("shares as the calling admin", async () => {
    await request(app.getHttpServer())
      .post(`/admin/github-installations/${ID}/share`)
      .set("x-test-user", "admin")
      .expect(200, { id: ID });
    expect(service.share).toHaveBeenLastCalledWith(ID, principals.admin);
  });

  it("rejects ids that are not UUIDs", async () => {
    await request(app.getHttpServer())
      .post("/admin/github-installations/77/share")
      .set("x-test-user", "admin")
      .expect(400);
  });
});
