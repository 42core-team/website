import { Module } from "@nestjs/common";
import { EventModule } from "../event/event.module";
import { GithubApiModule } from "../github-api/github-api.module";
import { GithubAppController } from "./github-app.controller";
import { GithubAppService } from "./github-app.service";

@Module({
  imports: [EventModule, GithubApiModule],
  controllers: [GithubAppController],
  providers: [GithubAppService],
})
export class GithubAppModule {}
