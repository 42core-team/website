import { MigrationInterface, QueryRunner } from "typeorm";

// Official 42core-team/config defaults at 54f501a, embedded for offline migrations.
const GAME_CONFIG =
  '{\n    "gridSize": 20,\n    "seed": "",\n    "idleIncome": 1,\n    "idleIncomeTimeOut": 350,\n    "maxUnitStandingCooldown": 12,\n    "depositHp": 30,\n    "depositIncome": 100,\n    "gemPileIncome": 25,\n    "coreHp": 99,\n    "initialGems": 200,\n    "wallHp": 42,\n    "worldGenerator": "jigsaw",\n    "worldGeneratorConfig": {\n        "templatePlaceAttemptCount": 5000,\n        "additionalWallPlaceAttemptCount": 50,\n        "depositCount": 36,\n        "gemPileCount": 16,\n        "minTemplateSpacing": 1,\n        "minCoreDistance": 5,\n        "depositAdditionalIncomePerAdjacentWall": 6,\n        "depositMultiplierIfFullySurrounded": 1.3,\n        "randomDepositIncomeVariation": 20,\n        "randomGemPileIncomeVariation": 8\n    },\n    "corePositions": [\n        {\n            "x": 0,\n            "y": 0\n        },\n        {\n            "x": 19,\n            "y": 19\n        }\n    ],\n    "components": {\n        "maxComponentsPerUnit": 6,\n        "unitDefaultCost": 42,\n        "unitDefaultProperties": {\n            "hp": 4,\n            "baseActionCooldown": 4,\n            "gemsPerCooldownStep": 16,\n            "maxGems": 16,\n            "damageReductionPercent": 0,\n            "damageCore": 0,\n            "damageUnit": 0,\n            "damageObject": 0,\n            "postSpawnCoreCooldown": 16\n        },\n        "components": [\n            {\n                "id": "health",\n                "properties": [\n                    {\n                        "name": "hp",\n                        "modification": 6\n                    },\n                    {\n                        "name": "postSpawnCoreCooldown",\n                        "modification": 3\n                    }\n                ],\n                "cost": 40,\n                "visualizer_asset_priority": 0,\n                "visualizer_asset_path": "heart"\n            },\n            {\n                "id": "speed",\n                "properties": [\n                    {\n                        "name": "baseActionCooldown",\n                        "modification": -2\n                    },\n                    {\n                        "name": "postSpawnCoreCooldown",\n                        "modification": 12\n                    }\n                ],\n                "cost": 55,\n                "visualizer_asset_priority": 0,\n                "visualizer_asset_path": "lightning"\n            },\n            {\n                "id": "armor",\n                "properties": [\n                    {\n                        "name": "damageReductionPercent",\n                        "modification": 30\n                    },\n                    {\n                        "name": "baseActionCooldown",\n                        "modification": 2\n                    },\n                    {\n                        "name": "postSpawnCoreCooldown",\n                        "modification": 4\n                    }\n                ],\n                "cost": 35,\n                "visualizer_asset_priority": 1,\n                "visualizer_asset_path": "shield"\n            },\n            {\n                "id": "combat",\n                "properties": [\n                    {\n                        "name": "damageUnit",\n                        "modification": 3\n                    },\n                    {\n                        "name": "baseActionCooldown",\n                        "modification": 3\n                    },\n                    {\n                        "name": "postSpawnCoreCooldown",\n                        "modification": 4\n                    }\n                ],\n                "cost": 35,\n                "visualizer_asset_priority": 2,\n                "visualizer_asset_path": "sword"\n            },\n            {\n                "id": "siege",\n                "properties": [\n                    {\n                        "name": "damageCore",\n                        "modification": 3\n                    },\n                    {\n                        "name": "baseActionCooldown",\n                        "modification": 3\n                    },\n                    {\n                        "name": "postSpawnCoreCooldown",\n                        "modification": 4\n                    }\n                ],\n                "cost": 35,\n                "visualizer_asset_priority": 3,\n                "visualizer_asset_path": "axe"\n            },\n            {\n                "id": "demolition",\n                "properties": [\n                    {\n                        "name": "damageObject",\n                        "modification": 3\n                    },\n                    {\n                        "name": "baseActionCooldown",\n                        "modification": 3\n                    },\n                    {\n                        "name": "postSpawnCoreCooldown",\n                        "modification": 4\n                    }\n                ],\n                "cost": 35,\n                "visualizer_asset_priority": 2,\n                "visualizer_asset_path": "pickaxe"\n            },\n            {\n                "id": "gem_speed",\n                "properties": [\n                    {\n                        "name": "gemsPerCooldownStep",\n                        "modification": 111\n                    },\n                    {\n                        "name": "hp",\n                        "modification": -2\n                    },\n\t\t\t\t\t{\n\t\t\t\t\t\t"name": "postSpawnCoreCooldown",\n\t\t\t\t\t\t"modification": 2\n\t\t\t\t\t}\n                ],\n                "cost": 40,\n                "visualizer_asset_priority": 1,\n                "visualizer_asset_path": "feather"\n            },\n            {\n                "id": "max_gems",\n                "properties": [\n                    {\n                        "name": "maxGems",\n                        "modification": 150\n                    },\n                    {\n                        "name": "hp",\n                        "modification": -1\n                    },\n\t\t\t\t\t{\n\t\t\t\t\t\t"name": "postSpawnCoreCooldown",\n\t\t\t\t\t\t"modification": 2\n\t\t\t\t\t}\n                ],\n                "cost": 40,\n                "visualizer_asset_priority": 0,\n                "visualizer_asset_path": "bag"\n            }\n        ],\n        "invalidConditions": [\n            {\n                "message": "Your baseActionCooldown must be more than or equal to all your damage properties (unit, core, object) added together.",\n                "condition": {\n                    "type": "less_than",\n                    "1": {\n                        "type": "property",\n                        "property": "baseActionCooldown"\n                    },\n                    "2": {\n                        "type": "sum",\n                        "1": {\n                            "type": "sum",\n                            "1": {\n                                "type": "property",\n                                "property": "damageUnit"\n                            },\n                            "2": {\n                                "type": "property",\n                                "property": "damageCore"\n                            }\n                        },\n                        "2": {\n                            "type": "property",\n                            "property": "damageObject"\n                        }\n                    }\n                }\n            },\n            {\n                "message": "You must have 1 or more hp.",\n                "condition": {\n                    "type": "less_than",\n                    "1": {\n                        "type": "property",\n                        "property": "hp"\n                    },\n                    "2": {\n                        "type": "const",\n                        "value": 1\n                    }\n                }\n            },\n            {\n                "message": "Your unit shall not have more than 3 armor components.",\n                "condition": {\n                    "type": "greater_than",\n                    "1": {\n                        "type": "component_count",\n                        "component": "armor"\n                    },\n                    "2": {\n                        "type": "const",\n                        "value": 3\n                    }\n                }\n            }\n        ]\n    }\n}\n';

const SERVER_CONFIG =
  '{\n    "replayFolderPaths": [\n        "/workspace/replays",\n        "/workspaces/monorepo",\n        "/workspaces/monorepo/visualizer/public/replays",\n        "./replays"\n    ],\n    "timeoutTicks": 10000,\n    "timeoutMs": 6000000,\n    "clientWaitTimeoutMs": 3000,\n    "clientConnectTimeoutMs": 30000,\n    "clientPacketsMaxSizeKb": 16\n}\n';

/** The create form's former defaults; the schedule keeps its 1h and 2h. */
export const DEFAULT_PRESET_SETTINGS = {
  description: "",
  location: "",
  minTeamSize: 1,
  maxTeamSize: 4,
  gameServerDockerImage: "ghcr.io/42core-team/server:dev",
  myCoreBotDockerImage: "ghcr.io/42core-team/my-core-bot:dev",
  visualizerDockerImage: "ghcr.io/42core-team/visualizer:dev",
  monorepoUrl: "https://github.com/42core-team/monorepo",
  monorepoVersion: "dev",
  basePath: "bots/c/bot",
  gameConfig: GAME_CONFIG,
  serverConfig: SERVER_CONFIG,
  introEnabled: false,
  introLeadMinutes: 15,
  schedule: {
    startOffsetDays: 7,
    startTime: "10:00",
    submissionDeadlineAfterHours: 1,
    scheduledEndAfterHours: 2,
  },
};

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

/** Idempotent: never replaces an edited preset or an existing default. */
export async function seedDefaultPreset(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO "event_presets" ("name", "description", "isDefault", "settings")
       SELECT 'Default', $1, true, $2 WHERE NOT EXISTS (SELECT 1 FROM event_presets WHERE "isDefault") ON CONFLICT ("name") DO NOTHING`,
    [
      "Default event settings with the official game and server configs.",
      JSON.stringify(DEFAULT_PRESET_SETTINGS),
    ],
  );
}
