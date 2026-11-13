import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthorizationModule } from "@nestjs/authorization";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EventPolicy } from "./event.policy";
import { PlatformPolicy } from "./platform.policy";
import { SessionPolicy } from "./session.policy";

export const POLICIES = [SessionPolicy, PlatformPolicy, EventPolicy];

/**
 * Registers two global guards, in this order: JwtAuthGuard attaches the
 * user if there is a valid token, then AuthorizationGuard enforces each
 * route's `@Can()` and denies routes that declare no decision. Nest runs
 * global guards in module scan order, and this module is scanned before
 * the AuthorizationModule it imports.
 *
 * Neither runs on the RabbitMQ handlers: connected microservices do not
 * inherit the app's global enhancers.
 */
@Module({
  imports: [AuthorizationModule.forRoot({ policies: POLICIES })],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthzModule {}
