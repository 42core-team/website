import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TeamEntity } from "./entities/team.entity";
import { TeamService } from "./team.service";
import { TeamController } from "./team.controller";
import { GithubApiModule } from "../github-api/github-api.module";
import { EventModule } from "../event/event.module";
import { UserModule } from "../user/user.module";
import { MatchModule } from "../match/match.module";
import { RepositoryLifecycleModule } from "../repository-lifecycle/repository-lifecycle.module";
import { MyTeamGuards, TeamNotLockedGuard } from "../guards/TeamGuard";

import { TeamImageController } from "./team-image.controller";
import { TeamImageService } from "./team-image.service";
import { MediaUploadEntity } from "../media/entities/media-upload.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity, MediaUploadEntity]),
    GithubApiModule,
    RepositoryLifecycleModule,
    forwardRef(() => EventModule),
    forwardRef(() => MatchModule),
    UserModule,
  ],
  controllers: [TeamController, TeamImageController],
  providers: [TeamImageService, TeamService, MyTeamGuards, TeamNotLockedGuard],
  exports: [TeamService],
})
export class TeamModule {}
