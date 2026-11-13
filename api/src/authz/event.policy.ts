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
 * before any pipe validates it, so abilities compare it with the user's
 * grants and only `view` looks it up: a malformed id matches nothing and is
 * denied.
 */
@Policy()
export class EventPolicy implements PolicyBefore<Principal> {
  constructor(private readonly audience: EventAudience) {}

  /** A global admin may do anything in every event. */
  before(user: Principal | null) {
    if (hasGlobal(user, UserRole.ADMIN)) return true;
  }

  /**
   * Seeing the event and everything in it. A private event is hidden from
   * everyone outside its staff, participants and whitelist; the guard
   * answers a denial with 404, so it looks like an unknown id.
   */
  async view(user: Principal | null, eventId: string) {
    return (
      isStaff(user, eventId) ||
      (await this.audience.includes(eventId, user?.id ?? null))
    );
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
