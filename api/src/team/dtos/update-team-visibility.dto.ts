import { IsBoolean } from "class-validator";

export class UpdateTeamVisibilityDto {
  @IsBoolean()
  isPublic: boolean;
}
