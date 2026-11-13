import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { Can, EventPolicy, param, SignedIn } from "../authz";
import { UserId } from "../guards/UserGuard";
import { PlaceGamblingBetDto } from "./dtos/place-gambling-bet.dto";
import { GamblingService } from "./gambling.service";

@Controller("gambling")
@SignedIn()
@Can(EventPolicy, "view", param("eventId"))
export class GamblingController {
  constructor(private readonly gamblingService: GamblingService) {}

  @Get("event/:eventId")
  getSnapshot(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.gamblingService.getSnapshot(eventId, userId);
  }

  @Put("event/:eventId/entry")
  join(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.gamblingService.join(eventId, userId);
  }

  @Delete("event/:eventId/entry")
  leave(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.gamblingService.leave(eventId, userId);
  }

  @Post("event/:eventId/bet")
  placeBet(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() dto: PlaceGamblingBetDto,
  ) {
    return this.gamblingService.placeBet(eventId, userId, dto);
  }
}
