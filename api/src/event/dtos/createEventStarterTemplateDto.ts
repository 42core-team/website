import { IsString, IsNotEmpty } from "class-validator";

export class CreateEventStarterTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  basePath: string;

  @IsString()
  @IsNotEmpty()
  myCoreBotDockerImage: string;
}
