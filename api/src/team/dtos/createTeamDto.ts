import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTeamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_.-]{4,30}$/, {
    message:
      "Name can only contain letters, numbers, underscores, dots, and hyphens. Must be between 4 and 30 characters.",
  })
  name: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  starterTemplateId?: string;
}
