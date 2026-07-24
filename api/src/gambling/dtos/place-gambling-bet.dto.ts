import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Max, Min } from "class-validator";

export class PlaceGamblingBetDto {
  @ApiProperty()
  @IsUUID()
  predictedWinnerId: string;

  @ApiProperty({ minimum: 1, maximum: 1_000_000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amount: number;
}
