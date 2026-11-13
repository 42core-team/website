import { Module } from "@nestjs/common";
import { EventModule } from "../event/event.module";
import { GithubApiModule } from "../github-api/github-api.module";
import { AdminGithubInstallationsController } from "./admin-github-installations.controller";
import { GithubAppController } from "./github-app.controller";
import { GithubAppService } from "./github-app.service";

@Module({
  imports: [EventModule, GithubApiModule],
  controllers: [GithubAppController, AdminGithubInstallationsController],
  providers: [GithubAppService],
  exports: [GithubAppService],
})
export class GithubAppModule {}
