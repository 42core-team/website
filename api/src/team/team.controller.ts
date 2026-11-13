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
  Logger,
} from "@nestjs/common";
import { UserId } from "../guards/UserGuard";
import { TeamService } from "./team.service";
import { CreateTeamDto } from "./dtos/createTeamDto";
import { InviteUserDto } from "./dtos/inviteUserDto";
import { UserService } from "../user/user.service";
import { EventService } from "../event/event.service";
import { UserEntity } from "../user/entities/user.entity";
import {
  EventId,
  TeamNotLockedGuard,
  MyTeamGuards,
  TeamId,
  Team,
} from "../guards/TeamGuard";
import { EVENT_ID_PARAM, TEAM_ID_PARAM } from "../guards/GuardConstants";
import { TeamEntity } from "./entities/team.entity";
import {
  Can,
  CurrentUser,
  EventPolicy,
  hasInEvent,
  param,
  Public,
  SignedIn,
  UserRole,
} from "../authz";
import { getLocationTags } from "../user/location-tags";
import { UpdateTeamCreditsDto } from "./dtos/updateTeamCreditsDto";

@Controller("team")
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly eventService: EventService,
  ) {}

  @Public()
  @Get(":id")
  getTeamById(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.teamService.getTeamByIdWithTags(id);
  }

  @SignedIn()
  @Get(`event/:${EVENT_ID_PARAM}`)
  getTeamsForEvent(
    @EventId eventId: string,
    @CurrentUser() user: UserEntity,
    @Query("adminRevealQuery") adminRevealQuery: string, // It's a string in query params
    @Query("searchName") searchName?: string,
    @Query("sortDir") sortDir?: string,
    @Query("sortBy") sortBy?: string,
  ) {
    return this.teamService.getSearchedTeamsForEvent(
      eventId,
      searchName,
      sortDir,
      sortBy,
      user,
      adminRevealQuery === "true",
    );
  }

  @SignedIn()
  @Get(`event/:${EVENT_ID_PARAM}/my`)
  getMyTeamForEvent(@EventId eventId: string, @UserId("id") userId: string) {
    return this.teamService.getTeamOfUserForEventWithTags(eventId, userId);
  }

  @Can(EventPolicy, "administer", param(EVENT_ID_PARAM))
  @Put(`event/:${EVENT_ID_PARAM}/admin/:${TEAM_ID_PARAM}/credits`)
  async updateTeamCredits(
    @EventId eventId: string,
    @TeamId teamId: string,
    @UserId() userId: string,
    @Body() body: UpdateTeamCreditsDto,
  ) {
    this.logger.log({
      action: "attempt_update_team_credits",
      userId,
      eventId,
      teamId,
      credits: body.credits,
    });

    return this.teamService.setTeamCredits(eventId, teamId, body.credits);
  }

  @Can(EventPolicy, "administer", param(EVENT_ID_PARAM))
  @Delete(`event/:${EVENT_ID_PARAM}/admin/:${TEAM_ID_PARAM}`)
  async deleteTeamAsAdmin(
    @EventId eventId: string,
    @TeamId teamId: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_admin_delete_team",
      userId,
      eventId,
      teamId,
    });

    return this.teamService.deleteTeamForEvent(eventId, teamId);
  }

  @SignedIn()
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

    this.logger.log({
      action: "attempt_create_team",
      userId,
      eventId,
      teamName: createTeamDto.name,
      starterTemplateId: createTeamDto.starterTemplateId,
    });

    return this.teamService.createTeam(
      createTeamDto.name,
      userId,
      eventId,
      createTeamDto.starterTemplateId,
    );
  }

  @SignedIn()
  @UseGuards(MyTeamGuards, TeamNotLockedGuard)
  @Put(`event/:${EVENT_ID_PARAM}/leave`)
  async leaveTeam(@UserId() userId: string, @Team() team: TeamEntity) {
    this.logger.log({
      action: "attempt_leave_team",
      userId,
      teamId: team.id,
    });
    return this.teamService.leaveTeam(team.id, userId);
  }

  @Public()
  @Get(":id/members")
  async getTeamMembers(@Param("id", new ParseUUIDPipe()) teamId: string) {
    const event = await this.eventService.getEventByTeamId(teamId);
    const team = await this.teamService.getTeamById(teamId, {
      users: {
        socialAccounts: true,
        roles: true,
      },
    });

    return team.users.map((user) => {
      // The event's own admins; global admins are not listed as such.
      const isEventAdmin = hasInEvent(user, event.id, UserRole.ADMIN);
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
        isEventAdmin,
        tags: getLocationTags(user.socialAccounts),
        socialAccounts: user.socialAccounts.map((sa) => ({
          platform: sa.platform,
          username: sa.username,
        })),
      };
    });
  }

  @SignedIn()
  @UseGuards(MyTeamGuards, TeamNotLockedGuard)
  @Post(`event/:${EVENT_ID_PARAM}/sendInvite`)
  async sendInviteToTeam(
    @EventId eventId: string,
    @Body() inviteUserDto: InviteUserDto,
    @Team() team: TeamEntity,
    @UserId() userId: string,
  ) {
    if (userId === inviteUserDto.userToInviteId)
      throw new BadRequestException("You cannot invite yourself to a team.");
    // Turning team creation off also freezes the rosters of existing teams.
    if (!(await this.eventService.canCreateTeamInEvent(eventId)))
      throw new BadRequestException("Team invites are closed for this event.");
    if (!(await this.userService.userExists(inviteUserDto.userToInviteId)))
      throw new NotFoundException("User not found.");
    if (
      !(await this.eventService.isUserEligibleForEvent(
        eventId,
        inviteUserDto.userToInviteId,
      ))
    )
      throw new BadRequestException(
        "This user is not registered or not whitelisted for this private event.",
      );

    if (await this.teamService.isTeamFull(team.id))
      throw new BadRequestException("This team is full.");
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

    this.logger.log({
      action: "attempt_send_team_invite",
      inviterId: userId,
      inviteeId: inviteUserDto.userToInviteId,
      teamId: team.id,
      eventId,
    });

    return this.userService.addTeamInvite(
      inviteUserDto.userToInviteId,
      team.id,
    );
  }

  @SignedIn()
  @UseGuards(MyTeamGuards, TeamNotLockedGuard)
  @Get(`event/:${EVENT_ID_PARAM}/searchInviteUsers/:searchQuery`)
  async searchUsersForInvite(
    @EventId eventId: string,
    @Param("searchQuery") searchQuery: string,
    @Team() team: TeamEntity,
    @UserId() userId: string,
  ) {
    return this.userService.searchUsersForInvite(
      eventId,
      searchQuery,
      team.id,
      userId,
    );
  }

  @SignedIn()
  @Get(`event/:${EVENT_ID_PARAM}/pending`)
  async getUserPendingInvites(
    @UserId() userId: string,
    @EventId eventId: string,
  ) {
    return this.teamService.getTeamsUserIsInvitedTo(userId, eventId);
  }

  @SignedIn()
  @UseGuards(TeamNotLockedGuard)
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

    if (await this.teamService.isTeamFull(teamId))
      throw new BadRequestException("This team is full.");

    this.logger.log({
      action: "attempt_accept_team_invite",
      userId,
      teamId,
      eventId,
    });

    return this.teamService.acceptTeamInvite(userId, teamId);
  }

  // TODO: eventId is not used here, should be removed
  @SignedIn()
  @Delete(`event/:${EVENT_ID_PARAM}/declineInvite/:${TEAM_ID_PARAM}`)
  async declineTeamInvite(@UserId() userId: string, @TeamId teamId: string) {
    if (!(await this.teamService.isUserInvitedToTeam(userId, teamId)))
      throw new BadRequestException("You are not invited to this team.");

    this.logger.log({
      action: "attempt_decline_team_invite",
      userId,
      teamId,
    });

    return this.teamService.declineTeamInvite(userId, teamId);
  }

  @SignedIn()
  @UseGuards(MyTeamGuards)
  @Put(`event/:${EVENT_ID_PARAM}/queue/join`)
  async joinQueue(
    @Team() team: TeamEntity,
    @EventId eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.hasEventStartedForTeam(team.id)))
      throw new BadRequestException("The event has not started yet.");

    this.logger.log({
      action: "attempt_join_queue",
      teamId: team.id,
      userId,
    });

    return this.teamService.joinQueue(team.id, eventId);
  }

  @SignedIn()
  @Get(`event/:${EVENT_ID_PARAM}/queue/summary`)
  getQueueSummary(@EventId eventId: string, @UserId() userId: string) {
    return this.teamService.getQueueSummary(eventId, userId);
  }

  @SignedIn()
  @UseGuards(MyTeamGuards)
  @Get(`event/:${EVENT_ID_PARAM}/queue/opponents`)
  getQueueOpponents(@EventId eventId: string, @Team() team: TeamEntity) {
    return this.teamService.getQueueOpponents(eventId, team.id);
  }

  @SignedIn()
  @UseGuards(MyTeamGuards)
  @Post(`event/:${EVENT_ID_PARAM}/queue/direct/:targetTeamId`)
  async startDirectMatch(
    @Team() team: TeamEntity,
    @Param("targetTeamId", new ParseUUIDPipe()) targetTeamId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.hasEventStartedForTeam(team.id)))
      throw new BadRequestException("The event has not started yet.");

    this.logger.log({
      action: "start_direct_match",
      initiatingTeamId: team.id,
      targetTeamId,
      userId,
    });
    return this.teamService.createDirectMatch(team.id, targetTeamId);
  }
}
