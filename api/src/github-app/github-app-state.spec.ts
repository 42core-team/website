/// <reference types="jest" />

import { createHmac } from "node:crypto";
import {
  GithubInstallStateSigner,
  isValidWebhookSignature,
} from "./github-app-state";

describe("GithubInstallStateSigner", () => {
  const state = { eventId: "event", userId: "user" };

  it("round-trips a signed state", () => {
    const signer = new GithubInstallStateSigner("secret");
    expect(signer.verify(signer.sign(state))).toEqual(state);
  });

  it("rejects a state signed with another secret", () => {
    const value = new GithubInstallStateSigner("other").sign(state);
    expect(new GithubInstallStateSigner("secret").verify(value)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const signer = new GithubInstallStateSigner("secret");
    const [, mac] = signer.sign(state).split(".");
    const forged = Buffer.from(
      JSON.stringify({ e: "other", u: "user", x: Date.now() + 1000 }),
    ).toString("base64url");
    expect(signer.verify(`${forged}.${mac}`)).toBeNull();
  });

  it("rejects an expired state", () => {
    let now = 0;
    const signer = new GithubInstallStateSigner("secret", () => now);
    const value = signer.sign(state);
    now = 31 * 60 * 1000;
    expect(signer.verify(value)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", "a."])("rejects malformed %p", (value) => {
    expect(new GithubInstallStateSigner("secret").verify(value)).toBeNull();
  });
});

describe("isValidWebhookSignature", () => {
  const body = Buffer.from('{"action":"deleted"}');
  const signature = `sha256=${createHmac("sha256", "hook").update(body).digest("hex")}`;

  it("accepts GitHub's signature", () => {
    expect(isValidWebhookSignature("hook", body, signature)).toBe(true);
  });

  it.each([undefined, "", "sha1=abc", signature.slice(0, -1) + "0"])(
    "rejects %p",
    (header) => {
      expect(isValidWebhookSignature("hook", body, header)).toBe(false);
    },
  );

  it("rejects a modified body", () => {
    expect(isValidWebhookSignature("hook", Buffer.from("{}"), signature)).toBe(
      false,
    );
  });
});
