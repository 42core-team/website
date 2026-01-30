import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateEventSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canCreateTeam?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  processQueue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showConfigs?: boolean;
}
