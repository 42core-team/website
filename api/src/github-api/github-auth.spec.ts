/// <reference types="jest" />

import { GithubAuthService, GithubNotConnectedError } from "./github-auth";

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
  const service = new GithubAuthService(repository as never, appAuth as never);
  return { service, repository, appAuth };
}

describe("GithubAuthService", () => {
  it("authenticates as the event's App installation", async () => {
    const { service, repository } = setup();
    await expect(
      service.authFor({ githubInstallationId: "row" }),
    ).resolves.toEqual({ installationId: 42 });
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: "row" });
  });

  it.each([
    ["an event without an installation", null, null],
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
      service.authFor({ githubInstallationId }),
    ).rejects.toBeInstanceOf(GithubNotConnectedError);
  });

  it("rejects events while the App is not configured", async () => {
    const { service } = setup(undefined, false);
    await expect(
      service.authFor({ githubInstallationId: "row" }),
    ).rejects.toThrow("not configured");
  });

  it("mints a read-only clone token for one repository", async () => {
    const { service, appAuth } = setup();
    await expect(
      service.cloneTokenFor({ githubInstallationId: "row" }, "team-repo"),
    ).resolves.toBe("scoped");
    expect(appAuth.createScopedToken).toHaveBeenCalledWith(42, {
      repositories: ["team-repo"],
      permissions: { contents: "read" },
    });
  });
});
