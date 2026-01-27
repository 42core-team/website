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
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserId } from "../guards/UserGuard";
import { TeamService } from "./team.service";
import { CreateTeamDto } from "./dtos/createTeamDto";
import { InviteUserDto } from "./dtos/inviteUserDto";
import { UserService } from "../user/user.service";
import { EventService } from "../event/event.service";
import { PermissionRole } from "../user/entities/user.entity";
import {
  EventId,
  TeamNotLockedGuard,
  MyTeamGuards,
  TeamId,
  Team,
} from "../guards/TeamGuard";
import { EVENT_ID_PARAM, TEAM_ID_PARAM } from "../guards/GuardConstants";
import { TeamEntity } from "./entities/team.entity";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("team")
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly eventService: EventService,
  ) {}

  @Get(":id")
  getTeamById(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.teamService.getTeamById(id);
  }

  @Get(`event/:${EVENT_ID_PARAM}`)
  getTeamsForEvent(
    @EventId eventId: string,
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

  @UseGuards(JwtAuthGuard)
  @Get(`event/:${EVENT_ID_PARAM}/my`)
  getMyTeamForEvent(@EventId eventId: string, @UserId("id") userId: string) {
    return this.teamService.getTeamOfUserForEvent(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(`event/:${EVENT_ID_PARAM}/create`)
  async createTeam(
    @UserId() userId: string,
    @EventId eventId: string,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    if (!(await this.eventService.isUserRegisteredForEvent(eventId, userId)))
      throw new BadRequestException("You are not registered for this event.");

    if (!(await this.eventService.canCreateTeamInEvent(eventId)))
      throw new BadRequestException("This event is locked.");

    if (await this.teamService.getTeamOfUserForEvent(eventId, userId))
      throw new BadRequestException("You already have a team for this event.");

    if (await this.teamService.existsTeamByName(createTeamDto.name, eventId))
      throw new BadRequestException(
        "A team with this name already exists for this event.",
      );

    return this.teamService.createTeam(createTeamDto.name, userId, eventId);
  }

  @UseGuards(JwtAuthGuard, MyTeamGuards, TeamNotLockedGuard)
  @Put(`event/:${EVENT_ID_PARAM}/leave`)
  async leaveTeam(@UserId() userId: string, @Team() team: TeamEntity) {
    return this.teamService.leaveTeam(team.id, userId);
  }

  @Get(":id/members")
  async getTeamMembers(@Param("id", new ParseUUIDPipe()) teamId: string) {
    const event = await this.eventService.getEventByTeamId(teamId);
    const team = await this.teamService.getTeamById(teamId, {
      users: {
        socialAccounts: true,
        permissions: {
          event: true,
        },
      },
    });

    return team.users.map((user) => {
      const isEventAdmin = user.permissions.some(
        (p) => p.event.id === event.id && p.role === PermissionRole.ADMIN,
      );
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
        isEventAdmin,
        socialAccounts: user.socialAccounts.map((sa) => ({
          platform: sa.platform,
          username: sa.username,
        })),
      };
    });
  }

  @UseGuards(JwtAuthGuard, MyTeamGuards, TeamNotLockedGuard)
  @Post(`event/:${EVENT_ID_PARAM}/sendInvite`)
  async sendInviteToTeam(
    @EventId eventId: string,
    @Body() inviteUserDto: InviteUserDto,
    @Team() team: TeamEntity,
  ) {
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

  @UseGuards(JwtAuthGuard, MyTeamGuards, TeamNotLockedGuard)
  @Get(`event/:${EVENT_ID_PARAM}/searchInviteUsers/:searchQuery`)
  async searchUsersForInvite(
    @EventId eventId: string,
    @Param("searchQuery") searchQuery: string,
    @Team() team: TeamEntity,
  ) {
    return this.userService.searchUsersForInvite(eventId, searchQuery, team.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(`event/:${EVENT_ID_PARAM}/pending`)
  async getUserPendingInvites(
    @UserId() userId: string,
    @EventId eventId: string,
  ) {
    return this.teamService.getTeamsUserIsInvitedTo(userId, eventId);
  }

  @UseGuards(JwtAuthGuard, TeamNotLockedGuard)
  @Put(`event/:${EVENT_ID_PARAM}/acceptInvite/:${TEAM_ID_PARAM}`)
  async acceptTeamInvite(
    @UserId() userId: string,
    @EventId eventId: string,
    @TeamId teamId: string,
  ) {
    if (await this.teamService.getTeamOfUserForEvent(eventId, userId))
      throw new BadRequestException(
        "You are already part of a team for this event.",
      );
    if (!(await this.teamService.isUserInvitedToTeam(userId, teamId)))
      throw new BadRequestException("You are not invited to this team.");

    return this.teamService.acceptTeamInvite(userId, teamId);
  }

  // TODO: eventId is not used here, should be removed
  @UseGuards(JwtAuthGuard)
  @Delete(`event/:${EVENT_ID_PARAM}/declineInvite/:${TEAM_ID_PARAM}`)
  async declineTeamInvite(@UserId() userId: string, @TeamId teamId: string) {
    if (!(await this.teamService.isUserInvitedToTeam(userId, teamId)))
      throw new BadRequestException("You are not invited to this team.");

    return this.teamService.declineTeamInvite(userId, teamId);
  }

  @UseGuards(JwtAuthGuard, MyTeamGuards)
  @Put(`event/:${EVENT_ID_PARAM}/queue/join`)
  async joinQueue(@Team() team: TeamEntity) {
    if (team.inQueue)
      throw new BadRequestException("You are already in the queue.");

    if (!(await this.eventService.hasEventStartedForTeam(team.id)))
      throw new BadRequestException("The event has not started yet.");

    return this.teamService.joinQueue(team.id);
  }

  @UseGuards(JwtAuthGuard, MyTeamGuards)
  @Put(`event/:${EVENT_ID_PARAM}/queue/leave`)
  async leaveQueue(@Team() team: TeamEntity) {
    if (!team.inQueue)
      throw new BadRequestException("You are not in the queue.");

    return this.teamService.leaveQueue(team.id);
  }

  @UseGuards(JwtAuthGuard, MyTeamGuards)
  @Get(`event/:${EVENT_ID_PARAM}/queue/state`)
  async getQueueState(@Team() team: TeamEntity) {
    return this.teamService.getQueueState(team.id);
  }
}
