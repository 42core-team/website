import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { EventService } from "./event.service";

@Controller("check")
export class CheckController {
  constructor(private readonly eventService: EventService) {}

  @Get(":id")
  async getEventVersion(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventVersion(id);
  }
}
