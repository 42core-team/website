import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { TeamEntity } from "./entities/team.entity";
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  Not,
  Repository,
} from "typeorm";
import { GithubApiService } from "../github-api/github-api.service";
import { EventService } from "../event/event.service";
import { UserService } from "../user/user.service";
import { FindOptionsRelations } from "typeorm/find-options/FindOptionsRelations";
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
import { groupLocationTagsByOwner } from "../user/location-tags";
import type { OwnedLocationTagSource } from "../user/location-tags";
import { accrueQueueCredits, spendQueueCredits } from "./team-credits";
import { rankQueueOpponents } from "./queue-matchmaking";
import type { QueueOpponentCandidate } from "./queue-matchmaking";
import { TeamAssetsService } from "./team-assets.service";
import {
  TeamAssetType,
  UploadedTeamAsset,
  validateTeamAsset,
} from "./team-assets";

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
    private readonly userService: UserService,
    @Inject(forwardRef(() => MatchService))
    private readonly matchService: MatchService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly teamAssetsService: TeamAssetsService,
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
            where: {
              startedRepoCreationAt: IsNull(),
              event: {
                startDate: LessThanOrEqual(new Date()),
              },
            },
            relations: {
              event: true,
            },
          });
          for (const team of teams) {
            this.logger.log(
              `Starting repo creation for team ${team.name} as its event has started.`,
            );

            await this.dataSource.transaction(async (entityManager) => {
              await this.createTeamRepository(team.id, entityManager);
            });
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

  async lockTeam(teamId: string) {
    const team = await this.teamRepository.findOneOrFail({
      where: {
        id: teamId,
      },
      relations: {
        users: true,
        event: true,
      },
    });

    await Promise.all(
      team.users.map(async (user) => {
        try {
          await this.githubApiService.removeWritePermissions(
            user.username,
            user.githubId,
            team.event.githubOrg,
            team.repo,
            team.event.githubOrgSecret,
          );
        } catch (e) {
          this.logger.error(
            `Failed to remove write permissions for user ${user.username} in team ${teamId}`,
            e,
          );
        }
      }),
    );

    return this.teamRepository.update(teamId, {
      locked: true,
    });
  }

  async createTeamRepository(teamId: string, entityManager: EntityManager) {
    const teamRepository = entityManager.getRepository(TeamEntity);
    const team = await teamRepository.findOneOrFail({
      where: {
        startedRepoCreationAt: IsNull(),
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

    const repoName = team.event.name + "-" + team.name + "-" + team.id;

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

      if (await this.eventService.hasEventStarted(eventId))
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

    await Promise.allSettled([
      this.teamAssetsService.deleteByUrl(team.profileImageUrl),
      this.teamAssetsService.deleteByUrl(team.bannerImageUrl),
      this.teamAssetsService.deleteByUrl(team.winningSoundUrl),
    ]);

    return this.teamRepository.softDelete(teamId);
  }

  async updateCustomization(teamId: string, description: string) {
    const normalizedDescription = description.trim() || null;
    await this.teamRepository.update(teamId, {
      description: normalizedDescription,
    });
    return { description: normalizedDescription };
  }

  async uploadAsset(
    teamId: string,
    assetType: TeamAssetType,
    file: UploadedTeamAsset | undefined,
  ) {
    validateTeamAsset(assetType, file);

    const team = await this.getTeamById(teamId);
    const field = this.getAssetField(assetType);
    const previousUrl = team[field];
    const uploadedAsset = await this.teamAssetsService.upload(
      teamId,
      assetType,
      file,
    );

    try {
      await this.teamRepository.update(teamId, {
        [field]: uploadedAsset.url,
      });
    } catch (error) {
      try {
        await this.teamAssetsService.deleteByKey(uploadedAsset.key);
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to clean up ${assetType} after a database error for team ${teamId}`,
          cleanupError,
        );
      }
      throw error;
    }

    try {
      await this.teamAssetsService.deleteByUrl(previousUrl);
    } catch (error) {
      this.logger.warn(
        `Failed to delete replaced ${assetType} for team ${teamId}`,
        error,
      );
    }

    return {
      assetType,
      url: uploadedAsset.url,
    };
  }

  private getAssetField(assetType: TeamAssetType) {
    switch (assetType) {
      case TeamAssetType.PROFILE_IMAGE:
        return "profileImageUrl" as const;
      case TeamAssetType.BANNER_IMAGE:
        return "bannerImageUrl" as const;
      case TeamAssetType.WINNING_SOUND:
        return "winningSoundUrl" as const;
    }
  }

  async setTeamCredits(eventId: string, teamId: string, credits: number) {
    return this.dataSource.transaction(async (entityManager) => {
      const team = await entityManager.findOne(TeamEntity, {
        where: {
          id: teamId,
          event: { id: eventId },
        },
        lock: { mode: "pessimistic_write" },
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
    const team = await this.getTeamById(teamId, {
      users: true,
      event: true,
    });
    const user = await this.userService.getUserById(userId);

    if (team.users.length > 1 && team.repo) {
      await this.githubApiService.removeUserFromRepository(
        team.repo,
        user.username,
        user.githubId,
        team.event.githubOrg,
        team.event.githubOrgSecret,
      );
    }
    await this.teamRepository
      .createQueryBuilder()
      .relation("users")
      .of(teamId)
      .remove(userId);

    if (team.users.length <= 1) return this.deleteTeam(teamId);
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
    const team = await this.getTeamById(teamId, {
      event: true,
    });
    const user = await this.userService.getUserById(userId);

    if (team.repo)
      await this.githubApiService.addUserToRepository(
        team.repo,
        user.username,
        user.githubId,
        team.event.githubOrg,
        team.event.githubOrgSecret,
        user.githubAccessToken,
      );

    await this.teamRepository
      .createQueryBuilder()
      .relation("teamInvites")
      .of(teamId)
      .remove(userId);

    await this.teamRepository
      .createQueryBuilder()
      .relation("users")
      .of(teamId)
      .add(userId);
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
        "team.score",
        "team.buchholzPoints",
        "team.hadBye",
        "team.credits",
        "team.createdAt",
        "team.updatedAt",
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
          "team.hadBye",
          "team.createdAt",
          "team.updatedAt",
          "team.score",
        ])
        .addSelect("COUNT(DISTINCT match.id)", "revealed_match_wins");
    }

    query.addSelect("COUNT(DISTINCT user.id)", "user_count").groupBy("team.id");

    if (searchName) {
      query.andWhere("team.name LIKE :searchName", {
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

    // Batch calculate Buchholz points for all teams in the result
    const teamIds = result.entities.map((t) => t.id);
    const buchholzMap = await this.matchService.calculateBuchholzPointsForTeams(
      teamIds,
      eventId,
      !revealAll,
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
        } = {
          ...team,
          hadBye: team.hadBye,
          userCount: parseInt(raw.user_count, 10) || 0,
          score: 0,
          buchholzPoints: 0,
          tags: tagsByTeam.get(team.id) ?? [],
        };

        if (revealAll) {
          // For admins, use DB score which includes byes
          mappedTeam.score = team.score || 0;
        } else {
          // For public, Revealed Match Wins + Bye
          mappedTeam.score =
            (parseInt(raw.revealed_match_wins, 10) || 0) +
            (team.hadBye ? 1 : 0);
        }

        // Use the batch-calculated Buchholz points
        mappedTeam.buchholzPoints = buchholzMap.get(team.id) || 0;

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

      const now = new Date();
      if (!event.processQueue)
        throw new BadRequestException("Match making is disabled.");
      if (event.startDate > now || event.endDate < now)
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
    const opponents = await this.teamRepository.find({
      select: { id: true, name: true },
      where: {
        id: Not(teamId),
        event: { id: eventId },
      },
      order: { name: "ASC" },
    });

    return opponents.map(({ id, name }) => ({ id, name }));
  }

  async createDirectMatch(challengerId: string, targetId: string) {
    if (challengerId === targetId)
      throw new BadRequestException("A team cannot play against itself.");

    const match = await this.dataSource.transaction(async (entityManager) => {
      const teams = await entityManager.find(TeamEntity, {
        where: { id: In([challengerId, targetId]) },
        order: { id: "ASC" },
        lock: { mode: "pessimistic_write" },
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
        select: {
          id: true,
          maxQueueCredits: true,
          queueCreditIntervalMinutes: true,
        },
        where: { id: challenger.eventId },
      });
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
        event: { id: team.eventId },
      },
      order: { id: "ASC" },
      lock: { mode: "pessimistic_write" },
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
    const teams = await this.dataSource.transaction(async (entityManager) => {
      const teamRepository = entityManager.getRepository(TeamEntity);
      await teamRepository
        .createQueryBuilder()
        .update()
        .set({ locked: false })
        .where("eventId = :eventId", { eventId })
        .execute();

      return teamRepository.find({
        where: {
          event: {
            id: eventId,
          },
        },
        relations: {
          users: true,
          event: true,
        },
      });
    });

    for (const team of teams) {
      if (!team.repo || !team.event) continue;

      for (const user of team.users) {
        if (!user.username) continue;

        await this.githubApiService.addWritePermissions(
          user.username,
          user.githubId,
          team.event.githubOrg,
          team.repo,
          team.event.githubOrgSecret,
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
