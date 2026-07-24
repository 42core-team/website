import { ConfigService } from "@nestjs/config";
import {
  FortyTwoOAuthStrategy,
  FortyTwoProfile,
  getPrimaryCampus,
} from "./fortytwo.strategy";

function profile(
  overrides: Partial<FortyTwoProfile> = {},
): FortyTwoProfile {
  return {
    id: 42,
    login: "student",
    email: "student@example.com",
    image_url: null,
    displayname: "Student",
    ...overrides,
  };
}

describe("getPrimaryCampus", () => {
  it("selects the matching primary campus rather than the first campus", () => {
    expect(
      getPrimaryCampus(
        profile({
          campus: [
            { id: 1, name: "Paris" },
            { id: 12, name: "Berlin" },
          ],
          campus_users: [
            { campus_id: 1, is_primary: false },
            { campus_id: 12, is_primary: true },
          ],
        }),
      ),
    ).toEqual({ campusId: 12, campusName: "Berlin" });
  });

  it.each([
    ["no primary campus", { campus: [{ id: 1, name: "Paris" }] }],
    [
      "a missing matching campus",
      { campus: [], campus_users: [{ campus_id: 12, is_primary: true }] },
    ],
    ["missing campus arrays", {}],
    ["empty campus arrays", { campus: [], campus_users: [] }],
  ])("returns null campus data for %s", (_description, overrides) => {
    expect(getPrimaryCampus(profile(overrides))).toEqual({
      campusId: null,
      campusName: null,
    });
  });
});

describe("FortyTwoOAuthStrategy", () => {
  it("passes through a non-successful 42 API response as an error", async () => {
    const config = {
      getOrThrow: jest.fn((key: string) => key),
    } as unknown as ConfigService;
    const strategy = new FortyTwoOAuthStrategy(config);
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("Unavailable"),
    });
    const done = jest.fn();

    try {
      await strategy.validate("access-token", "refresh-token", {}, done);
    } finally {
      global.fetch = originalFetch;
    }

    expect(done).toHaveBeenCalledWith(new Error("42 API error: 503"));
  });
});
