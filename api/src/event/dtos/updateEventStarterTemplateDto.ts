import { IsString, IsOptional } from "class-validator";

export class UpdateEventStarterTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  basePath?: string;

  @IsString()
  @IsOptional()
  myCoreBotDockerImage?: string;
}
