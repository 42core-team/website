jest.mock("./github-app.service", () => ({ GithubAppService: class {} }));

import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { authzTestingModule, principalWith } from "../authz/testing";
import { GithubAppController } from "./github-app.controller";
import { GithubAppService } from "./github-app.service";

describe("GET /github/installations", () => {
  let app: INestApplication;
  const rows = [
    {
      id: "ce268915-39cc-43b1-8605-03b1ab65fd92",
      accountLogin: "core",
      accountType: "Organization",
      shared: true,
    },
  ];
  const listInstallations = jest.fn(async () => rows);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        authzTestingModule(async (id) =>
          id === "member" ? principalWith(id) : null,
        ),
      ],
      controllers: [GithubAppController],
      providers: [
        { provide: GithubAppService, useValue: { listInstallations } },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(() => app.close());
  it("rejects guests", async () => {
    await request(app.getHttpServer()).get("/github/installations").expect(401);
    expect(listInstallations).not.toHaveBeenCalled();
  });
  it("lets any signed-in member load the UUID create picker", async () => {
    await request(app.getHttpServer())
      .get("/github/installations")
      .set("x-test-user", "member")
      .expect(200, rows);
    expect(listInstallations).toHaveBeenCalledWith(
      expect.objectContaining({ id: "member" }),
    );
  });
});
