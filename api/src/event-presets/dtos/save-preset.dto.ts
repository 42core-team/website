import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CreateEventStarterTemplateDto } from "../../event/dtos/createEventStarterTemplateDto";
import { PresetSettingsDto } from "./preset-settings.dto";

export const PRESET_NAME_MAX_LENGTH = 100;
export const PRESET_MAX_STARTER_TEMPLATES = 20;

/**
 * A new preset. Omitted optional fields default to no description, not the
 * default preset, no starter templates and no GitHub installation.
 */
export class CreatePresetDto {
  @ApiProperty({ minLength: 3, maxLength: PRESET_NAME_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(PRESET_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /** True makes this the default preset and unsets the previous default. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ type: PresetSettingsDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => PresetSettingsDto)
  settings: PresetSettingsDto;

  @ApiPropertyOptional({ type: [CreateEventStarterTemplateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PRESET_MAX_STARTER_TEMPLATES)
  @ValidateNested({ each: true })
  @Type(() => CreateEventStarterTemplateDto)
  starterTemplates?: CreateEventStarterTemplateDto[];

  /** A shared installation (our id, not GitHub's); null for none. */
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  githubInstallationId?: string | null;
}

/**
 * Replaces a preset's name and settings. Omitted optional fields keep their
 * current values; send null (or [] for templates) to clear them.
 */
export class UpdatePresetDto extends CreatePresetDto {
  /** The version the edit started from; a newer one answers 409. */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
