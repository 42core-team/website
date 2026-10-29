/// <reference types="jest" />

import { decryptSecret } from "./secret-crypto";

describe("decryptSecret", () => {
  it("decrypts the v2 format produced by the API", () => {
    const encryptedValue =
      "v2:iSdBJkxhFmSKCyTgU8ioYCWvLuZU79239ohWflJLECgKn68Vv0nJGshlIK5YoOePCFrGCO+YRr0jxV887/ntdw==";

    expect(decryptSecret(encryptedValue, "secret-encryption-key")).toBe(
      "github-token-example",
    );
  });

  it("rejects values that are not in the v2 format", () => {
    // An old CryptoJS (OpenSSL "Salted__") value; that format is no longer read.
    const cryptoJsValue =
      "U2FsdGVkX1+F6uMRv44Sr035oXa/MNgrexSw8nwAyyIlFbCidOjS2/c6d83amr9J";

    expect(() => decryptSecret(cryptoJsValue, "secret-encryption-key")).toThrow(
      "Unsupported encrypted secret format",
    );
    expect(() => decryptSecret("not-encrypted", "password")).toThrow(
      "Unsupported encrypted secret format",
    );
  });

  it("rejects an incorrect password", () => {
    const encryptedValue =
      "v2:iSdBJkxhFmSKCyTgU8ioYCWvLuZU79239ohWflJLECgKn68Vv0nJGshlIK5YoOePCFrGCO+YRr0jxV887/ntdw==";

    expect(() => decryptSecret(encryptedValue, "wrong-password")).toThrow();
  });

  it("rejects a v2 value that is too short", () => {
    expect(() => decryptSecret("v2:", "password")).toThrow(
      "Invalid v2 encrypted secret",
    );
    expect(() => decryptSecret("v2:AAAA", "password")).toThrow(
      "Invalid v2 encrypted secret",
    );
  });

  it("rejects a modified v2 value", () => {
    const encryptedValue =
      "v2:iSdBJkxhFmSKCyTgU8ioYCWvLuZU79239ohWflJLECgKn68Vv0nJGshlIK5YoOePCFrGCO+YRr0jxV887/ntdw==";
    const modified = `${encryptedValue.slice(0, -3)}AAA`;

    expect(() => decryptSecret(modified, "secret-encryption-key")).toThrow();
  });
});
