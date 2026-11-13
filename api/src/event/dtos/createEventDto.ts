import {
  ApiPropertyOptional,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
  ValidateIf,
} from "class-validator";
import { CreateEventStarterTemplateDto } from "./createEventStarterTemplateDto";
import { EventSettingsDto } from "./eventSettingsDto";

export const EVENT_MAX_STARTER_TEMPLATES = 20;

/**
 * A new event: a name, and any settings or dates that should differ from
 * the preset. The merged result must be a valid EventSettingsDto.
 *
 * There is no organizer token: `githubOrg` and `githubOrgSecret` are
 * rejected like any unknown property. `isPrivate` is accepted for older
 * clients but ignored, as every event starts private.
 */
export class CreateEventDto extends IntersectionType(
  PickType(EventSettingsDto, ["name"] as const),
  PartialType(OmitType(EventSettingsDto, ["name"] as const), {
    skipNullProperties: false,
  }),
) {
  /** Defaults to the default preset. */
  @ApiPropertyOptional({ format: "uuid" })
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  presetId?: string;

  /**
   * A shared or actively owned installation to link instead of the preset's; null links
   * none. Our id, not GitHub's.
   */
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  githubInstallationId?: string | null;

  /** Replaces the preset's starter templates. */
  @ApiPropertyOptional({ type: [CreateEventStarterTemplateDto] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(EVENT_MAX_STARTER_TEMPLATES)
  @ValidateNested({ each: true })
  @Type(() => CreateEventStarterTemplateDto)
  starterTemplates?: CreateEventStarterTemplateDto[];
}
