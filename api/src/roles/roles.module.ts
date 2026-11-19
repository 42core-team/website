import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserRoleEntity } from "../user/entities/user-role.entity";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleEntity])],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
