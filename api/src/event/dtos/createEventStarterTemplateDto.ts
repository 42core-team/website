import { IsString, IsNotEmpty, Matches } from "class-validator";
import {
  REPO_RELATIVE_PATH_MESSAGE,
  REPO_RELATIVE_PATH_PATTERN,
} from "../../common/github-validation";

export class CreateEventStarterTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(REPO_RELATIVE_PATH_PATTERN, { message: REPO_RELATIVE_PATH_MESSAGE })
  basePath: string;

  @IsString()
  @IsNotEmpty()
  myCoreBotDockerImage: string;
}
