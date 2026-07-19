import { BadRequestException } from "@nestjs/common";
import {
  getTeamAssetExtension,
  TeamAssetType,
  UploadedTeamAsset,
  validateTeamAsset,
} from "./team-assets";

function createFile(
  mimetype: string,
  signature: number[],
  size = signature.length,
): UploadedTeamAsset {
  const buffer = Buffer.alloc(Math.max(12, signature.length));
  Buffer.from(signature).copy(buffer);
  return {
    buffer,
    mimetype,
    originalname: "asset",
    size,
  };
}

describe("team asset validation", () => {
  it("accepts a valid PNG profile image", () => {
    const file = createFile(
      "image/png",
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );

    expect(() =>
      validateTeamAsset(TeamAssetType.PROFILE_IMAGE, file),
    ).not.toThrow();
    expect(getTeamAssetExtension(file.mimetype)).toBe("png");
  });

  it("rejects a file whose contents do not match the MIME type", () => {
    const file = createFile("image/png", [0x00, 0x01, 0x02, 0x03]);

    expect(() => validateTeamAsset(TeamAssetType.PROFILE_IMAGE, file)).toThrow(
      BadRequestException,
    );
  });

  it("rejects a profile image larger than 2 MB", () => {
    const file = createFile(
      "image/jpeg",
      [0xff, 0xd8, 0xff],
      2 * 1024 * 1024 + 1,
    );

    expect(() => validateTeamAsset(TeamAssetType.PROFILE_IMAGE, file)).toThrow(
      "2 MB or smaller",
    );
  });

  it("accepts a valid MP3 winning sound", () => {
    const file = createFile("audio/mpeg", [0x49, 0x44, 0x33]);

    expect(() =>
      validateTeamAsset(TeamAssetType.WINNING_SOUND, file),
    ).not.toThrow();
  });

  it("requires an uploaded file", () => {
    expect(() =>
      validateTeamAsset(TeamAssetType.BANNER_IMAGE, undefined),
    ).toThrow("required");
  });
});
