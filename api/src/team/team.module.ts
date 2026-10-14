import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TeamEntity } from "./entities/team.entity";
import { TeamService } from "./team.service";
import { TeamController } from "./team.controller";
import { GithubApiModule } from "../github-api/github-api.module";
import { EventModule } from "../event/event.module";
import { UserModule } from "../user/user.module";
import { MatchModule } from "../match/match.module";
import { TeamEventsController } from "./team.events.controller";
import { MyTeamGuards, TeamNotLockedGuard } from "../guards/TeamGuard";

import { TeamImageController } from "./team-image.controller";
import { TeamImageService } from "./team-image.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity]),
    GithubApiModule,
    forwardRef(() => EventModule),
    forwardRef(() => MatchModule),
    UserModule,
  ],
  controllers: [TeamController, TeamEventsController, TeamImageController],
  providers: [TeamImageService, TeamService, MyTeamGuards, TeamNotLockedGuard],
  exports: [TeamService],
})
export class TeamModule {}
