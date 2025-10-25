import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

export const getRabbitmqConfig: any = (
  configService: ConfigService,
  queue: string,
) => {
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
  const configService = new ConfigService();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    getRabbitmqConfig(configService, "github_service"),
  );
  app.useLogger(new Logger());
  await app.listen();
}

bootstrap();
