import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";

export function mediaStorage(config: ConfigService) {
  const endpoint = config.get<string>("MEDIA_S3_ENDPOINT");
  const bucket = config.get<string>("MEDIA_S3_BUCKET");
  if (!endpoint || !bucket)
    throw new ServiceUnavailableException("Media storage is not configured.");
  return {
    bucket,
    client: new S3Client({
      endpoint,
      region: config.get<string>("MEDIA_S3_REGION") || "eu01",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow("MEDIA_S3_ACCESS_KEY_ID"),
        secretAccessKey: config.getOrThrow("MEDIA_S3_SECRET_ACCESS_KEY"),
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
    }),
  };
}
