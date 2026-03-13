import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { MatchService } from "./match.service";

@Controller("match-events")
export class MatchEventsController {
  constructor(private readonly matchService: MatchService) {}

  private logger = new Logger("MatchEventsController");

  @EventPattern("game_server")
  async getNotifications(
    @Payload()
    data: {
      team_results: {
        id: string;
        name: string;
        place: number;
      }[];
      game_id: string;
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
      };
      BOT_ID_MAPPING: {
        [key: string]: string;
      };
    },
  ) {
    try {
      this.logger.log(
        `Processing match result for game_id: ${data.game_id} with results: ${JSON.stringify(data.team_results, null, 2)}`,
      );
      this.logger.log("data: " + JSON.stringify(data, null, 2));
      const winnerId =
        data.BOT_ID_MAPPING[
          data.team_results.sort((a, b) => a.place - b.place)[0].id
        ];
      await this.matchService.processMatchResult(
        data.game_id,
        winnerId,
        data.stats,
      );
    } catch (e) {
      this.logger.error("Error processing match result", e);
    }
  }
}
