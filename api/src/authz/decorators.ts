import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Can } from "@nestjs/authorization";
import { Request } from "express";
import { SessionPolicy } from "./session.policy";
import type { UserEntity } from "../user/entities/user.entity";

/** Anyone may call the route, guests included. */
export const Public = (): ClassDecorator & MethodDecorator => Can.Anyone();

/** The route needs a signed-in user (401 for guests) but no role. */
export const SignedIn = (): ClassDecorator & MethodDecorator =>
  Can(SessionPolicy, "signedIn");

/**
 * Reads a route param for a `@Can()` ability, e.g.
 * `@Can(EventPolicy, "administer", param("id"))`. It runs before pipes, so
 * the value is unvalidated; policies only compare it with role grants.
 */
export function param(name: string) {
  return (context: ExecutionContext) => {
    const value: unknown = context.switchToHttp().getRequest<Request>()
      .params?.[name];
    return [typeof value === "string" ? value : ""] as const;
  };
}

/**
 * The request user with their roles, or null for a guest. Non-null on
 * routes that require a signed-in user.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): UserEntity | null =>
    context.switchToHttp().getRequest<Request & { user?: UserEntity | null }>()
      .user ?? null,
);
