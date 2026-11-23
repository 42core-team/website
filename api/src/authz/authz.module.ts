import { DynamicModule, Module, ModuleMetadata } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthorizationModule } from "@nestjs/authorization";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthorizationGuard } from "./authorization.guard";
import { EventAudienceModule } from "./event-audience";
import { EventPolicy } from "./event.policy";
import { PlatformPolicy } from "./platform.policy";
import { SessionPolicy } from "./session.policy";

export const POLICIES = [SessionPolicy, PlatformPolicy, EventPolicy];

/**
 * The package's module with the app's policies, but without its global
 * guard: the app registers its own AuthorizationGuard. `imports` provide
 * what the policies inject (EventAudience).
 */
export function authorizationModule(
  imports: ModuleMetadata["imports"] = [EventAudienceModule],
): DynamicModule {
  return AuthorizationModule.forRoot({
    globalGuard: false,
    policies: POLICIES,
    imports,
  });
}

/**
 * Registers two global guards, in this order: JwtAuthGuard attaches the
 * user if there is a valid token, then AuthorizationGuard enforces each
 * route's `@Can()` and denies routes that declare no decision. Nest runs
 * the global guards of one module in the order they are provided.
 *
 * Neither runs on the RabbitMQ handlers: connected microservices do not
 * inherit the app's global enhancers.
 */
@Module({
  imports: [authorizationModule()],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AuthzModule {}
