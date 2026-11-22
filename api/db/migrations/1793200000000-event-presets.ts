import { MigrationInterface, QueryRunner } from "typeorm";

import { seedDefaultPreset } from "../event-preset-seed";

/**
 * Admin-managed presets of event settings. Events record the preset and
 * version they were created from. Seeds the "Default" preset.
 */
export class EventPresets1793200000000 implements MigrationInterface {
  name = "EventPresets1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "event_presets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT false, "archivedAt" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT 1, "settings" jsonb NOT NULL, "starterTemplates" jsonb NOT NULL DEFAULT '[]', "githubInstallationId" uuid, "createdById" uuid, "updatedById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_event_presets_name" UNIQUE ("name"), CONSTRAINT "CHK_event_presets_default_not_archived" CHECK (NOT ("isDefault" AND "archivedAt" IS NOT NULL)), CONSTRAINT "PK_event_presets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_event_presets_default" ON "event_presets" ("isDefault") WHERE "isDefault"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_presets" ADD CONSTRAINT "FK_event_presets_github_installation" FOREIGN KEY ("githubInstallationId") REFERENCES "github_installations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_presets" ADD CONSTRAINT "FK_event_presets_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_presets" ADD CONSTRAINT "FK_event_presets_updated_by" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "events" ADD "presetId" uuid`);
    await queryRunner.query(`ALTER TABLE "events" ADD "presetVersion" integer`);
    await queryRunner.query(
      `CREATE INDEX "IDX_events_preset_id" ON "events" ("presetId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_events_preset" FOREIGN KEY ("presetId") REFERENCES "event_presets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await seedDefaultPreset(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_preset"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_events_preset_id"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "presetVersion"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "presetId"`);
    await queryRunner.query(`DROP TABLE "event_presets"`);
  }
}
