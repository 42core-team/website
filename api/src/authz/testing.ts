import { DynamicModule, ExecutionContext, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import {
  AuthorizationModule,
  AuthorizationService,
} from "@nestjs/authorization";
import { POLICIES } from "./authz.module";
import { Principal, UserRole } from "./roles";

@Module({
  imports: [
    AuthorizationModule.forRoot({ globalGuard: false, policies: POLICIES }),
  ],
})
class TestAuthorizationModule {}

/**
 * A real AuthorizationService with the app's policies, for tests that build
 * services by hand instead of through a Nest module.
 */
export async function createAuthorizationService(): Promise<AuthorizationService> {
  const context = await NestFactory.createApplicationContext(
    TestAuthorizationModule,
    { logger: false },
  );
  return context.get(AuthorizationService);
}

/** A test user holding `role` for one event, or globally without an event. */
export function principalWith(
  id: string,
  role?: UserRole,
  eventId: string | null = null,
): Principal {
  return { id, roles: role ? [{ role, eventId }] : [] };
}

@Module({})
class AuthzTestingModule {}

/**
 * The app's global guards for HTTP tests, with the user taken from the
 * `x-test-user` header instead of a session cookie: `loadUser` returns them
 * with their roles, or null. Without the header the request is a guest.
 */
export function authzTestingModule(
  loadUser: (id: string) => Promise<Principal | null>,
): DynamicModule {
  return {
    module: AuthzTestingModule,
    imports: [AuthorizationModule.forRoot({ policies: POLICIES })],
    providers: [
      {
        provide: APP_GUARD,
        useValue: {
          async canActivate(context: ExecutionContext) {
            const request = context.switchToHttp().getRequest();
            const id = request.headers["x-test-user"];
            request.user = id ? await loadUser(id) : null;
            return true;
          },
        },
      },
    ],
  };
}
