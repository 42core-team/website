import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { In, Repository } from "typeorm";
import type {
  EntityManager,
  EntityTarget,
  FindOneOptions,
  FindOptionsWhere,
  QueryDeepPartialEntity,
} from "typeorm";
import { randomUUID } from "crypto";
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { MediaUploadEntity } from "./entities/media-upload.entity";
import type { MediaVariant } from "./entities/media-upload.entity";
import type { MediaArtworkColumns } from "./entities/media-artwork-columns";
import { MAX_IMAGE_BYTES, processImage } from "./image-processing";
import type { ImageKind } from "./image-processing";
import { mediaStorage } from "./media-storage";
import {
  assertUploadSlotFree,
  recordUpload,
  recordUploadFailure,
} from "./upload-cooldown";

type Owner = MediaArtworkColumns & { id: string };

// Limits are per process, shared by every owner type, because sharp is CPU bound.
const MAX_ACTIVE = 2;
let active = 0;
const busyOwners = new Set<string>();

/** Locks one owner row without joining the eager artwork relations. */
function lockedById<T extends Owner>(id: string): FindOneOptions<T> {
  // TypeORM cannot prove that a generic entity's id is a valid where key.
  const where = { id } as FindOptionsWhere<T>;
  return {
    where,
    lock: { mode: "pessimistic_write" },
    loadEagerRelations: false,
  };
}

/** Column values that set (ids) or clear (null) one artwork kind. */
function artworkPatch<T extends Owner>(
  kind: ImageKind,
  ids: (string | null)[],
  keepUpdatedAt: boolean,
): QueryDeepPartialEntity<T> {
  const columns =
    kind === "picture"
      ? { pictureSmallUploadId: ids[0], pictureLargeUploadId: ids[1] }
      : { backgroundLargeUploadId: ids[0] };
  // Naming the @UpdateDateColumn stops TypeORM from stamping NOW() on it.
  // Profile lookups break username ties by users.updatedAt, so artwork
  // changes must not reorder them. Teams keep the default bump.
  const patch = keepUpdatedAt
    ? { ...columns, updatedAt: () => '"updatedAt"' }
    : columns;
  // The columns come from MediaArtworkColumns, which T extends.
  return patch as QueryDeepPartialEntity<T>;
}

function uploadIds(owner: MediaArtworkColumns, kind: ImageKind) {
  return (
    kind === "picture"
      ? [owner.pictureSmallUploadId, owner.pictureLargeUploadId]
      : [owner.backgroundLargeUploadId]
  ).filter((id): id is string => Boolean(id));
}

/** Stores, replaces and removes the picture and background of one owner row. */
export abstract class OwnerImageService<T extends Owner> {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    protected readonly config: ConfigService,
    protected readonly owners: Repository<T>,
    private readonly target: EntityTarget<T>,
    /** Namespaces busy keys, since team and user ids are separate id spaces. */
    private readonly ownerType: "team" | "user",
  ) {}

  protected storage() {
    return mediaStorage(this.config);
  }

  /** Best effort: the nightly cleanup removes whatever this misses. */
  private async deleteObjects(keys: string[]) {
    if (!keys.length) return;
    let client: S3Client | undefined;
    try {
      const storage = this.storage();
      client = storage.client;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: storage.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    } catch (error) {
      this.logger.warn(`Could not delete replaced media objects: ${error}`);
    } finally {
      client?.destroy();
    }
  }

  /** Deletes the upload rows and returns their object keys. */
  private async dropUploads(manager: EntityManager, ids: string[]) {
    if (!ids.length) return [];
    const rows = await manager.find(MediaUploadEntity, {
      where: { id: In(ids) },
    });
    await manager.delete(MediaUploadEntity, { id: In(ids) });
    return rows.map((row) => row.objectKey);
  }

  async upload(
    ownerId: string,
    kind: ImageKind,
    buffer: Buffer,
    x: number,
    y: number,
    scale = 1,
  ) {
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES)
      throw new BadRequestException("Choose an image up to 10 MB.");
    const busyKey = `${this.ownerType}:${ownerId}`;
    if (active >= MAX_ACTIVE || busyOwners.has(busyKey))
      throw new ServiceUnavailableException(
        "Image processing is busy. Please try again shortly.",
      );
    const cooldownKey = `${busyKey}:${kind}`;
    assertUploadSlotFree(cooldownKey);
    active++;
    busyOwners.add(busyKey);
    let client: S3Client | undefined;
    let succeeded = false;
    try {
      const storage = this.storage();
      client = storage.client;
      const outputs = await processImage(buffer, kind, x, y, scale);
      const prefix = `images/${randomUUID()}/${kind}`;
      const variants: MediaVariant[] =
        kind === "picture" ? ["small", "large"] : ["large"];
      const image =
        kind === "picture"
          ? { small: `${prefix}-small.webp`, large: `${prefix}-large.webp` }
          : { large: `${prefix}-large.webp` };
      // Publish only after every immutable object exists. Orphans are cleaned later.
      for (const [index, variant] of variants.entries()) {
        await client.send(
          new PutObjectCommand({
            Bucket: storage.bucket,
            Key: `${prefix}-${variant}.webp`,
            Body: outputs[index],
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
      }
      const oldKeys = await this.owners.manager.transaction(async (manager) => {
        // Serialize replacements across API replicas and publish all variants atomically.
        const owner = await manager.findOneOrFail(
          this.target,
          lockedById<T>(ownerId),
        );
        const oldIds = uploadIds(owner, kind);
        const saved = await manager.save(
          MediaUploadEntity,
          variants.map((variant) => ({
            objectKey: `${prefix}-${variant}.webp`,
          })),
        );
        await manager.update(
          this.target,
          { id: ownerId },
          artworkPatch<T>(
            kind,
            saved.map((upload) => upload.id),
            this.ownerType === "user",
          ),
        );
        return this.dropUploads(manager, oldIds);
      });
      recordUpload(cooldownKey);
      succeeded = true;
      await this.deleteObjects(oldKeys);
      return image;
    } finally {
      // Short cooldown so failing uploads cannot hold the slots in a loop.
      if (!succeeded) recordUploadFailure(cooldownKey);
      client?.destroy();
      active--;
      busyOwners.delete(busyKey);
    }
  }

  async remove(ownerId: string, kind: ImageKind) {
    if (busyOwners.has(`${this.ownerType}:${ownerId}`))
      throw new ServiceUnavailableException(
        "Wait for the current upload to finish.",
      );
    const oldKeys = await this.owners.manager.transaction(async (manager) => {
      const owner = await manager.findOneOrFail(
        this.target,
        lockedById<T>(ownerId),
      );
      const oldIds = uploadIds(owner, kind);
      await manager.update(
        this.target,
        { id: ownerId },
        artworkPatch<T>(kind, [null, null], this.ownerType === "user"),
      );
      return this.dropUploads(manager, oldIds);
    });
    await this.deleteObjects(oldKeys);
  }
}
