import { ServiceUnavailableException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController readiness", () => {
  const createController = (query: jest.Mock) =>
    new AppController(new AppService(), { query } as unknown as DataSource);

  it("returns ok when the database responds", async () => {
    const query = jest.fn().mockResolvedValue([{ "?column?": 1 }]);

    await expect(createController(query).getReadiness()).resolves.toEqual({
      status: "ok",
    });
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 when the database query fails", async () => {
    const query = jest.fn().mockRejectedValue(new Error("connection refused"));

    await expect(createController(query).getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
