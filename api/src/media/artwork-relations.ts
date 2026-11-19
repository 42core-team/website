import type { SelectQueryBuilder, ObjectLiteral } from "typeorm";

/** Find `relations` that load the artwork of an entity with lazy artwork. */
export const USER_ARTWORK_RELATIONS = {
  pictureSmallUpload: true,
  pictureLargeUpload: true,
  backgroundLargeUpload: true,
} as const;

/** Query builder equivalent of USER_ARTWORK_RELATIONS. */
export function joinArtwork<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
): SelectQueryBuilder<T> {
  return qb
    .leftJoinAndSelect(`${alias}.pictureSmallUpload`, `${alias}PictureSmall`)
    .leftJoinAndSelect(`${alias}.pictureLargeUpload`, `${alias}PictureLarge`)
    .leftJoinAndSelect(`${alias}.backgroundLargeUpload`, `${alias}Background`);
}
