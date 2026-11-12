import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, IsNull, Not } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { EventService } from "../event/event.service";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import {
  GithubAppAuth,
  GithubAppInstallation,
  GithubAppRequestError,
} from "../github-api/github-app-auth";
import { TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { GithubInstallStateSigner } from "./github-app-state";

const GITHUB_API_URL = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 10 * 1000;

/** What repository provisioning and match cloning need from an installation. */
const REQUIRED_PERMISSIONS: Record<string, readonly string[]> = {
  administration: ["write"],
  contents: ["write"],
  members: ["read", "write"],
};

export type GithubConnectionStatus = "active" | "suspended" | "uninstalled";

export interface EventGithubStatus {
  /** Whether this server can connect events to the App. */
  appAvailable: boolean;
  githubOrg: string;
  usesOrganizerToken: boolean;
  installation: {
    accountLogin: string;
    status: GithubConnectionStatus;
  } | null;
}

interface InstallationWebhook {
  action?: string;
  installation?: { id?: number; suspended_at?: string | null };
  account?: { login?: string };
}

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);
  private readonly stateSigner: GithubInstallStateSigner;
  /** Overridable in tests. */
  fetch: typeof fetch = (input, init) => fetch(input, init);

  constructor(
    private readonly githubAppAuth: GithubAppAuth,
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.stateSigner = new GithubInstallStateSigner(
      configService.getOrThrow<string>("JWT_SECRET"),
    );
  }

  private get appSlug() {
    return this.configService.get<string>("GITHUB_APP_SLUG") || null;
  }

  isAvailable() {
    return this.githubAppAuth.isEnabled() && this.appSlug !== null;
  }

  async getStatus(eventId: string): Promise<EventGithubStatus> {
    const event = await this.dataSource
      .getRepository(EventEntity)
      .findOneOrFail({
        where: { id: eventId },
        relations: { githubInstallation: true },
      });
    const installation = event.githubInstallation;
    return {
      appAvailable: this.isAvailable(),
      githubOrg: event.githubOrg,
      usesOrganizerToken: !installation && !!event.githubOrgSecret,
      installation: installation && {
        accountLogin: installation.accountLogin,
        status: installation.deletedAt
          ? "uninstalled"
          : installation.suspendedAt
            ? "suspended"
            : "active",
      },
    };
  }

  /** Where to send an event admin to install the App on their organization. */
  async createInstallUrl(eventId: string, userId: string) {
    await this.assertEventAdmin(eventId, userId);
    if (!this.isAvailable())
      throw new ServiceUnavailableException(
        "The CORE GitHub App is not configured on this server.",
      );
    const url = new URL(
      `https://github.com/apps/${encodeURIComponent(this.appSlug!)}/installations/new`,
    );
    url.searchParams.set("state", this.stateSigner.sign({ eventId, userId }));
    return { url: url.toString() };
  }

  /**
   * Finishes the installation GitHub redirected back from. The installation ID
   * comes from the browser, so it is only trusted after GitHub confirms it
   * belongs to this App and the user administers the account it is on.
   */
  async completeInstallation(
    userId: string,
    installationId: number,
    stateValue: string,
  ) {
    const state = this.stateSigner.verify(stateValue);
    if (!state || state.userId !== userId)
      throw new BadRequestException(
        "This GitHub connection link is invalid or has expired. Start again from the event dashboard.",
      );
    await this.assertEventAdmin(state.eventId, userId);
    if (!this.githubAppAuth.isEnabled())
      throw new ServiceUnavailableException(
        "The CORE GitHub App is not configured on this server.",
      );

    const installation = await this.fetchInstallation(installationId);
    const account = installation.account;
    if (!account)
      throw new BadRequestException("The installation has no GitHub account.");
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: userId });
    await this.assertCanManageAccount(installation, user.githubId);
    const missing = missingPermissions(installation.permissions);
    if (missing.length)
      throw new BadRequestException(
        `The installation on ${account.login} lacks these permissions: ${missing.join(", ")}. An owner must accept the App's requested permissions on GitHub.`,
      );

    await this.dataSource.transaction(async (manager) => {
      const event = await manager.getRepository(EventEntity).findOneOrFail({
        where: { id: state.eventId },
        lock: { mode: "pessimistic_write" },
      });
      if (
        event.githubOrg &&
        event.githubOrg.toLowerCase() !== account.login.toLowerCase() &&
        (await manager.getRepository(TeamEntity).existsBy({
          event: { id: event.id },
          repo: Not(IsNull()),
        }))
      )
        throw new BadRequestException(
          `Teams of this event already have repositories in ${event.githubOrg}. Install the App on that organization instead of ${account.login}.`,
        );

      const installations = manager.getRepository(GithubInstallationEntity);
      const fields = {
        accountId: account.id,
        accountLogin: account.login,
        accountType: account.type,
        suspendedAt: installation.suspended_at
          ? new Date(installation.suspended_at)
          : null,
        deletedAt: null,
      };
      let row = await installations.findOneBy({ installationId });
      if (row) await installations.update(row.id, fields);
      else row = await installations.save({ installationId, ...fields });
      await manager.getRepository(EventEntity).update(event.id, {
        githubInstallationId: row.id,
        githubOrg: account.login,
      });
    });
    this.logger.log({
      action: "github_app_connected",
      eventId: state.eventId,
      userId,
      installationId,
      account: account.login,
    });
    return { eventId: state.eventId };
  }

  /** Keeps installation rows in sync with changes made on GitHub. */
  async handleWebhook(eventName: string, payload: InstallationWebhook) {
    const installationId = payload.installation?.id;
    if (typeof installationId !== "number") return;
    const installations = this.dataSource.getRepository(
      GithubInstallationEntity,
    );
    const row = await installations.findOneBy({ installationId });
    if (!row) return;

    if (eventName === "installation") {
      switch (payload.action) {
        case "deleted":
          await installations.update(row.id, { deletedAt: new Date() });
          break;
        case "suspend":
          await installations.update(row.id, {
            suspendedAt: payload.installation?.suspended_at
              ? new Date(payload.installation.suspended_at)
              : new Date(),
          });
          break;
        case "unsuspend":
          await installations.update(row.id, { suspendedAt: null });
          break;
        default:
          return;
      }
    } else if (
      eventName === "installation_target" &&
      payload.action === "renamed" &&
      payload.account?.login
    ) {
      // Repository URLs are built from the event's organization name.
      const login = payload.account.login;
      await this.dataSource.transaction(async (manager) => {
        await manager
          .getRepository(GithubInstallationEntity)
          .update(row.id, { accountLogin: login });
        await manager
          .getRepository(EventEntity)
          .update({ githubInstallationId: row.id }, { githubOrg: login });
      });
    } else return;
    this.logger.log({
      action: "github_app_webhook",
      event: eventName,
      webhookAction: payload.action,
      installationId,
    });
  }

  private async assertEventAdmin(eventId: string, userId: string) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new ForbiddenException("You are not an admin of this event");
  }

  private async fetchInstallation(installationId: number) {
    try {
      return await this.githubAppAuth.getInstallation(installationId);
    } catch (error) {
      if (error instanceof GithubAppRequestError && error.status === 404)
        throw new BadRequestException(
          "GitHub does not know this installation of the CORE GitHub App.",
        );
      throw error;
    }
  }

  /**
   * Organization installs need an active org owner; anyone else could connect
   * an installation they saw elsewhere to their own event.
   */
  private async assertCanManageAccount(
    installation: GithubAppInstallation,
    githubId: string,
  ) {
    const account = installation.account!;
    if (account.type !== "Organization") {
      if (String(account.id) !== githubId)
        throw new ForbiddenException(
          `Only ${account.login} can connect this installation.`,
        );
      return;
    }
    const token = await this.githubAppAuth.getInstallationToken(
      installation.id,
    );
    // The stored username may be outdated; the GitHub ID is stable.
    const githubUser = await this.githubRequest<{ login: string }>(
      token,
      `/user/${encodeURIComponent(githubId)}`,
    );
    const membership = githubUser
      ? await this.githubRequest<{ role: string; state: string }>(
          token,
          `/orgs/${encodeURIComponent(account.login)}/memberships/${encodeURIComponent(githubUser.login)}`,
        )
      : null;
    if (membership?.role !== "admin" || membership.state !== "active")
      throw new ForbiddenException(
        `Only an owner of ${account.login} can connect it to an event.`,
      );
  }

  /** A GET with an installation token; null when GitHub answers 404. */
  private async githubRequest<T>(token: string, path: string) {
    const response = await this.fetch(`${GITHUB_API_URL}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "CORE-GitHub-App",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`GitHub request ${path} failed with ${response.status}`);
    return (await response.json()) as T;
  }
}

export function missingPermissions(granted: Record<string, string>) {
  return Object.entries(REQUIRED_PERMISSIONS)
    .filter(([name, levels]) => !levels.includes(granted[name]))
    .map(([name]) => name);
}
