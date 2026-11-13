import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { EventService } from "./event.service";
import { Can, EventPolicy, param } from "../authz";

@Controller("check")
export class CheckController {
  constructor(private readonly eventService: EventService) {}

  @Can(EventPolicy, "view", param("id"))
  @Get(":id")
  async getEventVersion(@Param("id", new ParseUUIDPipe()) id: string) {
    return await this.eventService.getEventVersion(id);
  }
}
