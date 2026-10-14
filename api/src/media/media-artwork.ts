import type { MediaUploadEntity } from "./entities/media-upload.entity";

export interface TeamMediaUploads {
  pictureSmallUpload?: Pick<MediaUploadEntity, "objectKey"> | null;
  pictureLargeUpload?: Pick<MediaUploadEntity, "objectKey"> | null;
  backgroundLargeUpload?: Pick<MediaUploadEntity, "objectKey"> | null;
}

export function mediaArtwork({
  pictureSmallUpload,
  pictureLargeUpload,
  backgroundLargeUpload,
}: TeamMediaUploads) {
  return {
    picture:
      pictureSmallUpload && pictureLargeUpload
        ? {
            small: pictureSmallUpload.objectKey,
            large: pictureLargeUpload.objectKey,
          }
        : null,
    background: backgroundLargeUpload
      ? { large: backgroundLargeUpload.objectKey }
      : null,
  };
}
