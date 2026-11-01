jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import "reflect-metadata";
import { RequestMethod, Type } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { EventController } from "../event/event.controller";
import { MatchController } from "../match/match.controller";
import { TeamController } from "../team/team.controller";
import { SocialAccountController } from "../user/social-account.controller";

function routesOf(controller: Type): string[] {
  const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
  return Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== "constructor")
    .map((name) => controller.prototype[name] as object)
    .filter((handler) => Reflect.hasMetadata(PATH_METADATA, handler))
    .map((handler) => {
      const method = RequestMethod[
        Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
      ] as string;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      return `${method} ${[prefix, path].join("/").replace(/\/+/g, "/").replace(/\/$/, "")}`;
    });
}

describe("removed unused routes", () => {
  it.each([
    [EventController, "GET event/my"],
    [EventController, "PUT event/:id/unlock"],
    [EventController, "PUT event/:id/lockTeamsDate"],
    [MatchController, "GET match/queue/:eventId/timeseries"],
    [TeamController, "GET team/:id/event-started"],
    [SocialAccountController, "GET social-accounts/:platform"],
  ])("%p no longer exposes %s", (controller, route) => {
    expect(routesOf(controller)).not.toContain(route);
  });

  it("keeps the replacement and retained routes", () => {
    expect(routesOf(EventController)).toEqual(
      expect.arrayContaining([
        "GET event/overview",
        "PUT event/:id/lock",
        "POST event/:id/lifecycle",
        "PUT event/:id/settings",
      ]),
    );
    expect(routesOf(MatchController)).toEqual(
      expect.arrayContaining([
        "GET match/event/:eventId/timeseries",
        "GET match/queue/:eventId/admin",
      ]),
    );
    expect(routesOf(SocialAccountController)).toContain("GET social-accounts");
  });
});
