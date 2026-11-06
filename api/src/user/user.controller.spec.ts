jest.mock("./user.service", () => ({ UserService: class UserService {} }));
import { Test } from "@nestjs/testing";
import { ClassSerializerInterceptor, INestApplication } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import request from "supertest";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { toPublicUser } from "./dtos/public-user.dto";

const fullUser = {
  id: "user-1",
  githubId: "12345",
  githubAccessToken: "secret-token",
  email: "someone@example.com",
  username: "someone",
  name: "Some One",
  profilePicture: "https://example.com/avatar.png",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  canCreateEvent: true,
  socialAccounts: [{ platform: "42", username: "someone42" }],
};

describe("UserController", () => {
  let app: INestApplication;
  const searchUsers = jest.fn();
  const getUserByGithubId = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: { searchUsers, getUserByGithubId } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { id: "caller" };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Same serializer setup as main.ts.
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it("has no github or email lookup routes", async () => {
    const paths = Object.getOwnPropertyNames(UserController.prototype)
      .filter((name) => name !== "constructor")
      .map((name) =>
        Reflect.getMetadata(PATH_METADATA, UserController.prototype[name]),
      )
      .filter((path) => path !== undefined);
    expect(paths.sort()).toEqual(["canCreateEvent", "search"]);

    await request(app.getHttpServer()).get("/user/github/12345").expect(404);
    await request(app.getHttpServer())
      .get("/user/email/someone@example.com")
      .expect(404);
    expect(getUserByGithubId).not.toHaveBeenCalled();
  });

  it("returns only public fields from user search", async () => {
    searchUsers.mockResolvedValue([fullUser]);
    const res = await request(app.getHttpServer())
      .get("/user/search?q=some")
      .expect(200);

    expect(searchUsers).toHaveBeenCalledWith("some");
    expect(res.body).toEqual([
      {
        id: "user-1",
        username: "someone",
        name: "Some One",
        profilePicture: "https://example.com/avatar.png",
      },
    ]);
    expect(res.body[0]).not.toHaveProperty("email");
    expect(res.body[0]).not.toHaveProperty("githubId");
  });
});

describe("toPublicUser", () => {
  it("keeps only the allowed fields", () => {
    const result = toPublicUser({ ...fullUser, unknownField: "x" });
    expect(Object.keys(result).sort()).toEqual([
      "id",
      "name",
      "profilePicture",
      "username",
    ]);
  });
});
