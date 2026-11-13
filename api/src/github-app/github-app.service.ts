import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In, IsNull, Not } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { isPlaying } from "../event/event-lifecycle";
import { EventService } from "../event/event.service";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import { GithubInstallationOwner } from "../github-api/github-installation-owner";
import { isSharedInstallation } from "../github-api/installation-sharing";
import {
  GithubAppAuth,
  GithubAppInstallation,
  GithubAppRequestError,
} from "../github-api/github-app-auth";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { GithubInstallStateSigner } from "./github-app-state";
import { AuthorizationService, EventPolicy, type Principal } from "../authz";

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
  /** Shared by a global admin, so linking it skips the owner check. */
  shared: boolean;
}

/** An installation as global admins manage its sharing. */
export interface AdminGithubInstallation {
  id: string;
  accountLogin: string;
  accountType: string;
  status: GithubConnectionStatus;
  sharedAt: Date | null;
  sharedBy: { id: string; username: string } | null;
  /** Events linked to the installation. */
  eventCount: number;
}

function connectionStatus(
  installation: Pick<GithubInstallationEntity, "suspendedAt" | "deletedAt">,
): GithubConnectionStatus {
  return installation.deletedAt
    ? "uninstalled"
    : installation.suspendedAt
      ? "suspended"
      : "active";
}

interface InstallationWebhook {
  action?: string;
  installation?: { id?: number; suspended_at?: string | null };
  account?: { login?: string };
}

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);
  private readonly owner: GithubInstallationOwner;
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
    private readonly authorization: AuthorizationService,
  ) {
    this.owner = new GithubInstallationOwner(githubAppAuth, (input, init) =>
      this.fetch(input, init),
    );
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
        status: connectionStatus(installation),
      },
    };
  }

  /** Where to send an event admin to install the App on their organization. */
  async createInstallUrl(eventId: string, user: Principal) {
    await this.assertEventAdmin(eventId, user);
    if (!this.isAvailable())
      throw new ServiceUnavailableException(
        "The CORE GitHub App is not configured on this server.",
      );
    const url = new URL(
      `https://github.com/apps/${encodeURIComponent(this.appSlug!)}/installations/new`,
    );
    url.searchParams.set(
      "state",
      this.stateSigner.sign({ eventId, userId: user.id }),
    );
    return { url: url.toString() };
  }

  /**
   * Installations of the App, e.g. made for another event, on organizations
   * the user owns, so the event can use one without installing the App again,
   * and the installations a global admin shared.
   */
  async listLinkableInstallations(
    eventId: string,
    user: Principal,
  ): Promise<LinkableGithubInstallation[]> {
    await this.assertEventAdmin(eventId, user);
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
    const [owned, shared] = await Promise.all([
      this.ownedInstallations(user.id),
      this.dataSource.getRepository(GithubInstallationEntity).findBy({
        sharedAt: Not(IsNull()),
        suspendedAt: IsNull(),
        deletedAt: IsNull(),
      }),
    ]);
    const sharedIds = new Set(shared.map((row) => row.installationId));
    const ownedIds = new Set(owned.map((installation) => installation.id));
    const linkable: LinkableGithubInstallation[] = [
      ...owned.map((installation) => ({
        installationId: installation.id,
        accountLogin: installation.account!.login,
        accountType: installation.account!.type,
        shared: sharedIds.has(installation.id),
      })),
      ...shared
        .filter((row) => !ownedIds.has(row.installationId))
        .map((row) => ({
          installationId: row.installationId,
          accountLogin: row.accountLogin,
          accountType: row.accountType,
          shared: true,
        })),
    ];
    return linkable
      .filter(
        (installation) =>
          installation.installationId !== linked &&
          (!requiredOrg ||
            installation.accountLogin.toLowerCase() === requiredOrg),
      )
      .sort((a, b) => a.accountLogin.localeCompare(b.accountLogin));
  }

  /** Linkable installations before an event exists; ids are local UUIDs. */
  async listInstallations(user: Principal) {
    if (!this.githubAppAuth.isEnabled()) return [];
    const owned = await this.ownedInstallations(user.id);
    const installations = this.dataSource.getRepository(
      GithubInstallationEntity,
    );
    if (owned.length) {
      // The owner list may be cached. Only materialize missing UUIDs; never
      // overwrite newer suspension/uninstall/rename webhook state from it.
      await installations
        .createQueryBuilder()
        .insert()
        .values(
          owned.map((installation) => ({
            installationId: installation.id,
            accountId: installation.account!.id,
            accountLogin: installation.account!.login,
            accountType: installation.account!.type,
          })),
        )
        .orIgnore()
        .execute();
    }
    const rows = await installations.findBy([
      ...(owned.length
        ? [
            {
              installationId: In(owned.map(({ id }) => id)),
              suspendedAt: IsNull(),
              deletedAt: IsNull(),
            },
          ]
        : []),
      { sharedAt: Not(IsNull()), suspendedAt: IsNull(), deletedAt: IsNull() },
    ]);
    return rows
      .map((row) => ({
        id: row.id,
        accountLogin: row.accountLogin,
        accountType: row.accountType,
        shared: isSharedInstallation(row),
      }))
      .sort((a, b) => a.accountLogin.localeCompare(b.accountLogin));
  }

  /** Connects an installation that already exists, without the install redirect. */
  linkInstallation(eventId: string, user: Principal, installationId: number) {
    return this.connectInstallation(eventId, user, installationId);
  }

  /** Finishes the installation GitHub redirected back from. */
  async completeInstallation(
    user: Principal,
    installationId: number,
    stateValue: string,
  ) {
    const state = this.stateSigner.verify(stateValue);
    if (!state || state.userId !== user.id)
      throw new BadRequestException(
        "This GitHub connection link is invalid or has expired. Start again from the event dashboard.",
      );
    return this.connectInstallation(state.eventId, user, installationId);
  }

  /**
   * The installation ID comes from the browser, so it is only trusted after
   * GitHub confirms it belongs to this App and the user administers the
   * account it is on. A shared installation skips the owner check: the admin
   * who shared it passed it.
   */
  private async connectInstallation(
    eventId: string,
    principal: Principal,
    installationId: number,
  ) {
    await this.assertEventAdmin(eventId, principal);
    const userId = principal.id;
    if (!this.githubAppAuth.isEnabled())
      throw new ServiceUnavailableException(
        "The CORE GitHub App is not configured on this server.",
      );

    const installation = await this.fetchInstallation(installationId);
    if (installation.suspended_at)
      throw new BadRequestException("The GitHub installation is suspended.");
    const account = installation.account;
    if (!account)
      throw new BadRequestException("The installation has no GitHub account.");
    // Checked first: the ownership check below needs Members access.
    const missing = missingPermissions(installation.permissions);
    if (missing.length)
      throw new BadRequestException(
        `The installation on ${account.login} lacks these permissions: ${missing.join(", ")}. An owner must accept the App's requested permissions on GitHub.`,
      );
    const known = await this.dataSource
      .getRepository(GithubInstallationEntity)
      .findOneBy({ installationId });
    const ownershipChecked = !isSharedInstallation(known);
    if (ownershipChecked) {
      const user = await this.dataSource
        .getRepository(UserEntity)
        .findOneByOrFail({ id: userId });
      await this.owner.assertCanManageAccount(installation, user.githubId);
    }
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
        let row = await installations.findOne({
          where: { installationId },
          lock: { mode: "pessimistic_write" },
        });
        if (!ownershipChecked && !isSharedInstallation(row))
          throw new ForbiddenException(
            "This installation is no longer shared. Retry to check ownership.",
          );
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

  /** Every installation the App knows, for global admins. */
  async listForAdmin(): Promise<AdminGithubInstallation[]> {
    const rows = await this.dataSource
      .getRepository(GithubInstallationEntity)
      .find({ relations: { sharedBy: true }, order: { accountLogin: "ASC" } });
    return this.toAdminRows(rows);
  }

  /**
   * Lets every event creator link the installation. The sharing admin must
   * pass the owner check that linking then skips.
   */
  async share(id: string, admin: Principal): Promise<AdminGithubInstallation> {
    const installations = this.dataSource.getRepository(
      GithubInstallationEntity,
    );
    const row = await installations.findOneBy({ id });
    if (!row) throw new NotFoundException("Installation not found");
    if (row.deletedAt)
      throw new BadRequestException(
        `The App was uninstalled from ${row.accountLogin}, so it cannot be shared.`,
      );
    if (!this.githubAppAuth.isEnabled())
      throw new ServiceUnavailableException(
        "The CORE GitHub App is not configured on this server.",
      );
    const installation = await this.fetchInstallation(row.installationId);
    if (row.suspendedAt || installation.suspended_at)
      throw new BadRequestException("The GitHub installation is suspended.");
    if (!installation.account)
      throw new BadRequestException("The installation has no GitHub account.");
    const missing = missingPermissions(installation.permissions);
    if (missing.length)
      throw new BadRequestException(
        `The installation on ${installation.account.login} lacks these permissions: ${missing.join(", ")}. An owner must accept the App's requested permissions on GitHub.`,
      );
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: admin.id });
    await this.owner.assertCanManageAccount(installation, user.githubId);
    // Sharing again keeps who shared it first.
    await installations.update(
      { id, sharedAt: IsNull() },
      { sharedAt: new Date(), sharedById: admin.id },
    );
    this.logger.log({
      action: "github_installation_shared",
      userId: admin.id,
      installationId: row.installationId,
      account: row.accountLogin,
    });
    const [shared] = await this.toAdminRows([
      await installations.findOneOrFail({
        where: { id },
        relations: { sharedBy: true },
      }),
    ]);
    return shared;
  }

  /** Stops new links; events that already use the installation keep it. */
  async unshare(id: string, admin: Principal): Promise<void> {
    const result = await this.dataSource
      .getRepository(GithubInstallationEntity)
      .update(id, { sharedAt: null, sharedById: null });
    if (!result.affected) throw new NotFoundException("Installation not found");
    this.logger.log({
      action: "github_installation_unshared",
      userId: admin.id,
      id,
    });
  }

  private async toAdminRows(
    rows: GithubInstallationEntity[],
  ): Promise<AdminGithubInstallation[]> {
    const counts = rows.length
      ? await this.dataSource
          .getRepository(EventEntity)
          .createQueryBuilder("event")
          .select('event."githubInstallationId"', "id")
          .addSelect("COUNT(*)::int", "count")
          .where({ githubInstallationId: In(rows.map((row) => row.id)) })
          .groupBy('event."githubInstallationId"')
          .getRawMany<{ id: string; count: number }>()
      : [];
    const eventCounts = new Map(counts.map(({ id, count }) => [id, count]));
    return rows.map((row) => ({
      id: row.id,
      accountLogin: row.accountLogin,
      accountType: row.accountType,
      status: connectionStatus(row),
      sharedAt: row.sharedAt,
      sharedBy: row.sharedBy && {
        id: row.sharedBy.id,
        username: row.sharedBy.username,
      },
      eventCount: eventCounts.get(row.id) ?? 0,
    }));
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

    const login = await this.owner.githubLogin(candidates[0].id, user.githubId);
    if (!login) return [];
    const owned: GithubAppInstallation[] = [];
    let failures = 0;
    let next = 0;
    const worker = async () => {
      while (next < candidates.length) {
        const installation = candidates[next++];
        try {
          if (await this.owner.isActiveOwner(installation, login))
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

  private async assertEventAdmin(eventId: string, user: Principal) {
    if (
      !(await this.authorization.can(EventPolicy, "administer", user, eventId))
    )
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

  /** Lower-cased names of the repositories a "selected repositories" installation can access. */
  private async listInstallationRepositories(installationId: number) {
    const token = await this.githubAppAuth.getInstallationToken(installationId);
    const names = new Set<string>();
    for (let page = 1; ; page++) {
      const result = await this.owner.request<{
        repositories: { name: string }[];
      }>(token, `/installation/repositories?per_page=100&page=${page}`);
      const repositories = result?.repositories ?? [];
      for (const { name } of repositories) names.add(name.toLowerCase());
      if (repositories.length < 100) return names;
    }
  }
}

export function missingPermissions(granted: Record<string, string>) {
  return Object.entries(REQUIRED_PERMISSIONS)
    .filter(([name, levels]) => !levels.includes(granted[name]))
    .map(([name]) => name);
}
