import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron } from "@nestjs/schedule";
import { IsNull, Not, Repository } from "typeorm";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { TeamEntity } from "./entities/team.entity";
import { LockKeys } from "../constants";
import { MediaUploadEntity } from "../media/entities/media-upload.entity";
import type { MediaVariant } from "../media/entities/media-upload.entity";

export type ImageKind = "picture" | "background";
export interface TeamImage {
  small: string;
  large: string;
}
export interface TeamBackground {
  large: string;
}
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function processTeamImage(
  buffer: Buffer,
  kind: ImageKind,
  x = 50,
  y = 50,
  scale = 1,
) {
  try {
    const input = sharp(buffer, {
      animated: true,
      limitInputPixels: 25_000_000,
      failOn: "warning",
    });
    const meta = await input.metadata();
    if (
      !["jpeg", "png", "webp", "gif"].includes(meta.format ?? "") ||
      ((meta.pages ?? 1) > 1 && meta.format !== "gif") ||
      (meta.pages ?? 1) > 200 ||
      (meta.width ?? 0) * (meta.height ?? 0) > 25_000_000
    )
      throw new Error("Unsupported image");
    const animated = (meta.pages ?? 1) > 1;
    // Animated GIFs keep their frame stack and timing; still images are auto-oriented.
    const oriented = animated
      ? null
      : await input
          .rotate()
          .raw()
          .timeout({ seconds: 15 })
          .toBuffer({ resolveWithObject: true });
    const sourceWidth = oriented?.info.width ?? meta.width!;
    const sourceHeight = oriented?.info.height ?? meta.pageHeight!;
    const ratio = kind === "picture" ? 1 : 10 / 3;
    const width = Math.max(
      1,
      Math.floor(
        Math.min(sourceWidth, Math.floor(sourceHeight * ratio)) * scale,
      ),
    );
    const height = Math.min(sourceHeight, Math.floor(width / ratio));
    if (width < 1 || height < 1) throw new Error("Image is too small");
    const crop = {
      left: Math.round(((sourceWidth - width) * x) / 100),
      top: Math.round(((sourceHeight - height) * y) / 100),
      width,
      height,
    };
    const sizes = kind === "picture" ? [128, 512] : [1600];
    return await Promise.all(
      sizes.map((size) =>
        (oriented
          ? sharp(oriented.data, {
              raw: {
                width: sourceWidth,
                height: sourceHeight,
                channels: oriented.info.channels,
              },
            })
          : input.clone()
        )
          .extract(crop)
          .resize({ width: size, withoutEnlargement: true })
          .webp({ quality: kind === "picture" ? 82 : 78 })
          .timeout({ seconds: 15 })
          .toBuffer(),
      ),
    );
  } catch {
    throw new BadRequestException(
      "Use a valid JPEG, PNG, WebP or GIF. GIFs must have at most 200 frames and 25 million pixels across all frames; still images must be under 25 megapixels.",
    );
  }
}

@Injectable()
export class TeamImageService {
  private readonly logger = new Logger(TeamImageService.name);
  private active = 0;
  private readonly busyTeams = new Set<string>();
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TeamEntity)
    private readonly teams: Repository<TeamEntity>,
  ) {}

  private storage() {
    const endpoint = this.config.get<string>("MEDIA_S3_ENDPOINT");
    const bucket = this.config.get<string>("MEDIA_S3_BUCKET");
    if (!endpoint || !bucket)
      throw new ServiceUnavailableException("Media storage is not configured.");
    return {
      bucket,
      client: new S3Client({
        endpoint,
        region: this.config.get<string>("MEDIA_S3_REGION") || "eu01",
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.config.getOrThrow("MEDIA_S3_ACCESS_KEY_ID"),
          secretAccessKey: this.config.getOrThrow("MEDIA_S3_SECRET_ACCESS_KEY"),
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
      }),
    };
  }

  async upload(
    teamId: string,
    kind: ImageKind,
    buffer: Buffer,
    x: number,
    y: number,
    scale = 1,
  ) {
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES)
      throw new BadRequestException("Choose an image up to 10 MB.");
    if (this.active >= 2 || this.busyTeams.has(teamId))
      throw new ServiceUnavailableException(
        "Image processing is busy. Please try again shortly.",
      );
    this.active++;
    this.busyTeams.add(teamId);
    let client: S3Client | undefined;
    try {
      const storage = this.storage();
      client = storage.client;
      const outputs = await processTeamImage(buffer, kind, x, y, scale);
      const prefix = `images/${randomUUID()}/${kind}`;
      const variants: MediaVariant[] =
        kind === "picture" ? ["small", "large"] : ["large"];
      const image =
        kind === "picture"
          ? { small: `${prefix}-small.webp`, large: `${prefix}-large.webp` }
          : { large: `${prefix}-large.webp` };
      // Publish only after every immutable object exists. Orphans are cleaned later.
      for (const [index, variant] of variants.entries()) {
        const key = `${prefix}-${variant}.webp`;
        const body = outputs[index];
        await client.send(
          new PutObjectCommand({
            Bucket: storage.bucket,
            Key: key,
            Body: body,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
      }
      await this.teams.manager.transaction(async (manager) => {
        // Serialize replacements across API replicas and publish all variants atomically.
        await manager.findOneOrFail(TeamEntity, {
          where: { id: teamId },
          lock: { mode: "pessimistic_write" },
          loadEagerRelations: false,
        });
        await manager.delete(MediaUploadEntity, { teamId, kind });
        await manager.save(
          MediaUploadEntity,
          variants.map((variant) => ({
            teamId,
            userId: null,
            kind,
            variant,
            objectKey: `${prefix}-${variant}.webp`,
          })),
        );
      });
      return image;
    } finally {
      client?.destroy();
      this.active--;
      this.busyTeams.delete(teamId);
    }
  }

  async remove(teamId: string, kind: ImageKind) {
    if (this.busyTeams.has(teamId))
      throw new ServiceUnavailableException(
        "Wait for the current upload to finish.",
      );
    await this.teams.manager.transaction(async (manager) => {
      await manager.findOneOrFail(TeamEntity, {
        where: { id: teamId },
        lock: { mode: "pessimistic_write" },
        loadEagerRelations: false,
      });
      await manager.delete(MediaUploadEntity, { teamId, kind });
    });
  }

  @Cron("0 3 * * *")
  async cleanup() {
    if (!this.config.get("MEDIA_S3_BUCKET")) return;
    let client: S3Client | undefined;
    try {
      await this.teams.manager.transaction(async (manager) => {
        // Keep the lock on this transaction's connection for the entire sweep.
        // PostgreSQL releases it on commit, rollback, or connection loss.
        const [lock] = await manager.query(
          "SELECT pg_try_advisory_xact_lock($1) AS acquired",
          [LockKeys.TEAM_IMAGE_CLEANUP],
        );
        if (!lock.acquired) return;
        const storage = this.storage();
        client = storage.client;
        const uploads = await manager.find(MediaUploadEntity, {
          select: { objectKey: true },
          where: [
            { teamId: IsNull() },
            { teamId: Not(IsNull()), team: { deletedAt: IsNull() } },
          ],
        });
        const referenced = new Set(uploads.map((upload) => upload.objectKey));
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
