import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { EventModule } from "./event/event.module";
import { TeamModule } from "./team/team.module";
import { MatchModule } from "./match/match.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseConfig } from "./DatabaseConfig";
import { GithubApiModule } from "./github-api/github-api.module";
import { ScheduleModule } from "@nestjs/schedule";
import { StatsModule } from "./stats/stats.module";
import { LoggerModule } from "nestjs-pino";
import { Request } from "express";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  singleLine: true,
                  colorize: true,
                  ignore: "pid,hostname",
                  messageFormat: "[{context}] {msg}",
                },
              }
            : undefined,
        customProps: (req: Request) => {
          const customReq = req as Request & { user?: { id: string } };
          const user = customReq.user;
          return {
            userId: user?.id,
          };
        },
        serializers: {
          req: (req) => {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
            };
          },
          res: (res) => {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const databaseConfig = new DatabaseConfig(config);
        return databaseConfig.getConfig();
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    EventModule,
    TeamModule,
    MatchModule,
    GithubApiModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
