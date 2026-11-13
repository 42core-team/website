jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { globSync } from "node:fs";
import { join } from "node:path";
import { Controller, Get, RequestMethod, Type } from "@nestjs/common";
import {
  CONTROLLER_WATERMARK,
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { MetadataScanner } from "@nestjs/core";
import { Can, Public, SignedIn } from ".";
import { EventPolicy } from "./event.policy";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

// What @nestjs/authorization 0.1.3 records for @Can() and @Can.Anyone().
const CAN_METADATA = "authorization:can";
const CAN_ANYONE_METADATA = "authorization:can-anyone";

type Requirement = { policy: Type; ability: string };

/** The decision AuthorizationGuard makes for a handler, as it reads it. */
function decisionOf(controller: Type, handler: object) {
  const methodOpen = Reflect.getMetadata(CAN_ANYONE_METADATA, handler) === true;
  const classOpen =
    Reflect.getMetadata(CAN_ANYONE_METADATA, controller) === true;
  const requirements: Requirement[] = [
    ...(methodOpen
      ? []
      : (Reflect.getMetadata(CAN_METADATA, controller) ?? [])),
    ...(Reflect.getMetadata(CAN_METADATA, handler) ?? []),
  ];
  if (requirements.length > 0)
    return requirements.map((r) => `${r.policy.name}.${r.ability}`).join("+");
  return methodOpen || classOpen ? "public" : undefined;
}

function loadControllers(): Type[] {
  const root = join(__dirname, "..");
  return globSync("**/*.controller.ts", { cwd: root }).flatMap((file) =>
    Object.values(
      jest.requireActual<Record<string, unknown>>(join(root, file)),
    ).filter(
      (value): value is Type =>
        typeof value === "function" &&
        Reflect.getMetadata(CONTROLLER_WATERMARK, value) === true,
    ),
  );
}

interface Route {
  route: string;
  controller: Type;
  handler: object;
}

function httpRoutes(controllers: Type[]): Route[] {
  const scanner = new MetadataScanner();
  return controllers.flatMap((controller) => {
    const prefix = String(Reflect.getMetadata(PATH_METADATA, controller) ?? "");
    return scanner
      .getAllMethodNames(controller.prototype)
      .map((name) => controller.prototype[name] as object)
      .filter((handler) => Reflect.hasMetadata(METHOD_METADATA, handler))
      .map((handler) => {
        const method =
          RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
        const path = [
          prefix,
          String(Reflect.getMetadata(PATH_METADATA, handler)),
        ]
          .map((part) => part.replace(/^\/+|\/+$/g, ""))
          .filter(Boolean)
          .join("/");
        return { route: `${method} /${path}`, controller, handler };
      });
  });
}

// The reviewed decision of every route: "public" lets guests in,
// SessionPolicy.signedIn needs any signed-in user, the rest need the ability.
// Changing an entry here is a deliberate authorization change.
const DECISIONS: Record<string, string> = {
  "DELETE /event/:id/admins/:adminId": "EventPolicy.administer",
  "DELETE /event/:id/templates/:templateId": "EventPolicy.administer",
  "DELETE /event/:id/whitelist/:whitelistId": "EventPolicy.administer",
  "DELETE /gambling/event/:eventId/entry": "SessionPolicy.signedIn",
  "DELETE /social-accounts/:platform": "SessionPolicy.signedIn",
  "DELETE /team/event/:eventId/admin/:teamId": "EventPolicy.administer",
  "DELETE /team/event/:eventId/declineInvite/:teamId": "SessionPolicy.signedIn",
  "DELETE /team/event/:eventId/my/images/:kind": "SessionPolicy.signedIn",
  "GET /": "public",
  "GET /auth/42/callback": "public",
  "GET /auth/42/getUrl": "SessionPolicy.signedIn",
  "GET /auth/github/callback": "public",
  "GET /auth/me": "SessionPolicy.signedIn",
  "GET /check/:id": "public",
  "GET /event": "public",
  "GET /event/:id": "public",
  "GET /event/:id/admins": "EventPolicy.administer",
  "GET /event/:id/game-config": "public",
  "GET /event/:id/github": "EventPolicy.administer",
  "GET /event/:id/github-org": "public",
  "GET /event/:id/github/installations": "EventPolicy.administer",
  "GET /event/:id/isEventAdmin": "SessionPolicy.signedIn",
  "GET /event/:id/isUserRegistered": "SessionPolicy.signedIn",
  "GET /event/:id/participantsCount": "public",
  "GET /event/:id/repository-activity": "EventPolicy.administer",
  "GET /event/:id/server-config": "public",
  "GET /event/:id/teamsCount": "public",
  "GET /event/:id/templates": "SessionPolicy.signedIn",
  "GET /event/:id/templates/:templateId/version": "public",
  "GET /event/:id/version": "public",
  "GET /event/:id/whitelist": "EventPolicy.administer",
  "GET /event/event/currentLiveEvent": "public",
  "GET /event/overview": "SessionPolicy.signedIn",
  "GET /gambling/event/:eventId": "SessionPolicy.signedIn",
  "GET /github/app": "public",
  "GET /health": "public",
  "GET /health/ready": "public",
  "GET /match/:matchId": "SessionPolicy.signedIn",
  "GET /match/event/:eventId/timeseries": "EventPolicy.administer",
  "GET /match/logs/:matchId": "SessionPolicy.signedIn",
  "GET /match/manual/:eventId": "EventPolicy.administer",
  "GET /match/queue/:eventId": "SessionPolicy.signedIn",
  "GET /match/queue/:eventId/admin": "EventPolicy.administer",
  "GET /match/swiss/:eventId": "SessionPolicy.signedIn",
  "GET /match/team/:teamId": "SessionPolicy.signedIn",
  "GET /match/tournament/:eventId": "SessionPolicy.signedIn",
  "GET /match/tournament/:eventId/teamCount": "public",
  "GET /profile/:username": "SessionPolicy.signedIn",
  "GET /profile/:username/matches": "SessionPolicy.signedIn",
  "GET /social-accounts": "SessionPolicy.signedIn",
  "GET /stats/global": "public",
  "GET /team/:id": "public",
  "GET /team/:id/members": "public",
  "GET /team/event/:eventId": "SessionPolicy.signedIn",
  "GET /team/event/:eventId/my": "SessionPolicy.signedIn",
  "GET /team/event/:eventId/pending": "SessionPolicy.signedIn",
  "GET /team/event/:eventId/queue/opponents": "SessionPolicy.signedIn",
  "GET /team/event/:eventId/queue/summary": "SessionPolicy.signedIn",
  "GET /team/event/:eventId/searchInviteUsers/:searchQuery":
    "SessionPolicy.signedIn",
  "GET /user/canCreateEvent": "SessionPolicy.signedIn",
  "GET /user/search": "SessionPolicy.signedIn",
  "POST /auth/logout": "public",
  "POST /auth/logout-all": "SessionPolicy.signedIn",
  "POST /auth/refresh": "public",
  "POST /event": "PlatformPolicy.createEvent",
  "POST /event/:id/admins/:newAdminId": "EventPolicy.administer",
  "POST /event/:id/exclude-inactive-teams": "EventPolicy.administer",
  "POST /event/:id/github/connect": "EventPolicy.administer",
  "POST /event/:id/github/installations": "EventPolicy.administer",
  "POST /event/:id/lifecycle": "EventPolicy.administer",
  "POST /event/:id/repositories/retry": "EventPolicy.administer",
  "POST /event/:id/teams/:teamId/exclusion": "EventPolicy.administer",
  "POST /event/:id/templates": "EventPolicy.administer",
  "POST /event/:id/whitelist": "EventPolicy.administer",
  "POST /event/:id/whitelist/bulk-delete": "EventPolicy.administer",
  "POST /gambling/event/:eventId/bet": "SessionPolicy.signedIn",
  "POST /github/installations": "SessionPolicy.signedIn",
  "POST /github/webhook": "public",
  "POST /match/manual/:eventId": "EventPolicy.administer",
  "POST /team/event/:eventId/create": "SessionPolicy.signedIn",
  "POST /team/event/:eventId/queue/direct/:targetTeamId":
    "SessionPolicy.signedIn",
  "POST /team/event/:eventId/sendInvite": "SessionPolicy.signedIn",
  "PUT /event/:id/join": "SessionPolicy.signedIn",
  "PUT /event/:id/lock": "EventPolicy.administer",
  "PUT /event/:id/settings": "EventPolicy.administer",
  "PUT /event/:id/templates/:templateId": "EventPolicy.administer",
  "PUT /gambling/event/:eventId/entry": "SessionPolicy.signedIn",
  "PUT /match/cleanup-all/:eventId/:phase": "EventPolicy.administer",
  "PUT /match/reveal-all/:eventId/:phase": "EventPolicy.administer",
  "PUT /match/reveal/:matchId": "SessionPolicy.signedIn",
  "PUT /match/swiss/:eventId": "EventPolicy.administer",
  "PUT /match/tournament/:eventId": "EventPolicy.administer",
  "PUT /team/event/:eventId/acceptInvite/:teamId": "SessionPolicy.signedIn",
  "PUT /team/event/:eventId/admin/:teamId/credits": "EventPolicy.administer",
  "PUT /team/event/:eventId/leave": "SessionPolicy.signedIn",
  "PUT /team/event/:eventId/my/images/:kind": "SessionPolicy.signedIn",
  "PUT /team/event/:eventId/queue/join": "SessionPolicy.signedIn",
};

describe("route authorization coverage", () => {
  const controllers = loadControllers();
  const routes = httpRoutes(controllers);

  it("finds the application's controllers", () => {
    expect(controllers.length).toBeGreaterThan(10);
    expect(routes.length).toBeGreaterThan(90);
  });

  it("reads the decorators the way the guard does", () => {
    @Controller("probe")
    @SignedIn()
    class Probe {
      @Get("a") signedIn() {}
      @Public() @Get("b") open() {}
      @Can(EventPolicy, "administer", () => ["x"]) @Get("c") admin() {}
    }
    expect(decisionOf(Probe, Probe.prototype.signedIn)).toBe(
      "SessionPolicy.signedIn",
    );
    expect(decisionOf(Probe, Probe.prototype.open)).toBe("public");
    expect(decisionOf(Probe, Probe.prototype.admin)).toBe(
      "SessionPolicy.signedIn+EventPolicy.administer",
    );
    class Undecided {
      undecided() {}
    }
    expect(
      decisionOf(Undecided, Undecided.prototype.undecided),
    ).toBeUndefined();
  });

  it("gives every HTTP route an authorization decision", () => {
    const undecided = routes
      .filter(({ controller, handler }) => !decisionOf(controller, handler))
      .map(
        ({ controller, handler }) =>
          `${controller.name}.${(handler as () => void).name}`,
      );
    expect(undecided).toEqual([]);
  });

  it("matches the reviewed decision table", () => {
    const actual = Object.fromEntries(
      routes.map(({ route, controller, handler }) => [
        route,
        decisionOf(controller, handler),
      ]),
    );
    expect(actual).toEqual(DECISIONS);
  });

  it("leaves authentication to the global guard", () => {
    const reapplied = routes
      .filter(({ controller, handler }) =>
        [controller, handler].some((target) =>
          (Reflect.getMetadata(GUARDS_METADATA, target) ?? []).includes(
            JwtAuthGuard,
          ),
        ),
      )
      .map(({ route }) => route);
    expect(reapplied).toEqual([]);
  });
});
