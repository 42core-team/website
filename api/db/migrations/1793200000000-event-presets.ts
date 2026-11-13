import { MigrationInterface, QueryRunner } from "typeorm";

/*
 * The default preset's configs: bots/configs/fake_demo of
 * 42core-team/monorepo at dev (c3aba67). The create form used to fetch
 * configs from the monorepo; presets store them instead.
 */
const GAME_CONFIG = `{
	"gridSize": 20,
	"seed": "",
	"idleIncome": 3,
	"idleIncomeTimeOut": 100,
	"maxUnitStandingCooldown": 50,
	"depositHp": 50,
	"depositIncome": 100,
	"gemPileIncome": 35,
	"coreHp": 99,
	"initialGems": 300,
	"wallHp": 77,
	"worldGenerator": "sparse",
	"worldGeneratorConfig": {
		"depositCount": 20,
		"gemPileCount": 10,
		"wallCount": 30,
		"coreBuffer": 3
	},
	"components": {
		"maxComponentsPerUnit": 5,
		"unitDefaultCost": 20,
		"unitDefaultProperties": {
			"hp": 5,
			"baseActionCooldown": 3,
			"gemsPerCooldownStep": 10,
			"maxGems": 100,
			"damageReductionPercent": 0, 
			"damageCore": 0,
			"damageUnit": 0,
			"damageObject": 0,
			"postSpawnCoreCooldown": 10
		},
		"components": [
			{
				"id": "health",
				"properties": [
					{
						"name": "hp",
						"modification": 3
					}
				],
				"cost": 12,
				"visualizer_asset_priority": 0,
				"visualizer_asset_path": "heart"
			},
			{
				"id": "speed",
				"properties": [
					{
						"name": "baseActionCooldown",
						"modification": -2
					}
				],
				"cost": 12,
				"visualizer_asset_priority": 0,
				"visualizer_asset_path": "lightning"
			},
			{
				"id": "armor",
				"properties": [
					{
						"name": "damageReductionPercent",
						"modification": 20
					}
				],
				"cost": 30,
				"visualizer_asset_priority": 1,
				"visualizer_asset_path": "shield"
			},
			{
				"id": "unit_attack",
				"properties": [
					{
						"name": "damageUnit",
						"modification": 3
					}
				],
				"cost": 15,
				"visualizer_asset_priority": 1,
				"visualizer_asset_path": "sword"
			},
			{
				"id": "core_attack",
				"properties": [
					{
						"name": "damageCore",
						"modification": 3
					}
				],
				"cost": 15,
				"visualizer_asset_priority": 1,
				"visualizer_asset_path": "axe"
			},
			{
				"id": "mining",
				"properties": [
					{
						"name": "damageObject",
						"modification": 3
					}
				],
				"cost": 15,
				"visualizer_asset_priority": 1,
				"visualizer_asset_path": "pickaxe"
			},
			{
				"id": "gem_carrying_efficiency",
				"properties": [
					{
						"name": "gemsPerCooldownStep",
						"modification": 10
					}
				],
				"cost": 20,
				"visualizer_asset_priority": 0,
				"visualizer_asset_path": "feather"
			},
			{
				"id": "gem_carrying_capacity",
				"properties": [
					{
						"name": "maxGems",
						"modification": 50
					}
				],
				"cost": 20,
				"visualizer_asset_priority": 0,
				"visualizer_asset_path": "bag"
			}
		],
		"invalidConditions": [
			{
				"message": "Your action cooldown may not be less than your total attacks added together",
				"condition": {
					"type": "less_than",
					"1": {
						"type": "property",
						"property": "baseActionCooldown"
					},
					"2": {
						"type": "sum",
						"1": {
							"type": "sum",
							"1": {
								"type": "property",
								"property": "damageUnit"
							},
							"2": {
								"type": "property",
								"property": "damageCore"
							}
						},
						"2": {
							"type": "property",
							"property": "damageObject"
						}
					}
				}
			},
			{
				"message": "You may not have more than 4 armor components",
				"condition": {
					"type": "greater_than",
					"1": {
						"type": "component_count",
						"component": "armor"
					},
					"2": {
						"type": "const",
						"value": 4
					}
				}
			}
		]
	},
	"corePositions": [
		{
			"x": 0,
			"y": 0
		},
		{
			"x": 19,
			"y": 19
		}
	]
}
`;

const SERVER_CONFIG = `{
    "replayFolderPaths": [
        "/workspace/replays",
        "/workspaces/monorepo",
        "/workspaces/monorepo/visualizer/public/replays",
        "./replays"
    ],
    "timeoutTicks": 30000,
    "timeoutMs": 3000000,
    "clientWaitTimeoutMs": 30000,
    "clientConnectTimeoutMs": 30000,
    "clientLoginTimeoutMs": 5000,
    "clientPacketsMaxSizeKb": 16
}
`;

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

    await queryRunner.query(
      `INSERT INTO "event_presets" ("name", "description", "isDefault", "settings")
       VALUES ('Default', $1, true, $2)`,
      [
        "The settings the create form used before presets.",
        JSON.stringify(DEFAULT_PRESET_SETTINGS),
      ],
    );
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
