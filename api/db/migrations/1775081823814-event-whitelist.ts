import { MigrationInterface, QueryRunner } from "typeorm";

export class EventWhitelist1775081823814 implements MigrationInterface {
    name = 'EventWhitelist1775081823814'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_whitelists" DROP CONSTRAINT "FK_event_whitelists_event"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_event_whitelists_event_username_platform"`);
        await queryRunner.query(`ALTER TABLE "event_whitelists" ALTER COLUMN "eventId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "event_whitelists" ADD CONSTRAINT "UQ_1e66e3e9750244ea3f6563a6d49" UNIQUE ("eventId", "username", "platform")`);
        await queryRunner.query(`ALTER TABLE "event_whitelists" ADD CONSTRAINT "FK_17ccbcee3723a35d6d691532c22" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_whitelists" DROP CONSTRAINT "FK_17ccbcee3723a35d6d691532c22"`);
        await queryRunner.query(`ALTER TABLE "event_whitelists" DROP CONSTRAINT "UQ_1e66e3e9750244ea3f6563a6d49"`);
        await queryRunner.query(`ALTER TABLE "event_whitelists" ALTER COLUMN "eventId" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_event_whitelists_event_username_platform" ON "event_whitelists" ("eventId", "platform", "username") `);
        await queryRunner.query(`ALTER TABLE "event_whitelists" ADD CONSTRAINT "FK_event_whitelists_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
