import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TEAM_NAME_MAX_LENGTH } from "../../common/name-limits";

export class QueueMatchesQueryDto {
  @ApiPropertyOptional({ description: "The 1-based page", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: "Matches per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    description: "Part of a playing team's name",
    maxLength: TEAM_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(TEAM_NAME_MAX_LENGTH)
  search?: string;
}
