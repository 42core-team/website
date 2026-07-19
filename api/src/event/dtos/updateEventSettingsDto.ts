import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateEventSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canCreateTeam?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  processQueue?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxQueueCredits?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  queueCreditIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  githubOrg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  githubOrgSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  startDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  endDate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minTeamSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxTeamSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gameServerDockerImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  myCoreBotDockerImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visualizerDockerImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  monorepoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  monorepoVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  basePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gameConfig?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serverConfig?: string;
}
