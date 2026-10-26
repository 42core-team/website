import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TEAM_NAME_MAX_LENGTH } from "../../common/name-limits";

export class CreateTeamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(new RegExp(`^[A-Za-z0-9_.-]{4,${TEAM_NAME_MAX_LENGTH}}$`), {
    message: `Name can only contain letters, numbers, underscores, dots, and hyphens. Must be between 4 and ${TEAM_NAME_MAX_LENGTH} characters.`,
  })
  name: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  starterTemplateId?: string;
}
