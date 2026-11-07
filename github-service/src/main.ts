import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  MicroserviceOptions,
  Transport,
  RmqOptions,
} from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { INestApplication, Logger } from "@nestjs/common";
import { RmqDrainInterceptor } from "./common/rmq-drain.interceptor";
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

// Only consumers acknowledge manually: clients share the config above, and their
// reply queues would stop flowing with noAck disabled. A connected microservice
// has its own enhancers, and they must be set before its listeners register.
const connectRmqConsumer = (
  app: INestApplication,
  configService: ConfigService,
  queue: string,
) => {
  const config = getRabbitmqConfig(configService, queue);
  const microservice = app.connectMicroservice<MicroserviceOptions>(
    { ...config, options: { ...config.options, noAck: false } },
    { deferInitialization: true },
  );
  microservice.useGlobalInterceptors(app.get(RmqDrainInterceptor));
  return microservice;
};

// enableShutdownHooks() would end by re-sending the signal to this process, which
// the kernel ignores for PID 1. Open RabbitMQ clients would then keep the pod
// alive until it gets killed, so close the app and exit explicitly.
function exitOnSignal(app: INestApplication) {
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      app.close().then(
        () => process.exit(0),
        (error: unknown) => {
          console.error("Shutdown failed", error);
          process.exit(1);
        },
      );
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new Logger());
  const configService = app.get(ConfigService);

  // The HTTP listener only serves health probes; work arrives via RabbitMQ.
  const microservice = connectRmqConsumer(app, configService, "github_service");
  const healthService = app.get(HealthService);
  microservice.status.subscribe((status) => healthService.setRmqStatus(status));

  exitOnSignal(app);
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
