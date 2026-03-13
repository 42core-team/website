import { DataSource, DataSourceOptions } from "typeorm";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";
import { ConfigService } from "@nestjs/config";

export class DatabaseConfig {
  constructor(private configService: ConfigService) {}

  getConfig(migrations: boolean = false): TypeOrmModuleOptions {
    const config: Record<string, unknown> = {
      type: "postgres",
      host: this.configService.getOrThrow("DB_HOST"),
      port: this.configService.getOrThrow("DB_PORT"),
      username: this.configService.getOrThrow("DB_USER"),
      password: this.configService.getOrThrow("DB_PASSWORD"),
      database: this.configService.getOrThrow("DB_NAME"),
      schema: this.configService.getOrThrow("DB_SCHEMA"),
      entities: ["dist/**/*.entity{.ts,.js}"],
      migrations: migrations
        ? [
            join(__dirname, "..", "db", "migrations", "*.js"), // production (compiled)
            "db/migrations/*.ts", // local development (ts-node)
          ]
        : [],
      autoLoadEntities: true,
      url: this.configService.get("DB_URL"),
      synchronize: false,
      timezone: "Z",
      dateStrings: false,
    };

    // Add SSL configuration if required
    const requireSSL = this.configService.get("DB_SSL_REQUIRED", "false");
    if (requireSSL === "true") {
      config["ssl"] = {
        rejectUnauthorized: true, // For development - set to true in production
        require: true,
      };
    }

    return config as TypeOrmModuleOptions;
  }

  /*
      This function will be used for the database connection and migrations.
       */
  createDataSource(): DataSource {
    const config = this.getConfig(true);
    return new DataSource(config as DataSourceOptions);
  }
}
