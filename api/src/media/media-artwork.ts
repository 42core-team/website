import type { MediaUploadEntity } from "./entities/media-upload.entity";

export interface MediaImage {
  small: string;
  large: string;
}
export interface MediaBackground {
  large: string;
}

export interface MediaUploads {
  pictureSmallUpload?: Pick<MediaUploadEntity, "objectKey"> | null;
  pictureLargeUpload?: Pick<MediaUploadEntity, "objectKey"> | null;
  backgroundLargeUpload?: Pick<MediaUploadEntity, "objectKey"> | null;
}

export function mediaArtwork({
  pictureSmallUpload,
  pictureLargeUpload,
  backgroundLargeUpload,
}: MediaUploads) {
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
