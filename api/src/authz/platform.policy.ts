import { Policy } from "@nestjs/authorization";
import { hasGlobal, Principal, UserRole } from "./roles";

/** Platform-wide abilities; only global roles count. */
@Policy()
export class PlatformPolicy {
  manageRoles(user: Principal | null) {
    return hasGlobal(user, UserRole.ADMIN);
  }

  managePresets(user: Principal | null) {
    return hasGlobal(user, UserRole.ADMIN);
  }

  manageSharedInstallations(user: Principal | null) {
    return hasGlobal(user, UserRole.ADMIN);
  }

  /** Creating an event; new events always start private. */
  createEvent(user: Principal | null) {
    return hasGlobal(
      user,
      UserRole.ADMIN,
      UserRole.PUBLIC_EVENT_CREATOR,
      UserRole.PRIVATE_EVENT_CREATOR,
    );
  }

  createPublicEvent(user: Principal | null) {
    return hasGlobal(user, UserRole.ADMIN, UserRole.PUBLIC_EVENT_CREATOR);
  }
}
