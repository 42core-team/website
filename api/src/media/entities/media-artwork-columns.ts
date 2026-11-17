import { AfterLoad, Column, JoinColumn, ManyToOne } from "typeorm";
import { Exclude } from "class-transformer";
import { MediaUploadEntity } from "./media-upload.entity";
import { mediaArtwork } from "../media-artwork";
import type { MediaBackground, MediaImage } from "../media-artwork";

/** A hidden many-to-one link from an artwork id column to its upload row. */
function uploadRelation(column: string, eager: boolean): PropertyDecorator {
  return (target, key) => {
    Exclude()(target, key);
    ManyToOne(() => MediaUploadEntity, { eager, onDelete: "SET NULL" })(
      target,
      key,
    );
    JoinColumn({ name: column })(target, key);
  };
}

/** Picture and background references shared by every entity with artwork. */
export abstract class MediaArtworkColumns {
  picture: MediaImage | null;

  background: MediaBackground | null;

  @Exclude()
  @Column({ type: "uuid", nullable: true })
  pictureSmallUploadId: string | null;

  @Exclude()
  @Column({ type: "uuid", nullable: true })
  pictureLargeUploadId: string | null;

  @Exclude()
  @Column({ type: "uuid", nullable: true })
  backgroundLargeUploadId: string | null;

  abstract pictureSmallUpload: MediaUploadEntity | null;
  abstract pictureLargeUpload: MediaUploadEntity | null;
  abstract backgroundLargeUpload: MediaUploadEntity | null;

  @AfterLoad()
  loadArtwork() {
    Object.assign(this, mediaArtwork(this));
  }
}

/** Artwork loaded with every query; for entities that nearly always show it. */
export abstract class EagerMediaArtwork extends MediaArtworkColumns {
  @uploadRelation("pictureSmallUploadId", true)
  pictureSmallUpload: MediaUploadEntity | null;

  @uploadRelation("pictureLargeUploadId", true)
  pictureLargeUpload: MediaUploadEntity | null;

  @uploadRelation("backgroundLargeUploadId", true)
  backgroundLargeUpload: MediaUploadEntity | null;
}

/** Artwork loaded only when asked for; see USER_ARTWORK_RELATIONS. */
export abstract class LazyMediaArtwork extends MediaArtworkColumns {
  @uploadRelation("pictureSmallUploadId", false)
  pictureSmallUpload: MediaUploadEntity | null;

  @uploadRelation("pictureLargeUploadId", false)
  pictureLargeUpload: MediaUploadEntity | null;

  @uploadRelation("backgroundLargeUploadId", false)
  backgroundLargeUpload: MediaUploadEntity | null;
}
