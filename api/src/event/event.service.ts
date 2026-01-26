import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventEntity } from "./entities/event.entity";
import {
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  UpdateResult,
} from "typeorm";
import { PermissionRole } from "../user/entities/user.entity";
import * as CryptoJS from "crypto-js";
import { ConfigService } from "@nestjs/config";
import { TeamService } from "../team/team.service";
import { FindOptionsRelations } from "typeorm/find-options/FindOptionsRelations";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventVersionDto } from "./dtos/eventVersionDto";
import { LockKeys } from "../constants";

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TeamService))
    private readonly teamService: TeamService,
    private readonly dataSource: DataSource,
  ) {}

  logger = new Logger("EventService");

  @Cron(CronExpression.EVERY_MINUTE)
  async autoLockEvents() {
    const lockKey = LockKeys.AUTO_LOCK_EVENTS;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const gotLock = await queryRunner.query(
        "SELECT pg_try_advisory_lock($1)",
        [lockKey],
      );

      if (gotLock[0].pg_try_advisory_lock) {
        try {
          const events = await this.eventRepository.findBy({
            lockedAt: IsNull(),
            repoLockDate: LessThanOrEqual(new Date()),
          });
          for (const event of events) {
            this.logger.log(
              `Locking event ${event.name} as it past its repoLockDate date.`,
            );
            await this.lockEvent(event.id);
          }
        } finally {
          await queryRunner.query("SELECT pg_advisory_unlock($1)", [lockKey]);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  getAllEvents(): Promise<EventEntity[]> {
    return this.eventRepository.find({
      where: {
        isPrivate: false,
      },
      order: {
        startDate: "ASC",
      },
    });
  }

  getAllEventsForQueue(): Promise<EventEntity[]> {
    return this.eventRepository.findBy({
      startDate: LessThanOrEqual(new Date()),
      endDate: MoreThanOrEqual(new Date()),
      processQueue: true,
    });
  }

  async getEventsForUser(userId: string): Promise<EventEntity[]> {
    return this.eventRepository.find({
      where: [
        {
          users: {
            id: userId,
          },
        },
        {
          teams: {
            users: {
              id: userId,
            },
          },
        },
      ],
      order: {
        startDate: "ASC",
      },
    });
  }

  async getEventById(
    id: string,
    relations: FindOptionsRelations<EventEntity> = {},
  ): Promise<EventEntity> {
    return await this.eventRepository.findOneOrFail({
      where: { id },
      relations,
    });
  }

  async getEventByTeamId(
    teamId: string,
    relations: FindOptionsRelations<EventEntity> = {},
  ): Promise<EventEntity> {
    return await this.eventRepository.findOneOrFail({
      where: {
        teams: {
          id: teamId,
        },
      },
      relations,
    });
  }

  async getEventVersion(id: string): Promise<EventVersionDto> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id },
    });

    return {
      gameServerVersion: event.gameServerDockerImage,
      myCoreBotVersion: event.myCoreBotDockerImage,
      visualizerVersion: event.visualizerDockerImage,
    };
  }

  createEvent(
    userId: string,
    name: string,
    description: string,
    githubOrg: string,
    githubOrgSecret: string,
    location: string,
    startDate: number,
    endDate: number,
    minTeamSize: number,
    maxTeamSize: number,
    gameServerDockerImage: string,
    myCoreBotDockerImage: string,
    visualizerDockerImage: string,
    monorepoUrl: string,
    monorepoVersion: string,
    isPrivate: boolean = false,
  ) {
    githubOrgSecret = CryptoJS.AES.encrypt(
      githubOrgSecret,
      this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
    ).toString();

    return this.eventRepository.save({
      name,
      description,
      githubOrg,
      githubOrgSecret,
      location,
      minTeamSize,
      maxTeamSize,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      permissions: [
        {
          user: {
            id: userId,
          },
          role: PermissionRole.ADMIN,
        },
      ],
      users: [
        {
          id: userId,
        },
      ],
      gameServerDockerImage,
      myCoreBotDockerImage,
      visualizerDockerImage,
      monorepoUrl,
      monorepoVersion,
      isPrivate,
    });
  }

  increaseEventRound(eventId: string): Promise<UpdateResult> {
    return this.eventRepository.increment({ id: eventId }, "currentRound", 1);
  }

  isEventPublic(eventId: string): Promise<boolean> {
    return this.eventRepository.existsBy({
      id: eventId,
      isPrivate: false,
    });
  }

  async isUserRegisteredForEvent(eventId: string, userId: string) {
    /**
     * for public events, all users are considered registered
     */
    if (await this.isEventPublic(eventId)) return true;
    return await this.eventRepository.existsBy({
      id: eventId,
      users: {
        id: userId,
      },
    });
  }

  isEventAdmin(eventId: string, userId: string): Promise<boolean> {
    return this.eventRepository.existsBy({
      id: eventId,
      permissions: {
        user: {
          id: userId,
        },
        role: PermissionRole.ADMIN,
      },
    });
  }

  async lockEvent(eventId: string) {
    const event = await this.eventRepository.findOneOrFail({
      where: {
        id: eventId,
      },
      relations: {
        teams: true,
      },
    });

    await Promise.all(
      event.teams.map(async (team) => {
        try {
          await this.teamService.lockTeam(team.id);
        } catch (e) {
          this.logger.error(
            `Failed to lock team ${team.id} for event ${eventId}`,
            e,
          );
        }
      }),
    );

    return this.eventRepository.update(eventId, {
      canCreateTeam: false,
      lockedAt: new Date(),
      processQueue: false,
    });
  }

  async setCurrentRound(eventId: string, round: number): Promise<UpdateResult> {
    return this.eventRepository.update(eventId, {
      currentRound: round,
    });
  }

  async setTeamsLockedDate(
    eventId: string,
    date: Date | null,
  ): Promise<UpdateResult> {
    return this.eventRepository.update(eventId, {
      repoLockDate: date,
    });
  }

  async getCurrentLiveEvent() {
    const qb = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.users", "user")
      .where("event.isPrivate = false")
      .andWhere("event.startDate <= :now", { now: new Date() })
      .andWhere("event.endDate >= :now", { now: new Date() })
      .andWhere("event.canCreateTeam = true")
      .addSelect("COUNT(user.id)", "user_count")
      .groupBy("event.id, user.id")
      .orderBy("user_count", "DESC")
      .limit(1);

    return qb.getOne();
  }

  async hasEventStarted(eventId: string): Promise<boolean> {
    if (!eventId) return false;

    return await this.eventRepository.existsBy({
      id: eventId,
      startDate: LessThanOrEqual(new Date()),
    });
  }

  canCreateTeamInEvent(eventId: string): Promise<boolean> {
    return this.eventRepository.existsBy({
      id: eventId,
      canCreateTeam: true,
    });
  }
}
