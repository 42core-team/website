import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { MatchService } from "./match.service";
import { EventService } from "../event/event.service";
import { UserId } from "../guards/UserGuard";
import { MatchPhase } from "./entites/match.entity";
import {
  AuthorizationService,
  Can,
  CurrentUser,
  EventPolicy,
  param,
  Public,
  SignedIn,
} from "../authz";
import { UserEntity } from "../user/entities/user.entity";
import { CreateManualMatchDto } from "./dtos/createManualMatchDto";
import { QueueMatchesQueryDto } from "./dtos/queueMatchesQueryDto";
import { matchNotFound } from "./match-response";

@Controller("match")
export class MatchController {
  constructor(
    private readonly matchService: MatchService,
    private readonly eventService: EventService,
    private readonly authorization: AuthorizationService,
  ) {}

  private readonly logger = new Logger(MatchController.name);

  @SignedIn()
  @Get("swiss/:eventId")
  getSwissMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @CurrentUser() user: UserEntity,
    @Query("adminRevealQuery", new ParseBoolPipe({ optional: true }))
    adminRevealQuery: boolean | undefined,
  ) {
    return this.matchService.getSwissMatches(
      eventId,
      user,
      adminRevealQuery ?? false,
    );
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Put("swiss/:eventId")
  async startSwissMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    const event = await this.eventService.getEventById(eventId);
    if (event.currentRound != 0) {
      // A round that finished while submissions were reopened is resumed here.
      if (
        (await this.matchService.getPausedProgressionPhase(event)) !==
        MatchPhase.SWISS
      )
        throw new BadRequestException("swiss matches have already started");
      this.logger.log({
        action: "attempt_resume_swiss_matches",
        userId,
        eventId,
      });
      return this.matchService.resumeTournamentProgression(eventId);
    }

    this.logger.log({ action: "attempt_start_swiss_matches", userId, eventId });

    return await this.matchService.startSwissMatches(eventId);
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Put("tournament/:eventId")
  async startTournamentMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_start_tournament_matches",
      userId,
      eventId,
    });

    return this.matchService.startTournamentMatches(eventId);
  }

  @Public()
  @Get("tournament/:eventId/teamCount")
  getTournamentTeamCount(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.matchService.getTournamentTeamCount(eventId);
  }

  @SignedIn()
  @Get("tournament/:eventId")
  getTournamentMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @CurrentUser() user: UserEntity,
    @Query("adminRevealQuery", new ParseBoolPipe({ optional: true }))
    adminRevealQuery: boolean | undefined,
  ) {
    return this.matchService.getTournamentMatches(
      eventId,
      user,
      adminRevealQuery ?? false,
    );
  }

  @SignedIn()
  @Get("queue/:eventId")
  async getQueueMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    return await this.matchService.getQueueMatches(eventId, userId);
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Get("queue/:eventId/admin")
  async getAllQueueMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query(new ValidationPipe({ transform: true })) query: QueueMatchesQueryDto,
  ) {
    return await this.matchService.getAllQueueMatches(eventId, query);
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Get("manual/:eventId")
  async getManualMatches(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return await this.matchService.getManualMatches(eventId);
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Post("manual/:eventId")
  async createManualMatch(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
    @Body() body: CreateManualMatchDto,
  ) {
    this.logger.log({
      action: "attempt_create_manual_match",
      userId,
      eventId,
      teamOneId: body.teamOneId,
      teamTwoId: body.teamTwoId,
    });

    return this.matchService.createManualMatch(
      eventId,
      body.teamOneId,
      body.teamTwoId,
    );
  }

  @SignedIn()
  @Get("team/:teamId")
  async getMatchesForTeam(
    @Param("teamId", ParseUUIDPipe) teamId: string,
    @UserId() userId: string,
  ) {
    return await this.matchService.getMatchesForTeam(teamId, userId);
  }

  @SignedIn()
  @Get("logs/:matchId")
  async getMatchLogs(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @CurrentUser() user: UserEntity,
  ) {
    const logs = await this.matchService.getMatchLogs(matchId, user);
    if (!logs)
      throw new BadRequestException(
        "No logs found for match with id " + matchId,
      );
    return logs;
  }

  @SignedIn()
  @Put("reveal/:matchId")
  async revealMatch(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @CurrentUser() user: UserEntity,
  ) {
    const eventId = await this.matchService.getEventIdOfMatch(matchId);
    if (
      !eventId ||
      !(await this.authorization.can(EventPolicy, "administer", user, eventId))
    )
      throw matchNotFound();

    this.logger.log({
      action: "attempt_reveal_match",
      userId: user.id,
      matchId,
    });

    return this.matchService.revealMatch(matchId);
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Put("reveal-all/:eventId/:phase")
  async revealAllMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("phase") phase: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_reveal_all_matches",
      userId,
      eventId,
      phase,
    });

    return this.matchService.revealAllMatchesInPhase(
      eventId,
      phase as MatchPhase,
    );
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Put("cleanup-all/:eventId/:phase")
  async cleanupMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("phase") phase: string,
    @UserId() userId: string,
  ) {
    this.logger.log({
      action: "attempt_cleanup_matches",
      userId,
      eventId,
      phase,
    });

    return this.matchService.cleanupMatchesInPhase(
      eventId,
      phase as MatchPhase,
    );
  }

  @Can(EventPolicy, "administer", param("eventId"))
  @Get("event/:eventId/timeseries")
  async getMatchesTimeSeries(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Query("interval") interval?: "minute" | "hour" | "day",
    @Query("start") startStr?: string,
    @Query("end") endStr?: string,
    @Query("phases") phasesStr?: string,
  ) {
    const start = this.parseOptionalDate(startStr, "start");
    const end = this.parseOptionalDate(endStr, "end");

    if (start && end && start > end) {
      throw new BadRequestException("Start date must be before end date");
    }

    const validPhases = Object.values(MatchPhase);
    const phases = phasesStr
      ? phasesStr
          .split(",")
          .map((phase) => phase.trim())
          .filter(Boolean)
      : validPhases;
    const invalidPhase = phases.find(
      (phase) => !validPhases.includes(phase as MatchPhase),
    );

    if (invalidPhase) {
      throw new BadRequestException(`Invalid match phase: ${invalidPhase}`);
    }

    return this.matchService.getMatchesTimeSeries({
      interval,
      start,
      end,
      eventId,
      phases: phases as MatchPhase[],
    });
  }

  @SignedIn()
  @Get(":matchId")
  async getMatchById(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @CurrentUser() user: UserEntity,
    @Query("adminRevealQuery", new ParseBoolPipe({ optional: true }))
    adminRevealQuery: boolean | undefined,
  ) {
    const match = await this.matchService.getMatchResponseById(
      matchId,
      user,
      adminRevealQuery ?? false,
    );
    // QUEUE result scores contain private matchmaking ratings, not public scores.
    return match.phase === MatchPhase.QUEUE && "results" in match
      ? { ...match, results: [] }
      : match;
  }

  private parseOptionalDate(
    value: string | undefined,
    field: "start" | "end",
  ): Date | undefined {
    if (!value) return undefined;

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field} date`);
    }
    return date;
  }
}
