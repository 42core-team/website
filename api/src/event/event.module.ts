import { forwardRef, Module } from "@nestjs/common";
import { EventEntity } from "./entities/event.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventController } from "./event.controller";
import { EventService } from "./event.service";
import { TeamModule } from "../team/team.module";
import { UserModule } from "../user/user.module";
import { UserEventPermissionEntity } from "../user/entities/user.entity";
import { CheckController } from "./check.controller";

import { EventStarterTemplateEntity } from "./entities/event-starter-template.entity";
import { EventWhitelistEntity } from "./entities/event-whitelist.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventEntity,
      UserEventPermissionEntity,
      EventStarterTemplateEntity,
      EventWhitelistEntity,
    ]),
    UserModule,
    forwardRef(() => TeamModule),
  ],
  controllers: [EventController, CheckController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
