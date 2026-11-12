import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let healthService: HealthService;
  let controller: HealthController;

  beforeEach(() => {
    healthService = new HealthService();
    controller = new HealthController(healthService);
  });

  it("is not ready before RabbitMQ connects", () => {
    expect(() => controller.getReadiness()).toThrow(
      ServiceUnavailableException,
    );
  });

  it("is ready once RabbitMQ is connected", () => {
    healthService.setRmqStatus("connected");
    expect(controller.getReadiness()).toEqual({
      status: "ok",
      rabbitmq: "connected",
    });
  });

  it("is not ready after RabbitMQ disconnects or blocks", () => {
    healthService.setRmqStatus("connected");
    healthService.setRmqStatus("disconnected");
    expect(() => controller.getReadiness()).toThrow(
      ServiceUnavailableException,
    );
    healthService.setRmqStatus("blocked");
    expect(() => controller.getReadiness()).toThrow(
      ServiceUnavailableException,
    );
  });

  it("liveness always reports ok", () => {
    expect(controller.getHealth()).toEqual({ status: "ok" });
  });
});
