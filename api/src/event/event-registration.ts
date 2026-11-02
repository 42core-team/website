import { Repository } from "typeorm";
import { EventEntity } from "./entities/event.entity";

/** Public events consider all users registered; private events require a registration. */
export function isUserRegisteredForEvent(
  events: Repository<EventEntity>,
  eventId: string,
  userId: string,
): Promise<boolean> {
  return events.existsBy([
    { id: eventId, isPrivate: false },
    { id: eventId, users: { id: userId } },
  ]);
}
