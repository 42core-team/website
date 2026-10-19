import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventEntity } from "./entities/event.entity";
import { assertImageExists } from "./image.util";
import { EventStarterTemplateEntity } from "./entities/event-starter-template.entity";
import { EventWhitelistEntity } from "./entities/event-whitelist.entity";
import {
  DataSource,
  In,
  LessThanOrEqual,
  Repository,
  type FindOptionsRelations,
  UpdateResult,
} from "typeorm";
import {
  PermissionRole,
  UserEventPermissionEntity,
} from "../user/entities/user.entity";
import { ConfigService } from "@nestjs/config";
import { TeamService } from "../team/team.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventVersionDto } from "./dtos/eventVersionDto";
import { LockKeys } from "../constants";
import { WhitelistPlatform } from "./entities/event-whitelist.entity";
import { encryptSecret } from "../common/encryption";
import {
  EventState,
  getEventState,
  isRegistrationOpen,
} from "./event-lifecycle";
import { EventLifecycleDto } from "./dtos/eventLifecycleDto";
import { TeamEntity } from "../team/entities/team.entity";

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserEventPermissionEntity)
    private readonly permissionRepository: Repository<UserEventPermissionEntity>,
    @InjectRepository(EventStarterTemplateEntity)
    private readonly templateRepository: Repository<EventStarterTemplateEntity>,
    @InjectRepository(EventWhitelistEntity)
    private readonly whitelistRepository: Repository<EventWhitelistEntity>,
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
            state: In([EventState.REGISTRATION, EventState.PLAYING]),
          });
          for (const event of events) {
            try {
              const state = getEventState(event);
              if (state === EventState.SUBMISSIONS_CLOSED)
                await this.lockEvent(event.id, true);
              else if (state !== event.state)
                await this.eventRepository.update(
                  { id: event.id, state: event.state },
                  { state },
                );
            } catch (error) {
              this.logger.error(`Failed to advance event ${event.id}`, error);
            }
          }
          await this.refreshRepositoryLockConfirmations();
        } finally {
          await queryRunner.query("SELECT pg_advisory_unlock($1)", [lockKey]);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  private async refreshRepositoryLockConfirmations() {
    // The schedule closes submissions immediately; lockedAt describes confirmed
    // external access, not message dispatch. Recompute it as callbacks arrive.
    await this.dataSource.query(`
      UPDATE "events" AS event
      SET "lockedAt" = CASE WHEN NOT EXISTS (
        SELECT 1 FROM "teams" AS team
        WHERE team."eventId" = event.id
          AND team."deletedAt" IS NULL
          AND NOT team."tournamentExcluded"
          AND team."repositoryStatus" <> 'LOCKED'
      ) THEN COALESCE(event."lockedAt", CURRENT_TIMESTAMP) ELSE NULL END
      WHERE event.state IN ('SUBMISSIONS_CLOSED', 'SHOWCASE', 'COMPLETED')
    `);
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

  async getEventsOverviewForUser(userId: string): Promise<{
    allEvents: EventEntity[];
    myEvents: EventEntity[];
  }> {
    const [allEvents, myEvents] = await Promise.all([
      this.getAllEvents(),
      this.getEventsForUser(userId),
    ]);

    return { allEvents, myEvents };
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
    event.state = getEventState(event);
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

  async getStarterTemplateVersions(id: string) {
    const templates = await this.templateRepository.find({
      where: { event: { id } },
      select: {
        name: true,
        myCoreBotDockerImage: true,
      },
    });

    return templates.map((t) => ({
      name: t.name,
      version: t.myCoreBotDockerImage,
    }));
  }

  async getTemplateVersion(
    eventId: string,
    templateId: string,
  ): Promise<EventVersionDto> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      select: {
        gameServerDockerImage: true,
        visualizerDockerImage: true,
      },
    });

    const template = await this.templateRepository.findOneOrFail({
      where: { id: templateId, event: { id: eventId } },
      select: {
        id: true,
        myCoreBotDockerImage: true,
      },
    });

    return {
      gameServerVersion: event.gameServerDockerImage,
      myCoreBotVersion: template.myCoreBotDockerImage,
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

  async createEvent(
    userId: string,
    name: string,
    description: string,
    githubOrg: string,
    githubOrgSecret: string,
    location: string,
    startDate: number,
    endDate: number | undefined,
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
    lifecycle: {
      submissionDeadline?: number;
      scheduledEndDate?: number;
      introEnabled?: boolean;
      introLeadMinutes?: number;
    } = {},
  ) {
    const dates = {
      startDate: new Date(startDate),
      submissionDeadline: new Date(
        lifecycle.submissionDeadline ?? endDate ?? NaN,
      ),
      scheduledEndDate: new Date(lifecycle.scheduledEndDate ?? endDate ?? NaN),
      introEnabled: lifecycle.introEnabled ?? false,
      introLeadMinutes: lifecycle.introLeadMinutes ?? 15,
    };
    this.validateLifecycleDates(dates);
    await Promise.all(
      [gameServerDockerImage, myCoreBotDockerImage, visualizerDockerImage].map(
        assertImageExists,
      ),
    );

    githubOrgSecret = encryptSecret(
      githubOrgSecret,
      this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
    );

    return this.eventRepository.save({
      name,
      description,
      githubOrg,
      githubOrgSecret,
      location,
      minTeamSize,
      maxTeamSize,
      ...dates,
      state: getEventState(dates),
      canCreateTeam: isRegistrationOpen(dates),
      processQueue: isRegistrationOpen(dates),
      gamblingEnabled: isRegistrationOpen(dates),
      endDate: dates.scheduledEndDate,
      repoLockDate: dates.submissionDeadline,
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

  async getStarterTemplates(eventId: string) {
    return this.templateRepository.find({
      where: { event: { id: eventId } },
    });
  }

  isStarterTemplateInEvent(
    templateId: string,
    eventId: string,
  ): Promise<boolean> {
    return this.templateRepository.existsBy({
      id: templateId,
      event: { id: eventId },
    });
  }

  async createStarterTemplate(
    eventId: string,
    name: string,
    basePath: string,
    myCoreBotDockerImage: string,
  ) {
    await assertImageExists(myCoreBotDockerImage);

    const event = await this.getEventById(eventId);
    const template = this.templateRepository.create({
      name,
      basePath,
      myCoreBotDockerImage,
      event,
    });
    return this.templateRepository.save(template);
  }

  async updateStarterTemplate(
    eventId: string,
    templateId: string,
    data: { name?: string; basePath?: string; myCoreBotDockerImage?: string },
  ) {
    const template = await this.templateRepository.findOneOrFail({
      where: { id: templateId, event: { id: eventId } },
    });

    if (data.name) template.name = data.name;
    if (data.basePath) template.basePath = data.basePath;
    if (data.myCoreBotDockerImage) {
      await assertImageExists(data.myCoreBotDockerImage);
      template.myCoreBotDockerImage = data.myCoreBotDockerImage;
    }

    return this.templateRepository.save(template);
  }

  async deleteStarterTemplate(eventId: string, templateId: string) {
    try {
      await this.templateRepository.delete({
        id: templateId,
        event: { id: eventId },
      });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "23503") {
        throw new ConflictException(
          "Cannot delete template because it is still in use by one or more teams.",
        );
      }
      throw e;
    }
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

  async lockEvent(eventId: string, scheduled = false): Promise<UpdateResult> {
    const closure = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EventEntity);
      // Use the same row lock as manual lifecycle transitions. The cron snapshot
      // may predate a reopen or deadline extension, so it cannot authorize closure.
      const event = await repository.findOneOrFail({
        where: { id: eventId },
        lock: { mode: "pessimistic_write" },
      });
      if (
        scheduled &&
        (![EventState.REGISTRATION, EventState.PLAYING].includes(event.state) ||
          !(event.submissionDeadline <= new Date()))
      )
        return null;
      if ([EventState.SHOWCASE, EventState.COMPLETED].includes(event.state)) {
        throw new BadRequestException(
          "Reopen the event before closing submissions again",
        );
      }
      const result = await repository.update(eventId, {
        state: EventState.SUBMISSIONS_CLOSED,
        canCreateTeam: false,
        processQueue: false,
        lockedAt: null,
      });
      const teams = await manager.getRepository(TeamEntity).find({
        where: { event: { id: eventId } },
      });
      return { result, teams };
    });
    if (!closure) return { affected: 0, generatedMaps: [], raw: [] };
    // Commit disabled capabilities before dispatching asynchronous repository work.
    await Promise.all(
      closure.teams.map(async (team) => {
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

    return closure.result;
  }

  async unlockEvent(eventId: string) {
    const event = await this.getEventById(eventId);
    return this.transitionLifecycle(eventId, {
      action: "reopen",
      submissionDeadline: event.submissionDeadline?.getTime(),
    });
  }

  async setCurrentRound(eventId: string, round: number): Promise<UpdateResult> {
    return this.eventRepository.update(eventId, {
      currentRound: round,
    });
  }

  private validateLifecycleDates(
    event: Pick<
      EventEntity,
      | "startDate"
      | "submissionDeadline"
      | "scheduledEndDate"
      | "introEnabled"
      | "introLeadMinutes"
    >,
  ) {
    if (
      ![
        event.startDate,
        event.submissionDeadline,
        event.scheduledEndDate,
      ].every((date) => date instanceof Date && Number.isFinite(date.getTime()))
    ) {
      throw new BadRequestException(
        "Valid startDate, submissionDeadline and scheduledEndDate are required",
      );
    }
    if (
      event.submissionDeadline <= event.startDate ||
      event.scheduledEndDate < event.startDate
    ) {
      throw new BadRequestException(
        "Submission deadline must follow start; scheduled end cannot precede start",
      );
    }
    if (
      !Number.isInteger(event.introLeadMinutes) ||
      event.introLeadMinutes < 0
    ) {
      throw new BadRequestException(
        "introLeadMinutes must be a nonnegative integer",
      );
    }
  }

  async transitionLifecycle(eventId: string, request: EventLifecycleDto) {
    const now = new Date();
    const result = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EventEntity);
      const event = await repository.findOneOrFail({
        where: { id: eventId },
        lock: { mode: "pessimistic_write" },
      });
      const state = getEventState(event, now);
      if (request.action === "reopen") {
        if (state === EventState.REGISTRATION || state === EventState.PLAYING) {
          throw new BadRequestException(
            "Only post-playing events can be reopened",
          );
        }
        const deadline = new Date(request.submissionDeadline ?? NaN);
        if (
          !Number.isFinite(deadline.getTime()) ||
          deadline <= now ||
          deadline <= event.startDate
        ) {
          throw new BadRequestException(
            "Reopening requires a future submissionDeadline after the start date",
          );
        }
        await repository.update(eventId, {
          state: EventState.PLAYING,
          submissionDeadline: deadline,
          repoLockDate: deadline,
          completedAt: null,
          lockedAt: null,
          canCreateTeam: true,
          processQueue: true,
          gamblingEnabled: true,
        });
        // Persist desired access with the transition so reconciliation can resume
        // unlocking even if the process stops before dispatching GitHub work.
        await manager
          .getRepository(TeamEntity)
          .update({ event: { id: eventId } }, { locked: false });
      } else if (request.action === "showcase") {
        if (state !== EventState.SUBMISSIONS_CLOSED)
          throw new BadRequestException("Showcase requires closed submissions");
        const teams = await manager
          .getRepository(TeamEntity)
          .find({ where: { event: { id: eventId } } });
        if (
          teams.some(
            (team) =>
              !team.tournamentExcluded && team.repositoryStatus !== "LOCKED",
          )
        ) {
          throw new ConflictException(
            "All nonexcluded team repositories must be confirmed LOCKED",
          );
        }
        await repository.update(eventId, {
          state: EventState.SHOWCASE,
          lockedAt: now,
          canCreateTeam: false,
          processQueue: false,
        });
      } else if (request.action === "complete") {
        if (state !== EventState.SHOWCASE)
          throw new BadRequestException(
            "Only showcase events can be completed",
          );
        await repository.update(eventId, {
          state: EventState.COMPLETED,
          completedAt: now,
          canCreateTeam: false,
          processQueue: false,
        });
      } else {
        throw new BadRequestException("Unknown lifecycle action");
      }
      return repository.findOneByOrFail({ id: eventId });
    });
    if (request.action === "reopen")
      await this.teamService.unlockTeamsForEvent(eventId);
    await this.sanitizeEventConfigs(result);
    return result;
  }

  async retryRepositoryOperation(eventId: string, teamId: string) {
    await this.dataSource
      .getRepository(TeamEntity)
      .findOneOrFail({ where: { id: teamId, event: { id: eventId } } });
    return this.teamService.retryRepositoryOperation(teamId);
  }

  async setTeamExclusion(eventId: string, teamId: string, excluded: boolean) {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.getRepository(EventEntity).findOneOrFail({
        where: { id: eventId },
        lock: { mode: "pessimistic_write" },
      });
      if (getEventState(event) !== EventState.SUBMISSIONS_CLOSED)
        throw new BadRequestException(
          "Tournament exclusions can only change while submissions are closed",
        );
      const repository = manager.getRepository(TeamEntity);
      await repository.findOneOrFail({
        where: { id: teamId, event: { id: eventId } },
      });
      await repository.update(teamId, { tournamentExcluded: excluded });
      return repository.findOneByOrFail({ id: teamId });
    });
  }

  async setTeamsLockedDate(
    eventId: string,
    date: Date | null,
  ): Promise<UpdateResult> {
    if (!date)
      throw new BadRequestException("A submission deadline is required");
    return this.updateEventSettings(eventId, {
      submissionDeadline: date.getTime(),
    });
  }

  async updateEventSettings(
    eventId: string,
    settings: {
      canCreateTeam?: boolean;
      processQueue?: boolean;
      gamblingEnabled?: boolean;
      maxQueueCredits?: number;
      queueCreditIntervalMinutes?: number;
      isPrivate?: boolean;
      name?: string;
      description?: string;
      githubOrg?: string;
      githubOrgSecret?: string;
      location?: string;
      startDate?: number;
      endDate?: number;
      submissionDeadline?: number;
      scheduledEndDate?: number;
      introEnabled?: boolean;
      introLeadMinutes?: number;
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
    const event = await this.getEventById(eventId);

    const update: Partial<EventEntity> = {};

    const booleanFields = [
      "canCreateTeam",
      "processQueue",
      "gamblingEnabled",
      "isPrivate",
      "introEnabled",
    ] as const;
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

    await Promise.all(
      [
        update.gameServerDockerImage,
        update.myCoreBotDockerImage,
        update.visualizerDockerImage,
      ].map(assertImageExists),
    );

    if (settings.githubOrgSecret) {
      update.githubOrgSecret = encryptSecret(
        settings.githubOrgSecret,
        this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
      );
    }

    const numberFields = [
      "minTeamSize",
      "maxTeamSize",
      "maxQueueCredits",
      "queueCreditIntervalMinutes",
      "introLeadMinutes",
    ] as const;
    for (const field of numberFields) {
      if (typeof settings[field] === "number") {
        update[field] = settings[field];
      }
    }

    if (settings.startDate !== undefined) {
      update.startDate = new Date(settings.startDate);
    }
    if (
      settings.scheduledEndDate !== undefined ||
      settings.endDate !== undefined
    ) {
      update.scheduledEndDate = new Date(
        settings.scheduledEndDate ?? settings.endDate!,
      );
      update.endDate = update.scheduledEndDate;
    }
    if (settings.submissionDeadline !== undefined) {
      if (!isRegistrationOpen(event))
        throw new BadRequestException(
          "Use reopen to change a closed event's deadline",
        );
      update.submissionDeadline = new Date(settings.submissionDeadline);
      update.repoLockDate = update.submissionDeadline;
    }
    if (
      settings.startDate !== undefined ||
      settings.submissionDeadline !== undefined ||
      settings.scheduledEndDate !== undefined ||
      settings.endDate !== undefined ||
      settings.introEnabled !== undefined ||
      settings.introLeadMinutes !== undefined
    ) {
      this.validateLifecycleDates({ ...event, ...update });
    }
    if (
      !isRegistrationOpen(event) &&
      (settings.canCreateTeam === true ||
        settings.processQueue === true ||
        settings.gamblingEnabled === true)
    ) {
      throw new BadRequestException(
        "Reopen the event to enable playing capabilities",
      );
    }

    if (Object.keys(update).length === 0) {
      return {
        generatedMaps: [],
        raw: [],
        affected: 0,
      };
    }

    if (update.startDate) {
      return this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(EventEntity);
        const current = await repository.findOneOrFail({
          where: { id: eventId },
          lock: { mode: "pessimistic_write" },
        });
        const now = new Date();
        this.validateLifecycleDates({ ...current, ...update });
        update.state = getEventState({ ...current, ...update }, now);
        return repository.update(eventId, update);
      });
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
    await this.dataSource.transaction(async (manager) => {
      // Re-query admin permissions with a row-level lock (FOR UPDATE).
      // manager.find() with relations produces a LEFT JOIN which PostgreSQL
      // rejects with FOR UPDATE, so use a query builder with INNER JOIN instead.
      const admins = await manager
        .createQueryBuilder(UserEventPermissionEntity, "perm")
        .innerJoinAndSelect("perm.user", "user")
        .where("perm.eventId = :eventId", { eventId })
        .andWhere("perm.role = :role", { role: PermissionRole.ADMIN })
        .setLock("pessimistic_write")
        .getMany();

      const permissionToRemove = admins.find((p) => p.user.id === userId);

      if (!permissionToRemove) {
        throw new NotFoundException("Admin permission not found");
      }

      if (admins.length <= 1) {
        throw new BadRequestException(
          "Cannot remove the last admin of an event",
        );
      }

      await manager.remove(permissionToRemove);
    });
  }

  async getCurrentLiveEvent() {
    const qb = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.users", "user")
      .where("event.isPrivate = false")
      .andWhere("event.startDate <= :now", { now: new Date() })
      .andWhere("event.submissionDeadline > :now", { now: new Date() })
      .andWhere("event.state IN (:...states)", {
        states: [EventState.REGISTRATION, EventState.PLAYING],
      })
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

  async canCreateTeamInEvent(eventId: string): Promise<boolean> {
    const event = await this.eventRepository.findOneBy({ id: eventId });
    return !!event && event.canCreateTeam && isRegistrationOpen(event);
  }

  async getWhitelist(eventId: string): Promise<EventWhitelistEntity[]> {
    return this.whitelistRepository.find({
      where: { event: { id: eventId } },
      order: { createdAt: "DESC" },
    });
  }

  async addToWhitelist(
    eventId: string,
    entries: { username: string; platform: WhitelistPlatform }[],
  ): Promise<EventWhitelistEntity[]> {
    const event = await this.getEventById(eventId);
    const normalizedEntries = entries
      .map((entry) => ({
        username: entry.username.trim().toLowerCase(),
        platform: entry.platform,
      }))
      .filter((entry) => entry.username.length > 0);

    const toKey = (e: { username: string; platform: WhitelistPlatform }) =>
      `${e.username}:${e.platform}`;

    const uniqueInputEntries = [
      ...new Map(normalizedEntries.map((e) => [toKey(e), e])).values(),
    ];

    const existingEntries = await this.whitelistRepository.find({
      where: {
        event: { id: eventId },
      },
    });

    const existingSet = new Set(existingEntries.map(toKey));

    const newEntries = uniqueInputEntries.filter(
      (entry) => !existingSet.has(toKey(entry)),
    );

    if (newEntries.length === 0) {
      return [];
    }

    const whitelistEntries = newEntries.map((entry) =>
      this.whitelistRepository.create({
        event,
        username: entry.username,
        platform: entry.platform,
      }),
    );

    try {
      return await this.whitelistRepository.save(whitelistEntries);
    } catch (error) {
      // Handle race condition: if unique constraint is violated (e.g., Postgres 23505),
      // entries were added concurrently, so return empty array as no-op
      const databaseError = error as { code?: string; message?: string };
      if (
        databaseError.code === "23505" ||
        databaseError.message?.includes("duplicate key")
      ) {
        return [];
      }
      throw error;
    }
  }

  async removeFromWhitelist(
    eventId: string,
    whitelistId: string,
  ): Promise<void> {
    await this.whitelistRepository.delete({
      id: whitelistId,
      event: { id: eventId },
    });
  }

  async bulkRemoveFromWhitelist(eventId: string, ids: string[]): Promise<void> {
    await this.whitelistRepository.delete({
      id: In(ids),
      event: { id: eventId },
    });
  }

  async hasWhitelist(eventId: string): Promise<boolean> {
    return this.whitelistRepository.existsBy({
      event: { id: eventId },
    });
  }

  async isUserWhitelisted(
    eventId: string,
    githubUsername: string,
    fortyTwoUsername: string | null,
  ): Promise<boolean> {
    if (!(await this.hasWhitelist(eventId))) {
      return true;
    }

    const conditions: { username: string; platform: WhitelistPlatform }[] = [
      {
        username: githubUsername.trim().toLowerCase(),
        platform: WhitelistPlatform.GITHUB,
      },
    ];

    if (fortyTwoUsername) {
      conditions.push({
        username: fortyTwoUsername.trim().toLowerCase(),
        platform: WhitelistPlatform.FORTYTWO,
      });
    }

    return this.whitelistRepository.existsBy(
      conditions.map((cond) => ({
        event: { id: eventId },
        username: cond.username,
        platform: cond.platform,
      })),
    );
  }
}
