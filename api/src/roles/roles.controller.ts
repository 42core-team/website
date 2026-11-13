import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { Can, PlatformPolicy } from "../authz";
import { UserId } from "../guards/UserGuard";
import { GrantRoleDto } from "./dtos/grant-role.dto";
import { ListRolesQueryDto } from "./dtos/list-roles-query.dto";
import { RolesService } from "./roles.service";

@Controller("admin/roles")
@Can(PlatformPolicy, "manageRoles")
export class RolesController {
  private readonly logger = new Logger(RolesController.name);

  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(
    @Query(new ValidationPipe({ transform: true })) query: ListRolesQueryDto,
  ) {
    return this.rolesService.list(query);
  }

  @Post()
  async grant(@UserId() userId: string, @Body() body: GrantRoleDto) {
    const role = await this.rolesService.grant(body, userId);
    this.logger.log({
      action: "grant_role",
      userId,
      roleId: role.id,
      granteeId: body.userId,
      role: body.role,
      eventId: body.eventId,
    });
    return role;
  }

  @Delete(":id")
  @HttpCode(204)
  async revoke(
    @UserId() userId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.rolesService.revoke(id);
    this.logger.log({ action: "revoke_role", userId, roleId: id });
  }
}
