import { forwardRef, Module } from "@nestjs/common";
import { MatchEntity } from "./entites/match.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MatchService } from "./match.service";
import { TeamModule } from "../team/team.module";
import { EventModule } from "../event/event.module";
import { MatchController } from "./match.controller";
import { MatchEventsController } from "./match.events.controller";
import { GithubApiModule } from "../github-api/github-api.module";
import { MatchTeamResultEntity } from "./entites/match.team.result.entity";
import { MatchStatsEntity } from "./entites/matchStats.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatchEntity,
      MatchTeamResultEntity,
      MatchStatsEntity,
    ]),
    forwardRef(() => TeamModule),
    forwardRef(() => EventModule),
    forwardRef(() => GithubApiModule),
  ],
  controllers: [MatchController, MatchEventsController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
