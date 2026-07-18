import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { TeamEntity } from "./entities/team.entity";
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
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
import { accrueQueueCredits, QUEUE_CREDIT_INTERVAL_MS } from "./team-credits";

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
          UPDATE "teams"
          SET
            "credits" = "credits" + FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "lastCreditGrantedAt")) / 900)::integer,
            "lastCreditGrantedAt" = "lastCreditGrantedAt" + FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "lastCreditGrantedAt")) / 900)::integer * INTERVAL '15 minutes'
          WHERE "deletedAt" IS NULL
            AND "lastCreditGrantedAt" <= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
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

    if (team.repo)
      await this.githubApiService.deleteRepository(
        team.repo,
        team.event.githubOrg,
        team.event.githubOrgSecret,
      );

    return this.teamRepository.softDelete(teamId);
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

  getTeamsUserIsInvitedTo(
    userId: string,
    eventId: string,
  ): Promise<TeamEntity[]> {
    return this.teamRepository.find({
      where: {
        event: {
          id: eventId,
        },
        teamInvites: {
          id: userId,
        },
      },
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
        "team.queueScore",
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
          "team.queueScore",
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
        "queueScore",
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

    // Map properties from raw if entity is missing them due to partial select
    const teamsWithCounts = await Promise.all(
      result.entities.map(async (team, idx) => {
        const raw = result.raw[idx];

        const mappedTeam: TeamEntity & {
          userCount: number;
          score: number;
          buchholzPoints: number;
        } = {
          ...team,
          hadBye: team.hadBye,
          userCount: parseInt(raw.user_count, 10) || 0,
          score: 0,
          buchholzPoints: 0,
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

  async joinQueue(teamId: string) {
    return this.dataSource.transaction(async (entityManager) => {
      const team = await entityManager.findOneOrFail(TeamEntity, {
        where: { id: teamId },
        lock: { mode: "pessimistic_write" },
      });

      accrueQueueCredits(team);
      if (team.inQueue)
        throw new BadRequestException("You are already in the queue.");
      if (await this.hasActiveQueueMatch([teamId], entityManager))
        throw new BadRequestException(
          "Your team already has a match in progress.",
        );
      if (team.credits < 1)
        throw new BadRequestException(
          "Your team needs at least one credit to join the queue.",
        );

      team.credits -= 1;
      team.inQueue = true;
      return entityManager.save(team);
    });
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

  async getQueueState(teamId: string) {
    const team = await this.dataSource.transaction(async (entityManager) => {
      const lockedTeam = await entityManager.findOneOrFail(TeamEntity, {
        where: { id: teamId },
        lock: { mode: "pessimistic_write" },
      });
      if (accrueQueueCredits(lockedTeam) > 0)
        await entityManager.save(lockedTeam);
      return lockedTeam;
    });

    const match = await this.matchService.getLastQueueMatchForTeam(teamId);
    const queueCount = await this.teamRepository.countBy({
      inQueue: true,
      event: {
        id: team.eventId,
      },
    });
    return {
      match: match,
      queueCount: queueCount,
      inQueue: team.inQueue,
      credits: team.credits,
      nextCreditAt: new Date(
        team.lastCreditGrantedAt.getTime() + QUEUE_CREDIT_INTERVAL_MS,
      ),
    };
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
      if (challenger.inQueue || target.inQueue)
        throw new BadRequestException(
          "Neither team can be waiting in the queue when a direct match starts.",
        );
      if (
        await this.hasActiveQueueMatch(
          [challenger.id, target.id],
          entityManager,
        )
      )
        throw new BadRequestException(
          "One of these teams already has a match in progress.",
        );

      accrueQueueCredits(challenger);
      if (challenger.credits < DIRECT_MATCH_COST)
        throw new BadRequestException(
          `Your team needs at least ${DIRECT_MATCH_COST} credits to play a direct match.`,
        );
      challenger.credits -= DIRECT_MATCH_COST;
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
    creditWagerTeam: TeamEntity,
  ) {
    const matchRepository = entityManager.getRepository(MatchEntity);
    return matchRepository.save(
      matchRepository.create({
        teams: teamIds.map((id) => ({ id })),
        round: 0,
        phase: MatchPhase.QUEUE,
        state: MatchState.PLANNED,
        creditWager: DIRECT_MATCH_STAKE,
        creditWagerTeam,
        stats: new MatchStatsEntity(),
      }),
    );
  }

  private async hasActiveQueueMatch(
    teamIds: string[],
    entityManager: EntityManager,
  ) {
    return (
      (await entityManager
        .getRepository(MatchEntity)
        .createQueryBuilder("match")
        .innerJoin("match.teams", "team")
        .where("team.id IN (:...teamIds)", { teamIds })
        .andWhere("match.phase = :phase", { phase: MatchPhase.QUEUE })
        .andWhere("match.state IN (:...states)", {
          states: [MatchState.PLANNED, MatchState.IN_PROGRESS],
        })
        .getCount()) > 0
    );
  }

  async removeFromQueue(teamId: string) {
    return this.teamRepository.update(teamId, { inQueue: false });
  }

  async setQueueScore(teamId: string, score: number) {
    return this.teamRepository.update(teamId, { queueScore: score });
  }

  async getTeamsInQueue(eventId: string): Promise<TeamEntity[]> {
    return this.teamRepository.find({
      where: {
        event: {
          id: eventId,
        },
        inQueue: true,
      },
      order: {
        name: "ASC",
      },
    });
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

  async leaveQueue(teamId: string) {
    return this.teamRepository.update(teamId, { inQueue: false });
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
