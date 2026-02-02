import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
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
import { PermissionRole, UserEventPermissionEntity } from "../user/entities/user.entity";
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
    @InjectRepository(UserEventPermissionEntity)
    private readonly permissionRepository: Repository<UserEventPermissionEntity>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TeamService))
    private readonly teamService: TeamService,
    private readonly dataSource: DataSource,
  ) { }

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

  async getAllEvents(): Promise<EventEntity[]> {
    const events = await this.eventRepository.find({
      where: {
        isPrivate: false,
      },
      order: {
        startDate: "ASC",
      },
    });

    for (const event of events) {
      await this.sanitizeEventConfigs(event);
    }

    return events;
  }

  getAllEventsForQueue(): Promise<EventEntity[]> {
    return this.eventRepository.findBy({
      startDate: LessThanOrEqual(new Date()),
      endDate: MoreThanOrEqual(new Date()),
      processQueue: true,
    });
  }

  async getEventsForUser(userId: string): Promise<EventEntity[]> {
    const events = await this.eventRepository.find({
      where: [
        {
          users: { id: userId },
        },
        {
          teams: {
            users: { id: userId },
          },
        },
      ],
      order: {
        startDate: "ASC",
      },
    });

    for (const event of events) {
      await this.sanitizeEventConfigs(event);
    }
    return events;
  }

  async getEventById(
    id: string,
    relations: FindOptionsRelations<EventEntity> = {},
  ): Promise<EventEntity> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id },
      relations,
    });

    await this.sanitizeEventConfigs(event);

    return event;
  }

  private async sanitizeEventConfigs(event: EventEntity) {
    if (event.startDate > new Date()) {
      event.gameConfig = "";
      event.serverConfig = "";
    }
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
      select: {
        gameServerDockerImage: true,
        myCoreBotDockerImage: true,
        visualizerDockerImage: true,
      },
    });

    return {
      gameServerVersion: event.gameServerDockerImage,
      myCoreBotVersion: event.myCoreBotDockerImage,
      visualizerVersion: event.visualizerDockerImage,
    };
  }

  async getEventGameConfig(id: string): Promise<string | null> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id },
      select: {
        gameConfig: true,
        startDate: true,
      },
    });
    if (event.startDate > new Date()) return null;
    return event.gameConfig;
  }

  async getEventServerConfig(id: string): Promise<string | null> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id },
      select: {
        serverConfig: true,
        startDate: true,
      },
    });
    if (event.startDate > new Date()) return null;
    return event.serverConfig;
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
    basePath: string,
    gameConfig: string,
    serverConfig: string,
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
      basePath,
      gameConfig,
      serverConfig,
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

  async unlockEvent(eventId: string) {
    await this.getEventById(eventId);
    await this.teamService.unlockTeamsForEvent(eventId);
    return this.eventRepository.update(eventId, {
      canCreateTeam: true,
      lockedAt: null,
      processQueue: true,
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

  async updateEventSettings(
    eventId: string,
    settings: {
      canCreateTeam?: boolean;
      processQueue?: boolean;
      isPrivate?: boolean;
      name?: string;
      description?: string;
      githubOrg?: string;
      githubOrgSecret?: string;
      location?: string;
      startDate?: number;
      endDate?: number;
      minTeamSize?: number;
      maxTeamSize?: number;
      gameServerDockerImage?: string;
      myCoreBotDockerImage?: string;
      visualizerDockerImage?: string;
      monorepoUrl?: string;
      monorepoVersion?: string;
      basePath?: string;
      gameConfig?: string;
      serverConfig?: string;
    },
  ): Promise<UpdateResult> {
    await this.getEventById(eventId);

    const update: Partial<EventEntity> = {};

    const booleanFields = ["canCreateTeam", "processQueue", "isPrivate"] as const;
    for (const field of booleanFields) {
      if (typeof settings[field] === "boolean") {
        update[field] = settings[field];
      }
    }

    const stringFields = [
      "name",
      "description",
      "githubOrg",
      "location",
      "gameServerDockerImage",
      "myCoreBotDockerImage",
      "visualizerDockerImage",
      "monorepoUrl",
      "monorepoVersion",
      "basePath",
      "gameConfig",
      "serverConfig",
    ] as const;
    for (const field of stringFields) {
      if (typeof settings[field] === "string") {
        update[field] = settings[field];
      }
    }

    if (settings.githubOrgSecret) {
      update.githubOrgSecret = CryptoJS.AES.encrypt(
        settings.githubOrgSecret,
        this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
      ).toString();
    }

    const numberFields = ["minTeamSize", "maxTeamSize"] as const;
    for (const field of numberFields) {
      if (typeof settings[field] === "number") {
        update[field] = settings[field];
      }
    }

    if (settings.startDate) {
      update.startDate = new Date(settings.startDate);
    }
    if (settings.endDate) {
      update.endDate = new Date(settings.endDate);
    }

    if (Object.keys(update).length === 0) {
      return {
        generatedMaps: [],
        raw: [],
        affected: 0,
      };
    }

    return this.eventRepository.update(eventId, update);
  }

  async getEventAdmins(eventId: string) {
    const permissions = await this.permissionRepository.find({
      where: {
        event: { id: eventId },
        role: PermissionRole.ADMIN,
      },
      relations: {
        user: true,
      },
    });
    return permissions.map((p) => p.user);
  }

  async addEventAdmin(eventId: string, userId: string) {
    const existing = await this.permissionRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    if (existing) {
      if (existing.role === PermissionRole.ADMIN) return;
      existing.role = PermissionRole.ADMIN;
      await this.permissionRepository.save(existing);
      return;
    }

    await this.permissionRepository.save({
      event: { id: eventId },
      user: { id: userId },
      role: PermissionRole.ADMIN,
    });
  }

  async removeEventAdmin(eventId: string, userId: string) {
    const permission = await this.permissionRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
        role: PermissionRole.ADMIN,
      },
    });

    if (!permission) {
      throw new NotFoundException("Admin permission not found");
    }

    // Check if this is the last admin
    const adminCount = await this.permissionRepository.count({
      where: {
        event: { id: eventId },
        role: PermissionRole.ADMIN,
      },
    });

    if (adminCount <= 1) {
      throw new BadRequestException("Cannot remove the last admin of an event");
    }

    await this.permissionRepository.remove(permission);
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

    const event = await qb.getOne();
    if (event) {
      await this.sanitizeEventConfigs(event);
    }
    return event;
  }

  async hasEventStarted(eventId: string): Promise<boolean> {
    if (!eventId) return false;

    return await this.eventRepository.existsBy({
      id: eventId,
      startDate: LessThanOrEqual(new Date()),
    });
  }

  async hasEventStartedForTeam(teamId: string): Promise<boolean> {
    if (!teamId) return false;

    return await this.eventRepository.existsBy({
      teams: {
        id: teamId,
      },
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
