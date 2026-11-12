// This file is duplicated in api/src/github-api/github-app-auth.spec.ts and
// github-service/src/github-app-auth.spec.ts. Keep both copies identical.
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  GithubAppAuth,
  GithubAppNotConfiguredError,
  GithubAppRequestError,
} from "./github-app-auth";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const NOW = Date.parse("2026-11-12T12:00:00Z");
const HOUR = 60 * 60 * 1000;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenResponse(token: string, expiresAt = NOW + HOUR) {
  return jsonResponse(201, {
    token,
    expires_at: new Date(expiresAt).toISOString(),
  });
}

function createAuth(fetchMock: jest.Mock, now = () => NOW) {
  return new GithubAppAuth({
    appId: "12345",
    privateKey,
    fetch: fetchMock as unknown as typeof fetch,
    now,
  });
}

function decodeJwt(authorization: string) {
  const jwt = authorization.replace(/^Bearer /, "");
  const [header, payload, signature] = jwt.split(".");
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString()),
    payload: JSON.parse(Buffer.from(payload, "base64url").toString()),
    verified: createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature, "base64url")),
  };
}

function requestOf(fetchMock: jest.Mock, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  return {
    url,
    method: init.method,
    headers,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}

describe("GithubAppAuth", () => {
  describe("configuration", () => {
    it("is disabled without an App ID and key", async () => {
      const auth = new GithubAppAuth({ appId: "", privateKey: " " });

      expect(auth.isEnabled()).toBe(false);
      await expect(auth.getInstallationToken(1)).rejects.toBeInstanceOf(
        GithubAppNotConfiguredError,
      );
    });

    it("rejects a half-configured App", () => {
      expect(() => new GithubAppAuth({ appId: "12345" })).toThrow(
        "must be set together",
      );
      expect(() => new GithubAppAuth({ privateKey })).toThrow(
        "must be set together",
      );
    });

    it("accepts the key as a single-line base64 PEM", () => {
      const auth = new GithubAppAuth({
        appId: "12345",
        privateKey: Buffer.from(privateKey).toString("base64"),
      });

      expect(auth.isEnabled()).toBe(true);
    });

    it("accepts a PEM with escaped newlines", () => {
      const auth = new GithubAppAuth({
        appId: "12345",
        privateKey: privateKey.replace(/\n/g, "\\n"),
      });

      expect(auth.isEnabled()).toBe(true);
    });

    it("rejects values that are not an RSA private key", () => {
      const ecKey = generateKeyPairSync("ec", {
        namedCurve: "P-256",
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      }).privateKey;

      expect(
        () => new GithubAppAuth({ appId: "1", privateKey: "not-a-key" }),
      ).toThrow("not a PEM private key");
      expect(
        () => new GithubAppAuth({ appId: "1", privateKey: ecKey }),
      ).toThrow("must be an RSA private key");
    });
  });

  describe("App JWT", () => {
    it("signs a backdated RS256 JWT issued by the App", async () => {
      const fetchMock = jest.fn().mockResolvedValue(tokenResponse("t"));

      await createAuth(fetchMock).getInstallationToken(42);

      const request = requestOf(fetchMock);
      const jwt = decodeJwt(request.headers.Authorization);
      expect(jwt.verified).toBe(true);
      expect(jwt.header).toEqual({ alg: "RS256", typ: "JWT" });
      expect(jwt.payload).toEqual({
        iat: NOW / 1000 - 60,
        exp: NOW / 1000 + 9 * 60,
        iss: 12345,
      });
      expect(request.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    });

    it("uses a client ID as the issuer unchanged", async () => {
      const fetchMock = jest.fn().mockResolvedValue(tokenResponse("t"));
      const auth = new GithubAppAuth({
        appId: "Iv23liClientId",
        privateKey,
        fetch: fetchMock as unknown as typeof fetch,
        now: () => NOW,
      });

      await auth.getInstallationToken(42);

      const jwt = decodeJwt(requestOf(fetchMock).headers.Authorization);
      expect(jwt.payload.iss).toBe("Iv23liClientId");
    });

    it("signs a new JWT after GitHub rejected the current one", async () => {
      let now = NOW;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse(401, { message: "Bad JWT" }))
        .mockResolvedValueOnce(tokenResponse("t"));
      const auth = createAuth(fetchMock, () => now);

      await expect(auth.getInstallationToken(42)).rejects.toThrow("Bad JWT");
      now += 1000;
      await auth.getInstallationToken(42);

      const first = requestOf(fetchMock, 0).headers.Authorization;
      const second = requestOf(fetchMock, 1).headers.Authorization;
      expect(second).not.toBe(first);
    });
  });

  describe("installation tokens", () => {
    it("requests an installation-wide token", async () => {
      const fetchMock = jest.fn().mockResolvedValue(tokenResponse("token-1"));

      await expect(
        createAuth(fetchMock).getInstallationToken(42),
      ).resolves.toBe("token-1");

      const request = requestOf(fetchMock);
      expect(request.url).toBe(
        "https://api.github.com/app/installations/42/access_tokens",
      );
      expect(request.method).toBe("POST");
      expect(request.body).toEqual({});
    });

    it("reuses a cached token until shortly before it expires", async () => {
      let now = NOW;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(tokenResponse("token-1"))
        .mockResolvedValueOnce(tokenResponse("token-2", NOW + 2 * HOUR));
      const auth = createAuth(fetchMock, () => now);

      await auth.getInstallationToken(42);
      now = NOW + 54 * 60 * 1000;
      await expect(auth.getInstallationToken(42)).resolves.toBe("token-1");
      now = NOW + 56 * 60 * 1000;
      await expect(auth.getInstallationToken(42)).resolves.toBe("token-2");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("caches tokens per installation", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(tokenResponse("token-a"))
        .mockResolvedValueOnce(tokenResponse("token-b"));
      const auth = createAuth(fetchMock);

      await expect(auth.getInstallationToken(1)).resolves.toBe("token-a");
      await expect(auth.getInstallationToken(2)).resolves.toBe("token-b");
      await expect(auth.getInstallationToken(1)).resolves.toBe("token-a");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("shares one request between concurrent callers", async () => {
      const fetchMock = jest.fn().mockResolvedValue(tokenResponse("token-1"));
      const auth = createAuth(fetchMock);

      const tokens = await Promise.all([
        auth.getInstallationToken(42),
        auth.getInstallationToken(42),
        auth.getInstallationToken(42),
      ]);

      expect(tokens).toEqual(["token-1", "token-1", "token-1"]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not cache a failed request", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse(404, { message: "Not Found" }))
        .mockResolvedValueOnce(tokenResponse("token-1"));
      const auth = createAuth(fetchMock);

      const failure = auth.getInstallationToken(42);
      await expect(failure).rejects.toBeInstanceOf(GithubAppRequestError);
      await expect(failure).rejects.toMatchObject({ status: 404 });
      await expect(auth.getInstallationToken(42)).resolves.toBe("token-1");
    });

    it("requests a new token after invalidation", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(tokenResponse("token-1"))
        .mockResolvedValueOnce(tokenResponse("token-2"));
      const auth = createAuth(fetchMock);

      await auth.getInstallationToken(42);
      auth.invalidateInstallationToken(42);

      await expect(auth.getInstallationToken(42)).resolves.toBe("token-2");
    });

    it.each([0, -1, 1.5, Number.NaN])(
      "rejects the installation ID %p",
      async (installationId) => {
        const fetchMock = jest.fn();

        await expect(
          createAuth(fetchMock).getInstallationToken(installationId),
        ).rejects.toThrow("Invalid GitHub App installation ID");
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("scoped tokens", () => {
    it("restricts the token to the given repositories and permissions", async () => {
      const fetchMock = jest.fn().mockResolvedValue(tokenResponse("scoped"));

      const token = await createAuth(fetchMock).createScopedToken(42, {
        repositories: ["team-repo"],
        permissions: { contents: "read" },
      });

      expect(token).toEqual({
        token: "scoped",
        expiresAt: new Date(NOW + HOUR),
      });
      expect(requestOf(fetchMock).body).toEqual({
        repositories: ["team-repo"],
        permissions: { contents: "read" },
      });
    });

    it("never caches scoped tokens", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(tokenResponse("scoped-1"))
        .mockResolvedValueOnce(tokenResponse("scoped-2"));
      const auth = createAuth(fetchMock);
      const options = { repositories: ["team-repo"] };

      await auth.createScopedToken(42, options);
      await expect(auth.createScopedToken(42, options)).resolves.toMatchObject({
        token: "scoped-2",
      });
    });

    it("refuses an unrestricted scoped token", async () => {
      const fetchMock = jest.fn();

      await expect(
        createAuth(fetchMock).createScopedToken(42, { repositories: [] }),
      ).rejects.toThrow("needs repositories or permissions");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("installations", () => {
    it("reads an installation with the App JWT", async () => {
      const installation = {
        id: 42,
        account: { id: 7, login: "core-org", type: "Organization" },
        repository_selection: "all",
        permissions: { administration: "write" },
        suspended_at: null,
      };
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(200, installation));

      await expect(createAuth(fetchMock).getInstallation(42)).resolves.toEqual(
        installation,
      );

      const request = requestOf(fetchMock);
      expect(request.url).toBe("https://api.github.com/app/installations/42");
      expect(request.method).toBe("GET");
      expect(decodeJwt(request.headers.Authorization).verified).toBe(true);
    });
  });
});
