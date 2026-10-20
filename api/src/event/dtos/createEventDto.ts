import {
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  Min,
  IsNotEmpty,
  IsBoolean,
  IsInt,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  githubOrg: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  githubOrgSecret: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  location: string;

  @ApiProperty()
  @IsNumber()
  startDate: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  endDate?: number;

  @IsOptional()
  @IsNumber()
  submissionDeadline?: number;

  @IsOptional()
  @IsNumber()
  scheduledEndDate?: number;

  @IsOptional()
  @IsBoolean()
  introEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  introLeadMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamUrl?: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  minTeamSize: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  maxTeamSize: number;

  @ApiProperty()
  @IsString()
  gameServerDockerImage: string;

  @ApiProperty()
  @IsString()
  myCoreBotDockerImage: string;

  @ApiProperty()
  @IsString()
  visualizerDockerImage: string;

  @ApiProperty()
  @IsString()
  monorepoUrl: string;

  @ApiProperty()
  @IsString()
  monorepoVersion: string;

  @ApiProperty()
  @IsString()
  basePath: string;

  @ApiProperty()
  @IsString()
  gameConfig: string;

  @ApiProperty()
  @IsString()
  serverConfig: string;

  @ApiProperty()
  @IsBoolean()
  isPrivate: boolean;
}
