import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MatchModule } from "../match/match.module";
import { GamblingBetEntity } from "./entities/gambling-bet.entity";
import { GamblingEntryEntity } from "./entities/gambling-entry.entity";
import { GamblingRoundEntity } from "./entities/gambling-round.entity";
import { GamblingController } from "./gambling.controller";
import { GamblingService } from "./gambling.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GamblingRoundEntity,
      GamblingEntryEntity,
      GamblingBetEntity,
    ]),
    forwardRef(() => MatchModule),
  ],
  controllers: [GamblingController],
  providers: [GamblingService],
  exports: [GamblingService],
})
export class GamblingModule {}
