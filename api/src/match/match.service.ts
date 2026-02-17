import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { TeamService } from "../team/team.service";
import { InjectRepository } from "@nestjs/typeorm";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchStatsEntity } from "./entites/matchStats.entity";
import { DataSource, In, Not, Repository } from "typeorm";
import { Swiss } from "tournament-pairings";
import { EventService } from "../event/event.service";
// @ts-ignore
import { Player } from "tournament-pairings/interfaces";
import { EventEntity } from "../event/entities/event.entity";
import { ClientProxy, ClientProxyFactory } from "@nestjs/microservices";
import { getRabbitmqConfig } from "../main";
import { ConfigService } from "@nestjs/config";
import { TeamEntity } from "../team/entities/team.entity";
import { Cron, CronExpression } from "@nestjs/schedule";
import { GithubApiService } from "../github-api/github-api.service";
import { FindOptionsRelations } from "typeorm/find-options/FindOptionsRelations";
import { MatchTeamResultEntity } from "./entites/match.team.result.entity";
import { LockKeys } from "../constants";

@Injectable()
export class MatchService {
  private readonly gameResultsQueue: ClientProxy;
  private readonly gameQueue: ClientProxy;
  private readonly logger = new Logger("MatchService");
  private readonly k8sServiceUrl: string;

  constructor(
    @Inject(forwardRef(() => TeamService))
    private readonly teamService: TeamService,
    @Inject(forwardRef(() => EventService))
    private readonly eventService: EventService,
    @InjectRepository(MatchEntity)
    private readonly matchRepository: Repository<MatchEntity>,
    @InjectRepository(MatchStatsEntity)
    private readonly matchStatsRepository: Repository<MatchStatsEntity>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly githubApiService: GithubApiService,
  ) {
    this.k8sServiceUrl = configService.getOrThrow<string>("K8S_SERVICE_URL");
    this.gameResultsQueue = ClientProxyFactory.create(
      getRabbitmqConfig(configService, "game_results"),
    );
    this.gameQueue = ClientProxyFactory.create(
      getRabbitmqConfig(configService, "game_queue"),
    );
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processQueueMatches() {
    const lockKey = LockKeys.PROCESS_QUEUE_MATCHES;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const gotLock = await queryRunner.query(
        "SELECT pg_try_advisory_lock($1)",
        [lockKey],
      );

      if (gotLock[0].pg_try_advisory_lock) {
        try {
          const events = await this.eventService.getAllEventsForQueue();
          await Promise.all(
            events.map(async (event) => {
              let teamsInQueue = await this.teamService.getTeamsInQueue(
                event.id,
              );
              while (teamsInQueue.length >= 2) {
                const team1 =
                  teamsInQueue[Math.floor(Math.random() * teamsInQueue.length)];
                teamsInQueue = teamsInQueue.filter(
                  (team) => team.id !== team1.id,
                );
                const team2 =
                  teamsInQueue[Math.floor(Math.random() * teamsInQueue.length)];
                teamsInQueue = teamsInQueue.filter(
                  (team) => team.id !== team2.id,
                );
                this.logger.log(
                  `Creating queue match for teams ${team1.name} and ${team2.name} in event ${event.name}.`,
                );
                const match = await this.createMatch(
                  [team1.id, team2.id],
                  0,
                  MatchPhase.QUEUE,
                );
                await this.startMatch(match.id);
                await this.teamService.removeFromQueue(team1.id);
                await this.teamService.removeFromQueue(team2.id);
              }
            }),
          );
        } finally {
          await queryRunner.query("SELECT pg_advisory_unlock($1)", [lockKey]);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  async processMatchResult(
    matchId: string,
    winnerId: string,
    stats: {
      actions_executed: number;
      damage_deposits: number;
      gempiles_destroyed: number;
      damage_total: number;
      gems_gained: number;
      damage_walls: number;
      damage_cores: number;
      units_spawned: number;
      tiles_traveled: number;
      damage_self: number;
      damage_units: number;
      walls_destroyed: number;
      gems_transferred: number;
      units_destroyed: number;
      cores_destroyed: number;
      damage_opponent: number;
    },
  ) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: {
        teams: {
          event: true,
        },
        winner: true,
      },
    });

    if (!match) throw new Error(`Match with id ${matchId} not found.`);

    if (match.state !== MatchState.IN_PROGRESS)
      throw new Error(`Match with id ${matchId} is not in READY state.`);

    const winner = match.teams.find((team) => team.id === winnerId);
    if (!winner)
      throw new Error(`Winner with id ${winnerId} not found in match teams.`);

    match.winner = winner;
    match.state = MatchState.FINISHED;
    match.results = [];
    match.stats = {
      ...match.stats,
      actionsExecuted: stats.actions_executed,
      damageDeposits: stats.damage_deposits,
      gempilesDestroyed: stats.gempiles_destroyed,
      damageTotal: stats.damage_total,
      gemsGained: stats.gems_gained,
      damageWalls: stats.damage_walls,
      damageCores: stats.damage_cores,
      unitsSpawned: stats.units_spawned,
      tilesTraveled: stats.tiles_traveled,
      damageSelf: stats.damage_self,
      damageUnits: stats.damage_units,
      wallsDestroyed: stats.walls_destroyed,
      gemsTransferred: stats.gems_transferred,
      unitsDestroyed: stats.units_destroyed,
      coresDestroyed: stats.cores_destroyed,
      damageOpponent: stats.damage_opponent,
    };

    if (match.phase === MatchPhase.SWISS) {
      await this.teamService.increaseTeamScore(winner.id, 1);
      match.results = match.teams.map((team) => {
        return {
          team: { id: team.id } as any,
          score: team.id === winnerId ? team.score + 1 : team.score,
          match: { id: match.id } as any,
        } as MatchTeamResultEntity;
      });
    } else if (match.phase === MatchPhase.QUEUE) {
      const loser = match.teams.find((team) => team.id !== winnerId);
      if (loser) {
        const winnerElo = winner.queueScore;
        const loserElo = loser.queueScore;
        const k = 32;
        const expectedWin =
          1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedLose =
          1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
        const newWinnerElo = Math.round(winnerElo + k * (1 - expectedWin));
        const newLoserElo = Math.max(
          0,
          Math.round(loserElo + k * (0 - expectedLose)),
        );
        await this.teamService.setQueueScore(winner.id, newWinnerElo);
        await this.teamService.setQueueScore(loser.id, newLoserElo);
        match.results = match.teams.map((team) => {
          return {
            team: { id: team.id } as any,
            score: team.id === winner.id ? newWinnerElo : newLoserElo,
            match: { id: match.id } as any,
          } as MatchTeamResultEntity;
        });
      }
    }
    await this.matchRepository.save(match);
    this.logger.log(
      `Match with id ${matchId} finished. Winner: ${winner.name}`,
    );

    const event = match.teams[0].event;
    if (!event) {
      throw new Error(`Event for match with id ${matchId} not found.`);
    }

    const notFinishedMatches = await this.matchRepository.count({
      where: {
        teams: {
          event: {
            id: event.id,
          },
        },
        state: Not(MatchState.FINISHED),
        phase: match.phase,
        round: match.round,
      },
    });

    if (notFinishedMatches > 0) return;

    const [lockPart1, lockPart2] = this.getEventLockKey(event.id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Use advisory lock to prevent multiple round finishes for the same event
      await queryRunner.query("SELECT pg_advisory_xact_lock($1, $2)", [
        lockPart1,
        lockPart2,
      ]);

      // Re-check if the round is still unfinished inside the transaction
      const stillNotFinished = await queryRunner.manager.count(MatchEntity, {
        where: {
          teams: { event: { id: event.id } },
          state: Not(MatchState.FINISHED),
          phase: match.phase,
          round: match.round,
        },
      });

      const currentEvent = await queryRunner.manager.findOne(EventEntity, {
        where: { id: event.id },
      });

      if (
        stillNotFinished === 0 &&
        currentEvent &&
        currentEvent.currentRound === match.round
      ) {
        if (match.phase == MatchPhase.SWISS) {
          await this.processSwissFinishRound(event.id);
        } else if (match.phase == MatchPhase.ELIMINATION) {
          await this.processTournamentFinishRound(currentEvent);
        }
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error finishing round for event ${event.id}: ${err.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private getEventLockKey(eventId: string): [number, number] {
    const hex = eventId.replace(/-/g, "");
    const part1 = parseInt(hex.slice(0, 8), 16) | 0;
    const part2 = parseInt(hex.slice(8, 16), 16) | 0;
    return [part1, part2];
  }

  async processSwissFinishRound(evenId: string) {
    const event = await this.eventService.getEventById(evenId, {
      teams: true,
    });

    const finishedRound = event.currentRound;
    await this.eventService.increaseEventRound(evenId);
    this.logger.log(
      `Event ${event.name} has finished round ${finishedRound}.`,
    );

    if (
      finishedRound + 1 >=
      this.getMaxSwissRounds(event.teams.length)
    ) {
      this.logger.log(
        `Event ${event.name} has reached the maximum Swiss rounds.`,
      );
      await this.eventService.setCurrentRound(event.id, 0);
      await this.calculateBuchholzPoints(event.id);
      return;
    }

    await this.createNextSwissMatches(event.id);
  }

  async processTournamentFinishRound(event: EventEntity) {
    const finishedMatches = await this.matchRepository.countBy({
      teams: {
        event: {
          id: event.id,
        },
      },
      state: MatchState.FINISHED,
      phase: MatchPhase.ELIMINATION,
      round: event.currentRound,
    });

    const totalMatches = await this.matchRepository.countBy({
      teams: {
        event: {
          id: event.id,
        },
      },
      phase: MatchPhase.ELIMINATION,
      round: event.currentRound,
    });

    if (totalMatches == 0) {
      throw new Error(
        `No finished matches found for event ${event.name} in round ${event.currentRound}.`,
      );
    }

    const tournamentTeamCount = await this.getTournamentTeamCount(event.id);
    const finalRoundIndex = Math.max(0, Math.log2(tournamentTeamCount) - 1);

    if (event.currentRound >= finalRoundIndex) {
      this.logger.log(`Event ${event.name} has finished the final round.`);
      return;
    }

    if (finishedMatches < totalMatches) return;

    const finishedRound = event.currentRound;
    await this.eventService.increaseEventRound(event.id);
    this.logger.log(
      `Event ${event.name} has finished round ${finishedRound}.`,
    );
    await this.createNextTournamentMatches(event.id);
  }

  async startMatch(matchId: string) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: {
        teams: {
          event: true,
          starterTemplate: true,
        },
        winner: true,
      },
    });

    if (!match) throw new Error(`Match with id ${matchId} not found.`);

    if (match.state !== MatchState.PLANNED)
      throw new Error(`Match with id ${matchId} is not in PLANNED state.`);

    match.state = MatchState.IN_PROGRESS;
    await this.matchRepository.save(match);

    if (this.configService.get<string>("NODE_ENV") === "development") {
      const botIdMapping: Record<string, string> = {};
      match.teams.forEach((team) => {
        botIdMapping[team.id] = team.id;
      });

      // Add a small delay in dev mode so the user can test the queue state
      setTimeout(() => {
        this.gameResultsQueue.emit("game_server", {
          game_id: matchId,
          team_results: match.teams.map((team) => ({
            id: team.id,
            name: team.name,
            place: Math.random() * 10,
          })),
          game_end_reason: 0,
          version: "1.0.0",
          BOT_ID_MAPPING: botIdMapping,
          stats: {
            actions_executed: Math.floor(Math.random() * 1000),
            damage_deposits: Math.floor(Math.random() * 1000),
            gempiles_destroyed: Math.floor(Math.random() * 1000),
            damage_total: Math.floor(Math.random() * 1000),
            gems_gained: Math.floor(Math.random() * 1000),
            damage_walls: Math.floor(Math.random() * 1000),
            damage_cores: Math.floor(Math.random() * 1000),
            units_spawned: Math.floor(Math.random() * 1000),
            tiles_traveled: Math.floor(Math.random() * 1000),
            damage_self: Math.floor(Math.random() * 1000),
            damage_units: Math.floor(Math.random() * 1000),
            walls_destroyed: Math.floor(Math.random() * 1000),
            gems_transferred: Math.floor(Math.random() * 1000),
            units_destroyed: Math.floor(Math.random() * 1000),
            cores_destroyed: Math.floor(Math.random() * 1000),
            damage_opponent: Math.floor(Math.random() * 1000),
          },
        });
      }, 5000);
      return;
    }

    const event = match.teams[0].event;
    const orgName = event.githubOrg;
    const orgSecret = this.githubApiService.decryptSecret(
      event.githubOrgSecret,
    );
    const repoPrefix = `https://${orgName}:${orgSecret}@github.com/${orgName}/`;

    this.gameQueue.emit("new_match", {
      id: matchId,
      image: event.gameServerDockerImage,
      bots: [
        {
          id: match.teams[0].id,
          image:
            match.teams[0].starterTemplate?.myCoreBotDockerImage ??
            event.myCoreBotDockerImage,
          repoURL: repoPrefix + match.teams[0].repo,
          name: match.teams[0].name,
        },
        {
          id: match.teams[1].id,
          image:
            match.teams[1].starterTemplate?.myCoreBotDockerImage ??
            event.myCoreBotDockerImage,
          repoURL: repoPrefix + match.teams[1].repo,
          name: match.teams[1].name,
        },
      ],
      gameConfig: event.gameConfig,
      serverConfig: event.serverConfig,
    });
  }

  async createMatch(teamIds: string[], round: number, phase: MatchPhase) {
    const match = this.matchRepository.create({
      teams: teamIds.map((id) => ({ id })),
      round,
      phase,
      state: MatchState.PLANNED,
      stats: new MatchStatsEntity(),
    });

    return this.matchRepository.save(match);
  }

  async getFormerOpponents(teamId: string): Promise<TeamEntity[]> {
    const matches = await this.matchRepository.find({
      where: {
        teams: {
          id: teamId,
        },
        state: MatchState.FINISHED,
        phase: MatchPhase.SWISS,
      },
      relations: {
        teams: true,
      },
    });

    const opponents = new Set<TeamEntity>();
    for (const match of matches) {
      for (const team of match.teams) {
        if (team.id !== teamId) {
          opponents.add(team);
        }
      }
    }

    return Array.from(opponents);
  }

  async createNextSwissMatches(eventId: string) {
    const event = await this.eventService.getEventById(eventId, {
      teams: true,
    });

    const existingMatches = await this.matchRepository.countBy({
      teams: {
        event: {
          id: eventId,
        },
      },
      round: event.currentRound,
      phase: MatchPhase.SWISS,
    });

    if (existingMatches > 0) {
      this.logger.warn(
        `Matches for Swiss round ${event.currentRound} already exist for event ${event.name}. Skipping creation.`,
      );
      return [];
    }

    const maxSwissRounds = this.getMaxSwissRounds(event.teams.length);
    if (event.currentRound >= maxSwissRounds) {
      this.logger.error(
        `Cannot create Swiss matches for event ${event.name} in round ${event.currentRound}. Maximum rounds reached: ${maxSwissRounds}`,
      );
      throw new Error(`Maximum Swiss rounds reached for event ${event.name}.`);
    }

    const players: Player[] = await Promise.all(
      event.teams.map(async (team) => ({
        id: team.id,
        score: team.score,
        receivedBye: team.hadBye,
        avoid: await this.getFormerOpponents(team.id).then((opponents) =>
          opponents.map((opponent) => opponent.id),
        ),
        rating: true,
      })),
    );

    const matches = Swiss(players, event.currentRound);
    const matchEntities: (MatchEntity | null)[] = await Promise.all(
      matches.map(async (match) => {
        if (match.player1 === match.player2) {
          this.logger.error(
            `Player ${match.player1} cannot be paired with themselves in Swiss pairing.`,
          );
          throw new Error(
            "A player cannot be paired with themselves in Swiss pairing.",
          );
        }

        if (!match.player1 || !match.player2) {
          this.logger.log(
            `The team ${match.player1 || match.player2} got a bye in round ${event.currentRound} of event ${event.name}.`,
          );
          await this.teamService.setHadBye(
            (match.player1 || match.player2) as string,
            true,
          );
          return null;
        }
        return this.createMatch(
          [match.player1 as string, match.player2 as string],
          event.currentRound,
          MatchPhase.SWISS,
        );
      }),
    );
    const filteredMatchEntities = matchEntities.filter(
      (match): match is MatchEntity => match !== null,
    );

    this.logger.log(
      `Created ${filteredMatchEntities.length} Swiss matches for event ${event.name} in round ${event.currentRound}.`,
    );
    for (let matchEntity of filteredMatchEntities)
      await this.startMatch(matchEntity.id);
    return filteredMatchEntities;
  }

  async createFirstTournamentMatches(event: EventEntity) {
    const teamsCount = event.teams.length;
    const highestPowerOfTwo = Math.pow(2, Math.floor(Math.log2(teamsCount)));

    if (highestPowerOfTwo < 2) {
      throw new Error(
        "Not enough teams to create matches for the first round of the tournament. Minimum 2 teams required.",
      );
    }

    const sortedTeams = await this.teamService.getSortedTeamsForTournament(
      event.id,
    );

    const existingMatches = await this.matchRepository.countBy({
      teams: {
        event: {
          id: event.id,
        },
      },
      round: 0,
      phase: MatchPhase.ELIMINATION,
    });

    if (existingMatches > 0) {
      this.logger.warn(
        `Matches for tournament round 0 already exist for event ${event.name}. Skipping creation.`,
      );
      return;
    }

    this.logger.log(
      `start tournament with ${highestPowerOfTwo} teams for event ${event.name}`,
    );

    const seedOrder = this.generateSeedOrder(highestPowerOfTwo);

    for (let i = 0; i < highestPowerOfTwo; i += 2) {
      const team1 = sortedTeams[seedOrder[i]];
      const team2 = sortedTeams[seedOrder[i + 1]];

      if (!team1 || !team2) {
        throw new Error(
          "Not enough teams to create matches for the first round of the tournament.",
        );
      }

      const newMatch = await this.createMatch(
        [team1.id, team2.id],
        0,
        MatchPhase.ELIMINATION,
      );
      await this.startMatch(newMatch.id);
    }

    this.logger.log(
      `Created tournament matches for event ${event.name} in round 0.`,
    );
  }

  async createNextTournamentMatches(eventId: string) {
    const event = await this.eventService.getEventById(eventId, {
      teams: true,
    });

    if (event.currentRound == 0)
      return this.createFirstTournamentMatches(event);

    const existingMatches = await this.matchRepository.countBy({
      teams: {
        event: {
          id: eventId,
        },
      },
      round: event.currentRound,
      phase: MatchPhase.ELIMINATION,
    });

    if (existingMatches > 0) {
      this.logger.warn(
        `Matches for elimination round ${event.currentRound} already exist for event ${event.name}. Skipping creation.`,
      );
      return [];
    }

    const lastMatches = await this.matchRepository.find({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
        round: event.currentRound - 1,
        state: MatchState.FINISHED,
        phase: MatchPhase.ELIMINATION,
      },
      relations: {
        winner: true,
        teams: true,
      },
      order: {
        createdAt: "ASC",
      },
    });

    if (lastMatches.length == 0) {
      throw new Error(
        "No finished matches found for the last round. Cannot create next tournament matches.",
      );
    }

    if (lastMatches.length % 2 != 0) {
      throw new Error(
        "Odd number of matches in the last round. Cannot create next tournament matches.",
      );
    }

    for (let i = 0; i < lastMatches.length; i += 2) {
      const match1 = lastMatches[i];
      const match2 = lastMatches[i + 1];

      if (!match1.winner || !match2.winner) {
        throw new Error(
          "One of the matches does not have a winner. Cannot create next tournament matches.",
        );
      }

      // Winners play for the next round (or Final)
      const finalMatch = await this.createMatch(
        [match1.winner.id, match2.winner.id],
        event.currentRound,
        MatchPhase.ELIMINATION,
      );
      await this.startMatch(finalMatch.id);

      // If this was the semi-final (2 matches in last round), also create third place match
      if (lastMatches.length === 2) {
        const loser1 = match1.teams.find((t) => t.id !== match1.winner?.id);
        const loser2 = match2.teams.find((t) => t.id !== match2.winner?.id);

        if (loser1 && loser2) {
          const thirdPlaceMatch = await this.createMatch(
            [loser1.id, loser2.id],
            event.currentRound,
            MatchPhase.ELIMINATION,
          );
          await this.startMatch(thirdPlaceMatch.id);
        }
      }
    }

    this.logger.log(
      `Created next tournament matches for event ${event.name} in round ${event.currentRound}.`,
    );
  }

  async getSwissMatches(eventId: string, userId: string, adminReveal: boolean) {
    const swissMatches = await this.matchRepository.find({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
        phase: MatchPhase.SWISS,
      },
      relations: {
        results: {
          team: true,
        },
        teams: true,
        winner: true,
      },
    });

    if (
      userId &&
      (await this.eventService.isEventAdmin(eventId, userId)) &&
      adminReveal
    )
      return swissMatches;

    return swissMatches.map((match) => {
      if (match.isRevealed) return match;
      return {
        ...match,
        state: MatchState.PLANNED,
        winner: null,
        results: [],
      };
    });
  }

  getMaxSwissRounds(teams: number): number {
    return Math.ceil(Math.log2(teams));
  }

  generateSeedOrder(teams: number): number[] {
    const seedOrder = new Array(teams);
    for (let i = 0; i < teams; i += 2) {
      seedOrder[i] = i;
    }

    for (let i = 1; i < teams; i += 2) {
      seedOrder[i] = teams - i;
    }
    return seedOrder;
  }

  async getTournamentTeamCount(eventId: string) {
    const teamsCount = await this.teamService.getTeamCountForEvent(eventId);
    return Math.pow(2, Math.floor(Math.log2(teamsCount)));
  }

  async calculateBuchholzPoints(eventId: string): Promise<void> {
    const teams = await this.teamService.getTeamsForEvent(eventId);

    await Promise.all(
      teams.map(async (team) => {
        const buchholzPoints = await this.calculateBuchholzPointsForTeam(
          team.id,
          eventId,
        );
        await this.teamService.updateBuchholzPoints(team.id, buchholzPoints);
      }),
    );
  }

  async calculateBuchholzPointsForTeam(
    teamId: string,
    eventId: string,
  ): Promise<number> {
    const wonMatches = await this.matchRepository.find({
      where: {
        winner: {
          id: teamId,
        },
      },
      relations: {
        teams: true,
      },
    });

    let sum = 0;
    for (const match of wonMatches) {
      const opponent = match.teams.find((team) => team.id !== teamId);
      if (opponent) sum += opponent.score;
    }
    return sum;
  }

  async getTournamentMatches(
    eventId: string,
    userId: string,
    adminReveal: boolean,
  ) {
    const tournamentMatches = await this.matchRepository.find({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
        phase: MatchPhase.ELIMINATION,
      },
      relations: {
        teams: true,
        winner: true,
      },
      order: {
        createdAt: "ASC",
      },
    });

    const matchesWithPlacement = this.addPlacementMatchFlags(tournamentMatches);

    if (
      userId &&
      (await this.eventService.isEventAdmin(eventId, userId)) &&
      adminReveal
    )
      return matchesWithPlacement;

    return matchesWithPlacement.map((match) => {
      if (match.isRevealed) return match;
      return {
        ...match,
        state: MatchState.PLANNED,
        winner: null,
        results: [],
        isPlacementMatch: match.isPlacementMatch,
      };
    });
  }

  private addPlacementMatchFlags(
    matches: MatchEntity[],
  ): Array<MatchEntity & { isPlacementMatch?: boolean }> {
    if (matches.length === 0) return matches;

    const maxRound = Math.max(...matches.map((match) => match.round));
    if (!Number.isFinite(maxRound)) return matches;

    const previousRoundMatches = matches.filter(
      (match) => match.round === maxRound - 1,
    );
    if (previousRoundMatches.length === 0) return matches;

    const loserIds = new Set<string>();
    for (const match of previousRoundMatches) {
      const loser = match.teams?.find((team) => team.id !== match.winner?.id);
      if (loser) loserIds.add(loser.id);
    }

    if (loserIds.size < 2) return matches;

    return matches.map((match) => {
      if (match.round !== maxRound) return match;
      if (
        match.teams?.length === 2 &&
        match.teams.every((team) => loserIds.has(team.id))
      ) {
        return {
          ...match,
          isPlacementMatch: true,
        };
      }
      return match;
    });
  }

  getLastQueueMatchForTeam(teamId: string) {
    return this.matchRepository.findOne({
      where: {
        teams: {
          id: teamId,
        },
        phase: MatchPhase.QUEUE,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async getMatchesForTeam(teamId: string) {
    const matchesToQuery = (
      await this.matchRepository.find({
        select: {
          id: true,
        },
        where: [
          {
            teams: { id: teamId },
            state: MatchState.FINISHED,
            phase: MatchPhase.QUEUE,
          },
          {
            teams: { id: teamId },
            state: MatchState.FINISHED,
            isRevealed: true,
          },
        ],
        withDeleted: true,
      })
    ).map((match) => match.id);

    if (matchesToQuery.length === 0) return [];

    const matches = await this.matchRepository.find({
      where: {
        id: In(matchesToQuery),
      },
      relations: {
        results: {
          team: true,
        },
        teams: true,
        winner: true,
      },
      order: {
        createdAt: "DESC",
      },
      withDeleted: true,
    });

    return matches.map((match) => {
      // Reveal ID only if it's NOT from the queue AND it is revealed.
      const shouldRevealId =
        match.phase !== MatchPhase.QUEUE && match.isRevealed;

      if (!shouldRevealId) {
        const { id: _id, ...rest } = match;
        return rest;
      }
      return match;
    });
  }

  async getQueueMatches(eventId: string, userId: string) {
    const matchesToQuery = (
      await this.matchRepository.find({
        select: {
          id: true,
        },
        where: {
          teams: {
            event: {
              id: eventId,
            },
            users: {
              id: userId,
            },
          },
          phase: MatchPhase.QUEUE,
          state: MatchState.FINISHED,
        },
      })
    ).map((match) => match.id);

    return this.matchRepository.find({
      where: {
        id: In(matchesToQuery),
      },
      relations: {
        results: {
          team: true,
        },
        teams: true,
        winner: true,
      },
      take: 20,
      order: {
        createdAt: "DESC",
      },
    });
  }

  async getAllQueueMatches(eventId: string) {
    return this.matchRepository.find({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
        phase: MatchPhase.QUEUE,
      },
      relations: {
        results: {
          team: true,
        },
        teams: true,
        winner: true,
      },
      take: 100,
      order: {
        createdAt: "DESC",
      },
    });
  }

  async getMatchLogs(
    matchId: string,
    userId: string,
  ): Promise<
    {
      container: string;
      team?: string;
      logs: string[];
    }[]
  > {
    const match = await this.matchRepository.findOneOrFail({
      where: {
        id: matchId,
      },
      relations: {
        teams: {
          event: true,
        },
      },
    });
    const event = match.teams[0].event;
    if (!event) {
      this.logger.error(`Event for match with id ${matchId} not found.`);
      return [];
    }

    let isEventAdmin = false;
    if (userId)
      isEventAdmin = await this.eventService.isEventAdmin(event.id, userId);

    const containers: {
      id: string;
      containers: string[];
    } = await fetch(`${this.k8sServiceUrl}/v1/match/${matchId}/logs/containers`)
      .then((res) => res.json())
      .catch((err) => {
        this.logger.error(
          `Error fetching containers for match ${matchId}: ${err.message}`,
        );
      });

    if (
      !containers ||
      !containers.containers ||
      containers.containers.length === 0
    ) {
      this.logger.warn(`No containers found for match ${matchId}.`);
      return [];
    }

    let mappedLogs = await Promise.all(
      containers.containers.map(async (container) => {
        if (!isEventAdmin && container === "game") {
          return {
            container: container,
            logs: [],
          };
        }
        const logs = await fetch(
          `${this.k8sServiceUrl}/v1/match/${matchId}/logs?container=${container}`,
        ).then((res) => res.text());
        const team = match.teams.find(
          (team) => team.id === container.replace("bot-", ""),
        );

        return {
          container,
          team: team?.name,
          logs: logs.split("\n").filter((line) => line.trim() !== ""),
        };
      }),
    );
    if (!isEventAdmin)
      mappedLogs = mappedLogs.filter((log) => log.container !== "game");
    return mappedLogs;
  }

  async getMatchById(
    matchId: string,
    relations: FindOptionsRelations<MatchEntity> = {},
    userId?: string,
    adminReveal?: boolean,
  ): Promise<MatchEntity> {
    const match = await this.matchRepository.findOneOrFail({
      where: { id: matchId },
      relations,
    });

    if (match.isRevealed) return match;

    if (userId) {
      const eventId = match.teams?.[0]?.event?.id;
      if (
        eventId &&
        (await this.eventService.isEventAdmin(eventId, userId)) &&
        adminReveal
      ) {
        return match;
      }
    }

    return {
      ...match,
      state: MatchState.PLANNED,
      winner: null,
      results: [],
    };
  }

  async revealMatch(matchId: string) {
    await this.matchRepository.update(matchId, {
      isRevealed: true,
    });
  }

  async revealAllMatchesInPhase(eventId: string, phase: MatchPhase) {
    const matches = await this.matchRepository.find({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
        phase: phase,
      },
    });

    if (matches.length > 0) {
      await this.matchRepository.update(
        matches.map((m) => m.id),
        { isRevealed: true },
      );
    }
  }

  async cleanupMatchesInPhase(eventId: string, phase: MatchPhase) {
    const matches = await this.matchRepository.find({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
        phase: phase,
      },
    });

    if (matches.length > 0) {
      await this.matchRepository.delete(matches.map((m) => m.id));
    }

    if (phase === MatchPhase.SWISS) {
      await this.eventService.setCurrentRound(eventId, 0);
      await this.teamService.resetSwissStatsForEvent(eventId);
    } else if (phase === MatchPhase.ELIMINATION) {
      await this.eventService.setCurrentRound(eventId, 0);
    }
  }

  async calculateRevealedBuchholzPointsForTeam(
    teamId: string,
    eventId: string,
  ): Promise<number> {
    // A team's revealed Buchholz points is the sum of revealed scores of its opponents.
    // We already have getFormerOpponents, but that's for ALL finished matches.
    // For "revealed" Buchholz, we only care about Swiss phase.

    const matches = await this.matchRepository.find({
      where: {
        teams: { id: teamId },
        phase: MatchPhase.SWISS,
        state: MatchState.FINISHED,
      },
      relations: { teams: true },
    });

    let totalRevealedBuchholz = 0;
    for (const match of matches) {
      const opponent = match.teams.find((t) => t.id !== teamId);
      if (opponent) {
        // Opponent's revealed score = count of revealed wins in Swiss
        const revealedWins = await this.matchRepository.count({
          where: {
            winner: { id: opponent.id },
            isRevealed: true,
            phase: MatchPhase.SWISS,
          },
        });
        totalRevealedBuchholz += revealedWins;
      }
    }
    return totalRevealedBuchholz;
  }

  getGlobalStats() {
    return this.matchStatsRepository
      .createQueryBuilder("match_stats")
      .select("SUM(match_stats.actionsExecuted)", "actionsExecuted")
      .addSelect("SUM(match_stats.damageDeposits)", "damageDeposits")
      .addSelect("SUM(match_stats.gempilesDestroyed)", "gempilesDestroyed")
      .addSelect("SUM(match_stats.damageTotal)", "damageTotal")
      .addSelect("SUM(match_stats.gemsGained)", "gemsGained")
      .addSelect("SUM(match_stats.damageWalls)", "damageWalls")
      .addSelect("SUM(match_stats.damageCores)", "damageCores")
      .addSelect("SUM(match_stats.unitsSpawned)", "unitsSpawned")
      .addSelect("SUM(match_stats.tilesTraveled)", "tilesTraveled")
      .addSelect("SUM(match_stats.damageSelf)", "damageSelf")
      .addSelect("SUM(match_stats.damageUnits)", "damageUnits")
      .addSelect("SUM(match_stats.wallsDestroyed)", "wallsDestroyed")
      .addSelect("SUM(match_stats.gemsTransferred)", "gemsTransferred")
      .addSelect("SUM(match_stats.unitsDestroyed)", "unitsDestroyed")
      .addSelect("SUM(match_stats.coresDestroyed)", "coresDestroyed")
      .addSelect("SUM(match_stats.damageOpponent)", "damageOpponent")
      .getRawOne<{
        actionsExecuted?: string;
        damageDeposits?: string;
        gempilesDestroyed?: string;
        damageTotal?: string;
        gemsGained?: string;
        damageWalls?: string;
        damageCores?: string;
        unitsSpawned?: string;
        tilesTraveled?: string;
        damageSelf?: string;
        damageUnits?: string;
        wallsDestroyed?: string;
        gemsTransferred?: string;
        unitsDestroyed?: string;
        coresDestroyed?: string;
        damageOpponent?: string;
      }>();
  }

  async getQueueMatchesTimeSeries(params: {
    interval?: "minute" | "hour" | "day";
    start?: Date;
    end?: Date;
    eventId?: string;
  }): Promise<Array<{ bucket: string; count: number }>> {
    const interval = params.interval ?? "hour";
    const valid = new Set(["minute", "hour", "day"]);
    const unit = valid.has(interval) ? interval : "hour";

    // Determine time range
    const now = new Date();
    const start = params.start ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = params.end ?? now;

    const qb = this.matchRepository
      .createQueryBuilder("m")
      .where("m.phase = :phase", { phase: MatchPhase.QUEUE })
      .andWhere("m.state = :state", { state: MatchState.FINISHED })
      .andWhere("m.updatedAt BETWEEN :start AND :end", { start, end })
      .select(`date_trunc('${unit}', m."updatedAt")`, "bucket")
      .addSelect("COUNT(DISTINCT m.id)", "count")
      .groupBy("bucket")
      .orderBy("bucket", "ASC");

    if (params.eventId) {
      qb.innerJoin("m.teams", "t")
        .innerJoin("t.event", "e")
        .andWhere("e.id = :eventId", { eventId: params.eventId });
    }

    const rows = await qb.getRawMany<{ bucket: Date; count: string }>();
    return rows.map((r) => ({
      bucket: new Date(r.bucket as any).toISOString(),
      count: parseInt(r.count, 10),
    }));
  }
}
