import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OwnerImageService } from "../media/owner-image.service";
import { UserEntity } from "./entities/user.entity";

/** Uploaded profile artwork. Orphan cleanup runs in TeamImageService (shared MEDIA_CLEANUP lock). */
@Injectable()
export class UserImageService extends OwnerImageService<UserEntity> {
  constructor(
    config: ConfigService,
    @InjectRepository(UserEntity) users: Repository<UserEntity>,
  ) {
    super(config, users, UserEntity, "user");
  }
}
