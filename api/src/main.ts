import { NestFactory, Reflector, HttpAdapterHost } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { TypeormExceptionFilter } from "./common/TypeormExceptionFilter";
import { AllExceptionsFilter } from "./common/AllExceptionsFilter";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  MicroserviceOptions,
  RmqOptions,
  Transport,
} from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import * as cookieParser from "cookie-parser";

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
  app.enableCors({
    origin: configService.getOrThrow<string>("CORS_ORIGIN"),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders:
      "Content-Type, Accept, Authorization, X-Requested-With, X-HTTP-Method-Override, X-Auth-Token, X-Refresh-Token",
  });

  app.connectMicroservice<MicroserviceOptions>(
    getRabbitmqConfig(configService, "game_results"),
  );
  app.connectMicroservice<MicroserviceOptions>(
    getRabbitmqConfig(configService, "github-service-results"),
  );

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

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
