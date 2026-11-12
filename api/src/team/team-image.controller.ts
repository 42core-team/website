import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MyTeamGuards, Team } from "../guards/TeamGuard";
import { EVENT_ID_PARAM } from "../guards/GuardConstants";
import { TeamEntity } from "./entities/team.entity";
import {
  ImageKind,
  MAX_IMAGE_BYTES,
  TeamImageService,
} from "./team-image.service";

function imageKind(value: string): ImageKind {
  if (value !== "picture" && value !== "background")
    throw new BadRequestException("Unknown image kind.");
  return value;
}
function position(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value !== "string" || value.trim() === "")
    throw new BadRequestException("Invalid crop position.");
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100)
    throw new BadRequestException("Invalid crop position.");
  return number;
}
function cropScale(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestException("Invalid crop size.");
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 1)
    throw new BadRequestException("Crop size must be between 10% and 100%.");
  return scale;
}
@Controller(`team/event/:${EVENT_ID_PARAM}/my/images`)
@UseGuards(JwtAuthGuard, MyTeamGuards)
export class TeamImageController {
  constructor(private readonly images: TeamImageService) {}

  @Put(":kind")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 3, parts: 5 },
    }),
  )
  upload(
    @Team() team: TeamEntity,
    @Param("kind") kind: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body("x") x: unknown,
    @Body("y") y: unknown,
    @Body("scale") scale: unknown,
  ) {
    if (!file) throw new BadRequestException("Choose an image to upload.");
    return this.images.upload(
      team.id,
      imageKind(kind),
      file.buffer,
      position(x),
      position(y),
      cropScale(scale),
    );
  }

  @Delete(":kind")
  remove(@Team() team: TeamEntity, @Param("kind") kind: string) {
    return this.images.remove(team.id, imageKind(kind));
  }
}
