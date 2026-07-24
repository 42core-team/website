import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class UpdateTeamCreditsDto {
  @ApiProperty({ description: "The team's new credit balance" })
  @IsInt()
  credits: number;
}
