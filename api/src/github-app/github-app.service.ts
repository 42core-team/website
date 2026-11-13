import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { isPlaying } from "../event/event-lifecycle";
import { EventService } from "../event/event.service";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import {
  GithubAppAuth,
  GithubAppInstallation,
  GithubAppRequestError,
} from "../github-api/github-app-auth";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { GithubInstallStateSigner } from "./github-app-state";

const GITHUB_API_URL = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 10 * 1000;
const OWNED_INSTALLATIONS_CACHE_MS = 60 * 1000;
const OWNERSHIP_CHECK_CONCURRENCY = 4;

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

/** An existing installation the user may link to an event. */
export interface LinkableGithubInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
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
  private readonly ownedInstallationsCache = new Map<
    string,
    { expiresAt: number; installations: Promise<GithubAppInstallation[]> }
  >();
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
   * Installations of the App, e.g. made for another event, on organizations
   * the user owns, so the event can use one without installing the App again.
   */
  async listLinkableInstallations(
    eventId: string,
    userId: string,
  ): Promise<LinkableGithubInstallation[]> {
    await this.assertEventAdmin(eventId, userId);
    if (!this.githubAppAuth.isEnabled()) return [];
    const event = await this.dataSource
      .getRepository(EventEntity)
      .findOneOrFail({
        where: { id: eventId },
        relations: { githubInstallation: true },
      });
    const linked = event.githubInstallation?.deletedAt
      ? null
      : event.githubInstallation?.installationId;
    // Connecting refuses to move existing repositories to another organization.
    const requiredOrg =
      event.githubOrg && (await this.hasRepositories(event.id))
        ? event.githubOrg.toLowerCase()
        : null;
    const owned = await this.ownedInstallations(userId);
    return owned
      .filter(
        (installation) =>
          installation.id !== linked &&
          (!requiredOrg ||
            installation.account!.login.toLowerCase() === requiredOrg),
      )
      .map((installation) => ({
        installationId: installation.id,
        accountLogin: installation.account!.login,
        accountType: installation.account!.type,
      }));
  }

  /** Connects an installation that already exists, without the install redirect. */
  linkInstallation(eventId: string, userId: string, installationId: number) {
    return this.connectInstallation(eventId, userId, installationId);
  }

  /** Finishes the installation GitHub redirected back from. */
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
    return this.connectInstallation(state.eventId, userId, installationId);
  }

  /**
   * The installation ID comes from the browser, so it is only trusted after
   * GitHub confirms it belongs to this App and the user administers the
   * account it is on.
   */
  private async connectInstallation(
    eventId: string,
    userId: string,
    installationId: number,
  ) {
    await this.assertEventAdmin(eventId, userId);
    if (!this.githubAppAuth.isEnabled())
      throw new ServiceUnavailableException(
        "The CORE GitHub App is not configured on this server.",
      );

    const installation = await this.fetchInstallation(installationId);
    const account = installation.account;
    if (!account)
      throw new BadRequestException("The installation has no GitHub account.");
    // Checked first: the ownership check below needs Members access.
    const missing = missingPermissions(installation.permissions);
    if (missing.length)
      throw new BadRequestException(
        `The installation on ${account.login} lacks these permissions: ${missing.join(", ")}. An owner must accept the App's requested permissions on GitHub.`,
      );
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: userId });
    await this.assertCanManageAccount(installation, user.githubId);
    // Fetched before the transaction so no GitHub call runs under its locks.
    const accessibleRepositories =
      installation.repository_selection === "selected"
        ? await this.listInstallationRepositories(installation.id)
        : null;

    const { event, failedTeamIds } = await this.dataSource.transaction(
      async (manager) => {
        const event = await manager.getRepository(EventEntity).findOneOrFail({
          where: { id: eventId },
          lock: { mode: "pessimistic_write" },
        });
        // Provisioning locks the team row and then reads the event's
        // credentials, so locking every team serializes this with it.
        const teams = await manager
          .getRepository(TeamEntity)
          .createQueryBuilder("team")
          .select(["team.id", "team.repo", "team.repositoryStatus"])
          .where('team."eventId" = :eventId', { eventId: event.id })
          .setLock("pessimistic_write")
          .getMany();
        const repositories = teams.flatMap((team) =>
          team.repo ? [team.repo] : [],
        );
        if (
          event.githubOrg &&
          event.githubOrg.toLowerCase() !== account.login.toLowerCase() &&
          (repositories.length ||
            teams.some(
              (team) => team.repositoryStatus === RepositoryStatus.PROVISIONING,
            ))
        )
          throw new BadRequestException(
            `Teams of this event already have repositories in ${event.githubOrg}. Install the App on that organization instead of ${account.login}.`,
          );
        const unreachable = accessibleRepositories
          ? repositories.filter(
              (name) => !accessibleRepositories.has(name.toLowerCase()),
            )
          : [];
        if (unreachable.length)
          throw new BadRequestException(
            `The installation on ${account.login} cannot access ${unreachable.length} team ${unreachable.length === 1 ? "repository" : "repositories"} (e.g. ${unreachable[0]}). Grant it access to all repositories, or add them to the installation on GitHub.`,
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
          // The App always takes precedence, so a kept token would never be used.
          githubOrgSecret: null,
        });
        return {
          event,
          failedTeamIds: teams
            .filter(
              (team) =>
                team.repositoryStatus === RepositoryStatus.FAILED && !team.repo,
            )
            .map((team) => team.id),
        };
      },
    );
    this.logger.log({
      action: "github_app_connected",
      eventId,
      userId,
      installationId,
      account: account.login,
    });
    // Teams that could not get a repository without GitHub access get one now.
    if (isPlaying(event))
      for (const teamId of failedTeamIds) {
        try {
          await this.eventService.retryRepositoryOperation(event.id, teamId);
        } catch (error) {
          this.logger.error(
            `Failed to retry repository creation for team ${teamId} after connecting GitHub`,
            error,
          );
        }
      }
    return { eventId };
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

  private async hasRepositories(eventId: string) {
    const teams = await this.dataSource
      .getRepository(TeamEntity)
      .createQueryBuilder("team")
      .select(["team.id", "team.repo", "team.repositoryStatus"])
      .where('team."eventId" = :eventId', { eventId })
      .getMany();
    return teams.some(
      (team) =>
        team.repo || team.repositoryStatus === RepositoryStatus.PROVISIONING,
    );
  }

  /**
   * Usable organization installations the user owns. Checking ownership costs
   * GitHub requests for every installation of the App, so results are cached
   * briefly per user and connecting checks again.
   */
  private ownedInstallations(userId: string) {
    const now = Date.now();
    for (const [key, entry] of this.ownedInstallationsCache)
      if (entry.expiresAt <= now) this.ownedInstallationsCache.delete(key);
    const cached = this.ownedInstallationsCache.get(userId);
    if (cached) return cached.installations;
    const entry = {
      expiresAt: now + OWNED_INSTALLATIONS_CACHE_MS,
      installations: this.findOwnedInstallations(userId),
    };
    this.ownedInstallationsCache.set(userId, entry);
    entry.installations.catch(() => {
      if (this.ownedInstallationsCache.get(userId) === entry)
        this.ownedInstallationsCache.delete(userId);
    });
    return entry.installations;
  }

  private async findOwnedInstallations(userId: string) {
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: userId });
    let installations: GithubAppInstallation[];
    try {
      installations = await this.githubAppAuth.listInstallations();
    } catch (error) {
      this.logger.error("Failed to list the GitHub App installations", error);
      throw new BadGatewayException(
        "Could not load the installations from GitHub. Try again.",
      );
    }
    // Repositories are only created in organizations.
    const candidates = installations.filter(
      (installation) =>
        installation.account?.type === "Organization" &&
        !installation.suspended_at &&
        !missingPermissions(installation.permissions).length,
    );
    if (!candidates.length) return [];

    const login = await this.githubLogin(candidates[0].id, user.githubId);
    if (!login) return [];
    const owned: GithubAppInstallation[] = [];
    let failures = 0;
    let next = 0;
    const worker = async () => {
      while (next < candidates.length) {
        const installation = candidates[next++];
        try {
          if (await this.isActiveOwner(installation, login))
            owned.push(installation);
        } catch (error) {
          failures++;
          this.logger.warn(
            `Could not check access to installation ${installation.id}`,
            error,
          );
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(OWNERSHIP_CHECK_CONCURRENCY, candidates.length) },
        worker,
      ),
    );
    if (failures === candidates.length)
      throw new BadGatewayException(
        "Could not check the installations on GitHub. Try again.",
      );
    return owned.sort((a, b) =>
      a.account!.login.localeCompare(b.account!.login),
    );
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
  private async githubLogin(installationId: number, githubId: string) {
    const token = await this.githubAppAuth.getInstallationToken(installationId);
    const githubUser = await this.githubRequest<{ login: string }>(
      token,
      `/user/${encodeURIComponent(githubId)}`,
    );
    return githubUser?.login ?? null;
  }

  private async isActiveOwner(
    installation: GithubAppInstallation,
    login: string,
  ) {
    const token = await this.githubAppAuth.getInstallationToken(
      installation.id,
    );
    const membership = await this.githubRequest<{
      role: string;
      state: string;
    }>(
      token,
      `/orgs/${encodeURIComponent(installation.account!.login)}/memberships/${encodeURIComponent(login)}`,
    );
    return membership?.role === "admin" && membership.state === "active";
  }

  /** Lower-cased names of the repositories a "selected repositories" installation can access. */
  private async listInstallationRepositories(installationId: number) {
    const token = await this.githubAppAuth.getInstallationToken(installationId);
    const names = new Set<string>();
    for (let page = 1; ; page++) {
      const result = await this.githubRequest<{
        repositories: { name: string }[];
      }>(token, `/installation/repositories?per_page=100&page=${page}`);
      const repositories = result?.repositories ?? [];
      for (const { name } of repositories) names.add(name.toLowerCase());
      if (repositories.length < 100) return names;
    }
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
    if (!response.ok) {
      this.logger.error(
        `GitHub request ${path} failed with ${response.status}`,
      );
      throw new BadGatewayException(
        "Could not check the installation on GitHub. Try again.",
      );
    }
    return (await response.json()) as T;
  }
}

export function missingPermissions(granted: Record<string, string>) {
  return Object.entries(REQUIRED_PERMISSIONS)
    .filter(([name, levels]) => !levels.includes(granted[name]))
    .map(([name]) => name);
}
