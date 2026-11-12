import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GithubAppAuth } from "./github-app-auth";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    HealthService,
    {
      provide: GithubAppAuth,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        GithubAppAuth.fromConfig((key) => configService.get<string>(key)),
    },
  ],
})
export class AppModule {}
