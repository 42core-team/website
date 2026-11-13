import { Policy, PolicyBefore } from "@nestjs/authorization";
import { hasGlobal, hasInEvent, Principal, UserRole } from "./roles";

/**
 * Abilities within one event. The event id comes straight from the route,
 * before any pipe validates it, so abilities only compare it with the
 * user's grants: a malformed id matches none and is denied.
 */
@Policy()
export class EventPolicy implements PolicyBefore<Principal> {
  /** A global admin may do anything in every event. */
  before(user: Principal | null) {
    if (hasGlobal(user, UserRole.ADMIN)) return true;
  }

  administer(user: Principal | null, eventId: string) {
    return hasInEvent(user, eventId, UserRole.ADMIN);
  }

  viewUnrevealedResults(user: Principal | null, eventId: string) {
    return (
      hasInEvent(user, eventId, UserRole.ADMIN, UserRole.MODERATOR) ||
      hasGlobal(user, UserRole.MODERATOR)
    );
  }

  /** Making a private event public. */
  publish(user: Principal | null, eventId: string) {
    return (
      hasInEvent(user, eventId, UserRole.ADMIN) &&
      hasGlobal(user, UserRole.PUBLIC_EVENT_CREATOR)
    );
  }
}
