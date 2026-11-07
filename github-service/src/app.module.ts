import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { RmqDrainInterceptor } from "./common/rmq-drain.interceptor";
import { AppService } from "./app.service";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService, RmqDrainInterceptor],
})
export class AppModule {}
