import { BadRequestException } from "@nestjs/common";

export enum TeamAssetType {
  PROFILE_IMAGE = "profile-image",
  BANNER_IMAGE = "banner-image",
  WINNING_SOUND = "winning-sound",
}

export interface UploadedTeamAsset {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

interface TeamAssetRule {
  maxSize: number;
  mimeTypes: readonly string[];
}

export const MAX_TEAM_ASSET_SIZE = 10 * 1024 * 1024;

const TEAM_ASSET_RULES: Record<TeamAssetType, TeamAssetRule> = {
  [TeamAssetType.PROFILE_IMAGE]: {
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  [TeamAssetType.BANNER_IMAGE]: {
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  [TeamAssetType.WINNING_SOUND]: {
    maxSize: MAX_TEAM_ASSET_SIZE,
    mimeTypes: [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
    ],
  },
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

export function validateTeamAsset(
  assetType: TeamAssetType,
  file: UploadedTeamAsset | undefined,
): asserts file is UploadedTeamAsset {
  if (!file) throw new BadRequestException("An asset file is required.");

  const rule = TEAM_ASSET_RULES[assetType];
  if (!rule.mimeTypes.includes(file.mimetype))
    throw new BadRequestException(
      `Unsupported file type for ${assetType}. Allowed types: ${rule.mimeTypes.join(", ")}.`,
    );

  if (file.size > rule.maxSize)
    throw new BadRequestException(
      `${assetType} must be ${Math.floor(rule.maxSize / 1024 / 1024)} MB or smaller.`,
    );

  if (!hasExpectedSignature(file.mimetype, file.buffer))
    throw new BadRequestException(
      "The uploaded file contents do not match its declared file type.",
    );
}

export function getTeamAssetExtension(mimeType: string) {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new BadRequestException("Unsupported file type.");
  return extension;
}

function hasExpectedSignature(mimeType: string, buffer: Buffer) {
  if (buffer.length < 12) return false;

  switch (mimeType) {
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "audio/mpeg":
      return (
        buffer.subarray(0, 3).toString("ascii") === "ID3" ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      );
    case "audio/wav":
    case "audio/x-wav":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WAVE"
      );
    case "audio/ogg":
      return buffer.subarray(0, 4).toString("ascii") === "OggS";
    case "audio/webm":
      return buffer
        .subarray(0, 4)
        .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
}
