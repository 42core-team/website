import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  getTeamAssetExtension,
  TeamAssetType,
  UploadedTeamAsset,
} from "./team-assets";

@Injectable()
export class TeamAssetsService {
  private s3Client?: S3Client;

  constructor(private readonly configService: ConfigService) {}

  async upload(
    teamId: string,
    assetType: TeamAssetType,
    file: UploadedTeamAsset,
  ) {
    const key = `teams/${teamId}/${assetType}-${randomUUID()}.${getTeamAssetExtension(file.mimetype)}`;

    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.getBucket(),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return {
      key,
      url: `${this.getPublicBaseUrl()}/${key}`,
    };
  }

  async deleteByUrl(url: string | null | undefined) {
    if (!url) return;

    const prefix = `${this.getPublicBaseUrl()}/`;
    if (!url.startsWith(prefix)) return;

    await this.deleteByKey(url.slice(prefix.length));
  }

  async deleteByKey(key: string) {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.getBucket(),
        Key: key,
      }),
    );
  }

  private getClient() {
    if (this.s3Client) return this.s3Client;

    this.s3Client = new S3Client({
      endpoint: this.getEndpointOrigin(),
      region: this.configService.get<string>("S3_REGION", "eu"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>("S3_ACCESS_KEY_ID"),
        secretAccessKey: this.configService.getOrThrow<string>(
          "S3_SECRET_ACCESS_KEY",
        ),
      },
    });

    return this.s3Client;
  }

  private getBucket() {
    return this.configService.getOrThrow<string>("S3_BUCKET");
  }

  private getPublicBaseUrl() {
    const configuredUrl = this.configService.get<string>("S3_PUBLIC_URL");
    if (configuredUrl) return configuredUrl.replace(/\/$/, "");

    return `${this.getEndpointOrigin()}/${this.getBucket()}`;
  }

  private getEndpointOrigin() {
    const endpoint = this.configService.getOrThrow<string>("S3_ENDPOINT");
    const normalizedEndpoint = endpoint.match(/^https?:\/\//)
      ? endpoint
      : `https://${endpoint}`;
    return new URL(normalizedEndpoint).origin;
  }
}
