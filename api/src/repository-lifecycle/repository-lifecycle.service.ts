import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import {
  DataSource,
  EntityManager,
  Repository,
  type FindOptionsRelations,
} from "typeorm";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import { EventEntity } from "../event/entities/event.entity";
import { isPlaying, isRegistrationOpen } from "../event/event-lifecycle";
import { GithubApiService } from "../github-api/github-api.service";
import { LockKeys } from "../constants";

@Injectable()
export class RepositoryLifecycleService {
  private readonly logger = new Logger(RepositoryLifecycleService.name);
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    private readonly githubApiService: GithubApiService,
    private readonly dataSource: DataSource,
  ) {}
  private getTeamById(
    id: string,
    relations: FindOptionsRelations<TeamEntity> = {},
  ) {
    return this.teamRepository.findOneOrFail({ where: { id }, relations });
  }
  async rosterWillChange(team: TeamEntity, manager: EntityManager) {
    if (team.repo)
      await manager.update(TeamEntity, team.id, {
        repositoryStatus: RepositoryStatus.UNLOCKING,
      });
  }
  async rosterChanged(team: TeamEntity) {
    if (team.repo) await this.syncRepositoryAccess(team.id);
  }
  @Cron(CronExpression.EVERY_MINUTE)
  async autoCreateRepos() {
    const lockKey = LockKeys.CREATE_TEAM_REPOS;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const gotLock = await queryRunner.query(
        "SELECT pg_try_advisory_lock($1)",
        [lockKey],
      );

      if (gotLock[0].pg_try_advisory_lock) {
        try {
          const teams = await this.teamRepository.find({
            relations: {
              event: true,
            },
          });
          for (const team of teams) {
            try {
              if (
                team.repositoryOperationId &&
                team.startedRepoCreationAt &&
                Date.now() - team.startedRepoCreationAt.getTime() >=
                  10 * 60 * 1000
              ) {
                await this.retryRepositoryOperation(team.id);
                continue;
              }
              if (
                team.locked &&
                isRegistrationOpen(team.event) &&
                team.repositoryStatus === RepositoryStatus.LOCKING &&
                !team.repositoryOperationId
              ) {
                // A migrated manual lock has never been confirmed by GitHub.
                await this.lockTeam(team.id, false);
                continue;
              }
              if (!isRegistrationOpen(team.event)) {
                if (
                  [RepositoryStatus.READY, RepositoryStatus.PENDING].includes(
                    team.repositoryStatus,
                  ) ||
                  ([
                    RepositoryStatus.LOCKING,
                    RepositoryStatus.UNLOCKING,
                  ].includes(team.repositoryStatus) &&
                    !team.repositoryOperationId)
                )
                  await this.lockTeam(team.id);
                continue;
              }
              if (
                isPlaying(team.event) &&
                !team.locked &&
                (team.repositoryStatus === RepositoryStatus.LOCKED ||
                  (team.repositoryStatus === RepositoryStatus.UNLOCKING &&
                    !team.repositoryOperationId))
              ) {
                await this.unlockTeam(team.id);
                continue;
              }
              if (
                !isPlaying(team.event) ||
                team.repositoryStatus !== RepositoryStatus.PENDING
              )
                continue;
              this.logger.log(
                `Starting repo creation for team ${team.name} as its event has started.`,
              );

              await this.dataSource.transaction(async (entityManager) => {
                await this.createTeamRepository(team.id, entityManager);
              });
            } catch (error) {
              this.logger.error(
                `Repository reconciliation failed for team ${team.id}`,
                error,
              );
            }
          }
        } finally {
          await queryRunner.query("SELECT pg_advisory_unlock($1)", [lockKey]);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  async lockTeam(teamId: string, followLifecycle = true) {
    return this.changeRepositoryAccess(teamId, true, followLifecycle);
  }

  async unlockTeam(teamId: string) {
    return this.changeRepositoryAccess(teamId, false);
  }

  /** Applies the access the current event phase requires to the current roster. */
  private syncRepositoryAccess(teamId: string) {
    return this.changeRepositoryAccess(teamId, false, true);
  }

  private async changeRepositoryAccess(
    teamId: string,
    locked: boolean,
    followLifecycle = false,
  ) {
    const team = await this.getTeamById(teamId, { users: true, event: true });
    // Event closure work may arrive after a reopen. Only an explicit manual
    // lock (followLifecycle=false) may override the current event policy.
    if (followLifecycle) locked = !isRegistrationOpen(team.event);
    if (!locked && !isRegistrationOpen(team.event))
      throw new BadRequestException("Submissions are closed.");
    // A creation already in flight must finish before its permissions can change.
    if (team.repositoryStatus === RepositoryStatus.PROVISIONING) {
      return this.teamRepository.update(teamId, {
        locked,
      });
    }
    if (
      team.repositoryOperationId &&
      [RepositoryStatus.LOCKING, RepositoryStatus.UNLOCKING].includes(
        team.repositoryStatus,
      )
    ) {
      await this.teamRepository.update(teamId, { locked });
      return;
    }
    if (!team.repo) {
      await this.teamRepository.update(teamId, {
        locked,
        repositoryStatus: locked
          ? RepositoryStatus.FAILED
          : RepositoryStatus.PENDING,
        repositoryOperationId: null,
        repositoryError: locked
          ? "Repository is unavailable at submission closure. An administrator must explicitly exclude this team before showcase, or reopen submissions and retry provisioning."
          : null,
      });
      if (!locked && isPlaying(team.event))
        await this.dataSource.transaction((manager) =>
          this.createTeamRepository(teamId, manager),
        );
      return;
    }
    const operationId = randomUUID();
    await this.teamRepository.update(teamId, {
      locked,
      repositoryStatus: locked
        ? RepositoryStatus.LOCKING
        : RepositoryStatus.UNLOCKING,
      repositoryOperationId: operationId,
      repositoryError: null,
      startedRepoCreationAt: new Date(),
    });
    try {
      await this.githubApiService.setRepositoryAccess({
        teamId,
        operationId,
        locked,
        repositoryName: team.repo,
        githubOrg: team.event.githubOrg,
        encryptedSecret: team.event.githubOrgSecret,
        githubUsers: team.users.map((user) => ({
          username: user.username,
          githubId: user.githubId,
          githubAccessToken: user.githubAccessToken,
        })),
      });
    } catch (error) {
      await this.completeRepositoryOperation({
        teamId,
        operationId,
        repositoryName: team.repo,
        error: "Could not dispatch repository permission operation.",
      });
      throw error;
    }
  }

  async completeRepositoryOperation(data: {
    teamId: string;
    operationId: string;
    repositoryName: string;
    error?: string;
    action?: "CREATE" | "LOCK" | "UNLOCK";
  }) {
    let reconcile: boolean | undefined;
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TeamEntity);
      const team = await repository.findOne({
        where: { id: data.teamId },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });
      if (!team || !data.operationId) return;
      const event = await manager.findOneOrFail(EventEntity, {
        where: { id: team.eventId },
      });
      if (team.repositoryOperationId !== data.operationId) {
        // A stale acknowledgement can still describe real GitHub side effects.
        // Reassert the current policy rather than only ignoring the old state.
        const closed = !isRegistrationOpen(event) || team.locked;
        if (
          data.repositoryName &&
          ((closed && data.action !== "LOCK") ||
            (!closed && data.action === "LOCK" && !team.locked))
        ) {
          if (!team.repo) team.repo = data.repositoryName;
          team.repositoryOperationId = null;
          team.repositoryStatus = closed
            ? RepositoryStatus.LOCKING
            : RepositoryStatus.UNLOCKING;
          team.locked = closed;
          await repository.save(team);
          reconcile = closed;
        }
        return;
      }
      const wasLocking = team.repositoryStatus === RepositoryStatus.LOCKING;
      const mustLock = !isRegistrationOpen(event) || team.locked;
      if (data.repositoryName) team.repo = data.repositoryName;
      team.repositoryOperationId = null;
      team.repositoryError = data.error ?? null;
      team.repositoryStatus = data.error
        ? RepositoryStatus.FAILED
        : wasLocking
          ? RepositoryStatus.LOCKED
          : mustLock
            ? RepositoryStatus.LOCKING
            : RepositoryStatus.READY;
      team.locked = mustLock;
      if (!team.repo && !isRegistrationOpen(event)) {
        team.repositoryStatus = RepositoryStatus.FAILED;
        team.repositoryError =
          "Repository is unavailable at submission closure. An administrator must explicitly exclude this team before showcase, or reopen submissions and retry provisioning.";
      }
      // Even partially successful creation can have writable collaborators.
      if (team.repo && mustLock && !wasLocking) reconcile = true;
      if (!data.error && wasLocking && !mustLock) reconcile = false;
      await repository.save(team);
    });
    if (reconcile !== undefined)
      await this.changeRepositoryAccess(data.teamId, reconcile, true);
  }

  async isRepositoryOperationCurrent(teamId: string, operationId: string) {
    return this.dataSource.transaction(async (manager) => {
      const team = await manager.findOne(TeamEntity, {
        where: { id: teamId },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });
      return Boolean(team && team.repositoryOperationId === operationId);
    });
  }

  async retryRepositoryOperation(teamId: string) {
    const team = await this.getTeamById(teamId, { event: true });
    // Invalidate a lost acknowledgement; workers check operation IDs before
    // starting a retry and serialize effects for each team.
    if (team.repositoryOperationId) {
      await this.teamRepository.update(teamId, {
        repositoryOperationId: null,
        repositoryStatus: RepositoryStatus.FAILED,
      });
    }
    if (!isRegistrationOpen(team.event)) return this.lockTeam(teamId);
    if (team.repo) return this.unlockTeam(teamId);
    if (!isPlaying(team.event))
      throw new BadRequestException("The event has not started.");
    await this.teamRepository.update(teamId, {
      repositoryStatus: RepositoryStatus.PENDING,
    });
    return this.dataSource.transaction((manager) =>
      this.createTeamRepository(teamId, manager),
    );
  }

  private repositoryName(team: TeamEntity) {
    return `${team.event.name}-${team.name}-${team.id}`.replace(
      /[^a-zA-Z0-9_.-]/g,
      "-",
    );
  }

  async createTeamRepository(teamId: string, entityManager: EntityManager) {
    const teamRepository = entityManager.getRepository(TeamEntity);
    await teamRepository.findOneOrFail({
      where: { id: teamId },
      lock: { mode: "pessimistic_write" },
      loadEagerRelations: false,
    });
    const team = await teamRepository.findOneOrFail({
      where: {
        id: teamId,
      },
      relations: {
        users: true,
        event: true,
        starterTemplate: true,
      },
    });

    if (!team.event) {
      this.logger.error(
        `While creating repo for team ${teamId}, event was not found.`,
      );
      return;
    }

    if (
      !isPlaying(team.event) ||
      team.repo ||
      team.repositoryStatus !== RepositoryStatus.PENDING
    )
      return;
    const operationId = randomUUID();
    await teamRepository.update(teamId, {
      repositoryStatus: RepositoryStatus.PROVISIONING,
      repositoryOperationId: operationId,
      repositoryError: null,
      startedRepoCreationAt: new Date(),
      locked: false,
    });

    const repoName = this.repositoryName(team);

    // Determine values to use: template or event default
    const basePath = team.starterTemplate
      ? team.starterTemplate.basePath
      : team.event.basePath;
    const myCoreBotDockerImage = team.starterTemplate
      ? team.starterTemplate.myCoreBotDockerImage
      : team.event.myCoreBotDockerImage;

    await this.githubApiService.createTeamRepository(
      repoName,
      team.name,
      team.users.map((user) => ({
        username: user.username,
        githubId: user.githubId,
        githubAccessToken: user.githubAccessToken,
      })),
      team.event.githubOrg,
      team.event.githubOrgSecret,
      team.id,
      team.event.monorepoUrl,
      team.event.monorepoVersion,
      myCoreBotDockerImage,
      team.event.visualizerDockerImage,
      team.event.id,
      basePath,
      team.event.gameConfig ?? "",
      team.event.serverConfig ?? "",
      team.starterTemplate?.id,
      operationId,
      (
        team.event.submissionDeadline ??
        team.event.repoLockDate ??
        team.event.endDate
      )?.toISOString(),
    );

    await teamRepository.update(teamId, {
      startedRepoCreationAt: new Date(),
    });
  }
}
