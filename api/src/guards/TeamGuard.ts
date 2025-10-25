import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { TeamService } from "../team/team.service";
import { EVENT_ID_PARAM, TEAM_ID_PARAM, USER_ID_KEY } from "./GuardConstants";
import { TeamEntity } from "../team/entities/team.entity";

export const TeamId = Param(TEAM_ID_PARAM, new ParseUUIDPipe());
export const EventId = Param(EVENT_ID_PARAM, new ParseUUIDPipe());

/**
 * Decorator to get the team from the request object
 * this only works if the MyTeamGuard is used
 */
export const Team = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const team = request.team as TeamEntity;
    if (!team) throw new NotFoundException("Team not found");

    return team;
  },
);

/**
 * Checks if a user is part of a team for the given event
 * and attaches the team to the request object
 */
@Injectable()
export class MyTeamGuards implements CanActivate {
  constructor(private readonly teamService: TeamService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const eventId: string | undefined = request.params[EVENT_ID_PARAM];
    const userId: string | undefined = request.headers[USER_ID_KEY];

    if (!eventId || !userId) return false;

    const team = await this.teamService.getTeamOfUserForEvent(eventId, userId);
    if (!team)
      throw new NotFoundException("You are not part of a team for this event.");

    request.team = team;
    return true;
  }
}

/**
 * Checks if team is not locked
 * this guard can be used on its own or with the TeamsGuards guard
 */
@Injectable()
export class TeamNotLockedGuard implements CanActivate {
  constructor(private teamService: TeamService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const teamId: string | undefined =
      request.params[TEAM_ID_PARAM] || request.team?.id;

    if (!teamId) return false;

    if (await this.teamService.isTeamLocked(teamId))
      throw new BadRequestException("Team is locked");

    return true;
  }
}
