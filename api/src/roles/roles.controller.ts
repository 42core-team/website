import {
  BadRequestException,
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
import { Can, EventPolicy, param, PlatformPolicy } from "../authz";
import { UserId } from "../guards/UserGuard";
import { EVENT_SCOPED_ROLES } from "../user/entities/user-role.entity";
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

@Controller("admin/users")
@Can(PlatformPolicy, "manageRoles")
export class AdminUsersController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list() {
    return this.rolesService.listUsers();
  }
}

@Controller("event/:id")
@Can(EventPolicy, "administer", param("id"))
export class EventUsersController {
  private readonly logger = new Logger(EventUsersController.name);

  constructor(private readonly rolesService: RolesService) {}

  @Get("users")
  listUsers(@Param("id", ParseUUIDPipe) eventId: string) {
    return this.rolesService.listUsers(eventId);
  }

  @Get("roles")
  listRoles(@Param("id", ParseUUIDPipe) eventId: string) {
    return this.rolesService.list({ eventId });
  }

  @Post("roles")
  async grant(
    @Param("id", ParseUUIDPipe) eventId: string,
    @UserId() actorId: string,
    @Body() body: GrantRoleDto,
  ) {
    if (body.eventId !== undefined || !EVENT_SCOPED_ROLES.includes(body.role))
      throw new BadRequestException("Choose an event Admin or Moderator role.");
    const grant = await this.rolesService.grant(
      { userId: body.userId, role: body.role, eventId },
      actorId,
    );
    this.logger.log({
      action: "grant_role",
      actorId,
      eventId,
      roleId: grant.id,
    });
    return grant;
  }

  @Delete("roles/:roleId")
  @HttpCode(204)
  async revoke(
    @Param("id", ParseUUIDPipe) eventId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @UserId() actorId: string,
  ) {
    await this.rolesService.revoke(roleId, eventId);
    this.logger.log({ action: "revoke_role", actorId, eventId, roleId });
  }
}
