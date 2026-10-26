import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { RepositoryStatus, TeamEntity } from "./entities/team.entity";
import { isMatchmakingReady } from "./team-readiness";
import { randomUUID } from "crypto";
import { isPlaying, isRegistrationOpen } from "../event/event-lifecycle";
import { MediaUploadEntity } from "../media/entities/media-upload.entity";
import { mediaArtwork } from "../media/media-artwork";
import {
  DataSource,
  EntityManager,
  In,
  Not,
  Repository,
  type FindOptionsRelations,
} from "typeorm";
import { GithubApiService } from "../github-api/github-api.service";
import { EventService } from "../event/event.service";
import { MatchService } from "../match/match.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { LockKeys } from "../constants";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { MatchStatsEntity } from "../match/entites/matchStats.entity";
import { EventEntity } from "../event/entities/event.entity";
import { UserEntity } from "../user/entities/user.entity";
import { groupLocationTagsByOwner } from "../user/location-tags";
import type { OwnedLocationTagSource } from "../user/location-tags";
import { accrueQueueCredits, spendQueueCredits } from "./team-credits";
import { rankQueueOpponents } from "./queue-matchmaking";
import type { QueueOpponentCandidate } from "./queue-matchmaking";

export type PublicTaggedTeam = TeamEntity & {
  tags: string[];
};

const DIRECT_MATCH_COST = 2;
const DIRECT_MATCH_STAKE = 1;

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    private readonly githubApiService: GithubApiService,
    @Inject(forwardRef(() => EventService))
    private readonly eventService: EventService,
    @Inject(forwardRef(() => MatchService))
    private readonly matchService: MatchService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  logger = new Logger("TeamService");

  @Cron(CronExpression.EVERY_MINUTE)
  async grantTeamCredits() {
    const lockKey = LockKeys.GRANT_TEAM_QUEUE_CREDITS;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const gotLock = await queryRunner.query(
        "SELECT pg_try_advisory_lock($1)",
        [lockKey],
      );

      if (!gotLock[0].pg_try_advisory_lock) return;

      try {
        await queryRunner.query(`
          UPDATE "teams" AS team
          SET
            "credits" = team."credits" + LEAST(
              FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - team."lastCreditGrantedAt")) / (event."queueCreditIntervalMinutes" * 60))::integer,
              event."maxQueueCredits" - team."credits"
            ),
            "lastCreditGrantedAt" = team."lastCreditGrantedAt"
              + LEAST(
                FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - team."lastCreditGrantedAt")) / (event."queueCreditIntervalMinutes" * 60))::integer,
                event."maxQueueCredits" - team."credits"
              )
              * event."queueCreditIntervalMinutes" * INTERVAL '1 minute'
          FROM "events" AS event
          WHERE team."eventId" = event."id"
            AND team."deletedAt" IS NULL
            AND team."credits" < event."maxQueueCredits"
            AND team."lastCreditGrantedAt" <= CURRENT_TIMESTAMP - event."queueCreditIntervalMinutes" * INTERVAL '1 minute'
        `);
      } finally {
        await queryRunner.query("SELECT pg_advisory_unlock($1)", [lockKey]);
      }
    } finally {
      await queryRunner.release();
    }
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

  getTeamById(
    id: string,
    relations: FindOptionsRelations<TeamEntity> = {},
  ): Promise<TeamEntity> {
    return this.teamRepository.findOneOrFail({
      where: { id },
      relations,
    });
  }

  async getTeamByIdWithTags(id: string): Promise<PublicTaggedTeam> {
    const team = await this.getTeamById(id);
    const tagsByTeam = await this.getLocationTagsForTeams([id]);
    return Object.assign(team, { tags: tagsByTeam.get(id) ?? [] });
  }

  getTeamOfUserForEvent(
    eventId: string,
    userId: string,
    relations: FindOptionsRelations<TeamEntity> = {},
  ): Promise<TeamEntity | null> {
    return this.teamRepository.findOne({
      where: {
        event: {
          id: eventId,
        },
        users: {
          id: userId,
        },
      },
      relations,
    });
  }

  async getTeamOfUserForEventWithTags(
    eventId: string,
    userId: string,
  ): Promise<PublicTaggedTeam | null> {
    const team = await this.getTeamOfUserForEvent(eventId, userId);
    if (!team) return null;

    const tagsByTeam = await this.getLocationTagsForTeams([team.id]);
    return Object.assign(team, { tags: tagsByTeam.get(team.id) ?? [] });
  }

  async getLocationTagsForTeams(
    teamIds: string[],
  ): Promise<Map<string, string[]>> {
    if (teamIds.length === 0) return new Map();

    const rows = await this.teamRepository
      .createQueryBuilder("team")
      .select("team.id", "ownerId")
      .addSelect("socialAccount.platform", "platform")
      .addSelect("socialAccount.campusName", "campusName")
      .innerJoin("team.users", "tagUser")
      .innerJoin("tagUser.socialAccounts", "socialAccount")
      .where("team.id IN (:...teamIds)", { teamIds })
      .getRawMany<OwnedLocationTagSource>();

    return groupLocationTagsByOwner(teamIds, rows);
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

  async assertTeamMembershipOpen(teamId: string, eventId?: string) {
    const team = await this.getTeamById(teamId, { event: true });
    this.assertMembershipOpen(team, eventId);
  }

  /**
   * Serializes every "user joins a team" operation for one user, so membership
   * checks made under it cannot be invalidated by a concurrent join or create.
   * Lock order is always user first, then team; no path takes a team lock and
   * then a user lock.
   */
  private async lockUserForTeamMembership(
    manager: EntityManager,
    userId: string,
  ) {
    await manager.findOneOrFail(UserEntity, {
      select: { id: true },
      where: { id: userId },
      lock: { mode: "pessimistic_write" },
      loadEagerRelations: false,
    });
  }

  /**
   * Serializes team creation per event and name across users, so the name
   * check in createTeam holds until the transaction commits. Taken after the
   * user lock.
   */
  private async lockTeamName(
    manager: EntityManager,
    eventId: string,
    name: string,
  ) {
    await manager.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [
      LockKeys.TEAM_NAME,
      `${eventId}:${name}`,
    ]);
  }

  private async assertUserHasNoTeamInEvent(
    manager: EntityManager,
    userId: string,
    eventId: string,
    message: string,
  ) {
    if (
      await manager.exists(TeamEntity, {
        where: { event: { id: eventId }, users: { id: userId } },
      })
    )
      throw new BadRequestException(message);
  }

  /**
   * Locks the team row for a roster change. Every roster mutation and the
   * repository status transition it triggers happen under this lock, so a
   * permission operation never starts from a roster that is being changed.
   * Joins take the user lock (lockUserForTeamMembership) before this one.
   */
  private async lockTeamForMembershipChange(
    manager: EntityManager,
    teamId: string,
  ) {
    const repository = manager.getRepository(TeamEntity);
    await repository.findOneOrFail({
      where: { id: teamId },
      lock: { mode: "pessimistic_write" },
      loadEagerRelations: false,
    });
    const team = await repository.findOneOrFail({
      where: { id: teamId },
      relations: { event: true, users: true },
    });
    this.assertMembershipOpen(team);
    return team;
  }

  private assertMembershipOpen(team: TeamEntity, eventId?: string) {
    if (
      (eventId && team.event.id !== eventId) ||
      !isRegistrationOpen(team.event) ||
      team.locked
    )
      throw new BadRequestException("Team membership changes are closed.");
    if (
      [
        RepositoryStatus.PROVISIONING,
        RepositoryStatus.LOCKING,
        RepositoryStatus.UNLOCKING,
      ].includes(team.repositoryStatus)
    )
      throw new BadRequestException(
        "Repository access is being updated. Please retry shortly.",
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

  async createTeam(
    name: string,
    userId: string,
    eventId: string,
    starterTemplateId?: string,
  ) {
    return await this.dataSource.transaction(async (entityManager) => {
      await this.lockUserForTeamMembership(entityManager, userId);
      await this.lockTeamName(entityManager, eventId, name);
      const event = await entityManager.findOneOrFail(EventEntity, {
        where: { id: eventId },
      });
      if (!isRegistrationOpen(event))
        throw new BadRequestException("Registration is closed.");
      await this.assertUserHasNoTeamInEvent(
        entityManager,
        userId,
        eventId,
        "You already have a team for this event.",
      );
      if (
        await entityManager.exists(TeamEntity, {
          where: { name, event: { id: eventId } },
        })
      )
        throw new BadRequestException(
          "A team with this name already exists for this event.",
        );
      if (
        starterTemplateId &&
        !(await this.eventService.isStarterTemplateInEvent(
          starterTemplateId,
          eventId,
        ))
      ) {
        throw new BadRequestException(
          "Starter template does not belong to this event.",
        );
      }

      const teamRepository = entityManager.getRepository(TeamEntity);

      const newTeam = await teamRepository.save({
        name,
        event: { id: eventId },
        users: [{ id: userId }],
        starterTemplate: starterTemplateId
          ? { id: starterTemplateId }
          : undefined,
      });

      if (isPlaying(event))
        await this.createTeamRepository(newTeam.id, entityManager);

      return newTeam;
    });
  }

  async deleteTeam(teamId: string) {
    const team = await this.getTeamById(teamId, {
      event: true,
    });

    return this.deleteTeamRecord(team);
  }

  async deleteTeamForEvent(eventId: string, teamId: string) {
    const team = await this.teamRepository.findOne({
      where: {
        id: teamId,
        event: { id: eventId },
      },
      relations: { event: true },
    });

    if (!team) throw new NotFoundException("Team not found in this event.");

    return this.deleteTeamRecord(team);
  }

  private async deleteTeamRecord(team: TeamEntity) {
    const teamId = team.id;

    if (team.repo)
      await this.githubApiService.deleteRepository(
        team.repo,
        team.event.githubOrg,
        team.event.githubOrgSecret,
      );

    return this.teamRepository.softDelete(teamId);
  }

  async setTeamCredits(eventId: string, teamId: string, credits: number) {
    return this.dataSource.transaction(async (entityManager) => {
      const team = await entityManager.findOne(TeamEntity, {
        where: {
          id: teamId,
          event: { id: eventId },
        },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });

      if (!team) throw new NotFoundException("Team not found in this event.");

      team.credits = credits;
      team.lastCreditGrantedAt = new Date();
      const updatedTeam = await entityManager.save(team);

      return {
        id: updatedTeam.id,
        credits: updatedTeam.credits,
      };
    });
  }

  async leaveTeam(teamId: string, userId: string) {
    const { repo, lastMember } = await this.dataSource.transaction(
      async (manager) => {
        const team = await this.lockTeamForMembershipChange(manager, teamId);
        const lastMember = team.users.length <= 1;
        await manager
          .createQueryBuilder()
          .relation(TeamEntity, "users")
          .of(teamId)
          .remove(userId);
        if (!lastMember && team.repo)
          await manager.update(TeamEntity, teamId, {
            repositoryStatus: RepositoryStatus.UNLOCKING,
          });
        return { repo: team.repo, lastMember };
      },
    );

    if (lastMember) return this.deleteTeam(teamId);
    // The permission operation reconciles collaborators against the new
    // roster, which removes the departed member from the repository.
    if (repo) await this.syncRepositoryAccess(teamId);
  }

  getTeamCountForEvent(eventId: string): Promise<number> {
    return this.teamRepository.count({
      where: {
        event: {
          id: eventId,
        },
      },
    });
  }

  existsTeamByName(name: string, eventId: string): Promise<boolean> {
    return this.teamRepository.exists({
      where: {
        name,
        event: {
          id: eventId,
        },
      },
    });
  }

  async getTeamsUserIsInvitedTo(
    userId: string,
    eventId: string,
  ): Promise<PublicTaggedTeam[]> {
    const teams = await this.teamRepository.find({
      where: {
        event: {
          id: eventId,
        },
        teamInvites: {
          id: userId,
        },
      },
    });

    const tagsByTeam = await this.getLocationTagsForTeams(
      teams.map((team) => team.id),
    );
    return teams.map((team) => {
      return Object.assign(team, { tags: tagsByTeam.get(team.id) ?? [] });
    });
  }

  isUserInvitedToTeam(userId: string, teamId: string): Promise<boolean> {
    return this.teamRepository.exists({
      where: {
        id: teamId,
        teamInvites: {
          id: userId,
        },
      },
    });
  }

  async acceptTeamInvite(userId: string, teamId: string): Promise<void> {
    const team = await this.dataSource.transaction(async (manager) => {
      await this.lockUserForTeamMembership(manager, userId);
      const team = await this.lockTeamForMembershipChange(manager, teamId);
      await this.assertUserHasNoTeamInEvent(
        manager,
        userId,
        team.event.id,
        "You are already part of a team for this event.",
      );
      if (
        !(await manager.exists(TeamEntity, {
          where: { id: teamId, teamInvites: { id: userId } },
        }))
      )
        throw new BadRequestException("You are not invited to this team.");
      const maxUsers = team.event.maxTeamSize;
      if (!maxUsers || team.users.length >= maxUsers)
        throw new BadRequestException("This team is full.");
      if (team.repo)
        await manager.update(TeamEntity, teamId, {
          repositoryStatus: RepositoryStatus.UNLOCKING,
        });
      await manager
        .createQueryBuilder()
        .relation(TeamEntity, "teamInvites")
        .of(teamId)
        .remove(userId);
      await manager
        .createQueryBuilder()
        .relation(TeamEntity, "users")
        .of(teamId)
        .add(userId);
      return team;
    });
    if (team.repo) await this.syncRepositoryAccess(teamId);
  }

  declineTeamInvite(userId: string, teamId: string) {
    return this.teamRepository
      .createQueryBuilder()
      .relation("teamInvites")
      .of(teamId)
      .remove(userId);
  }

  async getSearchedTeamsForEvent(
    eventId: string,
    searchName?: string,
    searchDir?: string,
    sortBy?: string,
    userId?: string,
    adminReveal?: boolean,
  ): Promise<
    Array<
      TeamEntity & {
        userCount: number;
        tags: string[];
      }
    >
  > {
    const isAdmin = userId
      ? await this.eventService.isEventAdmin(eventId, userId)
      : false;
    const revealAll = isAdmin && adminReveal;

    const query = this.teamRepository
      .createQueryBuilder("team")
      .innerJoin("team.event", "event")
      .leftJoin("team.users", "user")
      .where("event.id = :eventId", { eventId })
      .andWhere("team.deletedAt IS NULL");

    if (revealAll) {
      query.select([
        "team.id",
        "team.name",
        "team.locked",
        "team.repositoryStatus",
        "team.repositoryOperationId",
        "team.repositoryError",
        "team.tournamentExcluded",
        "team.score",
        "team.buchholzPoints",
        "team.hadBye",
        "team.credits",
        "team.createdAt",
        "team.updatedAt",
        "team.pictureSmallUploadId",
        "team.pictureLargeUploadId",
        "team.backgroundLargeUploadId",
      ]);
    } else {
      // Calculate revealed score dynamically
      query
        .leftJoin(
          MatchEntity,
          "match",
          "match.winnerId = team.id AND match.isRevealed = true AND match.phase = 'SWISS'",
        )
        .select([
          "team.id",
          "team.name",
          "team.locked",
          "team.repositoryStatus",
          "team.repositoryOperationId",
          "team.repositoryError",
          "team.tournamentExcluded",
          "team.hadBye",
          "team.createdAt",
          "team.updatedAt",
          "team.score",
          "team.pictureSmallUploadId",
          "team.pictureLargeUploadId",
          "team.backgroundLargeUploadId",
        ])
        .addSelect("COUNT(DISTINCT match.id)", "revealed_match_wins");
    }

    query.addSelect("COUNT(DISTINCT user.id)", "user_count").groupBy("team.id");

    if (searchName) {
      query.andWhere("team.name ILIKE :searchName", {
        searchName: `%${searchName}%`,
      });
    }

    if (sortBy) {
      const direction = searchDir?.toUpperCase() === "DESC" ? "DESC" : "ASC";
      const sortColumn = sortBy;

      const validSortColumns = [
        "name",
        "locked",
        "score",
        "createdAt",
        "updatedAt",
        "buchholzPoints",
      ];

      if (validSortColumns.includes(sortColumn)) {
        if (sortColumn === "score" && !revealAll) {
          query.orderBy("revealed_match_wins", direction as "ASC" | "DESC");
        } else if (sortColumn === "buchholzPoints") {
          if (revealAll) {
            query.orderBy("team.buchholzPoints", direction as "ASC" | "DESC");
          } else {
            throw new BadRequestException(
              "Buchholz points are hidden for this event.",
            );
          }
        } else {
          query.orderBy(`team.${sortColumn}`, direction as "ASC" | "DESC");
        }
      }

      if (sortBy === "membersCount") {
        query.orderBy("COUNT(DISTINCT user.id)", direction as "ASC" | "DESC");
      }
    }

    const result = await query.getRawAndEntities();

    const teamIds = result.entities.map((t) => t.id);
    const uploadIds = [
      ...new Set(
        result.entities.flatMap((team) =>
          [
            team.pictureSmallUploadId,
            team.pictureLargeUploadId,
            team.backgroundLargeUploadId,
          ].filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    // Query builders do not load eager relations; fetch artwork in one batch.
    const uploads = uploadIds.length
      ? await this.teamRepository.manager.find(MediaUploadEntity, {
          where: { id: In(uploadIds) },
        })
      : [];
    const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]));
    // Public standings are calculated from revealed matches. The admin view must
    // keep the persisted value selected above instead of overwriting it with a
    // different on-the-fly calculation.
    const revealedBuchholzMap = revealAll
      ? undefined
      : await this.matchService.calculateBuchholzPointsForTeams(
          teamIds,
          eventId,
          true,
        );
    const tagsByTeam = await this.getLocationTagsForTeams(teamIds);

    // Map properties from raw if entity is missing them due to partial select
    const teamsWithCounts = await Promise.all(
      result.entities.map(async (team, idx) => {
        const raw = result.raw[idx];

        const mappedTeam: TeamEntity & {
          userCount: number;
          score: number;
          buchholzPoints: number;
          tags: string[];
        } = Object.assign(new TeamEntity(), team, {
          ...mediaArtwork({
            pictureSmallUpload: team.pictureSmallUploadId
              ? uploadsById.get(team.pictureSmallUploadId)
              : null,
            pictureLargeUpload: team.pictureLargeUploadId
              ? uploadsById.get(team.pictureLargeUploadId)
              : null,
            backgroundLargeUpload: team.backgroundLargeUploadId
              ? uploadsById.get(team.backgroundLargeUploadId)
              : null,
          }),
          hadBye: team.hadBye,
          userCount: parseInt(raw.user_count, 10) || 0,
          score: 0,
          buchholzPoints: 0,
          tags: tagsByTeam.get(team.id) ?? [],
        });

        if (revealAll) {
          // For admins, use DB score which includes byes
          mappedTeam.score = team.score || 0;
        } else {
          // For public, Revealed Match Wins + Bye
          mappedTeam.score =
            (parseInt(raw.revealed_match_wins, 10) || 0) +
            (team.hadBye ? 1 : 0);
        }

        mappedTeam.buchholzPoints = revealAll
          ? (team.buchholzPoints ?? 0)
          : (revealedBuchholzMap?.get(team.id) ?? 0);

        return mappedTeam;
      }),
    );

    return teamsWithCounts;
  }

  async joinQueue(teamId: string, eventId: string) {
    const result = await this.dataSource.transaction(async (entityManager) => {
      await this.lockQueueEvent(eventId, entityManager);

      const team = await entityManager.findOneOrFail(TeamEntity, {
        where: { id: teamId },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });
      if (team.eventId !== eventId)
        throw new BadRequestException("The team is not part of this event.");

      const event = await entityManager.findOneOrFail(EventEntity, {
        where: { id: eventId },
      });
      accrueQueueCredits(
        team,
        event.maxQueueCredits,
        event.queueCreditIntervalMinutes * 60 * 1000,
      );
      if (team.credits < 1)
        throw new BadRequestException(
          "Your team needs at least one credit to start match making.",
        );

      if (!event.processQueue)
        throw new BadRequestException("Match making is disabled.");
      if (!isPlaying(event) || !isMatchmakingReady(team))
        throw new BadRequestException("Match making is not available.");

      const match = await this.createBestQueueMatch(team, entityManager);
      if (!match)
        throw new BadRequestException(
          "No eligible opponent is currently available.",
        );

      spendQueueCredits(team, 1, event.maxQueueCredits);
      await entityManager.save(team);
      return match;
    });

    await this.matchService.startMatch(result.id);
    return { matchId: result.id };
  }

  async getTeamsForEvent(
    eventId: string,
    relations: FindOptionsRelations<TeamEntity> = {},
  ): Promise<TeamEntity[]> {
    return this.teamRepository.find({
      where: {
        event: {
          id: eventId,
        },
      },
      relations,
      order: {
        name: "ASC",
      },
    });
  }

  getSortedTeamsForTournament(eventId: string): Promise<TeamEntity[]> {
    return this.teamRepository.find({
      where: {
        event: {
          id: eventId,
        },
      },
      order: {
        score: "DESC",
        buchholzPoints: "DESC",
      },
    });
  }

  updateBuchholzPoints(teamId: string, points: number) {
    return this.teamRepository.update(teamId, { buchholzPoints: points });
  }

  increaseTeamScore(teamId: string, score: number) {
    return this.teamRepository.increment({ id: teamId }, "score", score);
  }

  increaseTeamCredits(teamId: string, credits: number) {
    return this.teamRepository.increment({ id: teamId }, "credits", credits);
  }

  setHadBye(teamId: string, hadBye: boolean) {
    return this.teamRepository.update(teamId, { hadBye });
  }

  async getQueueSummary(eventId: string, userId: string) {
    const teamReference = await this.teamRepository.findOne({
      select: { id: true },
      where: {
        event: { id: eventId },
        users: { id: userId },
      },
    });
    if (!teamReference) return null;

    return this.dataSource.transaction(async (entityManager) => {
      const lockedTeam = await entityManager.findOneOrFail(TeamEntity, {
        where: { id: teamReference.id },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });
      const event = await entityManager.findOneOrFail(EventEntity, {
        select: {
          id: true,
          maxQueueCredits: true,
          queueCreditIntervalMinutes: true,
        },
        where: { id: eventId },
      });
      const previousCredits = lockedTeam.credits;
      const previousCreditGrantedAt = lockedTeam.lastCreditGrantedAt.getTime();
      const creditIntervalMs = event.queueCreditIntervalMinutes * 60 * 1000;
      accrueQueueCredits(lockedTeam, event.maxQueueCredits, creditIntervalMs);
      if (
        lockedTeam.credits !== previousCredits ||
        lockedTeam.lastCreditGrantedAt.getTime() !== previousCreditGrantedAt
      )
        await entityManager.save(lockedTeam);
      return {
        id: lockedTeam.id,
        name: lockedTeam.name,
        credits: lockedTeam.credits,
        maxCredits: event.maxQueueCredits,
        creditIntervalMs,
        nextCreditAt:
          lockedTeam.credits < event.maxQueueCredits
            ? new Date(
                lockedTeam.lastCreditGrantedAt.getTime() + creditIntervalMs,
              )
            : null,
      };
    });
  }

  async getQueueOpponents(eventId: string, teamId: string) {
    const team = await this.getTeamById(teamId, { event: true });
    if (!isPlaying(team.event) || !isMatchmakingReady(team)) return [];
    const opponents = await this.teamRepository.find({
      select: { id: true, name: true },
      where: {
        id: Not(teamId),
        repositoryStatus: RepositoryStatus.READY,
        locked: false,
        event: { id: eventId },
      },
      order: { name: "ASC" },
    });

    return opponents.map(({ id, name, picture }) => ({ id, name, picture }));
  }

  async createDirectMatch(challengerId: string, targetId: string) {
    if (challengerId === targetId)
      throw new BadRequestException("A team cannot play against itself.");

    const match = await this.dataSource.transaction(async (entityManager) => {
      const teams = await entityManager.find(TeamEntity, {
        where: { id: In([challengerId, targetId]) },
        order: { id: "ASC" },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });
      const challenger = teams.find((team) => team.id === challengerId);
      const target = teams.find((team) => team.id === targetId);
      if (!challenger || !target)
        throw new BadRequestException("The selected team was not found.");
      if (challenger.eventId !== target.eventId)
        throw new BadRequestException(
          "Teams can only play opponents in the same event.",
        );

      const event = await entityManager.findOneOrFail(EventEntity, {
        where: { id: challenger.eventId },
      });
      if (!isPlaying(event) || ![challenger, target].every(isMatchmakingReady))
        throw new BadRequestException(
          "Match making requires playing teams with ready repositories.",
        );
      accrueQueueCredits(
        challenger,
        event.maxQueueCredits,
        event.queueCreditIntervalMinutes * 60 * 1000,
      );
      if (challenger.credits < DIRECT_MATCH_COST)
        throw new BadRequestException(
          `Your team needs at least ${DIRECT_MATCH_COST} credits to play a direct match.`,
        );
      spendQueueCredits(challenger, DIRECT_MATCH_COST, event.maxQueueCredits);
      await entityManager.save(challenger);

      return this.createQueueMatch(
        [challenger.id, target.id],
        entityManager,
        challenger,
      );
    });

    await this.matchService.startMatch(match.id);
    return { matchId: match.id };
  }

  private createQueueMatch(
    teamIds: string[],
    entityManager: EntityManager,
    creditWagerTeam?: TeamEntity,
  ) {
    const matchRepository = entityManager.getRepository(MatchEntity);
    return matchRepository.save(
      matchRepository.create({
        teams: teamIds.map((id) => ({ id })),
        round: 0,
        phase: MatchPhase.QUEUE,
        state: MatchState.PLANNED,
        creditWager: creditWagerTeam ? DIRECT_MATCH_STAKE : 0,
        creditWagerTeam: creditWagerTeam ?? null,
        stats: new MatchStatsEntity(),
      }),
    );
  }

  private async createBestQueueMatch(
    team: TeamEntity,
    entityManager: EntityManager,
  ) {
    const candidates = await entityManager.find(TeamEntity, {
      where: {
        id: Not(team.id),
        repositoryStatus: RepositoryStatus.READY,
        locked: false,
        event: { id: team.eventId },
      },
      order: { id: "ASC" },
      lock: { mode: "pessimistic_write" },
      loadEagerRelations: false,
    });
    if (candidates.length === 0) return null;

    const matchRepository = entityManager.getRepository(MatchEntity);
    const recentMatches = await matchRepository.find({
      where: {
        teams: { id: team.id },
        phase: MatchPhase.QUEUE,
        state: MatchState.FINISHED,
      },
      relations: { teams: true },
      order: { createdAt: "DESC" },
      take: 3,
    });
    const recentOpponentIds = new Set(
      recentMatches.flatMap((match) =>
        match.teams
          .filter((matchTeam) => matchTeam.id !== team.id)
          .map((matchTeam) => matchTeam.id),
      ),
    );

    const candidateIds = candidates.map((candidate) => candidate.id);
    const activityRows: Array<{
      teamId: string;
      lastQueueMatchAt: Date | string;
    }> = await matchRepository
      .createQueryBuilder("match")
      .innerJoin("match.teams", "candidate")
      .select("candidate.id", "teamId")
      .addSelect('MAX(match."createdAt")', "lastQueueMatchAt")
      .where("candidate.id IN (:...candidateIds)", {
        candidateIds,
      })
      .andWhere("match.phase = :phase", { phase: MatchPhase.QUEUE })
      .andWhere("match.state = :state", { state: MatchState.FINISHED })
      .groupBy("candidate.id")
      .getRawMany();
    const activityByTeamId = new Map(
      activityRows.map((row) => [row.teamId, new Date(row.lastQueueMatchAt)]),
    );

    const rankedCandidates = rankQueueOpponents(
      team.queueScore,
      candidates.map((candidate): QueueOpponentCandidate => ({
        id: candidate.id,
        elo: candidate.queueScore,
        lastQueueMatchAt: activityByTeamId.get(candidate.id) ?? null,
        wasRecentOpponent: recentOpponentIds.has(candidate.id),
      })),
    );
    const opponent = candidates.find(
      (candidate) => candidate.id === rankedCandidates[0].id,
    );
    if (!opponent) return null;

    this.logger.log({
      action: "queue_match_selected",
      teamId: team.id,
      opponentId: opponent.id,
      opponentScore: rankedCandidates[0].score,
    });

    return this.createQueueMatch([team.id, opponent.id], entityManager);
  }

  private async lockQueueEvent(eventId: string, entityManager: EntityManager) {
    await entityManager.query(
      "SELECT pg_advisory_xact_lock($1, hashtext($2))",
      [LockKeys.QUEUE_MATCHMAKING, eventId],
    );
  }

  async setQueueScore(teamId: string, score: number) {
    return this.teamRepository.update(teamId, { queueScore: score });
  }

  async setTeamRepository(teamId: string, repositoryName: string) {
    return this.teamRepository.update(teamId, { repo: repositoryName });
  }

  isTeamLocked(teamId: string): Promise<boolean> {
    return this.teamRepository.exists({
      where: {
        id: teamId,
        locked: true,
      },
    });
  }

  async isTeamFull(teamId: string) {
    const team = await this.teamRepository.findOne({
      where: {
        id: teamId,
      },
      relations: {
        event: true,
        users: true,
      },
    });
    const maxUsers = team?.event.maxTeamSize;
    if (!maxUsers) return true;
    if (!team?.users) return true;

    return team?.users.length >= maxUsers;
  }

  async unlockTeamsForEvent(eventId: string) {
    const teams = await this.getTeamsForEvent(eventId);
    for (const team of teams) {
      try {
        await this.unlockTeam(team.id);
      } catch (error) {
        this.logger.error(
          `Failed to unlock repository for team ${team.id}`,
          error,
        );
      }
    }
    return teams;
  }

  async resetSwissStatsForEvent(eventId: string) {
    await this.teamRepository
      .createQueryBuilder()
      .update()
      .set({ score: 0, buchholzPoints: 0, hadBye: false })
      .where("eventId = :eventId", { eventId })
      .execute();
  }
}
