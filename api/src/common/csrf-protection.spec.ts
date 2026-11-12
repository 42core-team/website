import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { createCsrfProtection } from "./csrf-protection";

describe("createCsrfProtection", () => {
  const trustedOrigin = "https://coregame.sh";

  function createTestApp(onMutation: () => void) {
    const app = express();
    app.use(cookieParser());
    app.use(createCsrfProtection(trustedOrigin, ["token", "refresh_token"]));
    app.post("/event/:eventId/admins/:newAdminId", (_req, res) => {
      onMutation();
      res.sendStatus(201);
    });
    app.post("/auth/refresh", (_req, res) => {
      onMutation();
      res.sendStatus(204);
    });
    return app;
  }

  it("rejects a cross-origin form POST before adding an event admin", async () => {
    const onMutation = jest.fn();

    await request(createTestApp(onMutation))
      .post("/event/event-id/admins/attacker-id")
      .set("Cookie", "token=admin-session")
      .set("Origin", "https://attacker.example")
      .type("form")
      .send({})
      .expect(403);

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("allows an authenticated mutation from the configured frontend", async () => {
    const onMutation = jest.fn();

    await request(createTestApp(onMutation))
      .post("/event/event-id/admins/new-admin-id")
      .set("Cookie", "token=admin-session")
      .set("Origin", trustedOrigin)
      .set("Sec-Fetch-Site", "same-site")
      .expect(201);

    expect(onMutation).toHaveBeenCalledTimes(1);
  });

  it("rejects cookie-authenticated mutations without trusted browser metadata", async () => {
    const onMutation = jest.fn();

    await request(createTestApp(onMutation))
      .post("/event/event-id/admins/attacker-id")
      .set("Cookie", "token=admin-session")
      .set("Sec-Fetch-Site", "cross-site")
      .expect(403);

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("does not let same-site metadata override an untrusted Origin", async () => {
    const onMutation = jest.fn();

    await request(createTestApp(onMutation))
      .post("/event/event-id/admins/attacker-id")
      .set("Cookie", "token=admin-session")
      .set("Origin", "https://attacker.coregame.sh")
      .set("Sec-Fetch-Site", "same-site")
      .expect(403);

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("rejects a cross-site refresh that carries only the refresh cookie", async () => {
    const onMutation = jest.fn();

    await request(createTestApp(onMutation))
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=session")
      .set("Origin", "https://attacker.example")
      .expect(403);

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("allows a same-site refresh after the access cookie has expired", async () => {
    const onMutation = jest.fn();

    await request(createTestApp(onMutation))
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=session")
      .set("Origin", trustedOrigin)
      .expect(204);

    expect(onMutation).toHaveBeenCalledTimes(1);
  });
});
