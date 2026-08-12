import { ConfigService } from "@nestjs/config";
import type { UserEntity } from "../user/entities/user.entity";
import type { UserService } from "../user/user.service";
import { GithubOAuthClient } from "./github.strategy";

jest.mock("../user/entities/user.entity", () => ({ UserEntity: class {} }));
jest.mock("../user/user.service", () => ({ UserService: class {} }));

describe("GithubOAuthClient", () => {
  const values: Record<string, string> = {
    CLIENT_GITHUB_ID: "client-id",
    CLIENT_GITHUB_SECRET: "client-secret",
    CALLBACK_GITHUB_URL: "https://api.example.com/auth/github/callback",
  };
  const config = {
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it("adds state and S256 PKCE to the authorization request", () => {
    const client = new GithubOAuthClient(config, {} as UserService);
    const url = new URL(client.getAuthorizationUrl("state-a", "challenge-a"));

    expect(url.searchParams.get("state")).toBe("state-a");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-a");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("sends the matching PKCE verifier during the token exchange", async () => {
    const user = { id: "user-id" } as UserEntity;
    const users = {
      getUserByGithubId: jest.fn().mockResolvedValue(null),
      createUser: jest.fn().mockResolvedValue(user),
    } as unknown as UserService;
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 123,
            login: "octocat",
            name: "Octo Cat",
            email: "octo@example.com",
            avatar_url: "https://example.com/avatar.png",
          }),
          { status: 200 },
        ),
      );
    const client = new GithubOAuthClient(config, users);

    await expect(
      client.authenticate("authorization-code", "verifier-a"),
    ).resolves.toBe(user);

    const tokenRequest = fetchMock.mock.calls[0][1];
    expect(tokenRequest?.body).toBeInstanceOf(URLSearchParams);
    expect((tokenRequest?.body as URLSearchParams).get("code_verifier")).toBe(
      "verifier-a",
    );
  });
});
