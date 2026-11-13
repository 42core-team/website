import { UserRole } from "../user/entities/user-role.entity";

export { UserRole };

/** One granted role, as policies see it: global when eventId is null. */
export interface RoleGrant {
  role: UserRole;
  eventId: string | null;
}

/**
 * The user policies decide for: the request user (JwtStrategy loads the
 * roles with it), or any user loaded with its `roles` relation.
 */
export interface Principal {
  id: string;
  roles?: readonly RoleGrant[];
}

/** Whether the user holds any of `roles` globally. */
export function hasGlobal(
  user: Principal | null | undefined,
  ...roles: UserRole[]
): boolean {
  return (
    user?.roles?.some(
      (grant) => grant.eventId === null && roles.includes(grant.role),
    ) ?? false
  );
}

/** Whether the user holds any of `roles` for this one event (not globally). */
export function hasInEvent(
  user: Principal | null | undefined,
  eventId: string | null | undefined,
  ...roles: UserRole[]
): boolean {
  if (!eventId) return false;
  return (
    user?.roles?.some(
      (grant) => grant.eventId === eventId && roles.includes(grant.role),
    ) ?? false
  );
}
