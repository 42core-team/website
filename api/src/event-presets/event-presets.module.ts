import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminEventPresetsController } from "./admin-event-presets.controller";
import { EventPresetEntity } from "./entities/event-preset.entity";
import { EventPresetsService } from "./event-presets.service";

@Module({
  imports: [TypeOrmModule.forFeature([EventPresetEntity])],
  controllers: [AdminEventPresetsController],
  providers: [EventPresetsService],
  exports: [EventPresetsService],
})
export class EventPresetsModule {}
