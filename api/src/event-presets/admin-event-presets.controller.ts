import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { Can, PlatformPolicy } from "../authz";
import { strictBody } from "../common/strict-body";
import { UserId } from "../guards/UserGuard";
import { ListPresetsQueryDto } from "./dtos/list-presets-query.dto";
import { CreatePresetDto, UpdatePresetDto } from "./dtos/save-preset.dto";
import { EventPresetsService } from "./event-presets.service";

@Controller("admin/event-presets")
@Can(PlatformPolicy, "managePresets")
export class AdminEventPresetsController {
  constructor(private readonly presets: EventPresetsService) {}

  @Get()
  list(
    @Query(new ValidationPipe({ transform: true })) query: ListPresetsQueryDto,
  ) {
    return this.presets.listForAdmin(query.includeArchived);
  }

  @Get(":id")
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.presets.getDetail(id);
  }

  @Post()
  create(@UserId() userId: string, @Body(strictBody()) body: CreatePresetDto) {
    return this.presets.create(body, userId);
  }

  @Put(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @UserId() userId: string,
    @Body(strictBody()) body: UpdatePresetDto,
  ) {
    return this.presets.update(id, body, userId);
  }

  @Post(":id/duplicate")
  duplicate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @UserId() userId: string,
  ) {
    return this.presets.duplicate(id, userId);
  }

  @Post(":id/archive")
  @HttpCode(200)
  archive(
    @Param("id", new ParseUUIDPipe()) id: string,
    @UserId() userId: string,
  ) {
    return this.presets.archive(id, userId);
  }

  @Post(":id/unarchive")
  @HttpCode(200)
  unarchive(
    @Param("id", new ParseUUIDPipe()) id: string,
    @UserId() userId: string,
  ) {
    return this.presets.unarchive(id, userId);
  }
}
