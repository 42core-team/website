import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { TeamEntity } from "./entities/team.entity";
import {
  DataSource,
  EntityManager,
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
import { EventEntity } from "../event/entities/event.entity";

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
  ) { }

  logger = new Logger("TeamService");

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

              if (team.event && !team.event.showConfigs) {
                await entityManager.getRepository(EventEntity).update(team.event.id, {
                  showConfigs: true,
                });
              }
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
      },
    });

    if (!team.event) {
      this.logger.error(
        `While creating repo for team ${teamId}, event was not found.`,
      );
      return;
    }

    const repoName = team.event.name + "-" + team.name + "-" + team.id;

    await this.githubApiService.createTeamRepository(
      repoName,
      team.name,
      team.users.map((user) => ({
        username: user.username,
        githubAccessToken: user.githubAccessToken,
      })),
      team.event.githubOrg,
      team.event.githubOrgSecret,
      team.id,
      team.event.monorepoUrl,
      team.event.monorepoVersion,
      team.event.myCoreBotDockerImage,
      team.event.visualizerDockerImage,
      team.event.id,
      team.event.basePath,
      team.event.gameConfig ?? "",
      team.event.serverConfig ?? "",
    );

    await teamRepository.update(teamId, {
      startedRepoCreationAt: new Date(),
    });
  }

  async createTeam(name: string, userId: string, eventId: string) {
    return await this.dataSource.transaction(async (entityManager) => {
      const teamRepository = entityManager.getRepository(TeamEntity);

      const newTeam = await teamRepository.save({
        name,
        event: { id: eventId },
        users: [{ id: userId }],
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
  ): Promise<
    Array<
      TeamEntity & {
        userCount: number;
      }
    >
  > {
    const query = this.teamRepository
      .createQueryBuilder("team")
      .innerJoin("team.event", "event")
      .leftJoin("team.users", "user")
      .where("event.id = :eventId", { eventId })
      .andWhere("team.deletedAt IS NULL")
      .select([
        "team.id",
        "team.name",
        "team.locked",
        "team.repo",
        "team.queueScore",
        "team.createdAt",
        "team.updatedAt",
      ])
      .addSelect("COUNT(user.id)", "userCount")
      .groupBy("team.id");

    if (searchName) {
      query.andWhere("team.name LIKE :searchName", {
        searchName: `%${searchName}%`,
      });
    }

    if (sortBy) {
      const direction = searchDir?.toUpperCase() === "DESC" ? "DESC" : "ASC";
      const validSortColumns = [
        "name",
        "locked",
        "repo",
        "queueScore",
        "createdAt",
        "updatedAt",
      ];
      if (validSortColumns.includes(sortBy)) {
        query.orderBy(`team.${sortBy}`, direction as "ASC" | "DESC");
      }
      if (sortBy === "membersCount") {
        query.orderBy("COUNT(user.id)", direction as "ASC" | "DESC");
      }
    }

    const result = await query.getRawAndEntities();
    return result.entities.map((team, idx) => ({
      ...team,
      userCount: parseInt(result.raw[idx].userCount, 10),
    }));
  }

  async joinQueue(teamId: string) {
    return this.teamRepository.update(teamId, { inQueue: true });
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

  setHadBye(teamId: string, hadBye: boolean) {
    return this.teamRepository.update(teamId, { hadBye });
  }

  async getQueueState(teamId: string) {
    const team = await this.getTeamById(teamId, {
      event: true,
    });

    const match = await this.matchService.getLastQueueMatchForTeam(teamId);
    const queueCount = await this.teamRepository.countBy({
      inQueue: true,
      event: {
        id: team.event.id,
      },
    });
    return {
      match: match,
      queueCount: queueCount,
      inQueue: team.inQueue,
    };
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
      if (!team.repo || !team.event)
        continue;

      for (const user of team.users) {
        if (!user.username)
          continue;

        await this.githubApiService.addWritePermissions(
          user.username,
          team.event.githubOrg,
          team.repo,
          team.event.githubOrgSecret,
        );
      }
    }

    return teams;
  }
}
