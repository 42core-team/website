import { MigrationInterface, QueryRunner } from "typeorm";

export class EventWhitelist1775336799887 implements MigrationInterface {
    name = 'EventWhitelist1775336799887'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "event_whitelists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platform" text NOT NULL, "username" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid NOT NULL, CONSTRAINT "UQ_1e66e3e9750244ea3f6563a6d49" UNIQUE ("eventId", "username", "platform"), CONSTRAINT "PK_64d752c5410ff967a715cca3998" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "event_whitelists" ADD CONSTRAINT "FK_17ccbcee3723a35d6d691532c22" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_whitelists" DROP CONSTRAINT "FK_17ccbcee3723a35d6d691532c22"`);
        await queryRunner.query(`DROP TABLE "event_whitelists"`);
    }

}
