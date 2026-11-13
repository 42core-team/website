import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { UserRole } from "../../user/entities/user-role.entity";

export class GrantRoleDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description: "Grants the role for this event only; ADMIN and MODERATOR",
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
