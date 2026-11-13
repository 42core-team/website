import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { MatchEntity } from "../match/entites/match.entity";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, TeamEntity, MatchEntity])],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
