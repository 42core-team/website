import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  MicroserviceOptions,
  Transport,
  RmqOptions,
} from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { rabbitmqQueueName } from "./rabbitmq-queue-name";

export const getRabbitmqConfig = (
  configService: ConfigService,
  queue: string,
): RmqOptions => {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>("RABBITMQ_URL")],
      queue: rabbitmqQueueName(configService, queue),
      queueOptions: {
        arguments: {
          "x-queue-type": "quorum",
        },
      },
    },
  };
};

async function bootstrap() {
  const configService = new ConfigService();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    getRabbitmqConfig(configService, "github_service"),
  );
  app.useLogger(new Logger());
  await app.listen();
}

bootstrap();
