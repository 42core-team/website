/// <reference types="jest" />

jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));

import { EventEntity } from "../event/entities/event.entity";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import { GithubAppRequestError } from "../github-api/github-app-auth";
import { TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { GithubInstallStateSigner } from "./github-app-state";
import { GithubAppService, missingPermissions } from "./github-app.service";

const JWT_SECRET = "jwt-secret";
const PERMISSIONS = {
  administration: "write",
  contents: "write",
  members: "read",
  metadata: "read",
};

function setup(
  options: {
    admin?: boolean;
    accountType?: string;
    permissions?: Record<string, string>;
    membership?: { role: string; state: string } | null;
    event?: Partial<EventEntity>;
    teamsHaveRepos?: boolean;
    existingInstallation?: Partial<GithubInstallationEntity> | null;
    installationError?: Error;
  } = {},
) {
  const event = {
    id: "event",
    githubOrg: "",
    githubOrgSecret: null,
    ...options.event,
  };
  const repositories = new Map<unknown, Record<string, jest.Mock>>([
    [
      EventEntity,
      {
        findOneOrFail: jest.fn().mockResolvedValue(event),
        update: jest.fn(),
      },
    ],
    [
      TeamEntity,
      {
        existsBy: jest.fn().mockResolvedValue(options.teamsHaveRepos ?? false),
      },
    ],
    [
      UserEntity,
      { findOneByOrFail: jest.fn().mockResolvedValue({ githubId: "1001" }) },
    ],
    [
      GithubInstallationEntity,
      {
        findOneBy: jest
          .fn()
          .mockResolvedValue(options.existingInstallation ?? null),
        save: jest.fn(async (row) => ({ id: "row", ...row })),
        update: jest.fn(),
      },
    ],
  ]);
  const manager = {
    getRepository: (entity: unknown) => repositories.get(entity),
  };
  const dataSource = {
    ...manager,
    transaction: (action: (value: typeof manager) => unknown) =>
      action(manager),
  };
  const appAuth = {
    isEnabled: jest.fn().mockReturnValue(true),
    getInstallation: options.installationError
      ? jest.fn().mockRejectedValue(options.installationError)
      : jest.fn().mockResolvedValue({
          id: 77,
          account: {
            id: options.accountType === "User" ? 1001 : 5,
            login: "Core-Org",
            type: options.accountType ?? "Organization",
          },
          repository_selection: "all",
          permissions: options.permissions ?? PERMISSIONS,
          suspended_at: null,
        }),
    getInstallationToken: jest.fn().mockResolvedValue("installation-token"),
  };
  const eventService = {
    isEventAdmin: jest.fn().mockResolvedValue(options.admin ?? true),
  };
  const config = {
    getOrThrow: () => JWT_SECRET,
    get: (key: string) =>
      ({ GITHUB_APP_SLUG: "core-app" })[key as "GITHUB_APP_SLUG"],
  };
  const service = new GithubAppService(
    appAuth as never,
    eventService as never,
    config as never,
    dataSource as never,
  );
  const membership =
    options.membership === undefined
      ? { role: "admin", state: "active" }
      : options.membership;
  service.fetch = jest.fn(async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname;
    if (path === "/user/1001")
      return new Response(JSON.stringify({ login: "organizer" }));
    if (path === "/orgs/Core-Org/memberships/organizer")
      return membership
        ? new Response(JSON.stringify(membership))
        : new Response("{}", { status: 404 });
    throw new Error(`unexpected ${path}`);
  }) as never;
  const state = new GithubInstallStateSigner(JWT_SECRET).sign({
    eventId: "event",
    userId: "user",
  });
  return { service, repositories, appAuth, eventService, state };
}

describe("GithubAppService", () => {
  describe("createInstallUrl", () => {
    it("links to the App's install page with a signed state", async () => {
      const { service } = setup();
      const { url } = await service.createInstallUrl("event", "user");
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        "https://github.com/apps/core-app/installations/new",
      );
      expect(
        new GithubInstallStateSigner(JWT_SECRET).verify(
          parsed.searchParams.get("state")!,
        ),
      ).toEqual({ eventId: "event", userId: "user" });
    });

    it("refuses non-admins", async () => {
      const { service } = setup({ admin: false });
      await expect(service.createInstallUrl("event", "user")).rejects.toThrow(
        "not an admin",
      );
    });
  });

  describe("completeInstallation", () => {
    it("connects an org installation for an org owner", async () => {
      const { service, repositories, state } = setup();
      await expect(
        service.completeInstallation("user", 77, state),
      ).resolves.toEqual({ eventId: "event" });
      expect(
        repositories.get(GithubInstallationEntity)!.save,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: 77,
          accountId: 5,
          accountLogin: "Core-Org",
          deletedAt: null,
        }),
      );
      expect(repositories.get(EventEntity)!.update).toHaveBeenCalledWith(
        "event",
        { githubInstallationId: "row", githubOrg: "Core-Org" },
      );
    });

    it("reuses the row of a known installation", async () => {
      const { service, repositories, state } = setup({
        existingInstallation: { id: "existing", installationId: 77 },
      });
      await service.completeInstallation("user", 77, state);
      const installations = repositories.get(GithubInstallationEntity)!;
      expect(installations.save).not.toHaveBeenCalled();
      expect(installations.update).toHaveBeenCalledWith(
        "existing",
        expect.objectContaining({ accountLogin: "Core-Org" }),
      );
    });

    it("rejects a state issued to another user", async () => {
      const { service, state } = setup();
      await expect(
        service.completeInstallation("someone-else", 77, state),
      ).rejects.toThrow("invalid or has expired");
    });

    it("rejects users who no longer administer the event", async () => {
      const { service, state } = setup({ admin: false });
      await expect(
        service.completeInstallation("user", 77, state),
      ).rejects.toThrow("not an admin");
    });

    it.each([
      ["a member", { role: "member", state: "active" }],
      ["a pending owner", { role: "admin", state: "pending" }],
      ["an outsider", null],
    ])("rejects %s of the organization", async (_name, membership) => {
      const { service, repositories, state } = setup({ membership });
      await expect(
        service.completeInstallation("user", 77, state),
      ).rejects.toThrow("Only an owner of Core-Org");
      expect(repositories.get(EventEntity)!.update).not.toHaveBeenCalled();
    });

    it("connects a personal installation only for its owner", async () => {
      const { service, state } = setup({ accountType: "User" });
      await expect(
        service.completeInstallation("user", 77, state),
      ).resolves.toEqual({ eventId: "event" });
    });

    it("rejects installations GitHub does not know", async () => {
      const { service, state } = setup({
        installationError: new GithubAppRequestError(404, "Not Found"),
      });
      await expect(
        service.completeInstallation("user", 77, state),
      ).rejects.toThrow("does not know this installation");
    });

    it("rejects installations missing required permissions", async () => {
      const { service, state } = setup({
        permissions: { contents: "write", metadata: "read" },
      });
      await expect(
        service.completeInstallation("user", 77, state),
      ).rejects.toThrow("administration, members");
    });

    it("keeps teams' repositories in their organization", async () => {
      const { service, repositories, state } = setup({
        event: { githubOrg: "old-org", githubOrgSecret: "enc" },
        teamsHaveRepos: true,
      });
      await expect(
        service.completeInstallation("user", 77, state),
      ).rejects.toThrow("already have repositories in old-org");
      expect(repositories.get(EventEntity)!.update).not.toHaveBeenCalled();
    });

    it("switches a token event on the same organization to the App", async () => {
      const { service, repositories, state } = setup({
        event: { githubOrg: "core-org", githubOrgSecret: "enc" },
        teamsHaveRepos: true,
      });
      await service.completeInstallation("user", 77, state);
      expect(repositories.get(EventEntity)!.update).toHaveBeenCalled();
    });
  });

  describe("handleWebhook", () => {
    const row = { id: "row", installationId: 77 };

    it.each([
      ["deleted", { deletedAt: expect.any(Date) }],
      ["suspend", { suspendedAt: new Date("2026-01-01T00:00:00Z") }],
      ["unsuspend", { suspendedAt: null }],
    ])("records %s", async (action, update) => {
      const { service, repositories } = setup({ existingInstallation: row });
      await service.handleWebhook("installation", {
        action,
        installation: { id: 77, suspended_at: "2026-01-01T00:00:00Z" },
      });
      expect(
        repositories.get(GithubInstallationEntity)!.update,
      ).toHaveBeenCalledWith("row", update);
    });

    it("follows an organization rename", async () => {
      const { service, repositories } = setup({ existingInstallation: row });
      await service.handleWebhook("installation_target", {
        action: "renamed",
        installation: { id: 77 },
        account: { login: "new-name" },
      });
      expect(
        repositories.get(GithubInstallationEntity)!.update,
      ).toHaveBeenCalledWith("row", { accountLogin: "new-name" });
      expect(repositories.get(EventEntity)!.update).toHaveBeenCalledWith(
        { githubInstallationId: "row" },
        { githubOrg: "new-name" },
      );
    });

    it("ignores installations no event uses", async () => {
      const { service, repositories } = setup();
      await service.handleWebhook("installation", {
        action: "deleted",
        installation: { id: 77 },
      });
      expect(
        repositories.get(GithubInstallationEntity)!.update,
      ).not.toHaveBeenCalled();
    });
  });

  it("reports missing permissions", () => {
    expect(missingPermissions(PERMISSIONS)).toEqual([]);
    expect(missingPermissions({ ...PERMISSIONS, contents: "read" })).toEqual([
      "contents",
    ]);
  });
});
