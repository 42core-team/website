import { IsString, IsOptional, Matches } from "class-validator";
import {
  REPO_RELATIVE_PATH_MESSAGE,
  REPO_RELATIVE_PATH_PATTERN,
} from "../../common/github-validation";
import { NormalizeGithubConfig } from "../../common/github-config-normalization";

export class UpdateEventStarterTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @NormalizeGithubConfig("basePath")
  @Matches(REPO_RELATIVE_PATH_PATTERN, { message: REPO_RELATIVE_PATH_MESSAGE })
  basePath?: string;

  @IsString()
  @IsOptional()
  myCoreBotDockerImage?: string;
}
