import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
    UseGuards,
} from "@nestjs/common";
import { UserId } from "../guards/UserGuard";
import {TeamService} from "./team.service";
import {CreateTeamDto} from "./dtos/createTeamDto";
import {InviteUserDto} from "./dtos/inviteUserDto";
import {UserService} from "../user/user.service";
import {EventService} from "../event/event.service";
import {UserGuard} from "../guards/UserGuard";
import {PermissionRole} from "../user/entities/user.entity";

// TODO: create pipe or guard for user team validation, so we don't have to check for team existence in every endpoint
@Controller("team")
export class TeamController {
    constructor(
        private readonly teamService: TeamService,
        private readonly userService: UserService,
        private readonly eventService: EventService,
    ) {
    }

    @Get(":id")
    getTeamById(@Param("id", new ParseUUIDPipe()) id: string) {
        return this.teamService.getTeamById(id);
    }

    @Get("event/:eventId")
    getTeamsForEvent(
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @Query("searchName") searchName?: string,
        @Query("sortDir") sortDir?: string,
        @Query("sortBy") sortBy?: string,
    ) {
        return this.teamService.getSearchedTeamsForEvent(
            eventId,
            searchName,
            sortDir,
            sortBy,
        );
    }

    @UseGuards(UserGuard)
    @Get("event/:eventId/my")
    getMyTeamForEvent(
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @UserId("id") userId: string,
    ) {
        return this.teamService.getTeamOfUserForEvent(eventId, userId);
    }

    @UseGuards(UserGuard)
    @Post("event/:eventId/create")
    async createTeam(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @Body() createTeamDto: CreateTeamDto,
    ) {
        if (!(await this.eventService.isUserRegisteredForEvent(eventId, userId)))
            throw new BadRequestException("You are not registered for this event.");

        if (await this.teamService.getTeamOfUserForEvent(eventId, userId))
            throw new BadRequestException("You already have a team for this event.");

        if (await this.teamService.existsTeamByName(createTeamDto.name, eventId))
            throw new BadRequestException(
                "A team with this name already exists for this event.",
            );

        return this.teamService.createTeam(createTeamDto.name, userId, eventId);
    }

    @UseGuards(UserGuard)
    @Put("event/:eventId/leave")
    async leaveTeam(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
    ) {
        const team = await this.teamService.getTeamOfUserForEvent(eventId, userId);
        if (!team)
            throw new NotFoundException("You are not part of a team for this event.");
        if (team.locked)
            throw new BadRequestException("You cannot leave a locked team.");

        return this.teamService.leaveTeam(team.id, userId);
    }

    @Get(":id/members")
    async getTeamMembers(@Param("id", new ParseUUIDPipe()) teamId: string) {
        const event = await this.eventService.getEventByTeamId(teamId);
        const team = await this.teamService.getTeamById(teamId, {
            users: {
                socialAccounts: true,
                permissions: {
                    event: true
                }
            },
        });

        return team.users.map(user => {
            const isEventAdmin = user.permissions.some(p => p.event.id === event.id && p.role === PermissionRole.ADMIN);
            return {
                id: user.id,
                name: user.name,
                username: user.username,
                profilePicture: user.profilePicture,
                isEventAdmin,
                socialAccounts: user.socialAccounts.map(sa => ({
                    platform: sa.platform,
                    username: sa.username,
                })),
            };
        });
    }

    @UseGuards(UserGuard)
    @Post("event/:eventId/sendInvite")
    async sendInviteToTeam(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @Body() inviteUserDto: InviteUserDto,
    ) {
        const team = await this.teamService.getTeamOfUserForEvent(eventId, userId);
        if (!team)
            throw new NotFoundException("You are not part of a team for this event.");
        if (team.locked)
            throw new BadRequestException(
                "You cannot send invites for a locked team.",
            );
        if (
            await this.teamService.getTeamOfUserForEvent(
                eventId,
                inviteUserDto.userToInviteId,
            )
        )
            throw new BadRequestException(
                "This user is already part of a team for this event.",
            );
        if (
            await this.teamService.isUserInvitedToTeam(
                inviteUserDto.userToInviteId,
                team.id,
            )
        )
            throw new BadRequestException(
                "This user is already invited to this team.",
            );

        return this.userService.addTeamInvite(
            inviteUserDto.userToInviteId,
            team.id,
        );
    }

    @UseGuards(UserGuard)
    @Get("event/:eventId/searchInviteUsers/:searchQuery")
    async searchUsersForInvite(
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @UserId() userId: string,
        @Param("searchQuery") searchQuery: string,
    ) {
        const team = await this.teamService.getTeamOfUserForEvent(eventId, userId);
        if (!team)
            throw new NotFoundException("You are not part of a team for this event.");
        if (team.locked)
            throw new BadRequestException(
                "You cannot search for users in a locked team.",
            );

        return this.userService.searchUsersForInvite(eventId, searchQuery, team.id);
    }

    @UseGuards(UserGuard)
    @Get("event/:eventId/pending")
    async getUserPendingInvites(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
    ) {
        return this.teamService.getTeamsUserIsInvitedTo(userId, eventId);
    }

    @UseGuards(UserGuard)
    @Put("event/:eventId/acceptInvite/:teamId")
    async acceptTeamInvite(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @Param("teamId", new ParseUUIDPipe()) teamId: string,
    ) {
        if (await this.teamService.getTeamOfUserForEvent(eventId, userId))
            throw new BadRequestException(
                "You are already part of a team for this event.",
            );
        if (!(await this.teamService.isUserInvitedToTeam(userId, teamId)))
            throw new BadRequestException("You are not invited to this team.");
        const team = await this.teamService.getTeamById(teamId);
        if (team.locked)
            throw new BadRequestException(
                "You cannot accept an invite to a locked team.",
            );

        return this.teamService.acceptTeamInvite(userId, teamId);
    }

    @UseGuards(UserGuard)
    @Delete("event/:eventId/declineInvite/:teamId")
    async declineTeamInvite(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @Param("teamId", new ParseUUIDPipe()) teamId: string,
    ) {
        if (!(await this.teamService.isUserInvitedToTeam(userId, teamId)))
            throw new BadRequestException("You are not invited to this team.");

        return this.teamService.declineTeamInvite(userId, teamId);
    }

    @UseGuards(UserGuard)
    @Put("event/:eventId/queue/join")
    async joinQueue(
        @UserId() userId: string,
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
    ) {
        const team = await this.teamService.getTeamOfUserForEvent(eventId, userId);
        if (!team) throw new NotFoundException("You are not part of a team for this event.");
        if (team.locked) throw new BadRequestException("You cannot join the queue with a locked team.");
        if (team.inQueue) throw new BadRequestException("You are already in the queue.");

        return this.teamService.joinQueue(team.id);
    }

    @UseGuards(UserGuard)
    @Get("event/:eventId/queue/state")
    async getQueueState(
        @Param("eventId", new ParseUUIDPipe()) eventId: string,
        @UserId() userId: string,
    ) {
        const team = await this.teamService.getTeamOfUserForEvent(eventId, userId);
        if (!team) throw new NotFoundException("You are not part of a team for this event.");

        return this.teamService.getQueueState(team.id);
    }
}
