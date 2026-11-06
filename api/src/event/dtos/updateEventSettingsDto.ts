import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import {
  GIT_REF_MESSAGE,
  GIT_REF_PATTERN,
  GITHUB_OWNER_MESSAGE,
  GITHUB_OWNER_PATTERN,
  GITHUB_REPO_URL_MESSAGE,
  GITHUB_REPO_URL_PATTERN,
  REPO_RELATIVE_PATH_MESSAGE,
  REPO_RELATIVE_PATH_PATTERN,
} from "../../common/github-validation";
import { NormalizeGithubConfig } from "../../common/github-config-normalization";
import {
  EVENT_NAME_MAX_LENGTH,
  EVENT_NAME_MAX_LENGTH_MESSAGE,
} from "../../common/name-limits";

export class UpdateEventSettingsDto {
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
  @MaxLength(2048)
  streamUrl?: string;

  @ApiPropertyOptional({
    description: "Showtime stream; falls back to streamUrl when empty",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  showtimeStreamUrl?: string;

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
  gamblingEnabled?: boolean;

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

  @ApiPropertyOptional({ maxLength: EVENT_NAME_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(EVENT_NAME_MAX_LENGTH, { message: EVENT_NAME_MAX_LENGTH_MESSAGE })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @NormalizeGithubConfig("githubOrg")
  @Matches(GITHUB_OWNER_PATTERN, { message: GITHUB_OWNER_MESSAGE })
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
  @NormalizeGithubConfig("monorepoUrl")
  @Matches(GITHUB_REPO_URL_PATTERN, { message: GITHUB_REPO_URL_MESSAGE })
  monorepoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @NormalizeGithubConfig("monorepoVersion")
  @Matches(GIT_REF_PATTERN, { message: GIT_REF_MESSAGE })
  monorepoVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @NormalizeGithubConfig("basePath")
  @Matches(REPO_RELATIVE_PATH_PATTERN, { message: REPO_RELATIVE_PATH_MESSAGE })
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
