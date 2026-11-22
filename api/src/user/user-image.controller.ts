import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SignedIn } from "../authz";
import { UserId } from "../guards/UserGuard";
import { MAX_IMAGE_BYTES } from "../media/image-processing";
import { cropScale, imageKind, position } from "../media/image-params";
import { UserImageService } from "./user-image.service";

@Controller("user/me/images")
@SignedIn()
export class UserImageController {
  constructor(private readonly images: UserImageService) {}

  @Put(":kind")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 3, parts: 5 },
    }),
  )
  upload(
    @UserId() userId: string,
    @Param("kind") kind: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body("x") x: unknown,
    @Body("y") y: unknown,
    @Body("scale") scale: unknown,
  ) {
    if (!file) throw new BadRequestException("Choose an image to upload.");
    return this.images.upload(
      userId,
      imageKind(kind),
      file.buffer,
      position(x),
      position(y),
      cropScale(scale),
    );
  }

  @Delete(":kind")
  remove(@UserId() userId: string, @Param("kind") kind: string) {
    return this.images.remove(userId, imageKind(kind));
  }
}
