jest.mock("./team.service", () => ({ TeamService: class TeamService {} }));
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { TeamImageController } from "./team-image.controller";
import { TeamImageService } from "./team-image.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MyTeamGuards } from "../guards/TeamGuard";

describe("team image multipart endpoint", () => {
  let app: INestApplication;
  const upload = jest
    .fn()
    .mockResolvedValue({ small: "small.webp", large: "large.webp" });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamImageController],
      providers: [{ provide: TeamImageService, useValue: { upload } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MyTeamGuards)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().team = { id: "my-team" };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  it("accepts a file and both crop coordinates", async () => {
    await request(app.getHttpServer())
      .put("/team/event/event/my/images/picture")
      .field("x", "25")
      .field("y", "75")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(200);
    expect(upload).toHaveBeenCalledWith(
      "my-team",
      "picture",
      Buffer.from("image"),
      25,
      75,
      1,
    );
  });
  it("rejects an invalid crop", async () => {
    await request(app.getHttpServer())
      .put("/team/event/event/my/images/picture")
      .field("x", "101")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(400);
  });
  it("accepts a smaller crop and rejects invalid sizes", async () => {
    await request(app.getHttpServer())
      .put("/team/event/event/my/images/picture")
      .field("x", "50")
      .field("y", "50")
      .field("scale", "0.4")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(200);
    expect(upload).toHaveBeenLastCalledWith(
      "my-team",
      "picture",
      Buffer.from("image"),
      50,
      50,
      0.4,
    );
    for (const scale of ["0", "1.1", "NaN"]) {
      await request(app.getHttpServer())
        .put("/team/event/event/my/images/picture")
        .field("scale", scale)
        .attach("file", Buffer.from("image"), "image.png")
        .expect(400);
    }
  });
});
