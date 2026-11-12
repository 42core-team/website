import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GithubApiService } from "./github-api.service";
import { GithubAppAuth } from "./github-app-auth";
import { GithubInstallationEntity } from "./entities/github-installation.entity";

@Module({
  imports: [TypeOrmModule.forFeature([GithubInstallationEntity])],
  providers: [
    GithubApiService,
    {
      provide: GithubAppAuth,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        GithubAppAuth.fromConfig((key) => configService.get<string>(key)),
    },
  ],
  exports: [GithubApiService, GithubAppAuth, TypeOrmModule],
})
export class GithubApiModule {}
