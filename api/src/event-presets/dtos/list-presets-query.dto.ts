import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean } from "class-validator";

export class ListPresetsQueryDto {
  @ApiPropertyOptional({ default: false })
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  includeArchived: boolean = false;
}
