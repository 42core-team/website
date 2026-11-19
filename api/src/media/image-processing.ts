import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

export type ImageKind = "picture" | "background";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function processImage(
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
