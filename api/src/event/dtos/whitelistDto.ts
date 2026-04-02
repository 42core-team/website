import { IsArray, IsEnum, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { WhitelistPlatform } from "../entities/event-whitelist.entity";

export class WhitelistEntryDto {
  @IsString()
  username: string;

  @IsEnum(WhitelistPlatform)
  platform: WhitelistPlatform;
}

export class AddToWhitelistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhitelistEntryDto)
  entries: WhitelistEntryDto[];
}

export class BulkDeleteWhitelistDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
