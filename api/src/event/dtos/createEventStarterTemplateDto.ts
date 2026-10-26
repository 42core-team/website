import { IsString, IsNotEmpty, Matches } from "class-validator";
import {
  REPO_RELATIVE_PATH_MESSAGE,
  REPO_RELATIVE_PATH_PATTERN,
} from "../../common/github-validation";
import { NormalizeGithubConfig } from "../../common/github-config-normalization";

export class CreateEventStarterTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @NormalizeGithubConfig("basePath")
  @Matches(REPO_RELATIVE_PATH_PATTERN, { message: REPO_RELATIVE_PATH_MESSAGE })
  basePath: string;

  @IsString()
  @IsNotEmpty()
  myCoreBotDockerImage: string;
}
