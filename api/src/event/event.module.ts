import { forwardRef, Module } from "@nestjs/common";
import { EventEntity } from "./entities/event.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminEventsController } from "./admin-events.controller";
import { EventController } from "./event.controller";
import { EventService } from "./event.service";
import { TeamModule } from "../team/team.module";
import { UserModule } from "../user/user.module";
import { UserRoleEntity } from "../user/entities/user-role.entity";
import { CheckController } from "./check.controller";
import { EventPresetsModule } from "../event-presets/event-presets.module";

import { EventStarterTemplateEntity } from "./entities/event-starter-template.entity";
import { EventWhitelistEntity } from "./entities/event-whitelist.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventEntity,
      UserRoleEntity,
      EventStarterTemplateEntity,
      EventWhitelistEntity,
    ]),
    UserModule,
    EventPresetsModule,
    forwardRef(() => TeamModule),
  ],
  controllers: [EventController, CheckController, AdminEventsController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
