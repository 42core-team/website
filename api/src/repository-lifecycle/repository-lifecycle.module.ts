import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TeamEntity } from "../team/entities/team.entity";
import { GithubApiModule } from "../github-api/github-api.module";
import { RepositoryLifecycleService } from "./repository-lifecycle.service";
import { RepositoryLifecycleEventsController } from "./repository-lifecycle.events.controller";
@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity]), GithubApiModule],
  providers: [RepositoryLifecycleService],
  controllers: [RepositoryLifecycleEventsController],
  exports: [RepositoryLifecycleService],
})
export class RepositoryLifecycleModule {}
