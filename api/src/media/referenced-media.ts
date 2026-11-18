import type { EntityManager, EntityTarget, FindManyOptions } from "typeorm";
import type { MediaArtworkColumns } from "./entities/media-artwork-columns";

/** Object keys currently referenced by the artwork of every row of an entity. */
export async function referencedMediaKeys<
  T extends MediaArtworkColumns & { id: string },
>(manager: EntityManager, target: EntityTarget<T>): Promise<string[]> {
  const upload = { id: true, objectKey: true };
  const options = {
    select: {
      id: true,
      pictureSmallUpload: upload,
      pictureLargeUpload: upload,
      backgroundLargeUpload: upload,
    },
    relations: {
      pictureSmallUpload: true,
      pictureLargeUpload: true,
      backgroundLargeUpload: true,
    },
    loadEagerRelations: false,
    // TypeORM cannot map the generic T onto these artwork-only select keys.
  } as FindManyOptions<T>;
  const rows = await manager.find(target, options);
  return rows.flatMap((row) =>
    [
      row.pictureSmallUpload?.objectKey,
      row.pictureLargeUpload?.objectKey,
      row.backgroundLargeUpload?.objectKey,
    ].filter((key): key is string => Boolean(key)),
  );
}
