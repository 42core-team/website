import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { join } from "node:path";
import { DataSource, DataSourceOptions } from "typeorm";
import { DatabaseConfig } from "../DatabaseConfig";
import { seedLocalDatabase } from "./seed-local-database";

async function main() {
  config();
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Local database seeding requires NODE_ENV=development.");
  }

  const dataSource = new DataSource({
    ...new DatabaseConfig(new ConfigService()).getConfig(),
    entities: [join(__dirname, "../**/*.entity.ts")],
  } as DataSourceOptions);
  await dataSource.initialize();
  try {
    const count = await seedLocalDatabase(dataSource);
    console.log(
      count ? `Seeded ${count} local events.` : "Local seed skipped.",
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
