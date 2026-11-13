import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { MatchPhase } from "../match/entites/match.entity";

export class ProfileMatchesQueryDto {
  @ApiPropertyOptional({ description: "Matches to skip", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({ description: "Matches per page", default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 25;

  @ApiPropertyOptional({ description: "Only matches of this event" })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ enum: MatchPhase, description: "Only this phase" })
  @IsOptional()
  @IsEnum(MatchPhase)
  phase?: MatchPhase;
}
