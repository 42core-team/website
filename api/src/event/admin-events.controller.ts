import { Controller, Get, Query, ValidationPipe } from "@nestjs/common";
import { Can, PlatformPolicy } from "../authz";
import { ListAdminEventsQueryDto } from "./dtos/list-admin-events-query.dto";
import { EventService } from "./event.service";

@Controller("admin/events")
@Can(PlatformPolicy, "manageRoles")
export class AdminEventsController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  list(
    @Query(new ValidationPipe({ transform: true }))
    query: ListAdminEventsQueryDto,
  ) {
    return this.eventService.getAdminEvents(query);
  }
}
