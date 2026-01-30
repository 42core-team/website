import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { EventService } from "./event.service";
import { TeamService } from "../team/team.service";
import { UserService } from "../user/user.service";
import { CreateEventDto } from "./dtos/createEventDto";
import { SetLockTeamsDateDto } from "./dtos/setLockTeamsDateDto";
import { UpdateEventSettingsDto } from "./dtos/updateEventSettingsDto";
import { UserId } from "../guards/UserGuard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("event")
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  async getMyEvents(@UserId() userId: string) {
    return this.eventService.getEventsForUser(userId);
  }

  @Get()
  getAllEvents() {
    return this.eventService.getAllEvents();
  }

  @Get(":id")
  async getEventById(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventById(id);
  }

  @Get(":id/version")
  async getEventVersion(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventVersion(id);
  }

  @Get(":id/game-config")
  async getEventGameConfig(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventGameConfig(id);
  }

  @Get(":id/server-config")
  async getEventServerConfig(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventServerConfig(id);
  }

  @Get("event/currentLiveEvent")
  async getCurrentLiveEvent() {
    return await this.eventService.getCurrentLiveEvent();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createEvent(
    @UserId() userId: string,
    @Body() createEventDto: CreateEventDto,
  ) {
    if (!this.userService.canCreateEvent(userId))
      throw new UnauthorizedException(
        "You are not authorized to create events.",
      );

    return this.eventService.createEvent(
      userId,
      createEventDto.name,
      createEventDto.description,
      createEventDto.githubOrg,
      createEventDto.githubOrgSecret,
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
      createEventDto.isPrivate,
    );
  }

  @Get(":id/teamsCount")
  getTeamsCountForEvent(@Param("id", new ParseUUIDPipe()) eventId: string) {
    return this.teamService.getTeamCountForEvent(eventId);
  }

  @Get(":id/participantsCount")
  getParticipantsCountForEvent(
    @Param("id", new ParseUUIDPipe()) eventId: string,
  ) {
    return this.userService.getUserCountOfEvent(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/isUserRegistered")
  isUserRegistered(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.eventService.isUserRegisteredForEvent(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/isEventAdmin")
  isEventAdmin(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.eventService.isEventAdmin(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
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
    if (new Date() < event.startDate) {
      throw new BadRequestException("Event has not started yet.");
    }

    return this.userService.joinEvent(userId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(":id/lock")
  async lockEvent(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to lock this event.",
      );

    return this.eventService.lockEvent(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(":id/unlock")
  async unlockEvent(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to unlock teams for this event.",
      );

    return this.eventService.unlockEvent(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(":id/lockTeamsDate")
  async lockTeamsDate(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() body: SetLockTeamsDateDto,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to lock teams for this event.",
      );

    if (!body.repoLockDate)
      return this.eventService.setTeamsLockedDate(eventId, null);
    return this.eventService.setTeamsLockedDate(
      eventId,
      new Date(body.repoLockDate),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put(":id/settings")
  async updateEventSettings(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() body: UpdateEventSettingsDto,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to update settings for this event.",
      );

    return this.eventService.updateEventSettings(eventId, body);
  }
}
