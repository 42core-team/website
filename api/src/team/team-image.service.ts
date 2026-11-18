import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron } from "@nestjs/schedule";
import { Repository } from "typeorm";
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { TeamEntity } from "./entities/team.entity";
import { referencedMediaKeys } from "../media/referenced-media";
import { UserEntity } from "../user/entities/user.entity";
import { LockKeys } from "../constants";
import { OwnerImageService } from "../media/owner-image.service";

@Injectable()
export class TeamImageService extends OwnerImageService<TeamEntity> {
  constructor(
    config: ConfigService,
    @InjectRepository(TeamEntity) teams: Repository<TeamEntity>,
  ) {
    super(config, teams, TeamEntity, "team");
  }

  @Cron("0 3 * * *")
  async cleanup() {
    if (!this.config.get("MEDIA_S3_BUCKET")) return;
    let client: S3Client | undefined;
    try {
      await this.owners.manager.transaction(async (manager) => {
        // Keep the lock on this transaction's connection for the entire sweep.
        // PostgreSQL releases it on commit, rollback, or connection loss.
        const [lock] = await manager.query(
          "SELECT pg_try_advisory_xact_lock($1) AS acquired",
          [LockKeys.MEDIA_CLEANUP],
        );
        if (!lock.acquired) return;
        const storage = this.storage();
        client = storage.client;
        // Users share the media table, so their artwork must survive the sweep.
        const referenced = new Set([
          ...(await referencedMediaKeys(manager, TeamEntity)),
          ...(await referencedMediaKeys(manager, UserEntity)),
        ]);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        let token: string | undefined;
        do {
          const page = await client.send(
            new ListObjectsV2Command({
              Bucket: storage.bucket,
              Prefix: "images/",
              ContinuationToken: token,
            }),
          );
          const objects = (page.Contents ?? [])
            .filter(
              (o) =>
                o.Key &&
                o.LastModified &&
                o.LastModified.getTime() < cutoff &&
                !referenced.has(o.Key),
            )
            .map((o) => ({ Key: o.Key! }));
          if (objects.length)
            await client.send(
              new DeleteObjectsCommand({
                Bucket: storage.bucket,
                Delete: { Objects: objects },
              }),
            );
          token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
      });
    } catch (error) {
      this.logger.error("Media upload cleanup failed", error);
    } finally {
      client?.destroy();
    }
  }
}
