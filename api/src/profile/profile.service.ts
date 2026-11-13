import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { SocialPlatform } from "../user/entities/social-account.entity";
import { getLocationTags } from "../user/location-tags";
import { TeamEntity } from "../team/entities/team.entity";
import { getEventState } from "../event/event-lifecycle";
import { MatchEntity, MatchPhase } from "../match/entites/match.entity";
import { MatchStatsEntity } from "../match/entites/matchStats.entity";
import { toMatchTeamResponse } from "../match/match-response";
import type { MatchTeamResponse } from "../match/match-response";
import { addPlacementMatchFlags } from "../match/placement-matches";
import {
  canViewTeamMatchReplay,
  findVisibleTeamMatchIds,
} from "../match/team-match-visibility";
import { getBracketFinish } from "./profile-finish";
import { getVisibleRepo } from "./profile-repo";
import { summarizeMatches } from "./profile-summary";
import type { ProfileMatchRow, RivalCount } from "./profile-summary";
import type { ProfileMatchesQueryDto } from "./profile-matches-query.dto";
import type {
  ProfileCombatTotals,
  ProfileMatchesResponse,
  ProfileResponse,
  ProfileRivalResponse,
  ProfileTeamResponse,
} from "./profile-response";

interface ResolvedProfile {
  user: UserEntity;
  /** The player's teams this viewer may see, newest event first. */
  teams: TeamEntity[];
  viewerTeamIds: Set<string>;
}

interface Bracket {
  /** Teams that entered round 0. */
  size: number;
  placementMatchIds: Set<string>;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
    @InjectRepository(MatchStatsEntity)
    private readonly statsRepository: Repository<MatchStatsEntity>,
  ) {}

  async getProfile(
    username: string,
    viewerId: string,
    now = new Date(),
  ): Promise<ProfileResponse> {
    const { user, teams, viewerTeamIds } = await this.resolve(
      username,
      viewerId,
    );
    const teamIds = teams.map((team) => team.id);
    const matchIds = await findVisibleTeamMatchIds(
      this.matchRepository,
      teamIds,
    );
    const [rows, members, brackets, combat] = await Promise.all([
      this.getMatchRows(matchIds, teams),
      this.getMembers(teamIds),
      this.getBrackets(teams.map((team) => team.event.id)),
      this.sumCombat(matchIds),
    ]);
    const summary = summarizeMatches(rows, now);

    const rivalCounts = Object.values(summary.rivals).filter(
      (rival): rival is RivalCount => rival !== null,
    );
    const opponents = await this.getMatchTeams([
      ...summary.form.map((match) => match.opponentId),
      ...rivalCounts.map((rival) => rival.opponentId),
    ]);
    const rival = (count: RivalCount | null): ProfileRivalResponse | null => {
      const team = count && opponents.get(count.opponentId);
      if (!count || !team) return null;
      const { wins, losses, total, eventId } = count;
      return { team, eventId, wins, losses, total };
    };

    const emptyRecord = { wins: 0, losses: 0, draws: 0 };
    const teamResponses: ProfileTeamResponse[] = teams.map((team) => {
      const bracket = brackets.get(team.event.id);
      const bracketMatches = rows
        .filter(
          (match) =>
            match.teamId === team.id &&
            match.phase === MatchPhase.ELIMINATION &&
            match.result !== "DRAW",
        )
        .map((match) => ({
          round: match.round,
          won: match.result === "WIN",
          isPlacementMatch: bracket?.placementMatchIds.has(match.id) ?? false,
        }));
      const records = summary.teams.get(team.id);
      return {
        id: team.id,
        name: team.name,
        picture: team.picture ?? null,
        background: team.background ?? null,
        repo: getVisibleRepo(team, viewerTeamIds),
        starterTemplate: team.starterTemplate?.name ?? null,
        createdAt: team.createdAt,
        event: {
          id: team.event.id,
          name: team.event.name,
          state: getEventState(team.event, now),
          startDate: team.event.startDate,
          scheduledEndDate: team.event.scheduledEndDate,
        },
        members: members.get(team.id) ?? [],
        record: records?.record ?? emptyRecord,
        swissRecord: records?.swiss ?? emptyRecord,
        finish: getBracketFinish(bracketMatches, bracket?.size ?? 0),
      };
    });

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
      summary: {
        record: summary.record,
        form: summary.form.map((match) => ({
          result: match.result,
          createdAt: match.createdAt,
          opponent: match.opponentId
            ? (opponents.get(match.opponentId)?.name ?? null)
            : null,
        })),
        streaks: summary.streaks,
        phases: summary.phases,
        activity: summary.activity,
        rivals: {
          nemesis: rival(summary.rivals.nemesis),
          favourite: rival(summary.rivals.favourite),
          mostPlayed: rival(summary.rivals.mostPlayed),
        },
      },
      combat,
    };
  }

  /** One page of the player's match history, newest first. */
  async getMatches(
    username: string,
    viewerId: string,
    query: ProfileMatchesQueryDto,
  ): Promise<ProfileMatchesResponse> {
    const { teams, viewerTeamIds } = await this.resolve(username, viewerId);
    const matchIds = await findVisibleTeamMatchIds(
      this.matchRepository,
      teams.map((team) => team.id),
    );
    const rows = (await this.getMatchRows(matchIds, teams))
      .filter(
        (match) =>
          (!query.eventId || match.eventId === query.eventId) &&
          (!query.phase || match.phase === query.phase),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const page = rows.slice(query.offset, query.offset + query.limit);
    if (page.length === 0) return { total: rows.length, matches: [] };

    const entities = new Map(
      (
        await this.matchRepository.find({
          where: { id: In(page.map((match) => match.id)) },
          relations: { teams: true },
          withDeleted: true,
        })
      ).map((match) => [match.id, match]),
    );

    return {
      total: rows.length,
      matches: page.map((row) => {
        const match = entities.get(row.id);
        const matchTeamIds = match?.teams.map((team) => team.id) ?? [];
        const opponent = match?.teams.find(
          (team) => team.id === row.opponentId,
        );
        const canView = canViewTeamMatchReplay(
          matchTeamIds.find((id) => viewerTeamIds.has(id)),
          matchTeamIds,
        );
        return {
          id: canView ? row.id : null,
          teamId: row.teamId,
          eventId: row.eventId,
          phase: row.phase,
          round: row.round,
          createdAt: row.createdAt,
          result: row.result,
          opponent: opponent ? toMatchTeamResponse(opponent) : null,
          stats: match?.stats
            ? {
                unitsSpawned: match.stats.unitsSpawned,
                coresDestroyed: match.stats.coresDestroyed,
                damageTotal: match.stats.damageTotal,
              }
            : null,
        };
      }),
    };
  }

  private async resolve(
    username: string,
    viewerId: string,
  ): Promise<ResolvedProfile> {
    const user = await this.userRepository
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.socialAccounts", "socialAccount")
      .where("LOWER(user.username) = LOWER(:username)", { username })
      .orderBy("user.updatedAt", "DESC")
      .getOne();
    if (!user) throw new NotFoundException("User not found");

    const [allTeams, viewerTeams, viewerEventIds] = await Promise.all([
      this.teamRepository.find({
        where: { users: { id: user.id } },
        relations: { event: true, starterTemplate: true },
      }),
      this.teamRepository.find({
        where: { users: { id: viewerId } },
        relations: { event: true },
        loadEagerRelations: false,
      }),
      this.getEventIdsOfUser(viewerId),
    ]);
    for (const team of viewerTeams) viewerEventIds.add(team.event.id);

    // Private events stay as hidden here as in the event list: only the
    // profile's owner and people taking part in the event see them. Everything
    // else on the profile is built from these teams only.
    const teams = allTeams
      .filter(
        (team) =>
          !team.event.isPrivate ||
          viewerId === user.id ||
          viewerEventIds.has(team.event.id),
      )
      .sort(
        (a, b) => b.event.startDate.getTime() - a.event.startDate.getTime(),
      );

    return {
      user,
      teams,
      viewerTeamIds: new Set(viewerTeams.map((team) => team.id)),
    };
  }

  /** The listed matches from the player's side, without their relations. */
  private async getMatchRows(
    matchIds: string[],
    teams: TeamEntity[],
  ): Promise<ProfileMatchRow[]> {
    if (matchIds.length === 0) return [];
    const eventOfTeam = new Map(teams.map((team) => [team.id, team.event.id]));
    const raw = await this.matchRepository
      .createQueryBuilder("match")
      .innerJoin("match.teams", "team")
      .select("match.id", "id")
      .addSelect("match.phase", "phase")
      .addSelect("match.round", "round")
      .addSelect("match.createdAt", "createdAt")
      .addSelect('"match"."winnerId"', "winnerId")
      .addSelect("team.id", "teamId")
      .where("match.id = ANY(:matchIds)", { matchIds })
      .withDeleted()
      .getRawMany<{
        id: string;
        phase: MatchPhase;
        round: number;
        createdAt: Date;
        winnerId: string | null;
        teamId: string;
      }>();

    const byMatch = new Map<
      string,
      { row: (typeof raw)[0]; teamIds: string[] }
    >();
    for (const row of raw) {
      const entry = byMatch.get(row.id) ?? { row, teamIds: [] };
      entry.teamIds.push(row.teamId);
      byMatch.set(row.id, entry);
    }

    const rows: ProfileMatchRow[] = [];
    for (const { row, teamIds } of byMatch.values()) {
      const teamId = teamIds.find((id) => eventOfTeam.has(id));
      if (!teamId) continue;
      rows.push({
        id: row.id,
        phase: row.phase,
        round: row.round,
        createdAt: new Date(row.createdAt),
        teamId,
        eventId: eventOfTeam.get(teamId)!,
        opponentId: teamIds.find((id) => id !== teamId) ?? null,
        result: !row.winnerId
          ? "DRAW"
          : row.winnerId === teamId
            ? "WIN"
            : "LOSS",
      });
    }
    return rows;
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

  private async getEventIdsOfUser(userId: string) {
    const rows = await this.userRepository
      .createQueryBuilder("user")
      .innerJoin("user.events", "event")
      .select("event.id", "id")
      .where("user.id = :userId", { userId })
      .getRawMany<{ id: string }>();
    return new Set(rows.map((row) => row.id));
  }

  /**
   * Bracket size and match for third place per event, from all its bracket
   * matches. Both follow from the bracket's layout, which the bracket view
   * shows before results are revealed.
   */
  private async getBrackets(eventIds: string[]) {
    const brackets = new Map<string, Bracket>();
    if (eventIds.length === 0) return brackets;
    const raw = await this.matchRepository
      .createQueryBuilder("match")
      .innerJoin("match.teams", "team")
      .select("match.id", "id")
      .addSelect("match.round", "round")
      .addSelect('"match"."winnerId"', "winnerId")
      .addSelect("team.id", "teamId")
      .addSelect('"team"."eventId"', "eventId")
      .where("match.phase = :phase", { phase: MatchPhase.ELIMINATION })
      .andWhere('"team"."eventId" = ANY(:eventIds)', { eventIds })
      .withDeleted()
      .getRawMany<{
        id: string;
        round: number;
        winnerId: string | null;
        teamId: string;
        eventId: string;
      }>();

    const matches = new Map<
      string,
      {
        id: string;
        round: number;
        eventId: string;
        winner: { id: string } | null;
        teams: { id: string }[];
      }
    >();
    for (const row of raw) {
      const match = matches.get(row.id) ?? {
        id: row.id,
        round: row.round,
        eventId: row.eventId,
        winner: row.winnerId ? { id: row.winnerId } : null,
        teams: [],
      };
      match.teams.push({ id: row.teamId });
      matches.set(row.id, match);
    }

    for (const eventId of new Set(eventIds)) {
      const eventMatches = [...matches.values()].filter(
        (match) => match.eventId === eventId,
      );
      brackets.set(eventId, {
        size: 2 * eventMatches.filter((match) => match.round === 0).length,
        placementMatchIds: new Set(
          addPlacementMatchFlags(eventMatches)
            .filter((match) => match.isPlacementMatch)
            .map((match) => match.id),
        ),
      });
    }
    return brackets;
  }

  private async getMatchTeams(
    ids: Array<string | null>,
  ): Promise<Map<string, MatchTeamResponse>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const teams = await this.teamRepository.find({
      where: { id: In(unique) },
      withDeleted: true,
    });
    return new Map(teams.map((team) => [team.id, toMatchTeamResponse(team)]));
  }

  private async sumCombat(matchIds: string[]): Promise<ProfileCombatTotals> {
    const fields = [
      "unitsSpawned",
      "unitsDestroyed",
      "damageTotal",
      "coresDestroyed",
      "wallsDestroyed",
      "gemsGained",
      "tilesTraveled",
    ] as const;
    const totals: ProfileCombatTotals = {
      matches: matchIds.length,
      unitsSpawned: 0,
      unitsDestroyed: 0,
      damageTotal: 0,
      coresDestroyed: 0,
      wallsDestroyed: 0,
      gemsGained: 0,
      tilesTraveled: 0,
    };
    if (matchIds.length === 0) return totals;

    const query = this.statsRepository
      .createQueryBuilder("stats")
      .select([])
      .where('"stats"."matchId" = ANY(:matchIds)', { matchIds });
    for (const field of fields)
      query.addSelect(`COALESCE(SUM(stats.${field}), 0)`, field);
    const sums = await query.getRawOne<Record<string, string>>();
    for (const field of fields) totals[field] = Number(sums?.[field] ?? 0);
    return totals;
  }
}
