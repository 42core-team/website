import { NestFactory, Reflector, HttpAdapterHost } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { RmqDrainInterceptor } from "./common/rmq-drain.interceptor";
import { TypeormExceptionFilter } from "./common/TypeormExceptionFilter";
import { AllExceptionsFilter } from "./common/AllExceptionsFilter";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  MicroserviceOptions,
  RmqOptions,
  Transport,
} from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { createCsrfProtection } from "./common/csrf-protection";
import {
  getAuthCookieName,
  REFRESH_COOKIE_NAME,
} from "./auth/session.constants";

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
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(
    new AllExceptionsFilter(httpAdapterHost),
    new TypeormExceptionFilter(),
  );
  app.use(cookieParser());
  app.use(
    createCsrfProtection(configService.getOrThrow<string>("CORS_ORIGIN"), [
      getAuthCookieName(configService),
      REFRESH_COOKIE_NAME,
    ]),
  );
  app.enableCors({
    origin: configService.getOrThrow<string>("CORS_ORIGIN"),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders:
      "Content-Type, Accept, Authorization, X-Requested-With, X-HTTP-Method-Override, X-Auth-Token, X-Refresh-Token",
  });

  connectRmqConsumer(app, configService, "game_results");
  connectRmqConsumer(app, configService, "github-service-results");

  if (process.env.NODE_ENV === "development") {
    const config = new DocumentBuilder()
      .setTitle("CORE game API")
      .setDescription("This is the API for the CORE game backend.")
      .setVersion("1.0")
      .addTag("core")
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api", app, documentFactory);
  }

  exitOnSignal(app);
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
