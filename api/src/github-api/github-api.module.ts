import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GithubApiService } from "./github-api.service";
import { GithubAppAuth } from "./github-app-auth";
import { GithubAuthService } from "./github-auth";
import { GithubInstallationEntity } from "./entities/github-installation.entity";

@Module({
  imports: [TypeOrmModule.forFeature([GithubInstallationEntity])],
  providers: [
    GithubApiService,
    GithubAuthService,
    {
      provide: GithubAppAuth,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        GithubAppAuth.fromConfig((key) => configService.get<string>(key)),
    },
  ],
  exports: [GithubApiService, GithubAuthService, GithubAppAuth, TypeOrmModule],
})
export class GithubApiModule {}
