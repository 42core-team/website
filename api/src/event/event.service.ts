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
import { isUserRegisteredForEvent } from "./event-registration";
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  Repository,
  type FindOptionsRelations,
  UpdateResult,
} from "typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { UserRole, UserRoleEntity } from "../user/entities/user-role.entity";
import { SocialPlatform } from "../user/entities/social-account.entity";
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
import { MatchEntity, MatchPhase } from "../match/entites/match.entity";
import { lockEvent } from "./event-lock";
import { toPublicUsers } from "../user/dtos/public-user.dto";
import { removeAdminGrant } from "../roles/admin-grants";

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly roleRepository: Repository<UserRoleEntity>,
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

  getAdminEvents({
    q = "",
    limit = 20,
  }: {
    q?: string;
    limit?: number;
  }): Promise<Pick<EventEntity, "id" | "name" | "isPrivate" | "startDate">[]> {
    return this.eventRepository
      .createQueryBuilder("event")
      .select(["event.id", "event.name", "event.isPrivate", "event.startDate"])
      .where("event.name ILIKE :name", {
        name: `%${q.replace(/[\\%_]/g, "\\$&")}%`,
      })
      .orderBy("event.startDate", "DESC")
      .addOrderBy("event.id", "ASC")
      .take(limit)
      .getMany();
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
    githubOrg: string | undefined,
    githubOrgSecret: string | undefined,
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
      streamUrl?: string;
      showtimeStreamUrl?: string;
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
    const streamUrl = normalizeStreamUrl(lifecycle.streamUrl);
    const showtimeStreamUrl = normalizeStreamUrl(
      lifecycle.showtimeStreamUrl,
      "showtimeStreamUrl",
    );
    await Promise.all(
      [gameServerDockerImage, myCoreBotDockerImage, visualizerDockerImage].map(
        assertImageExists,
      ),
    );

    return this.dataSource.transaction(async (manager) => {
      const event = await manager.getRepository(EventEntity).save({
        name,
        description,
        // Without a token the organization is set when the GitHub App is connected.
        githubOrg: githubOrgSecret ? githubOrg : "",
        githubOrgSecret: githubOrgSecret
          ? encryptSecret(
              githubOrgSecret,
              this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
            )
          : null,
        location,
        minTeamSize,
        maxTeamSize,
        ...dates,
        streamUrl,
        showtimeStreamUrl,
        state: getEventState(dates),
        canCreateTeam: isRegistrationOpen(dates),
        processQueue: isRegistrationOpen(dates),
        gamblingEnabled: isRegistrationOpen(dates),
        endDate: dates.scheduledEndDate,
        repoLockDate: dates.submissionDeadline,
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
      await manager.getRepository(UserRoleEntity).insert({
        userId,
        role: UserRole.ADMIN,
        eventId: event.id,
        grantedById: userId,
      });
      return event;
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
    return isUserRegisteredForEvent(this.eventRepository, eventId, userId);
  }

  /**
   * Whether the user may be part of a team in this event. Public events are
   * open to everyone. Private events require the user to be registered and,
   * when the event has a whitelist, to still be on it.
   */
  async isUserEligibleForEvent(
    eventId: string,
    userId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<boolean> {
    const event = await manager.findOne(EventEntity, {
      select: { id: true, isPrivate: true },
      where: { id: eventId },
      loadEagerRelations: false,
    });
    if (!event) return false;
    if (!event.isPrivate) return true;

    const user = await manager.findOne(UserEntity, {
      where: { id: userId, events: { id: eventId } },
      relations: { socialAccounts: true },
      loadEagerRelations: false,
    });
    if (!user) return false;
    const fortyTwoAccount = user.socialAccounts.find(
      (sa) => sa.platform === SocialPlatform.FORTYTWO,
    );
    return this.isUserWhitelisted(
      eventId,
      user.username,
      fortyTwoAccount?.username ?? null,
      manager,
    );
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

  /** Read-only, so coding allows it too; only code freeze can act on it. */
  async getRepositoryActivity(eventId: string) {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
    });
    const state = getEventState(event);
    if (state === EventState.SUBMISSIONS_CLOSED)
      await this.dataSource.transaction((manager) =>
        this.assertRepositoryActivityFilterOpen(manager, eventId),
      );
    else if (state !== EventState.PLAYING)
      throw new BadRequestException(
        "Repository activity can only be checked during coding or code freeze",
      );
    return this.teamService.getRepositoryActivityForEvent(eventId);
  }

  /**
   * Excludes the selected teams whose repositories are still inactive. It never
   * re-includes a team, so earlier manual decisions survive a repeated run.
   */
  async excludeInactiveTeams(eventId: string, teamIds: string[]) {
    await this.dataSource.transaction((manager) =>
      this.assertRepositoryActivityFilterOpen(manager, eventId),
    );
    const activity =
      await this.teamService.getRepositoryActivityForEvent(eventId);
    // Validation accepts uppercase UUIDs; stored ids are lowercase.
    const selected = new Set(teamIds.map((id) => id.toLowerCase()));
    const inactive = new Set(
      activity
        .filter(({ status }) => status === "inactive")
        .map(({ teamId }) => teamId),
    );
    return this.dataSource.transaction(async (manager) => {
      await this.assertRepositoryActivityFilterOpen(manager, eventId);
      const repository = manager.getRepository(TeamEntity);
      const participants = await repository.find({
        select: { id: true },
        where: { event: { id: eventId }, tournamentExcluded: false },
        loadEagerRelations: false,
      });
      const excludedTeamIds = participants
        .map((team) => team.id)
        .filter((id) => selected.has(id) && inactive.has(id));
      if (excludedTeamIds.length === 0) return { excludedTeamIds };
      if (participants.length - excludedTeamIds.length < 2)
        throw new BadRequestException(
          "Excluding these teams would leave fewer than 2 teams in the tournament",
        );
      await repository.update(
        { id: In(excludedTeamIds) },
        { tournamentExcluded: true },
      );
      return { excludedTeamIds };
    });
  }

  /** Entrants must stay fixed once the group phase has generated matches. */
  private async assertRepositoryActivityFilterOpen(
    manager: EntityManager,
    eventId: string,
  ) {
    await lockEvent(manager, eventId);
    const event = await manager.getRepository(EventEntity).findOneOrFail({
      where: { id: eventId },
      lock: { mode: "pessimistic_write" },
    });
    if (getEventState(event) !== EventState.SUBMISSIONS_CLOSED)
      throw new BadRequestException(
        "Inactive teams can only be excluded while submissions are closed",
      );
    const tournamentMatches = await manager.getRepository(MatchEntity).countBy({
      phase: In([MatchPhase.SWISS, MatchPhase.ELIMINATION]),
      teams: { event: { id: eventId } },
    });
    if (tournamentMatches > 0)
      throw new BadRequestException(
        "Repository activity cannot be applied after tournament matches exist",
      );
  }

  async updateEventSettings(
    eventId: string,
    settings: {
      canCreateTeam?: boolean;
      processQueue?: boolean;
      gamblingEnabled?: boolean;
      maxQueueCredits?: number;
      queueCreditIntervalMinutes?: number;
      tournamentAdvancementLimit?: number | null;
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
      streamUrl?: string;
      showtimeStreamUrl?: string;
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

    if (
      event.githubInstallationId &&
      (settings.githubOrgSecret ||
        (update.githubOrg !== undefined &&
          update.githubOrg.toLowerCase() !== event.githubOrg.toLowerCase()))
    )
      throw new BadRequestException(
        "This event uses the CORE GitHub App; its organization and access come from the App installation.",
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

    if (settings.tournamentAdvancementLimit !== undefined) {
      update.tournamentAdvancementLimit = settings.tournamentAdvancementLimit;
    }

    if (settings.streamUrl !== undefined) {
      update.streamUrl = normalizeStreamUrl(settings.streamUrl);
    }

    if (settings.showtimeStreamUrl !== undefined) {
      update.showtimeStreamUrl = normalizeStreamUrl(
        settings.showtimeStreamUrl,
        "showtimeStreamUrl",
      );
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

    const updatesLimit = update.tournamentAdvancementLimit !== undefined;
    if (update.startDate || updatesLimit) {
      return this.dataSource.transaction(async (manager) => {
        // Bracket generation holds this lock, so it cannot read a limit that
        // changes before its matches exist.
        if (updatesLimit) await lockEvent(manager, eventId);
        const repository = manager.getRepository(EventEntity);
        const current = await repository.findOneOrFail({
          where: { id: eventId },
          lock: { mode: "pessimistic_write" },
        });
        if (
          updatesLimit &&
          update.tournamentAdvancementLimit !==
            current.tournamentAdvancementLimit
        ) {
          const eliminationMatches = await manager
            .getRepository(MatchEntity)
            .countBy({
              phase: MatchPhase.ELIMINATION,
              teams: { event: { id: eventId } },
            });
          if (eliminationMatches > 0)
            throw new BadRequestException(
              "The advancement limit cannot change once the elimination bracket exists",
            );
        }
        if (update.startDate) {
          const now = new Date();
          this.validateLifecycleDates({ ...current, ...update });
          update.state = getEventState({ ...current, ...update }, now);
        }
        return repository.update(eventId, update);
      });
    }
    return this.eventRepository.update(eventId, update);
  }

  async getEventAdmins(eventId: string) {
    const admins = await this.roleRepository.find({
      where: { eventId, role: UserRole.ADMIN },
      relations: { user: true },
      order: { createdAt: "ASC" },
    });
    return toPublicUsers(admins.map((admin) => admin.user));
  }

  async addEventAdmin(eventId: string, userId: string, grantedById: string) {
    await this.roleRepository
      .createQueryBuilder()
      .insert()
      .values({ userId, role: UserRole.ADMIN, eventId, grantedById })
      .orIgnore()
      .execute();
  }

  async removeEventAdmin(eventId: string, userId: string) {
    const outcome = await this.dataSource.transaction((manager) =>
      removeAdminGrant(manager, eventId, (admin) => admin.userId === userId),
    );
    if (outcome === "not-found")
      throw new NotFoundException("Admin permission not found");
    if (outcome === "last-admin")
      throw new BadRequestException("Cannot remove the last admin of an event");
  }

  async getCurrentLiveEvent() {
    // Picks the event with the most registered users. The users are only
    // counted, never selected, so none of them end up in the public response.
    const qb = this.eventRepository
      .createQueryBuilder("event")
      .addSelect(
        (subQuery) =>
          subQuery
            .select("COUNT(*)")
            .from("events_users", "event_user")
            .where('event_user."eventsId" = event.id'),
        "user_count",
      )
      .where("event.isPrivate = false")
      .andWhere("event.startDate <= :now", { now: new Date() })
      .andWhere("event.submissionDeadline > :now", { now: new Date() })
      .andWhere("event.state IN (:...states)", {
        states: [EventState.REGISTRATION, EventState.PLAYING],
      })
      .andWhere("event.canCreateTeam = true")
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

  async hasWhitelist(
    eventId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    return this.getWhitelistRepository(manager).existsBy({
      event: { id: eventId },
    });
  }

  async isUserWhitelisted(
    eventId: string,
    githubUsername: string,
    fortyTwoUsername: string | null,
    manager?: EntityManager,
  ): Promise<boolean> {
    if (!(await this.hasWhitelist(eventId, manager))) {
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

    return this.getWhitelistRepository(manager).existsBy(
      conditions.map((cond) => ({
        event: { id: eventId },
        username: cond.username,
        platform: cond.platform,
      })),
    );
  }

  private getWhitelistRepository(manager?: EntityManager) {
    return (
      manager?.getRepository(EventWhitelistEntity) ?? this.whitelistRepository
    );
  }
}

/** Empty clears the stream link; anything else must be an http(s) URL, stored as entered. */
export function normalizeStreamUrl(
  value: string | undefined,
  field = "streamUrl",
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BadRequestException(`${field} must be a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new BadRequestException(`${field} must use http or https`);
  return trimmed;
}
