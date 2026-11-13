import { Policy, PolicyBefore } from "@nestjs/authorization";
import { EventAudience } from "./event-audience";
import { hasGlobal, hasInEvent, Principal, UserRole } from "./roles";

/** Event admins and moderators, and global moderators. */
function isStaff(user: Principal | null, eventId: string) {
  return (
    hasInEvent(user, eventId, UserRole.ADMIN, UserRole.MODERATOR) ||
    hasGlobal(user, UserRole.MODERATOR)
  );
}

/**
 * Abilities within one event. The event id comes straight from the route,
 * before any pipe validates it. Role checks compare it with the user's
 * grants; `view` only looks up public visibility for guests.
 */
@Policy()
export class EventPolicy implements PolicyBefore<Principal> {
  constructor(private readonly audience: EventAudience) {}

  /** A global admin may do anything in every event. */
  before(user: Principal | null) {
    if (hasGlobal(user, UserRole.ADMIN)) return true;
  }

  /** Private events are unlisted, but any signed-in user may follow a link. */
  async view(user: Principal | null, eventId: string) {
    return user !== null || this.audience.isPublic(eventId);
  }

  administer(user: Principal | null, eventId: string) {
    return hasInEvent(user, eventId, UserRole.ADMIN);
  }

  viewUnrevealedResults(user: Principal | null, eventId: string) {
    return isStaff(user, eventId);
  }

  /** Making a private event public. */
  publish(user: Principal | null, eventId: string) {
    return (
      hasInEvent(user, eventId, UserRole.ADMIN) &&
      hasGlobal(user, UserRole.PUBLIC_EVENT_CREATOR)
    );
  }
}
