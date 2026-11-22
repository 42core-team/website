import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserRoleEntity } from "../user/entities/user-role.entity";
import {
  AdminUsersController,
  EventUsersController,
  RolesController,
} from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleEntity])],
  controllers: [RolesController, AdminUsersController, EventUsersController],
  providers: [RolesService],
})
export class RolesModule {}
