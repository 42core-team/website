import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { MatchService } from "./match.service";
import { EventService } from "../event/event.service";
import { UserId } from "../guards/UserGuard";
import { MatchEntity } from "./entites/match.entity";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("match")
export class MatchController {
  constructor(
    private readonly matchService: MatchService,
    private readonly eventService: EventService,
  ) {}

  private logger = new Logger("MatchController");

  @UseGuards(JwtAuthGuard)
  @Get("swiss/:eventId")
  getSwissMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
    @Query("adminRevealQuery") adminRevealQuery: boolean,
  ) {
    return this.matchService.getSwissMatches(
      eventId,
      userId,
      Boolean(adminRevealQuery),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put("swiss/:eventId")
  async startSwissMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to lock this event.",
      );
    const event = await this.eventService.getEventById(eventId);
    if (event.currentRound != 0) {
      throw new BadRequestException("swiss matches have already started");
    }

    return await this.matchService.createNextSwissMatches(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Put("tournament/:eventId")
  async startTournamentMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to lock this event.",
      );
    return this.matchService.createNextTournamentMatches(eventId);
  }

  @Get("tournament/:eventId/teamCount")
  getTournamentTeamCount(@Param("eventId", ParseUUIDPipe) eventId: string) {
    return this.matchService.getTournamentTeamCount(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("tournament/:eventId")
  getTournamentMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
    @Query("adminRevealQuery") adminRevealQuery: boolean,
  ) {
    return this.matchService.getTournamentMatches(
      eventId,
      userId,
      adminRevealQuery,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("queue/:eventId")
  async getQueueMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    return await this.matchService.getQueueMatches(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("queue/:eventId/admin")
  async getAllQueueMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to view all queue matches.",
      );
    return await this.matchService.getAllQueueMatches(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("team/:teamId")
  async getMatchesForTeam(@Param("teamId", ParseUUIDPipe) teamId: string) {
    return await this.matchService.getMatchesForTeam(teamId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("logs/:matchId")
  async getMatchLogs(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @UserId() userId: string,
  ) {
    const logs = await this.matchService.getMatchLogs(matchId, userId);
    if (!logs)
      throw new BadRequestException(
        "No logs found for match with id " + matchId,
      );
    return logs;
  }

  @UseGuards(JwtAuthGuard)
  @Put("reveal/:matchId")
  async revealMatch(
    @Param("matchId", ParseUUIDPipe) matchId: string,
    @UserId() userId: string,
  ) {
    const match = await this.matchService.getMatchById(matchId, {
      teams: {
        event: true,
      },
    });
    if (!match) throw new BadRequestException("Match not found");

    if (
      !(await this.eventService.isEventAdmin(match.teams[0].event.id, userId))
    )
      throw new UnauthorizedException(
        "You are not authorized to reveal this match.",
      );

    return this.matchService.revealMatch(matchId);
  }

  @UseGuards(JwtAuthGuard)
  @Put("reveal-all/:eventId/:phase")
  async revealAllMatches(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("phase") phase: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to reveal matches for this event.",
      );

    return this.matchService.revealAllMatchesInPhase(eventId, phase as any);
  }

  @Get(":matchId")
  async getMatchById(
    @Param("matchId", ParseUUIDPipe) matchId: string,
  ): Promise<MatchEntity> {
    return await this.matchService.getMatchById(matchId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("queue/:eventId/timeseries")
  async getQueueMatchesTimeSeries(
    @Param("eventId") eventId: string,
    @UserId() userId: string,
    @Query("interval") interval?: "minute" | "hour" | "day",
    @Query("start") startStr?: string,
    @Query("end") endStr?: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new UnauthorizedException(
        "You are not authorized to view queue match stats.",
      );

    let start: Date | undefined = undefined;
    let end: Date | undefined = undefined;

    if (startStr) {
      const d = new Date(startStr);
      if (isNaN(d.getTime())) {
        throw new BadRequestException("Invalid start date");
      }
      start = d;
    }
    if (endStr) {
      const d = new Date(endStr);
      if (isNaN(d.getTime())) {
        throw new BadRequestException("Invalid end date");
      }
      end = d;
    }

    if (start && end && start > end) {
      throw new BadRequestException("Start date must be before end date");
    }

    return this.matchService.getQueueMatchesTimeSeries({
      interval,
      start,
      end,
      eventId,
    });
  }
}
