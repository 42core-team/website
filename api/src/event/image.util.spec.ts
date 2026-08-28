import { assertImageExists } from "./image.util";

describe("assertImageExists", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockImplementation((url: unknown) =>
      Promise.resolve(
        String(url).includes("/token")
          ? { ok: true, json: () => Promise.resolve({ token: "t" }) }
          : { ok: true, status: 200 },
      ),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("accepts a tag the registry knows", async () => {
    await expect(
      assertImageExists("ghcr.io/42core-team/my-core-bot:v0.0.4.2"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ghcr.io/v2/42core-team/my-core-bot/manifests/v0.0.4.2",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("rejects a tag the registry does not know", async () => {
    fetchMock.mockImplementation((url: unknown) =>
      Promise.resolve(
        String(url).includes("/token")
          ? { ok: true, json: () => Promise.resolve({ token: "t" }) }
          : { ok: false, status: 404 },
      ),
    );
    await expect(
      assertImageExists("ghcr.io/42core-team/my-core-bot:v9.9.9"),
    ).rejects.toThrow(/not found in registry/);
  });

  it("skips refs it cannot check", async () => {
    await expect(assertImageExists(undefined)).resolves.toBeUndefined();
    await expect(
      assertImageExists("docker.io/library/alpine:3"),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails open on network errors", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND ghcr.io"));
    await expect(
      assertImageExists("ghcr.io/42core-team/my-core-bot:v0.0.4.2"),
    ).resolves.toBeUndefined();
  });
});
