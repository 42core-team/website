// The only entry point to @nestjs/authorization: import from here, not from
// the package, so it can be swapped in one place.
export { AuthorizationService, Can } from "@nestjs/authorization";
export { AuthzModule } from "./authz.module";
export { CurrentUser, param, Public, SignedIn } from "./decorators";
export { EventPolicy } from "./event.policy";
export { PlatformPolicy } from "./platform.policy";
export { SessionPolicy } from "./session.policy";
export { hasGlobal, hasInEvent, UserRole } from "./roles";
export type { Principal, RoleGrant } from "./roles";
