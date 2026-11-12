import { ConfigService } from "@nestjs/config";

export function rabbitmqQueueName(configService: ConfigService, name: string) {
  return `${configService.get<string>("RABBITMQ_QUEUE_PREFIX") ?? ""}${name}`;
}
