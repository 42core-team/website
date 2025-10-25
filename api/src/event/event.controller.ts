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
import { UserGuard, UserId } from "../guards/UserGuard";

@Controller("event")
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
  ) {}

  @UseGuards(UserGuard)
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

  @Get("event/currentLiveEvent")
  async getCurrentLiveEvent() {
    return await this.eventService.getCurrentLiveEvent();
  }

  @UseGuards(UserGuard)
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

  @UseGuards(UserGuard)
  @Get(":id/isUserRegistered")
  getEventByUserId(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.eventService.isUserRegisteredForEvent(eventId, userId);
  }

  @UseGuards(UserGuard)
  @Get(":id/isEventAdmin")
  isEventAdmin(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.eventService.isEventAdmin(eventId, userId);
  }

  @UseGuards(UserGuard)
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

  @UseGuards(UserGuard)
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

  @UseGuards(UserGuard)
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
}
