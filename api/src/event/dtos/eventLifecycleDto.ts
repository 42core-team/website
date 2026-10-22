import { IsBoolean, IsIn, IsNumber, IsOptional, IsUUID } from "class-validator";

export class EventLifecycleDto {
  @IsIn(["showcase", "complete", "reopen"])
  action: "showcase" | "complete" | "reopen";

  @IsOptional()
  @IsNumber()
  submissionDeadline?: number;
}

export class RetryEventRepositoryDto {
  @IsUUID()
  teamId: string;
}

export class EventTeamExclusionDto {
  @IsBoolean()
  excluded: boolean;
}
