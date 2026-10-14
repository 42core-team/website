import type { MediaUploadEntity } from "./entities/media-upload.entity";

export function mediaArtwork(uploads: readonly MediaUploadEntity[]) {
  const small = uploads.find(
    (upload) => upload.kind === "picture" && upload.variant === "small",
  );
  const large = uploads.find(
    (upload) => upload.kind === "picture" && upload.variant === "large",
  );
  const background = uploads.find(
    (upload) => upload.kind === "background" && upload.variant === "large",
  );
  return {
    picture:
      small && large
        ? { small: small.objectKey, large: large.objectKey }
        : null,
    background: background ? { large: background.objectKey } : null,
  };
}
