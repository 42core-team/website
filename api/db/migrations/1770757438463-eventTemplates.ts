import { MigrationInterface, QueryRunner } from "typeorm";

export class EventTemplates1770757438463 implements MigrationInterface {
    name = 'EventTemplates1770757438463'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "event_starter_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "basePath" character varying NOT NULL, "myCoreBotDockerImage" character varying NOT NULL, "eventId" uuid, CONSTRAINT "PK_71a1105f3641c6830dc2ca59178" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "teams" ADD "starterTemplateId" uuid`);
        await queryRunner.query(`ALTER TABLE "event_starter_templates" ADD CONSTRAINT "FK_6c691c5b56253870cacd70e0413" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_1d9ef4aae433eba4679f8c7671d" FOREIGN KEY ("starterTemplateId") REFERENCES "event_starter_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_1d9ef4aae433eba4679f8c7671d"`);
        await queryRunner.query(`ALTER TABLE "event_starter_templates" DROP CONSTRAINT "FK_6c691c5b56253870cacd70e0413"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "starterTemplateId"`);
        await queryRunner.query(`DROP TABLE "event_starter_templates"`);
    }

}
