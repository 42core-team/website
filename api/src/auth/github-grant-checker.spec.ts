import { GithubGrantChecker } from "./github-grant-checker";

describe("GithubGrantChecker", () => {
  const checker = new GithubGrantChecker();
  const profile = {
    id: 123,
    login: "octocat",
    name: "Octo Cat",
    avatar_url: "https://example.com/avatar.png",
  };

  afterEach(() => jest.restoreAllMocks());

  it("reports a valid grant with the profile when GitHub answers 200", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(profile), { status: 200 }),
      );

    await expect(checker.check("gho_token")).resolves.toEqual({
      status: "valid",
      profile,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/user");
    expect(new Headers(init!.headers).get("Authorization")).toBe(
      "Bearer gho_token",
    );
    expect(init!.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports a revoked grant when GitHub answers 401", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("Bad credentials", { status: 401 }));

    await expect(checker.check("gho_token")).resolves.toEqual({
      status: "revoked",
    });
  });

  it.each([403, 404, 422, 429, 500, 502])(
    "reports unknown when GitHub answers %i",
    async (status) => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response("nope", { status }));

      await expect(checker.check("gho_token")).resolves.toMatchObject({
        status: "unknown",
      });
    },
  );

  it("reports unknown on a network error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));

    await expect(checker.check("gho_token")).resolves.toMatchObject({
      status: "unknown",
    });
  });

  it("reports unknown when the request times out", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(
        new DOMException("The operation timed out.", "TimeoutError"),
      );

    await expect(checker.check("gho_token")).resolves.toMatchObject({
      status: "unknown",
    });
  });

  it("reports unknown when a 200 body is not a GitHub user", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("<html>", { status: 200 }));

    await expect(checker.check("gho_token")).resolves.toMatchObject({
      status: "unknown",
    });
  });
});
