import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { EventService } from "./event.service";
import { TeamService } from "../team/team.service";
import { UserService } from "../user/user.service";
import { CreateEventDto } from "./dtos/createEventDto";
import { UpdateEventSettingsDto } from "./dtos/updateEventSettingsDto";
import { CreateEventStarterTemplateDto } from "./dtos/createEventStarterTemplateDto";
import { UpdateEventStarterTemplateDto } from "./dtos/updateEventStarterTemplateDto";
import { AddToWhitelistDto, BulkDeleteWhitelistDto } from "./dtos/whitelistDto";
import { UserId } from "../guards/UserGuard";
import {
  AuthorizationService,
  Can,
  CurrentUser,
  EventPolicy,
  param,
  PlatformPolicy,
  Public,
  SignedIn,
} from "../authz";
import { UserEntity } from "../user/entities/user.entity";
import { SocialPlatform } from "src/user/entities/social-account.entity";
import { isRegistrationOpen } from "./event-lifecycle";
import { NormalizeGithubConfigPipe } from "../common/github-config-normalization";
import {
  EventLifecycleDto,
  EventTeamExclusionDto,
  ExcludeInactiveTeamsDto,
  RetryEventRepositoryDto,
} from "./dtos/eventLifecycleDto";

export interface EventAbilities {
  administer: boolean;
  viewUnrevealedResults: boolean;
  publish: boolean;
}

@Controller("event")
export class EventController {
  private readonly logger = new Logger(EventController.name);

  constructor(
    private readonly eventService: EventService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly authorization: AuthorizationService,
  ) {}

  @SignedIn()
  @Get("overview")
  async getEventsOverview(@UserId() userId: string) {
    return this.eventService.getEventsOverviewForUser(userId);
  }

  @Public()
  @Get()
  getAllEvents() {
    return this.eventService.getAllEvents();
  }

  @Can(EventPolicy, "view", param("id"))
  @Get(":id")
  async getEventById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventById(id);
  }

  @Public()
  @Get(":id/version")
  async getEventVersion(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventVersion(id);
  }

  @Public()
  @Get(":id/templates/:templateId/version")
  async getStarterTemplateVersion(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("templateId", new ParseUUIDPipe()) templateId: string,
  ) {
    return await this.eventService.getTemplateVersion(id, templateId);
  }

  @Can(EventPolicy, "view", param("id"))
  @Get(":id/game-config")
  async getEventGameConfig(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventGameConfig(id);
  }

  @Can(EventPolicy, "view", param("id"))
  @Get(":id/server-config")
  async getEventServerConfig(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventServerConfig(id);
  }

  @Can(EventPolicy, "view", param("id"))
  @Get(":id/github-org")
  async getEventGithubOrg(@Param("id", new ParseUUIDPipe()) id: string) {
    const event = await this.eventService.getEventById(id);
    return event.githubOrg;
  }

  @Public()
  @Get("event/currentLiveEvent")
  async getCurrentLiveEvent() {
    return await this.eventService.getCurrentLiveEvent();
  }

  @Can(PlatformPolicy, "createEvent")
  @Post()
  async createEvent(
    @UserId() userId: string,
    @Body(NormalizeGithubConfigPipe) createEventDto: CreateEventDto,
  ) {
    this.logger.log({
      action: "attempt_create_event",
      userId,
      eventName: createEventDto.name,
    });

    return this.eventService.createEvent(
      userId,
      createEventDto.name,
      createEventDto.description,
      createEventDto.location,
      createEventDto.startDate,
      createEventDto.endDate,
      createEventDto.minTeamSize,
      createEventDto.maxTeamSize,
      createEventDto.gameServerDockerImage,
      createEventDto.myCoreBotDockerImage,
      createEventDto.visualizerDockerImage,
      createEventDto.monorepoUrl,
      createEventDto.monorepoVersion,
      createEventDto.basePath,
      createEventDto.gameConfig,
      createEventDto.serverConfig,
      // Every event starts private; publishing it needs EventPolicy.publish.
      true,
      createEventDto,
    );
  }

  @Can(EventPolicy, "view", param("id"))
  @Get(":id/teamsCount")
  getTeamsCountForEvent(@Param("id", new ParseUUIDPipe()) eventId: string) {
    return this.teamService.getTeamCountForEvent(eventId);
  }

  @Can(EventPolicy, "view", param("id"))
  @Get(":id/participantsCount")
  getParticipantsCountForEvent(
    @Param("id", new ParseUUIDPipe()) eventId: string,
  ) {
    return this.userService.getUserCountOfEvent(eventId);
  }

  @SignedIn()
  @Get(":id/isUserRegistered")
  isUserRegistered(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.eventService.isUserRegisteredForEvent(eventId, userId);
  }

  /**
   * What the caller may do in this event, so the frontend can decide what to
   * offer. Every route still enforces its own ability.
   */
  @SignedIn()
  @Can(EventPolicy, "view", param("id"))
  @Get(":id/abilities")
  async getEventAbilities(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: UserEntity,
  ): Promise<EventAbilities> {
    await this.eventService.getEventById(eventId);
    const can = (ability: keyof EventAbilities) =>
      this.authorization.can(EventPolicy, ability, user, eventId);
    const [administer, viewUnrevealedResults, publish] = await Promise.all([
      can("administer"),
      can("viewUnrevealedResults"),
      can("publish"),
    ]);
    return { administer, viewUnrevealedResults, publish };
  }

  @SignedIn()
  @Can(EventPolicy, "view", param("id"))
  @Put(":id/join")
  async joinEvent(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    const isRegistered = await this.eventService.isUserRegisteredForEvent(
      eventId,
      userId,
    );
    if (isRegistered) {
      throw new BadRequestException(
        "User is already registered for this event.",
      );
    }

    const event = await this.eventService.getEventById(eventId);

    if (!isRegistrationOpen(event))
      throw new BadRequestException("Registration is closed for this event");

    if (event.isPrivate) {
      const user = await this.userService.getUserWithSocialAccounts(userId);
      const socialAccounts = user.socialAccounts || [];
      const fortyTwoAccount = socialAccounts.find(
        (sa) => sa.platform === SocialPlatform.FORTYTWO,
      );

      const isWhitelisted = await this.eventService.isUserWhitelisted(
        eventId,
        user.username,
        fortyTwoAccount?.username || null,
      );

      if (!isWhitelisted) {
        throw new UnauthorizedException(
          "You are not whitelisted for this private event.",
        );
      }
    }

    this.logger.log({ action: "attempt_join_event", userId, eventId });

    return this.userService.joinEvent(userId, eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/lifecycle")
  async transitionLifecycle(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Body() body: EventLifecycleDto,
  ) {
    return this.eventService.transitionLifecycle(eventId, body);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/repositories/retry")
  async retryRepository(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Body() body: RetryEventRepositoryDto,
  ) {
    return this.eventService.retryRepositoryOperation(eventId, body.teamId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/teams/:teamId/exclusion")
  async setTeamExclusion(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Param("teamId", new ParseUUIDPipe()) teamId: string,
    @Body() body: EventTeamExclusionDto,
  ) {
    return this.eventService.setTeamExclusion(eventId, teamId, body.excluded);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Get(":id/repository-activity")
  async getRepositoryActivity(
    @Param("id", new ParseUUIDPipe()) eventId: string,
  ) {
    return this.eventService.getRepositoryActivity(eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/exclude-inactive-teams")
  async excludeInactiveTeams(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() body: ExcludeInactiveTeamsDto,
  ) {
    const result = await this.eventService.excludeInactiveTeams(
      eventId,
      body.teamIds,
    );
    this.logger.log({
      action: "exclude_inactive_teams",
      userId,
      eventId,
      excludedTeamIds: result.excludedTeamIds,
    });
    return result;
  }

  @Can(EventPolicy, "administer", param("id"))
  @Put(":id/lock")
  async lockEvent(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    this.logger.log({ action: "attempt_lock_event", userId, eventId });

    return this.eventService.lockEvent(eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Put(":id/settings")
  async updateEventSettings(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: UserEntity,
    @Body(NormalizeGithubConfigPipe) body: UpdateEventSettingsDto,
  ) {
    if (
      body.isPrivate === false &&
      !(await this.authorization.can(EventPolicy, "publish", user, eventId))
    )
      throw new ForbiddenException(
        "Only a public event creator can make this event public.",
      );

    this.logger.log({
      action: "attempt_update_event_settings",
      userId: user.id,
      eventId,
    });

    return this.eventService.updateEventSettings(eventId, body);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Get(":id/admins")
  async getEventAdmins(@Param("id", new ParseUUIDPipe()) eventId: string) {
    return this.eventService.getEventAdmins(eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/admins/:newAdminId")
  async addEventAdmin(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Param("newAdminId", new ParseUUIDPipe()) newAdminId: string,
  ) {
    this.logger.log({
      action: "attempt_add_event_admin",
      userId,
      eventId,
      newAdminId,
    });
    return this.eventService.addEventAdmin(eventId, newAdminId, userId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Delete(":id/admins/:adminId")
  async removeEventAdmin(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Param("adminId", new ParseUUIDPipe()) adminIdToRemove: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_remove_event_admin",
      userId,
      eventId,
      removedAdminId: adminIdToRemove,
    });
    return this.eventService.removeEventAdmin(eventId, adminIdToRemove);
  }

  @SignedIn()
  @Can(EventPolicy, "view", param("id"))
  @Get(":id/templates")
  async getStarterTemplates(@Param("id", new ParseUUIDPipe()) eventId: string) {
    return this.eventService.getStarterTemplates(eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/templates")
  async createStarterTemplate(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body(NormalizeGithubConfigPipe) body: CreateEventStarterTemplateDto,
  ) {
    this.logger.log({
      action: "attempt_create_starter_template",
      userId,
      eventId,
      templateName: body.name,
    });
    return this.eventService.createStarterTemplate(
      eventId,
      body.name,
      body.basePath,
      body.myCoreBotDockerImage,
    );
  }

  @Can(EventPolicy, "administer", param("id"))
  @Put(":id/templates/:templateId")
  async updateStarterTemplate(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Param("templateId", new ParseUUIDPipe()) templateId: string,
    @UserId() userId: string,
    @Body(NormalizeGithubConfigPipe) body: UpdateEventStarterTemplateDto,
  ) {
    this.logger.log({
      action: "attempt_update_starter_template",
      userId,
      eventId,
      templateId,
    });
    return this.eventService.updateStarterTemplate(eventId, templateId, body);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Delete(":id/templates/:templateId")
  async deleteStarterTemplate(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Param("templateId", new ParseUUIDPipe()) templateId: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_delete_starter_template",
      userId,
      eventId,
      templateId,
    });
    return this.eventService.deleteStarterTemplate(eventId, templateId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Get(":id/whitelist")
  async getWhitelist(@Param("id", new ParseUUIDPipe()) eventId: string) {
    return this.eventService.getWhitelist(eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/whitelist")
  async addToWhitelist(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() body: AddToWhitelistDto,
  ) {
    this.logger.log({
      action: "attempt_add_to_whitelist",
      userId,
      eventId,
      entriesCount: body.entries.length,
    });

    return this.eventService.addToWhitelist(eventId, body.entries);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Delete(":id/whitelist/:whitelistId")
  async removeFromWhitelist(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @Param("whitelistId", new ParseUUIDPipe()) whitelistId: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_remove_from_whitelist",
      userId,
      eventId,
      whitelistId,
    });

    return this.eventService.removeFromWhitelist(eventId, whitelistId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post(":id/whitelist/bulk-delete")
  async bulkRemoveFromWhitelist(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() body: BulkDeleteWhitelistDto,
  ) {
    this.logger.log({
      action: "attempt_bulk_remove_from_whitelist",
      userId,
      eventId,
      idsCount: body.ids.length,
    });

    return this.eventService.bulkRemoveFromWhitelist(eventId, body.ids);
  }
}
