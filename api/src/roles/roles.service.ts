import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, QueryFailedError, Repository } from "typeorm";
import {
  EVENT_SCOPED_ROLES,
  UserRole,
  UserRoleEntity,
} from "../user/entities/user-role.entity";
import { UserEntity } from "../user/entities/user.entity";
import { EventEntity } from "../event/entities/event.entity";
import { GrantRoleDto } from "./dtos/grant-role.dto";
import { ListRolesQueryDto } from "./dtos/list-roles-query.dto";
import { RoleResponse, toRoleResponse } from "./role-response";

const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";
const RELATIONS = { user: true, event: true, grantedBy: true } as const;

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(UserRoleEntity)
    private readonly roleRepository: Repository<UserRoleEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async list(filter: ListRolesQueryDto): Promise<RoleResponse[]> {
    const rows = await this.roleRepository.find({
      where: {
        ...(filter.userId && { userId: filter.userId }),
        ...(filter.eventId && { eventId: filter.eventId }),
      },
      relations: RELATIONS,
      order: { createdAt: "ASC", id: "ASC" },
    });
    return rows.map(toRoleResponse);
  }

  async grant(grant: GrantRoleDto, grantedById: string): Promise<RoleResponse> {
    const eventId = grant.eventId ?? null;
    if (eventId && !EVENT_SCOPED_ROLES.includes(grant.role))
      throw new BadRequestException(
        `${grant.role} can only be granted globally.`,
      );
    if (
      !(await this.dataSource
        .getRepository(UserEntity)
        .existsBy({ id: grant.userId }))
    )
      throw new NotFoundException("User not found.");
    if (
      eventId &&
      !(await this.dataSource
        .getRepository(EventEntity)
        .existsBy({ id: eventId }))
    )
      throw new NotFoundException("Event not found.");

    let id: string;
    try {
      const result = await this.roleRepository.insert({
        userId: grant.userId,
        role: grant.role,
        eventId,
        grantedById,
      });
      id = result.identifiers[0].id;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code ===
          POSTGRES_UNIQUE_VIOLATION_CODE
      )
        throw new ConflictException("The user already has this role.");
      throw error;
    }
    return toRoleResponse(
      await this.roleRepository.findOneOrFail({
        where: { id },
        relations: RELATIONS,
      }),
    );
  }

  async revoke(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const roles = manager.getRepository(UserRoleEntity);
      const row = await roles.findOne({
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!row) throw new NotFoundException("Role not found.");

      if (row.role === UserRole.ADMIN && row.eventId === null) {
        // Lock every global admin row, so two concurrent revocations cannot
        // each see another admin left and remove both.
        const admins = await roles.find({
          where: { role: UserRole.ADMIN, eventId: IsNull() },
          lock: { mode: "pessimistic_write" },
        });
        if (admins.length <= 1)
          throw new ConflictException("Cannot remove the last global admin.");
      }
      await roles.delete(row.id);
    });
  }
}
