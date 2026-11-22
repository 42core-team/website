import { DynamicModule, ExecutionContext, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { AuthorizationService } from "@nestjs/authorization";
import { DataSource } from "typeorm";
import { AuthorizationGuard } from "./authorization.guard";
import { authorizationModule } from "./authz.module";
import { EventAudience } from "./event-audience";
import { Principal, UserRole } from "./roles";

@Module({})
class TestEventAudienceModule {}

/**
 * EventAudience on the test's database. Without one, guest visibility checks
 * fail explicitly; signed-in viewers do not need a database lookup.
 */
function eventAudienceModule(database?: DataSource): DynamicModule {
  return {
    module: TestEventAudienceModule,
    providers: [
      database
        ? {
            provide: EventAudience,
            useFactory: () => new EventAudience(database),
          }
        : {
            provide: EventAudience,
            useValue: {
              isPublic: () =>
                Promise.reject(
                  new Error(
                    "EventPolicy.view needs a database: pass it to the authz test helper.",
                  ),
                ),
            },
          },
    ],
    exports: [EventAudience],
  };
}

/**
 * A real AuthorizationService with the app's policies, for tests that build
 * services by hand instead of through a Nest module.
 */
export async function createAuthorizationService(
  database?: DataSource,
): Promise<AuthorizationService> {
  @Module({ imports: [authorizationModule([eventAudienceModule(database)])] })
  class TestAuthorizationModule {}

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
 * `database` backs `EventPolicy.view`.
 */
export function authzTestingModule(
  loadUser: (id: string) => Promise<Principal | null>,
  database?: DataSource,
): DynamicModule {
  return {
    module: AuthzTestingModule,
    imports: [authorizationModule([eventAudienceModule(database)])],
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
      { provide: APP_GUARD, useClass: AuthorizationGuard },
    ],
  };
}
