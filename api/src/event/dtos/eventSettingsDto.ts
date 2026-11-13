import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  GIT_REF_MESSAGE,
  GIT_REF_PATTERN,
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

/**
 * Every value a new event needs, all required. A create request is merged
 * onto a resolved preset and the result must validate against this.
 * Dates are epoch milliseconds.
 */
export class EventSettingsDto {
  @ApiProperty({ maxLength: EVENT_NAME_MAX_LENGTH })
  @IsString()
  @MinLength(3)
  @MaxLength(EVENT_NAME_MAX_LENGTH, { message: EVENT_NAME_MAX_LENGTH_MESSAGE })
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiProperty()
  @IsNumber()
  startDate: number;

  /** Older clients' end date; an event's end is its scheduledEndDate. */
  @ApiProperty()
  @IsNumber()
  endDate: number;

  @ApiProperty()
  @IsNumber()
  submissionDeadline: number;

  @ApiProperty()
  @IsNumber()
  scheduledEndDate: number;

  @ApiProperty()
  @IsBoolean()
  introEnabled: boolean;

  @ApiProperty()
  @IsInt()
  @Min(0)
  introLeadMinutes: number;

  /** Empty for no stream. */
  @ApiProperty()
  @IsString()
  @MaxLength(2048)
  streamUrl: string;

  @ApiProperty({
    description: "Showtime stream; falls back to streamUrl when empty",
  })
  @IsString()
  @MaxLength(2048)
  showtimeStreamUrl: string;

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

/** The settings an event takes over from a preset, apart from its dates. */
export const PRESET_SETTING_FIELDS = [
  "description",
  "location",
  "introEnabled",
  "introLeadMinutes",
  "streamUrl",
  "showtimeStreamUrl",
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
] as const satisfies readonly (keyof EventSettingsDto)[];

/** The dates a preset's schedule resolves to. */
export const EVENT_DATE_FIELDS = [
  "startDate",
  "endDate",
  "submissionDeadline",
  "scheduledEndDate",
] as const satisfies readonly (keyof EventSettingsDto)[];
