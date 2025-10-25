import { IsOptional } from "class-validator";

export class SetLockTeamsDateDto {
  @IsOptional()
  repoLockDate: number;
}
