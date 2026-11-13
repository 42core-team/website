import {
  ExecutionContext,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuthorizationError,
  AuthorizationGuard as PackageAuthorizationGuard,
} from "@nestjs/authorization";
import { EventPolicy } from "./event.policy";

/** The answer for an event the caller may not see, as for an unknown one. */
export function eventNotFound() {
  return new NotFoundException("Event not found");
}

function hidesEvent(error: unknown) {
  const denial = error instanceof HttpException ? error.cause : undefined;
  return (
    denial instanceof AuthorizationError &&
    denial.policy === EventPolicy.name &&
    denial.ability === "view"
  );
}

/**
 * The package's guard, except that a denied `EventPolicy.view` answers 404
 * instead of 401 or 403, so a private event's id does not confirm that it
 * exists. Every other denial is left as it is.
 */
@Injectable()
export class AuthorizationGuard extends PackageAuthorizationGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (hidesEvent(error)) throw eventNotFound();
      throw error;
    }
  }
}
