/// <reference types="jest" />

import { GithubAuthService, GithubNotConnectedError } from "./github-auth";
import { encryptSecret } from "../common/encryption";

const ENCRYPTION_KEY = "test-encryption-key";

function setup(
  installation: Record<string, unknown> | null = {
    id: "row",
    installationId: 42,
    suspendedAt: null,
    deletedAt: null,
  },
  enabled = true,
) {
  const repository = { findOneBy: jest.fn().mockResolvedValue(installation) };
  const appAuth = {
    isEnabled: jest.fn().mockReturnValue(enabled),
    createScopedToken: jest
      .fn()
      .mockResolvedValue({ token: "scoped", expiresAt: new Date() }),
  };
  const service = new GithubAuthService(
    repository as never,
    appAuth as never,
    { getOrThrow: () => ENCRYPTION_KEY } as never,
  );
  return { service, repository, appAuth };
}

describe("GithubAuthService", () => {
  it("prefers the App installation over a stored token", async () => {
    const { service, repository } = setup();
    await expect(
      service.authFor({ githubInstallationId: "row", githubOrgSecret: "x" }),
    ).resolves.toEqual({ kind: "installation", installationId: 42 });
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: "row" });
  });

  it("falls back to the organizer token", async () => {
    const { service } = setup();
    await expect(
      service.authFor({ githubInstallationId: null, githubOrgSecret: "enc" }),
    ).resolves.toEqual({ kind: "token", encryptedSecret: "enc" });
  });

  it.each([
    ["no credentials", null, null],
    ["an uninstalled App", "row", { deletedAt: new Date() }],
    ["a suspended App", "row", { suspendedAt: new Date() }],
    ["a missing installation row", "row", null],
  ])("rejects %s", async (_name, githubInstallationId, installation) => {
    const { service } = setup(
      installation && {
        id: "row",
        installationId: 42,
        suspendedAt: null,
        deletedAt: null,
        ...installation,
      },
    );
    await expect(
      service.authFor({ githubInstallationId, githubOrgSecret: null }),
    ).rejects.toBeInstanceOf(GithubNotConnectedError);
  });

  it("rejects App events while the App is not configured", async () => {
    const { service } = setup(undefined, false);
    await expect(
      service.authFor({ githubInstallationId: "row", githubOrgSecret: null }),
    ).rejects.toThrow("not configured");
  });

  it("mints a read-only clone token for one repository", async () => {
    const { service, appAuth } = setup();
    await expect(
      service.cloneTokenFor(
        { githubInstallationId: "row", githubOrgSecret: null },
        "team-repo",
      ),
    ).resolves.toBe("scoped");
    expect(appAuth.createScopedToken).toHaveBeenCalledWith(42, {
      repositories: ["team-repo"],
      permissions: { contents: "read" },
    });
  });

  it("decrypts the organizer token for legacy clones", async () => {
    const { service, appAuth } = setup();
    await expect(
      service.cloneTokenFor(
        {
          githubInstallationId: null,
          githubOrgSecret: encryptSecret("ghp_pat", ENCRYPTION_KEY),
        },
        "team-repo",
      ),
    ).resolves.toBe("ghp_pat");
    expect(appAuth.createScopedToken).not.toHaveBeenCalled();
  });
});
