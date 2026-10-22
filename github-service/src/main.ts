import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MicroserviceOptions, Transport, RmqOptions } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { HealthService } from "./health/health.service";

export const getRabbitmqConfig = (
  configService: ConfigService,
  queue: string,
): RmqOptions => {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>("RABBITMQ_URL")],
      queue: queue,
      queueOptions: {
        arguments: {
          "x-queue-type": "quorum",
        },
      },
    },
  };
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new Logger());
  const configService = app.get(ConfigService);

  // The HTTP listener only serves health probes; work arrives via RabbitMQ.
  const microservice = app.connectMicroservice<MicroserviceOptions>(
    getRabbitmqConfig(configService, "github_service"),
  );
  const healthService = app.get(HealthService);
  microservice.status.subscribe((status) => healthService.setRmqStatus(status));

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
