import { DataSource, DataSourceOptions } from "typeorm";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";
import { ConfigService } from "@nestjs/config";

export class DatabaseConfig {
  constructor(private configService: ConfigService) {}

  getConfig(migrations: boolean = false): TypeOrmModuleOptions {
    const databaseUrl = this.getOptionalString("DB_URL");
    const schema = this.getOptionalString("DB_SCHEMA");
    const config: Record<string, unknown> = {
      type: "postgres",
      host: this.configService.getOrThrow("DB_HOST"),
      port: this.configService.getOrThrow("DB_PORT"),
      username: this.configService.getOrThrow("DB_USER"),
      password: this.configService.getOrThrow("DB_PASSWORD"),
      database: this.configService.getOrThrow("DB_NAME"),
      entities: ["dist/**/*.entity{.ts,.js}"],
      migrations: migrations
        ? [
            join(__dirname, "..", "db", "migrations", "*.js"), // production (compiled)
            "db/migrations/*.ts", // local development (ts-node)
          ]
        : [],
      autoLoadEntities: true,
      synchronize: false,
      timezone: "Z",
      dateStrings: false,
    };

    if (databaseUrl) {
      config["url"] = databaseUrl;
    }

    if (schema) {
      config["schema"] = schema;
    }

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

  private getOptionalString(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    return value?.trim() || undefined;
  }
}
