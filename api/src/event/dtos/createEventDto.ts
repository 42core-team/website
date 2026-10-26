import {
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
  @NormalizeGithubConfig("githubOrg")
  @Matches(GITHUB_OWNER_PATTERN, { message: GITHUB_OWNER_MESSAGE })
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
  @MaxLength(2048)
  streamUrl?: string;

  @ApiPropertyOptional({
    description: "Showtime stream; falls back to streamUrl when empty",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  showtimeStreamUrl?: string;

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
  @NormalizeGithubConfig("monorepoUrl")
  @Matches(GITHUB_REPO_URL_PATTERN, { message: GITHUB_REPO_URL_MESSAGE })
  monorepoUrl: string;

  @ApiProperty()
  @IsString()
  @NormalizeGithubConfig("monorepoVersion")
  @Matches(GIT_REF_PATTERN, { message: GIT_REF_MESSAGE })
  monorepoVersion: string;

  @ApiProperty()
  @IsString()
  @NormalizeGithubConfig("basePath")
  @Matches(REPO_RELATIVE_PATH_PATTERN, { message: REPO_RELATIVE_PATH_MESSAGE })
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
