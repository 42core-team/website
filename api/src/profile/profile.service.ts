import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, Repository } from "typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { SocialPlatform } from "../user/entities/social-account.entity";
import { getLocationTags } from "../user/location-tags";
import { TeamEntity } from "../team/entities/team.entity";
import { getEventState } from "../event/event-lifecycle";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { toMatchTeamResponse } from "../match/match-response";
import { canViewTeamMatchReplay } from "../match/team-match-visibility";
import { getBracketFinish } from "./profile-finish";
import { getVisibleRepo } from "./profile-repo";
import type {
  ProfileCombatTotals,
  ProfileMatchResponse,
  ProfileResponse,
  ProfileTeamResponse,
} from "./profile-response";

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
  ) {}

  async getProfile(
    username: string,
    viewerId: string,
  ): Promise<ProfileResponse> {
    const user = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.socialAccounts", "socialAccount")
      .where("LOWER(user.username) = LOWER(:username)", { username })
      .orderBy("user.updatedAt", "DESC")
      .getOne();
    if (!user) throw new NotFoundException("User not found");

    const allTeams = await this.teamRepository.find({
      where: { users: { id: user.id } },
      relations: { event: true, starterTemplate: true },
    });
    const teamIds = allTeams.map((team) => team.id);
    const [members, viewerTeamIds, viewerEventIds] = await Promise.all([
      this.getMembers(teamIds),
      this.getTeamIdsOfUser(viewerId),
      this.getEventIdsOfUser(viewerId),
    ]);

    // Private events stay as hidden here as in the event list: only the
    // profile's owner and people taking part in the event see them.
    const teams = allTeams.filter(
      (team) =>
        !team.event.isPrivate ||
        viewerId === user.id ||
        viewerEventIds.has(team.event.id) ||
        viewerTeamIds.eventIds.has(team.event.id),
    );

    const matches = await this.getVisibleMatches(teams.map((team) => team.id));
    const teamIdSet = new Set(teams.map((team) => team.id));
    const eventIdOfTeam = new Map(
      teams.map((team) => [team.id, team.event.id]),
    );

    const profileMatches: ProfileMatchResponse[] = [];
    for (const match of matches) {
      const ownTeam = match.teams.find((team) => teamIdSet.has(team.id));
      if (!ownTeam) continue;
      const opponent = match.teams.find((team) => team.id !== ownTeam.id);
      const matchTeamIds = match.teams.map((team) => team.id);
      const canView = canViewTeamMatchReplay(
        matchTeamIds.find((id) => viewerTeamIds.teamIds.has(id)),
        matchTeamIds,
      );
      profileMatches.push({
        id: canView ? match.id : null,
        teamId: ownTeam.id,
        eventId: eventIdOfTeam.get(ownTeam.id)!,
        phase: match.phase,
        round: match.round,
        createdAt: match.createdAt,
        result: !match.winner
          ? "DRAW"
          : match.winner.id === ownTeam.id
            ? "WIN"
            : "LOSS",
        opponent: opponent ? toMatchTeamResponse(opponent) : null,
        stats: match.stats
          ? {
              unitsSpawned: match.stats.unitsSpawned,
              coresDestroyed: match.stats.coresDestroyed,
              damageTotal: match.stats.damageTotal,
            }
          : null,
      });
    }

    const bracketSizes = await this.getBracketSizes(
      teams.map((team) => team.event.id),
    );

    const teamResponses: ProfileTeamResponse[] = teams
      .map((team) => {
        const bracketMatches = profileMatches
          .filter(
            (match) =>
              match.teamId === team.id &&
              match.phase === MatchPhase.ELIMINATION &&
              match.result !== "DRAW",
          )
          .map((match) => ({
            round: match.round,
            won: match.result === "WIN",
          }));
        return {
          id: team.id,
          name: team.name,
          picture: team.picture ?? null,
          background: team.background ?? null,
          repo: getVisibleRepo(team, viewerTeamIds.teamIds),
          starterTemplate: team.starterTemplate?.name ?? null,
          createdAt: team.createdAt,
          event: {
            id: team.event.id,
            name: team.event.name,
            state: getEventState(team.event),
            startDate: team.event.startDate,
            scheduledEndDate: team.event.scheduledEndDate,
            bracketSize: bracketSizes.get(team.event.id) ?? null,
          },
          members: members.get(team.id) ?? [],
          finish: getBracketFinish(
            bracketMatches,
            bracketSizes.get(team.event.id) ?? 0,
          ),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.event.startDate).getTime() -
          new Date(a.event.startDate).getTime(),
      );

    const fortyTwo = user.socialAccounts.find(
      (account) => account.platform === SocialPlatform.FORTYTWO,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        profilePicture: user.profilePicture ?? null,
        createdAt: user.createdAt,
        tags: getLocationTags(user.socialAccounts),
        intra: fortyTwo
          ? { username: fortyTwo.username, campusName: fortyTwo.campusName }
          : null,
      },
      teams: teamResponses,
      matches: profileMatches,
      combat: sumCombat(matches),
    };
  }

  // The same matches a team's own match history lists: finished queue
  // matches, and revealed matches of every other phase but manual ones.
  private async getVisibleMatches(teamIds: string[]): Promise<MatchEntity[]> {
    if (teamIds.length === 0) return [];
    const ids = (
      await this.matchRepository.find({
        select: { id: true },
        where: [
          {
            teams: { id: In(teamIds) },
            state: MatchState.FINISHED,
            phase: MatchPhase.QUEUE,
          },
          {
            teams: { id: In(teamIds) },
            state: MatchState.FINISHED,
            isRevealed: true,
            phase: Not(MatchPhase.MANUAL),
          },
        ],
        withDeleted: true,
      })
    ).map((match) => match.id);
    if (ids.length === 0) return [];

    return this.matchRepository.find({
      where: { id: In(ids) },
      relations: { teams: true, winner: true },
      order: { createdAt: "DESC" },
      withDeleted: true,
    });
  }

  private async getMembers(teamIds: string[]) {
    const byTeam = new Map<string, ProfileTeamResponse["members"]>();
    if (teamIds.length === 0) return byTeam;
    const teams = await this.teamRepository.find({
      where: { id: In(teamIds) },
      relations: { users: true },
    });
    for (const team of teams) {
      byTeam.set(
        team.id,
        team.users.map((member) => ({
          id: member.id,
          username: member.username,
          name: member.name,
          profilePicture: member.profilePicture ?? null,
        })),
      );
    }
    return byTeam;
  }

  private async getTeamIdsOfUser(userId: string) {
    const teams = await this.teamRepository.find({
      where: { users: { id: userId } },
      relations: { event: true },
      loadEagerRelations: false,
    });
    return {
      teamIds: new Set(teams.map((team) => team.id)),
      eventIds: new Set(teams.map((team) => team.event.id)),
    };
  }

  private async getEventIdsOfUser(userId: string) {
    const rows = await this.userRepository
      .createQueryBuilder("user")
      .innerJoin("user.events", "event")
      .select("event.id", "id")
      .where("user.id = :userId", { userId })
      .getRawMany<{ id: string }>();
    return new Set(rows.map((row) => row.id));
  }

  // Teams entering the bracket: two per first-round match. The number of
  // matches in a round is public even while their results are hidden.
  private async getBracketSizes(eventIds: string[]) {
    const sizes = new Map<string, number>();
    if (eventIds.length === 0) return sizes;
    const rows = await this.matchRepository
      .createQueryBuilder("match")
      .innerJoin("match.teams", "team")
      .innerJoin("team.event", "event")
      .select("event.id", "eventId")
      .addSelect("COUNT(DISTINCT match.id)", "matches")
      .where("event.id IN (:...eventIds)", { eventIds })
      .andWhere("match.phase = :phase", { phase: MatchPhase.ELIMINATION })
      .andWhere("match.round = 0")
      .withDeleted()
      .groupBy("event.id")
      .getRawMany<{ eventId: string; matches: string }>();
    for (const row of rows)
      sizes.set(row.eventId, 2 * (parseInt(row.matches, 10) || 0));
    return sizes;
  }
}

export function sumCombat(matches: MatchEntity[]): ProfileCombatTotals {
  const totals: ProfileCombatTotals = {
    matches: matches.length,
    unitsSpawned: 0,
    unitsDestroyed: 0,
    damageTotal: 0,
    coresDestroyed: 0,
    wallsDestroyed: 0,
    gemsGained: 0,
    tilesTraveled: 0,
  };
  for (const { stats } of matches) {
    if (!stats) continue;
    totals.unitsSpawned += stats.unitsSpawned;
    totals.unitsDestroyed += stats.unitsDestroyed;
    totals.damageTotal += stats.damageTotal;
    totals.coresDestroyed += stats.coresDestroyed;
    totals.wallsDestroyed += stats.wallsDestroyed;
    totals.gemsGained += stats.gemsGained;
    totals.tilesTraveled += stats.tilesTraveled;
  }
  return totals;
}
