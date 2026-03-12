import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { SocialAccountController } from "./social-account.controller";
import { SocialAccountService } from "./social-account.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity, UserEventPermissionEntity } from "./entities/user.entity";
import { SocialAccountEntity } from "./entities/social-account.entity";

import { UserEventsController } from "./user.events.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserEventPermissionEntity,
      SocialAccountEntity,
    ]),
  ],
  controllers: [UserController, SocialAccountController, UserEventsController],
  providers: [UserService, SocialAccountService],
  exports: [UserService, SocialAccountService],
})
export class UserModule {}
