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
import { MAX_IMAGE_BYTES } from "../media/image-processing";
import { cropScale, imageKind, position } from "../media/image-params";
import { TeamImageService } from "./team-image.service";

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
