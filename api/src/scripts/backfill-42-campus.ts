import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "dotenv";
import { ConfigService } from "@nestjs/config";
import { DatabaseConfig } from "../DatabaseConfig";
import {
  CampusAccount,
  backfillCampuses,
  createIntraLookup,
} from "./campus-backfill";

/**
 * Fills campusId and campusName of linked 42 accounts from the 42 intra API.
 *
 * Usage (from api/, with the DB_* variables of the target database set):
 *   read -rs FORTYTWO_ACCESS_TOKEN && export FORTYTWO_ACCESS_TOKEN
 *   pnpm backfill:campus            # dry run, writes nothing
 *   pnpm backfill:campus --apply    # write the campuses
 *   pnpm backfill:campus --all      # also re-check accounts with a campus
 *
 * Reading the token with `read -s` keeps it out of the shell history. Any
 * token that may read /v2/users/:id works, for example one from the
 * client_credentials flow of the 42 application.
 */

async function main() {
  config();
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const all = args.has("--all");
  const accessToken = process.env.FORTYTWO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    console.error("Set FORTYTWO_ACCESS_TOKEN to a 42 intra access token.");
    process.exit(1);
  }

  const dataSource = new DataSource({
    ...new DatabaseConfig(new ConfigService()).getConfig(),
    entities: [],
  } as DataSourceOptions);
  await dataSource.initialize();

  try {
    const accounts: CampusAccount[] = await dataSource.query(
      `SELECT "id", "platformUserId", "username", "campusName"
       FROM "social_accounts"
       WHERE "platform" = '42' ${all ? "" : `AND "campusName" IS NULL`}
       ORDER BY "createdAt"`,
    );
    console.log(
      `${accounts.length} 42 account(s) to check${apply ? "" : " (dry run, pass --apply to write)"}.`,
    );

    const lookup = createIntraLookup(accessToken);
    const summary = await backfillCampuses({
      accounts,
      lookup,
      apply,
      save: async (accountId, { campusId, campusName }) => {
        await dataSource.query(
          `UPDATE "social_accounts"
           SET "campusId" = $1, "campusName" = $2, "updatedAt" = now()
           WHERE "id" = $3`,
          [campusId, campusName, accountId],
        );
      },
    });
    console.log(JSON.stringify(summary));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
