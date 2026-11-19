import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { UserImageController } from "./user-image.controller";
import { UserImageService } from "./user-image.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

describe("user image multipart endpoint", () => {
  let app: INestApplication;
  const upload = jest
    .fn()
    .mockResolvedValue({ small: "small.webp", large: "large.webp" });
  const remove = jest.fn().mockResolvedValue(undefined);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserImageController],
      providers: [{ provide: UserImageService, useValue: { upload, remove } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { id: "me" };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  it("uploads for the authenticated user with both crop coordinates", async () => {
    await request(app.getHttpServer())
      .put("/user/me/images/picture")
      .field("x", "25")
      .field("y", "75")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(200);
    expect(upload).toHaveBeenCalledWith(
      "me",
      "picture",
      Buffer.from("image"),
      25,
      75,
      1,
    );
  });
  it("accepts a smaller crop and rejects invalid sizes and positions", async () => {
    await request(app.getHttpServer())
      .put("/user/me/images/background")
      .field("scale", "0.4")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(200);
    expect(upload).toHaveBeenLastCalledWith(
      "me",
      "background",
      Buffer.from("image"),
      50,
      50,
      0.4,
    );
    for (const scale of ["0", "1.1", "NaN"]) {
      await request(app.getHttpServer())
        .put("/user/me/images/picture")
        .field("scale", scale)
        .attach("file", Buffer.from("image"), "image.png")
        .expect(400);
    }
    await request(app.getHttpServer())
      .put("/user/me/images/picture")
      .field("x", "101")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(400);
  });
  it("rejects unknown kinds and missing files", async () => {
    await request(app.getHttpServer())
      .put("/user/me/images/banner")
      .attach("file", Buffer.from("image"), "image.png")
      .expect(400);
    await request(app.getHttpServer())
      .put("/user/me/images/picture")
      .field("x", "1")
      .expect(400);
  });
  it("removes an image of the authenticated user", async () => {
    await request(app.getHttpServer())
      .delete("/user/me/images/background")
      .expect(200);
    expect(remove).toHaveBeenCalledWith("me", "background");
  });
});
