import {
  CampusAccount,
  FatalLookupError,
  backfillCampuses,
  createIntraLookup,
} from "./campus-backfill";

const profile = (campusName: string | null) => ({
  id: 1,
  login: "login",
  email: null,
  image_url: null,
  displayname: null,
  campus: [
    { id: 7, name: "Other" },
    ...(campusName ? [{ id: 44, name: campusName }] : []),
  ],
  campus_users: campusName
    ? [
        { campus_id: 7, is_primary: false },
        { campus_id: 44, is_primary: true },
      ]
    : [{ campus_id: 7, is_primary: false }],
});

const account = (
  id: string,
  campusName: string | null = null,
): CampusAccount => ({
  id,
  platformUserId: `${id}-42`,
  username: `user-${id}`,
  campusName,
});

describe("backfillCampuses", () => {
  const profiles: Record<string, ReturnType<typeof profile> | undefined> = {
    "a-42": profile("Heilbronn"),
    "b-42": profile(null),
    "c-42": undefined,
    "d-42": profile("Wolfsburg"),
  };
  const lookup = jest.fn(async (platformUserId: string) => {
    if (platformUserId === "e-42") throw new Error("42 API error 500");
    const found = profiles[platformUserId];
    return found
      ? { status: "found" as const, profile: found }
      : { status: "not_found" as const };
  });

  it("saves the primary campus and counts every outcome", async () => {
    const save = jest.fn(async () => undefined);
    const summary = await backfillCampuses({
      accounts: [
        account("a"),
        account("b"),
        account("c"),
        account("d", "Wolfsburg"),
        account("e"),
      ],
      lookup,
      save,
      apply: true,
      log: () => undefined,
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("a", {
      campusId: 44,
      campusName: "Heilbronn",
    });
    expect(summary).toEqual({
      updated: 1,
      unchanged: 1,
      noPrimaryCampus: 1,
      notFound: 1,
      failed: 1,
    });
  });

  it("writes nothing in a dry run", async () => {
    const save = jest.fn(async () => undefined);
    const summary = await backfillCampuses({
      accounts: [account("a")],
      lookup,
      save,
      apply: false,
      log: () => undefined,
    });
    expect(save).not.toHaveBeenCalled();
    expect(summary.updated).toBe(1);
  });

  it("stops at once when the token is rejected", async () => {
    const rejected = jest.fn(async () => {
      throw new FatalLookupError("The access token was rejected (401).");
    });
    await expect(
      backfillCampuses({
        accounts: [account("a"), account("b")],
        lookup: rejected,
        save: jest.fn(),
        apply: true,
        log: () => undefined,
      }),
    ).rejects.toThrow("rejected");
    expect(rejected).toHaveBeenCalledTimes(1);
  });
});

describe("createIntraLookup", () => {
  const response = (status: number, body: unknown = {}, retryAfter?: string) =>
    new Response(JSON.stringify(body), {
      status,
      headers: retryAfter ? { "retry-after": retryAfter } : {},
    });

  it("sends the token and returns the profile", async () => {
    const fetchImpl = jest.fn(async () => response(200, profile("Heilbronn")));
    const lookup = createIntraLookup(
      "token",
      fetchImpl as never,
      async () => 0,
    );

    const result = await lookup("123");

    expect(result.status).toBe("found");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.intra.42.fr/v2/users/123",
      { headers: { Authorization: "Bearer token" } },
    );
  });

  it("retries after a rate limit, waiting as long as the API asks", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(429, {}, "3"))
      .mockResolvedValueOnce(response(200, profile("Heilbronn")));
    const wait = jest.fn(async () => 0);
    const lookup = createIntraLookup("token", fetchImpl, wait);

    expect((await lookup("123")).status).toBe("found");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(3000);
  });

  it("reports unknown users and rejected tokens", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(403));
    const lookup = createIntraLookup("token", fetchImpl, async () => 0);

    expect(await lookup("1")).toEqual({ status: "not_found" });
    await expect(lookup("2")).rejects.toBeInstanceOf(FatalLookupError);
    await expect(lookup("3")).rejects.toBeInstanceOf(FatalLookupError);
  });
});
