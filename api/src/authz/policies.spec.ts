import { Test } from "@nestjs/testing";
import {
  AuthorizationModule,
  AuthorizationService,
} from "@nestjs/authorization";
import { Module } from "@nestjs/common";
import { EventAudience } from "./event-audience";
import { EventPolicy } from "./event.policy";
import { PlatformPolicy } from "./platform.policy";
import { Principal, RoleGrant, UserRole } from "./roles";

const EVENT = "11111111-1111-4111-8111-111111111111";
const OTHER_EVENT = "22222222-2222-4222-8222-222222222222";

const global = (role: UserRole): RoleGrant => ({ role, eventId: null });
const inEvent = (role: UserRole, eventId = EVENT): RoleGrant => ({
  role,
  eventId,
});

const principals: Record<string, Principal | null> = {
  guest: null,
  "no roles": { id: "u", roles: [] },
  "global ADMIN": { id: "u", roles: [global(UserRole.ADMIN)] },
  "global MODERATOR": { id: "u", roles: [global(UserRole.MODERATOR)] },
  "global PUBLIC_EVENT_CREATOR": {
    id: "u",
    roles: [global(UserRole.PUBLIC_EVENT_CREATOR)],
  },
  "global PRIVATE_EVENT_CREATOR": {
    id: "u",
    roles: [global(UserRole.PRIVATE_EVENT_CREATOR)],
  },
  "event ADMIN": { id: "u", roles: [inEvent(UserRole.ADMIN)] },
  "event ADMIN of another event": {
    id: "u",
    roles: [inEvent(UserRole.ADMIN, OTHER_EVENT)],
  },
  "event MODERATOR": { id: "u", roles: [inEvent(UserRole.MODERATOR)] },
  "event ADMIN + global PUBLIC_EVENT_CREATOR": {
    id: "u",
    roles: [inEvent(UserRole.ADMIN), global(UserRole.PUBLIC_EVENT_CREATOR)],
  },
  "event ADMIN + global PRIVATE_EVENT_CREATOR": {
    id: "u",
    roles: [inEvent(UserRole.ADMIN), global(UserRole.PRIVATE_EVENT_CREATOR)],
  },
  "event MODERATOR + global PUBLIC_EVENT_CREATOR": {
    id: "u",
    roles: [inEvent(UserRole.MODERATOR), global(UserRole.PUBLIC_EVENT_CREATOR)],
  },
};
type Who = keyof typeof principals;

const platformAbilities = [
  "manageRoles",
  "managePresets",
  "manageSharedInstallations",
  "createEvent",
  "createPublicEvent",
] as const;
const eventAbilities = [
  "view",
  "administer",
  "viewUnrevealedResults",
  "publish",
] as const;

// Who is allowed each ability; everyone else is denied.
const platformAllowed: Record<(typeof platformAbilities)[number], Who[]> = {
  manageRoles: ["global ADMIN"],
  managePresets: ["global ADMIN"],
  manageSharedInstallations: ["global ADMIN"],
  createEvent: [
    "global ADMIN",
    "global PUBLIC_EVENT_CREATOR",
    "global PRIVATE_EVENT_CREATOR",
    "event ADMIN + global PUBLIC_EVENT_CREATOR",
    "event ADMIN + global PRIVATE_EVENT_CREATOR",
    "event MODERATOR + global PUBLIC_EVENT_CREATOR",
  ],
  createPublicEvent: [
    "global ADMIN",
    "global PUBLIC_EVENT_CREATOR",
    "event ADMIN + global PUBLIC_EVENT_CREATOR",
    "event MODERATOR + global PUBLIC_EVENT_CREATOR",
  ],
};
const eventAllowed: Record<(typeof eventAbilities)[number], Who[]> = {
  view: Object.keys(principals).filter((who) => who !== "guest"),
  administer: [
    "global ADMIN",
    "event ADMIN",
    "event ADMIN + global PUBLIC_EVENT_CREATOR",
    "event ADMIN + global PRIVATE_EVENT_CREATOR",
  ],
  viewUnrevealedResults: [
    "global ADMIN",
    "global MODERATOR",
    "event ADMIN",
    "event MODERATOR",
    "event ADMIN + global PUBLIC_EVENT_CREATOR",
    "event ADMIN + global PRIVATE_EVENT_CREATOR",
    "event MODERATOR + global PUBLIC_EVENT_CREATOR",
  ],
  publish: ["global ADMIN", "event ADMIN + global PUBLIC_EVENT_CREATOR"],
};

function cases<A extends string>(
  abilities: readonly A[],
  allowed: Record<A, Who[]>,
) {
  return abilities.flatMap((ability) =>
    (Object.keys(principals) as Who[]).map(
      (who) => [ability, who, allowed[ability].includes(who)] as const,
    ),
  );
}

// Guest public visibility; the PostgreSQL tests cover the real lookup.
const audience = { isPublic: jest.fn(async () => false) };

@Module({
  providers: [{ provide: EventAudience, useValue: audience }],
  exports: [EventAudience],
})
class StubAudienceModule {}

describe("policies", () => {
  let authorization: AuthorizationService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthorizationModule.forRoot({
          globalGuard: false,
          policies: [PlatformPolicy, EventPolicy],
          imports: [StubAudienceModule],
        }),
      ],
    }).compile();
    await moduleRef.init();
    authorization = moduleRef.get(AuthorizationService);
  });

  describe("PlatformPolicy", () => {
    it.each(cases(platformAbilities, platformAllowed))(
      "%s for %s: %s",
      async (ability, who, expected) => {
        await expect(
          authorization.can(PlatformPolicy, ability, principals[who]),
        ).resolves.toBe(expected);
      },
    );

    it("ignores event-scoped grants", () => {
      const policy = new PlatformPolicy();
      const user = { id: "u", roles: [inEvent(UserRole.ADMIN)] };
      for (const ability of platformAbilities)
        expect(policy[ability](user)).toBe(false);
    });
  });

  describe("EventPolicy", () => {
    it.each(cases(eventAbilities, eventAllowed))(
      "%s for %s: %s",
      async (ability, who, expected) => {
        await expect(
          authorization.can(EventPolicy, ability, principals[who], EVENT),
        ).resolves.toBe(expected);
      },
    );

    it("lets a global admin skip every ability through before()", () => {
      const policy = new EventPolicy(audience as unknown as EventAudience);
      expect(policy.before(principals["global ADMIN"])).toBe(true);
      for (const who of Object.keys(principals) as Who[])
        if (who !== "global ADMIN")
          expect(policy.before(principals[who])).toBeUndefined();
    });

    it("only looks up public visibility for guests", async () => {
      audience.isPublic.mockClear();
      for (const user of Object.values(principals))
        if (user) await authorization.can(EventPolicy, "view", user, EVENT);
      expect(audience.isPublic).not.toHaveBeenCalled();

      audience.isPublic.mockResolvedValueOnce(true);
      await expect(
        authorization.can(EventPolicy, "view", null, EVENT),
      ).resolves.toBe(true);
      await expect(
        authorization.can(EventPolicy, "view", null, OTHER_EVENT),
      ).resolves.toBe(false);
      expect(audience.isPublic.mock.calls).toEqual([[EVENT], [OTHER_EVENT]]);
    });

    it("lets a global admin publish an event they hold no grant in", async () => {
      await expect(
        authorization.can(
          EventPolicy,
          "publish",
          principals["global ADMIN"],
          OTHER_EVENT,
        ),
      ).resolves.toBe(true);
    });

    it.each(["not-a-uuid", "", undefined as unknown as string])(
      "denies a malformed event id %p without throwing",
      async (eventId) => {
        for (const ability of eventAbilities.filter((a) => a !== "view"))
          await expect(
            authorization.can(
              EventPolicy,
              ability,
              principals["event ADMIN"],
              eventId,
            ),
          ).resolves.toBe(false);
      },
    );

    it("throws the 401 or 403 error from authorize()", async () => {
      await expect(
        authorization.authorize(EventPolicy, "administer", null, EVENT),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        authorization.authorize(
          EventPolicy,
          "administer",
          principals["event MODERATOR"],
          EVENT,
        ),
      ).rejects.toMatchObject({ status: 403 });
    });
  });
});
