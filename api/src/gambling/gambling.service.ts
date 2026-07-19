import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { MatchStatsEntity } from "../match/entites/matchStats.entity";
import { MatchService } from "../match/match.service";
import { TeamEntity } from "../team/entities/team.entity";
import { PlaceGamblingBetDto } from "./dtos/place-gambling-bet.dto";
import { GamblingBetEntity } from "./entities/gambling-bet.entity";
import { GamblingEntryEntity } from "./entities/gambling-entry.entity";
import {
  GamblingRoundEntity,
  GamblingRoundPhase,
} from "./entities/gambling-round.entity";
import {
  toGamblingBetSummary,
  toSettledGamblingBetSummary,
} from "./gambling-bet-summary";
import { getMaximumGamblingBet } from "./gambling-credits";
import { calculateGamblingPayouts } from "./gambling-payout";

const PHASE_DURATION_MS = 30 * 60 * 1000;

type GamblingAdvanceAction =
  | { type: "start"; matchId: string }
  | { type: "settle"; matchId: string; winnerId: string }
  | null;

interface GamblingSettlementContext {
  round: GamblingRoundEntity;
  eventId: string;
  playedTeamIds: string[];
}

@Injectable()
export class GamblingService {
  private readonly logger = new Logger(GamblingService.name);

  constructor(
    @InjectRepository(GamblingRoundEntity)
    private readonly roundRepository: Repository<GamblingRoundEntity>,
    @InjectRepository(GamblingEntryEntity)
    private readonly entryRepository: Repository<GamblingEntryEntity>,
    @InjectRepository(GamblingBetEntity)
    private readonly betRepository: Repository<GamblingBetEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => MatchService))
    private readonly matchService: MatchService,
  ) {}

  @Cron("*/10 * * * * *")
  async advanceActiveRounds() {
    const rows = await this.roundRepository
      .createQueryBuilder("round")
      .select('DISTINCT "round"."eventId"', "eventId")
      .where("round.phase != :settled", {
        settled: GamblingRoundPhase.SETTLED,
      })
      .getRawMany<{ eventId: string }>();

    for (const { eventId } of rows) {
      try {
        await this.advanceEvent(eventId);
      } catch (error) {
        this.logger.error(
          `Could not advance gambling for event ${eventId}`,
          error,
        );
      }
    }
  }

  async getSnapshot(eventId: string, userId: string) {
    await this.advanceEvent(eventId);

    const [round, latestResult, entries, myTeam, event] = await Promise.all([
      this.getLatestRound(eventId),
      this.getLatestSettledRound(eventId),
      this.entryRepository.find({
        where: { event: { id: eventId } },
        relations: { team: true },
        order: { createdAt: "ASC" },
      }),
      this.dataSource.getRepository(TeamEntity).findOne({
        where: { event: { id: eventId }, users: { id: userId } },
      }),
      this.dataSource.getRepository(EventEntity).findOneOrFail({
        select: { id: true, maxQueueCredits: true },
        where: { id: eventId },
      }),
    ]);

    if (!round) throw new BadRequestException("Gambling round not found.");

    const bets = await this.betRepository.find({
      where: { round: { id: round.id } },
      order: { createdAt: "ASC" },
    });
    const myBet = myTeam
      ? bets.find((bet) => bet.bettorTeamId === myTeam.id)
      : undefined;
    const latestResultBet =
      latestResult && myTeam
        ? await this.betRepository.findOne({
            where: {
              round: { id: latestResult.id },
              bettorTeam: { id: myTeam.id },
            },
          })
        : null;
    const pools = {
      teamOne: round.teamOne
        ? bets
            .filter((bet) => bet.predictedWinnerId === round.teamOne?.id)
            .reduce((sum, bet) => sum + bet.amount, 0)
        : 0,
      teamTwo: round.teamTwo
        ? bets
            .filter((bet) => bet.predictedWinnerId === round.teamTwo?.id)
            .reduce((sum, bet) => sum + bet.amount, 0)
        : 0,
    };

    return {
      round: this.toRoundSummary(round, pools.teamOne + pools.teamTwo),
      entries: entries.map((entry) => ({
        id: entry.team.id,
        name: entry.team.name,
      })),
      pools,
      myTeam: myTeam
        ? {
            id: myTeam.id,
            name: myTeam.name,
            credits: myTeam.credits,
            maxCredits: event.maxQueueCredits,
            isEntered: entries.some((entry) => entry.team.id === myTeam.id),
          }
        : null,
      myBet: myBet ? toGamblingBetSummary(myBet) : null,
      latestResult: latestResult
        ? {
            id: latestResult.id,
            teamOne: this.toTeamSummary(latestResult.teamOne),
            teamTwo: this.toTeamSummary(latestResult.teamTwo),
            winner: this.toTeamSummary(latestResult.winner),
            totalPool: latestResult.totalPool,
            winnerTeamPayout: latestResult.winnerTeamPayout,
            matchId: latestResult.match?.id ?? null,
            myBet: latestResultBet
              ? toSettledGamblingBetSummary(
                  latestResultBet,
                  latestResult.winner?.id ?? null,
                )
              : null,
          }
        : null,
    };
  }

  async join(eventId: string, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.lockEvent(manager, eventId);
      const team = await this.getUserTeam(manager, eventId, userId);
      const exists = await manager.exists(GamblingEntryEntity, {
        where: { event: { id: eventId }, team: { id: team.id } },
      });
      if (exists)
        throw new BadRequestException("Your team is already in the list.");

      await manager.save(GamblingEntryEntity, {
        event: { id: eventId },
        team: { id: team.id },
      });
    });
  }

  async leave(eventId: string, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.lockEvent(manager, eventId);
      const team = await this.getUserTeam(manager, eventId, userId);
      const entry = await manager.findOne(GamblingEntryEntity, {
        where: { event: { id: eventId }, team: { id: team.id } },
      });
      if (!entry)
        throw new BadRequestException("Your team is not in the list.");
      await manager.remove(entry);
    });
  }

  async placeBet(eventId: string, userId: string, dto: PlaceGamblingBetDto) {
    await this.advanceEvent(eventId);
    await this.dataSource.transaction(async (manager) => {
      await this.lockEvent(manager, eventId);
      const round = await this.getLatestRoundWithManager(manager, eventId);
      if (
        !round ||
        round.phase !== GamblingRoundPhase.BETTING ||
        !round.phaseEndsAt ||
        round.phaseEndsAt.getTime() <= Date.now()
      )
        throw new BadRequestException("Betting is closed.");

      const teamReference = await this.getUserTeam(manager, eventId, userId);
      const team = await manager.findOneOrFail(TeamEntity, {
        where: { id: teamReference.id },
        lock: { mode: "pessimistic_write" },
      });
      if (team.id === round.teamOne?.id || team.id === round.teamTwo?.id)
        throw new BadRequestException(
          "Teams in the match cannot bet on their own match.",
        );
      if (
        dto.predictedWinnerId !== round.teamOne?.id &&
        dto.predictedWinnerId !== round.teamTwo?.id
      )
        throw new BadRequestException("Choose one of the selected teams.");

      const existingBet = await manager.exists(GamblingBetEntity, {
        where: { round: { id: round.id }, bettorTeam: { id: team.id } },
      });
      if (existingBet)
        throw new BadRequestException(
          "Your team has already placed a bet this round.",
        );

      const maximumBet = getMaximumGamblingBet(
        team.credits,
        round.event.maxQueueCredits,
      );
      if (dto.amount > maximumBet)
        throw new BadRequestException(
          `Your team can bet at most ${maximumBet} credits. Its balance cannot go below -${round.event.maxQueueCredits}.`,
        );

      team.credits -= dto.amount;
      await manager.save(team);
      await manager.save(GamblingBetEntity, {
        round: { id: round.id },
        bettorTeam: { id: team.id },
        predictedWinner: { id: dto.predictedWinnerId },
        amount: dto.amount,
      });
    });
  }

  async settleMatch(matchId: string, winnerId: string) {
    await this.dataSource.transaction(async (manager) => {
      const context = await this.getSettlementContext(manager, matchId);
      if (!context) return;

      const bets = await this.getRoundBets(manager, context.round.id);
      const payout = this.calculateRoundPayout(bets, winnerId);
      await this.applyRoundPayouts(manager, bets, winnerId, payout);
      await this.completeSettledRound(manager, context, winnerId, payout);
    });
  }

  private async advanceEvent(eventId: string) {
    const action = await this.dataSource.transaction((manager) =>
      this.getAdvanceAction(manager, eventId),
    );
    await this.executeAdvanceAction(action);
  }

  private async getSettlementContext(
    manager: EntityManager,
    matchId: string,
  ): Promise<GamblingSettlementContext | null> {
    const roundReference = await manager.findOne(GamblingRoundEntity, {
      where: { match: { id: matchId } },
      relations: { event: true, teamOne: true, teamTwo: true },
    });
    if (!roundReference) return null;

    await this.lockEvent(manager, roundReference.event.id);
    const round = await manager.findOneOrFail(GamblingRoundEntity, {
      where: { id: roundReference.id },
      lock: { mode: "pessimistic_write" },
    });
    if (round.phase === GamblingRoundPhase.SETTLED) return null;
    if (round.phase !== GamblingRoundPhase.PLAYING)
      throw new Error(`Gambling round ${round.id} is not playing.`);

    return {
      round,
      eventId: roundReference.event.id,
      playedTeamIds: [
        roundReference.teamOne?.id,
        roundReference.teamTwo?.id,
      ].filter((teamId): teamId is string => Boolean(teamId)),
    };
  }

  private getRoundBets(manager: EntityManager, roundId: string) {
    return manager.find(GamblingBetEntity, {
      where: { round: { id: roundId } },
      order: { createdAt: "ASC" },
    });
  }

  private calculateRoundPayout(bets: GamblingBetEntity[], winnerId: string) {
    return calculateGamblingPayouts(
      bets.map((bet) => ({
        id: bet.id,
        amount: bet.amount,
        predictedWinnerId: bet.predictedWinnerId,
      })),
      winnerId,
    );
  }

  private async applyRoundPayouts(
    manager: EntityManager,
    bets: GamblingBetEntity[],
    winnerId: string,
    payout: ReturnType<typeof calculateGamblingPayouts>,
  ) {
    await this.creditTeam(manager, winnerId, payout.winnerTeamPayout);
    for (const bet of bets) {
      const betPayout = payout.payouts.get(bet.id) ?? 0;
      bet.payout = betPayout;
      await this.creditTeam(manager, bet.bettorTeamId, betPayout);
    }
    await manager.save(bets);
  }

  private async creditTeam(
    manager: EntityManager,
    teamId: string,
    credits: number,
  ) {
    if (credits <= 0) return;
    await manager.increment(TeamEntity, { id: teamId }, "credits", credits);
  }

  private async completeSettledRound(
    manager: EntityManager,
    context: GamblingSettlementContext,
    winnerId: string,
    payout: ReturnType<typeof calculateGamblingPayouts>,
  ) {
    context.round.phase = GamblingRoundPhase.SETTLED;
    context.round.phaseEndsAt = null;
    context.round.winner = { id: winnerId } as TeamEntity;
    context.round.totalPool = payout.totalPool;
    context.round.winnerTeamPayout = payout.winnerTeamPayout;
    await manager.save(context.round);
    await this.removePlayedTeams(
      manager,
      context.eventId,
      context.playedTeamIds,
    );
    await this.createJoiningRound(manager, context.eventId);
  }

  private async removePlayedTeams(
    manager: EntityManager,
    eventId: string,
    playedTeamIds: string[],
  ) {
    if (playedTeamIds.length === 0) return;
    await manager
      .createQueryBuilder()
      .delete()
      .from(GamblingEntryEntity)
      .where('"eventId" = :eventId', { eventId })
      .andWhere('"teamId" IN (:...playedTeamIds)', { playedTeamIds })
      .execute();
  }

  private async getAdvanceAction(
    manager: EntityManager,
    eventId: string,
  ): Promise<GamblingAdvanceAction> {
    await this.lockEvent(manager, eventId);
    await manager.findOneOrFail(EventEntity, { where: { id: eventId } });
    const round = await this.getOrCreateCurrentRound(manager, eventId);
    const now = new Date();

    await this.advanceJoiningRound(manager, round, eventId, now);
    const bettingAction = await this.advanceBettingRound(manager, round, now);
    return bettingAction ?? this.getPlayingRoundAction(round);
  }

  private async getOrCreateCurrentRound(
    manager: EntityManager,
    eventId: string,
  ) {
    return (
      (await this.getLatestRoundWithManager(manager, eventId)) ??
      (await this.createJoiningRound(manager, eventId))
    );
  }

  private async advanceJoiningRound(
    manager: EntityManager,
    round: GamblingRoundEntity,
    eventId: string,
    now: Date,
  ) {
    if (!this.isExpiredPhase(round, GamblingRoundPhase.JOINING, now)) return;

    const selectedTeamIds = await this.selectRandomTeamIds(manager, eventId);
    round.phaseEndsAt = new Date(now.getTime() + PHASE_DURATION_MS);
    if (selectedTeamIds.length === 2) {
      round.phase = GamblingRoundPhase.BETTING;
      round.teamOne = { id: selectedTeamIds[0] } as TeamEntity;
      round.teamTwo = { id: selectedTeamIds[1] } as TeamEntity;
    }
    await manager.save(round);
  }

  private async selectRandomTeamIds(manager: EntityManager, eventId: string) {
    const rows = await manager
      .getRepository(GamblingEntryEntity)
      .createQueryBuilder("entry")
      .select('"entry"."teamId"', "teamId")
      .where('"entry"."eventId" = :eventId', { eventId })
      .orderBy("RANDOM()")
      .limit(2)
      .getRawMany<{ teamId: string }>();
    return rows.map(({ teamId }) => teamId);
  }

  private async advanceBettingRound(
    manager: EntityManager,
    round: GamblingRoundEntity,
    now: Date,
  ): Promise<GamblingAdvanceAction> {
    if (!this.isExpiredPhase(round, GamblingRoundPhase.BETTING, now))
      return null;
    if (!round.teamOne || !round.teamTwo)
      throw new Error(`Gambling round ${round.id} has no teams.`);

    const match = await this.createGamblingMatch(
      manager,
      round.teamOne.id,
      round.teamTwo.id,
    );
    round.phase = GamblingRoundPhase.PLAYING;
    round.phaseEndsAt = null;
    round.match = match;
    await manager.save(round);
    return { type: "start", matchId: match.id };
  }

  private createGamblingMatch(
    manager: EntityManager,
    teamOneId: string,
    teamTwoId: string,
  ) {
    return manager.save(
      manager.create(MatchEntity, {
        teams: [{ id: teamOneId }, { id: teamTwoId }],
        round: 0,
        phase: MatchPhase.GAMBLING,
        state: MatchState.PLANNED,
        stats: new MatchStatsEntity(),
      }),
    );
  }

  private isExpiredPhase(
    round: GamblingRoundEntity,
    phase: GamblingRoundPhase,
    now: Date,
  ) {
    return (
      round.phase === phase &&
      round.phaseEndsAt !== null &&
      round.phaseEndsAt <= now
    );
  }

  private getPlayingRoundAction(
    round: GamblingRoundEntity,
  ): GamblingAdvanceAction {
    if (round.phase !== GamblingRoundPhase.PLAYING || !round.match) return null;
    if (round.match.state === MatchState.PLANNED)
      return { type: "start", matchId: round.match.id };
    if (round.match.state === MatchState.FINISHED && round.match.winner)
      return {
        type: "settle",
        matchId: round.match.id,
        winnerId: round.match.winner.id,
      };
    return null;
  }

  private async executeAdvanceAction(action: GamblingAdvanceAction) {
    if (action?.type === "start")
      await this.matchService.startMatch(action.matchId);
    if (action?.type === "settle")
      await this.settleMatch(action.matchId, action.winnerId);
  }

  private createJoiningRound(manager: EntityManager, eventId: string) {
    return manager.save(
      manager.create(GamblingRoundEntity, {
        event: { id: eventId },
        phase: GamblingRoundPhase.JOINING,
        phaseEndsAt: new Date(Date.now() + PHASE_DURATION_MS),
      }),
    );
  }

  private async getLatestRound(eventId: string) {
    const roundId = await this.getLatestRoundId(this.roundRepository, eventId);
    if (!roundId) return null;

    return this.roundRepository.findOne({
      where: { id: roundId },
      relations: {
        teamOne: true,
        teamTwo: true,
        winner: true,
        match: { winner: true },
      },
    });
  }

  private async getLatestSettledRound(eventId: string) {
    const roundId = await this.getLatestRoundId(
      this.roundRepository,
      eventId,
      GamblingRoundPhase.SETTLED,
    );
    if (!roundId) return null;

    return this.roundRepository.findOne({
      where: { id: roundId },
      relations: {
        teamOne: true,
        teamTwo: true,
        winner: true,
        match: true,
      },
    });
  }

  private async getLatestRoundWithManager(
    manager: EntityManager,
    eventId: string,
  ) {
    const repository = manager.getRepository(GamblingRoundEntity);
    const roundId = await this.getLatestRoundId(repository, eventId);
    if (!roundId) return null;

    return repository.findOne({
      where: { id: roundId },
      relations: {
        event: true,
        teamOne: true,
        teamTwo: true,
        match: { winner: true },
      },
    });
  }

  private async getLatestRoundId(
    repository: Repository<GamblingRoundEntity>,
    eventId: string,
    phase?: GamblingRoundPhase,
  ) {
    const query = repository
      .createQueryBuilder("round")
      .select("round.id", "id")
      .addSelect("round.createdAt", "createdAt")
      .where('"round"."eventId" = :eventId', { eventId })
      .orderBy("round.createdAt", "DESC")
      .addOrderBy("round.id", "DESC")
      .limit(1);
    if (phase) query.andWhere("round.phase = :phase", { phase });

    return (await query.getRawOne<{ id: string }>())?.id ?? null;
  }

  private async getUserTeam(
    manager: EntityManager,
    eventId: string,
    userId: string,
  ) {
    const team = await manager.findOne(TeamEntity, {
      where: { event: { id: eventId }, users: { id: userId } },
    });
    if (!team)
      throw new BadRequestException(
        "Create or join a team before using gambling.",
      );
    return team;
  }

  private lockEvent(manager: EntityManager, eventId: string) {
    return manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `gambling:${eventId}`,
    ]);
  }

  private toTeamSummary(team: TeamEntity | null) {
    return team ? { id: team.id, name: team.name } : null;
  }

  private toRoundSummary(round: GamblingRoundEntity, totalPool: number) {
    return {
      id: round.id,
      phase: round.phase,
      phaseEndsAt: round.phaseEndsAt,
      teamOne: this.toTeamSummary(round.teamOne),
      teamTwo: this.toTeamSummary(round.teamTwo),
      totalPool,
      match: round.match
        ? {
            id: round.match.id,
            state: round.match.state,
            winner: this.toTeamSummary(round.match.winner),
          }
        : null,
    };
  }
}
