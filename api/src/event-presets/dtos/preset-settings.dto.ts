import { Type } from "class-transformer";
import {
  IsDefined,
  IsInt,
  IsNumber,
  IsObject,
  ValidateIf,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IntersectionType, PartialType, PickType } from "@nestjs/swagger";
import { EventSettingsDto } from "../../event/dtos/eventSettingsDto";

/** Hours after the start; a year and a day at most. */
const MAX_AFTER_HOURS = 366 * 24;

/**
 * When an event created from the preset happens, relative to the day it is
 * created. Times are wall-clock times in Europe/Berlin.
 */
export class PresetScheduleDto {
  /** Days from today; 0 is today. */
  @IsInt()
  @Min(0)
  @Max(365)
  startOffsetDays: number;

  /** "HH:mm", 24-hour. */
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
    message: "startTime must be a time of day as HH:mm",
  })
  startTime: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(MAX_AFTER_HOURS)
  submissionDeadlineAfterHours?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(MAX_AFTER_HOURS)
  scheduledEndAfterHours?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(MAX_AFTER_HOURS)
  endAfterHours?: number;
}

/**
 * A preset's event settings: the event's settings without its name,
 * visibility, GitHub token and absolute dates, plus a relative schedule.
 * Field names and validators are those of EventSettingsDto.
 */
export class PresetSettingsDto extends IntersectionType(
  PickType(EventSettingsDto, [
    "minTeamSize",
    "maxTeamSize",
    "gameServerDockerImage",
    "myCoreBotDockerImage",
    "visualizerDockerImage",
    "monorepoUrl",
    "monorepoVersion",
    "basePath",
    "gameConfig",
    "serverConfig",
  ] as const),
  PartialType(
    PickType(EventSettingsDto, [
      "description",
      "location",
      "introEnabled",
      "introLeadMinutes",
      "streamUrl",
      "showtimeStreamUrl",
    ] as const),
    { skipNullProperties: false },
  ),
) {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PresetScheduleDto)
  schedule: PresetScheduleDto;
}
