/// <reference types="jest" />

import { githubAuthOf } from "./github-auth";

describe("githubAuthOf", () => {
  it("prefers githubAuth", () => {
    expect(
      githubAuthOf({
        githubAuth: { kind: "installation", installationId: 7 },
        encryptedSecret: "legacy",
      }),
    ).toEqual({ kind: "installation", installationId: 7 });
  });

  it("reads messages queued before githubAuth existed", () => {
    expect(githubAuthOf({ encryptedSecret: "legacy" })).toEqual({
      kind: "token",
      encryptedSecret: "legacy",
    });
  });

  it("rejects messages without credentials", () => {
    expect(() => githubAuthOf({})).toThrow("no GitHub credentials");
  });
});
