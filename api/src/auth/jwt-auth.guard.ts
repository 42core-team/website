import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Global and optional: a valid access token attaches the user (with roles)
 * to the request, anything else lets the request continue as a guest.
 * Whether a route needs a user is decided by AuthorizationGuard, which runs
 * after this one.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only HTTP requests carry the session cookie.
    if (context.getType() !== "http") return true;
    return (await super.canActivate(context)) as boolean;
  }

  handleRequest<TUser>(err: unknown, user: TUser | false): TUser | null {
    // A missing, expired or revoked token is a guest; an outage is not.
    if (err && !(err instanceof UnauthorizedException)) throw err;
    return user || null;
  }
}
