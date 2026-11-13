import { Controller, Get } from "@nestjs/common";
import { MatchService } from "../match/match.service";
import { Cron } from "@nestjs/schedule";
import { Public } from "../authz";

@Public()
@Controller("stats")
export class StatsController {
  constructor(private matchService: MatchService) {}

  globalStats?: {
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
  };

  @Cron("*/30 * * * * *")
  async updateGlobalStats() {
    this.globalStats = await this.matchService.getGlobalStats();
  }

  @Get("global")
  async getGlobalStats() {
    if (!this.globalStats) {
      this.globalStats = await this.matchService.getGlobalStats();
    }
    return this.globalStats;
  }
}
