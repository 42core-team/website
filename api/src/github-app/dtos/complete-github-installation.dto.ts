import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";

export class CompleteGithubInstallationDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  installationId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  state: string;
}
