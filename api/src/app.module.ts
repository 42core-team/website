import {Module} from "@nestjs/common";
import {AppController} from "./app.controller";
import {AppService} from "./app.service";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {AuthModule} from "./auth/auth.module";
import {UserModule} from "./user/user.module";
import {EventModule} from "./event/event.module";
import {TeamModule} from "./team/team.module";
import {MatchModule} from "./match/match.module";
import {TypeOrmModule} from "@nestjs/typeorm";
import {DatabaseConfig} from "./DatabaseConfig";
import {GithubApiModule} from "./github-api/github-api.module";
import {ScheduleModule} from "@nestjs/schedule";
import { StatsModule } from './stats/stats.module';
import {RabbitMqModule} from "./common/rabbitmq.module";

@Module({
    imports: [
        ScheduleModule.forRoot(),
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => {
                const databaseConfig = new DatabaseConfig(config);
                return databaseConfig.getConfig() as any;
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
        RabbitMqModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}
