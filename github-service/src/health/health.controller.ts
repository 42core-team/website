import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): { status: string } {
    return { status: "ok" };
  }

  @Get("ready")
  getReadiness(): { status: string; rabbitmq: string } {
    const rabbitmq = this.healthService.getRmqStatus();
    if (!this.healthService.isReady()) {
      throw new ServiceUnavailableException(`RabbitMQ is ${rabbitmq}`);
    }
    return { status: "ok", rabbitmq };
  }
}
