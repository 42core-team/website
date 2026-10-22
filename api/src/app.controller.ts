import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AppService } from "./app.service";

const READINESS_DB_TIMEOUT_MS = 1500;

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  getHealth(): { status: string; timestamp: string; uptime: number } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get("health/ready")
  async getReadiness(): Promise<{ status: string }> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.dataSource.query("SELECT 1"),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Database check timed out")),
            READINESS_DB_TIMEOUT_MS,
          );
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException("Database is not reachable");
    } finally {
      clearTimeout(timeout);
    }
    return { status: "ok" };
  }
}
