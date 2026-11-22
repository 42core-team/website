import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { Can, PlatformPolicy } from "../authz";
import { EventPresetsService } from "./event-presets.service";

/** The presets an organizer can create an event from. */
@Controller("event-presets")
@Can(PlatformPolicy, "createEvent")
export class EventPresetsController {
  constructor(private readonly presets: EventPresetsService) {}

  @Get()
  list() {
    return this.presets.listForOrganizers();
  }

  @Get(":id/resolved")
  resolved(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.presets.getResolved(id);
  }
}
