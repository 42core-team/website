import { BadGatewayException, ForbiddenException } from "@nestjs/common";
import { GithubAppAuth, GithubAppInstallation } from "./github-app-auth";

/** Shared by create, share, and the existing event connection flow. */
export class GithubInstallationOwner {
  constructor(
    private readonly auth: GithubAppAuth,
    private readonly fetch: typeof globalThis.fetch = (input, init) =>
      globalThis.fetch(input, init),
  ) {}

  /**
   * Organization installs need an active org owner; anyone else could connect
   * an installation they saw elsewhere to their own event.
   */
  async assertCanManageAccount(
    installation: GithubAppInstallation,
    githubId: string,
  ) {
    if (await this.canManageAccount(installation, githubId)) return;
    const account = installation.account!;
    throw new ForbiddenException(
      account.type === "Organization"
        ? `Only an owner of ${account.login} can connect it to an event.`
        : `Only ${account.login} can connect this installation.`,
    );
  }

  private async canManageAccount(
    installation: GithubAppInstallation,
    githubId: string,
  ) {
    const account = installation.account!;
    if (account.type !== "Organization") return String(account.id) === githubId;
    const login = await this.githubLogin(installation.id, githubId);
    return login ? this.isActiveOwner(installation, login) : false;
  }

  /** The user's current login; the stored username may be outdated, the GitHub ID is stable. */
  async githubLogin(installationId: number, githubId: string) {
    const token = await this.auth.getInstallationToken(installationId);
    const githubUser = await this.request<{ login: string }>(
      token,
      `/user/${encodeURIComponent(githubId)}`,
    );
    return githubUser?.login ?? null;
  }

  async isActiveOwner(installation: GithubAppInstallation, login: string) {
    const token = await this.auth.getInstallationToken(installation.id);
    const membership = await this.request<{
      role: string;
      state: string;
    }>(
      token,
      `/orgs/${encodeURIComponent(installation.account!.login)}/memberships/${encodeURIComponent(login)}`,
    );
    return membership?.role === "admin" && membership.state === "active";
  }

  /** A GET with an installation token; null when GitHub answers 404. */
  async request<T>(token: string, path: string) {
    let response: Response;
    try {
      response = await this.fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "CORE-GitHub-App",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException(
        "Could not check the installation on GitHub. Try again.",
      );
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new BadGatewayException(
        "Could not check the installation on GitHub. Try again.",
      );
    }
    return (await response.json()) as T;
  }
}
