import { Injectable } from "@nestjs/common";

const READY_RMQ_STATUSES = new Set(["connected", "unblocked"]);

@Injectable()
export class HealthService {
  private rmqStatus = "disconnected";

  setRmqStatus(status: string) {
    this.rmqStatus = status;
  }

  isReady(): boolean {
    return READY_RMQ_STATUSES.has(this.rmqStatus);
  }

  getRmqStatus(): string {
    return this.rmqStatus;
  }
}
