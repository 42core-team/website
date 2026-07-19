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
import { calculateGamblingPayouts } from "./gambling-payout";

const PHASE_DURATION_MS = 30 * 60 * 1000;

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

    const [round, latestResult, entries, myTeam] = await Promise.all([
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
    ]);

    if (!round) throw new BadRequestException("Gambling round not found.");

    const bets = await this.betRepository.find({
      where: { round: { id: round.id } },
      relations: { bettorTeam: true, predictedWinner: true },
      order: { createdAt: "ASC" },
    });
    const myBet = myTeam
      ? bets.find((bet) => bet.bettorTeam.id === myTeam.id)
      : undefined;
    const latestResultBet =
      latestResult && myTeam
        ? await this.betRepository.findOne({
            where: {
              round: { id: latestResult.id },
              bettorTeam: { id: myTeam.id },
            },
            relations: { predictedWinner: true },
          })
        : null;
    const pools = {
      teamOne: round.teamOne
        ? bets
            .filter((bet) => bet.predictedWinner.id === round.teamOne?.id)
            .reduce((sum, bet) => sum + bet.amount, 0)
        : 0,
      teamTwo: round.teamTwo
        ? bets
            .filter((bet) => bet.predictedWinner.id === round.teamTwo?.id)
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
            isEntered: entries.some((entry) => entry.team.id === myTeam.id),
          }
        : null,
      myBet: myBet
        ? {
            predictedWinnerId: myBet.predictedWinner.id,
            amount: myBet.amount,
            payout: myBet.payout,
          }
        : null,
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
              ? {
                  predictedWinnerId: latestResultBet.predictedWinner.id,
                  amount: latestResultBet.amount,
                  payout: latestResultBet.payout,
                  net: latestResultBet.payout - latestResultBet.amount,
                  wasCorrect:
                    latestResultBet.predictedWinner.id ===
                    latestResult.winner?.id,
                }
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
      const roundReference = await manager.findOne(GamblingRoundEntity, {
        where: { match: { id: matchId } },
        relations: { event: true, teamOne: true, teamTwo: true },
      });
      if (!roundReference) return;

      await this.lockEvent(manager, roundReference.event.id);
      const round = await manager.findOneOrFail(GamblingRoundEntity, {
        where: { id: roundReference.id },
        lock: { mode: "pessimistic_write" },
      });
      if (round.phase === GamblingRoundPhase.SETTLED) return;
      if (round.phase !== GamblingRoundPhase.PLAYING)
        throw new Error(`Gambling round ${round.id} is not playing.`);

      const bets = await manager.find(GamblingBetEntity, {
        where: { round: { id: round.id } },
        relations: { predictedWinner: true, bettorTeam: true },
        order: { createdAt: "ASC" },
      });
      const payout = calculateGamblingPayouts(
        bets.map((bet) => ({
          id: bet.id,
          amount: bet.amount,
          predictedWinnerId: bet.predictedWinner.id,
        })),
        winnerId,
      );

      if (payout.winnerTeamPayout > 0)
        await manager.increment(
          TeamEntity,
          { id: winnerId },
          "credits",
          payout.winnerTeamPayout,
        );
      for (const bet of bets) {
        const betPayout = payout.payouts.get(bet.id) ?? 0;
        bet.payout = betPayout;
        if (betPayout > 0)
          await manager.increment(
            TeamEntity,
            { id: bet.bettorTeam.id },
            "credits",
            betPayout,
          );
      }

      round.phase = GamblingRoundPhase.SETTLED;
      round.phaseEndsAt = null;
      round.winner = { id: winnerId } as TeamEntity;
      round.totalPool = payout.totalPool;
      round.winnerTeamPayout = payout.winnerTeamPayout;
      await manager.save(bets);
      await manager.save(round);
      const playedTeamIds = [
        roundReference.teamOne?.id,
        roundReference.teamTwo?.id,
      ].filter((teamId): teamId is string => Boolean(teamId));
      if (playedTeamIds.length > 0)
        await manager
          .createQueryBuilder()
          .delete()
          .from(GamblingEntryEntity)
          .where('"eventId" = :eventId', {
            eventId: roundReference.event.id,
          })
          .andWhere('"teamId" IN (:...playedTeamIds)', { playedTeamIds })
          .execute();
      await this.createJoiningRound(manager, roundReference.event.id);
    });
  }

  private async advanceEvent(eventId: string) {
    const action = await this.dataSource.transaction(
      async (
        manager,
      ): Promise<
        | { type: "start"; matchId: string }
        | { type: "settle"; matchId: string; winnerId: string }
        | null
      > => {
        await this.lockEvent(manager, eventId);
        await manager.findOneOrFail(EventEntity, { where: { id: eventId } });
        let round = await this.getLatestRoundWithManager(manager, eventId);
        if (!round) round = await this.createJoiningRound(manager, eventId);

        const now = new Date();
        if (
          round.phase === GamblingRoundPhase.JOINING &&
          round.phaseEndsAt &&
          round.phaseEndsAt <= now
        ) {
          const selectedTeamIds = await manager
            .getRepository(GamblingEntryEntity)
            .createQueryBuilder("entry")
            .select('"entry"."teamId"', "teamId")
            .where('"entry"."eventId" = :eventId', { eventId })
            .orderBy("RANDOM()")
            .limit(2)
            .getRawMany<{ teamId: string }>();
          if (selectedTeamIds.length < 2) {
            round.phaseEndsAt = new Date(now.getTime() + PHASE_DURATION_MS);
          } else {
            round.phase = GamblingRoundPhase.BETTING;
            round.phaseEndsAt = new Date(now.getTime() + PHASE_DURATION_MS);
            round.teamOne = { id: selectedTeamIds[0].teamId } as TeamEntity;
            round.teamTwo = { id: selectedTeamIds[1].teamId } as TeamEntity;
          }
          await manager.save(round);
        }

        if (
          round.phase === GamblingRoundPhase.BETTING &&
          round.phaseEndsAt &&
          round.phaseEndsAt <= now
        ) {
          if (!round.teamOne || !round.teamTwo)
            throw new Error(`Gambling round ${round.id} has no teams.`);
          const match = await manager.save(
            manager.create(MatchEntity, {
              teams: [{ id: round.teamOne.id }, { id: round.teamTwo.id }],
              round: 0,
              phase: MatchPhase.GAMBLING,
              state: MatchState.PLANNED,
              stats: new MatchStatsEntity(),
            }),
          );
          round.phase = GamblingRoundPhase.PLAYING;
          round.phaseEndsAt = null;
          round.match = match;
          await manager.save(round);
          return { type: "start", matchId: match.id };
        }

        if (
          round.phase === GamblingRoundPhase.PLAYING &&
          round.match?.state === MatchState.PLANNED
        )
          return { type: "start", matchId: round.match.id };
        if (
          round.phase === GamblingRoundPhase.PLAYING &&
          round.match?.state === MatchState.FINISHED &&
          round.match.winner
        )
          return {
            type: "settle",
            matchId: round.match.id,
            winnerId: round.match.winner.id,
          };
        return null;
      },
    );

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
