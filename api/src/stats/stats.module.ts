import { Module } from "@nestjs/common";
import { StatsController } from "./stats.controller";
import { MatchModule } from "../match/match.module";

@Module({
  imports: [MatchModule],
  controllers: [StatsController],
})
export class StatsModule {}
