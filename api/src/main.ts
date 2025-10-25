import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { TypeormExceptionFilter } from "./common/TypeormExceptionFilter";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";

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
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new TypeormExceptionFilter());
  app.enableCors();

  const configService = app.get(ConfigService);

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
