import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateManualMatchDto {
  @ApiProperty({ description: "The first team to play" })
  @IsUUID()
  teamOneId: string;

  @ApiProperty({ description: "The second team to play" })
  @IsUUID()
  teamTwoId: string;
}
