import { Policy } from "@nestjs/authorization";
import { Principal } from "./roles";

/** Routes that need a signed-in user but no particular role. */
@Policy()
export class SessionPolicy {
  signedIn(user: Principal | null) {
    return user !== null;
  }
}
