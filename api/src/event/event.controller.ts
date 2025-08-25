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
import {EventService} from "./event.service";
import {FrontendGuard, UserId} from "../guards/FrontendGuard";
import {TeamService} from "../team/team.service";
import {UserService} from "../user/user.service";
import {CreateEventDto} from "./dtos/createEventDto";
import {SetLockTeamsDateDto} from "./dtos/setLockTeamsDateDto";
import {UserGuard} from "../guards/UserGuard";

@UseGuards(FrontendGuard)
@Controller("event")
export class EventController {
    constructor(
        private readonly eventService: EventService,
        private readonly teamService: TeamService,
        private readonly userService: UserService,
    ) {
    }

    @Get()
    getAllEvents() {
        return this.eventService.getAllEvents();
    }

    @Get(":id")
    async getEventById(@Param("id", new ParseUUIDPipe()) id: string) {
        return await this.eventService.getEventById(id);
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
            createEventDto.repoTemplateOwner,
            createEventDto.repoTemplateName,
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

        return this.userService.joinEvent(userId, eventId);
    }

    @UseGuards(UserGuard)
    @Put(":id/lock")
    async lockEvent(
        @Param("id", new ParseUUIDPipe()) eventId: string,
        @UserId() userId: string,
    ) {
        if (!await this.eventService.isEventAdmin(eventId, userId))
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
        @Body() body: SetLockTeamsDateDto
    ) {
        if (!await this.eventService.isEventAdmin(eventId, userId))
            throw new UnauthorizedException("You are not authorized to lock teams for this event.");

        if (!body.repoLockDate)
            return this.eventService.setTeamsLockedDate(eventId, null);
        return this.eventService.setTeamsLockedDate(eventId, new Date(body.repoLockDate));
    }
}
