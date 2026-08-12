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

  it("decrypts legacy values produced by CryptoJS.AES.encrypt", () => {
    const encryptedValue =
      "U2FsdGVkX1+F6uMRv44Sr035oXa/MNgrexSw8nwAyyIlFbCidOjS2/c6d83amr9J";

    expect(decryptSecret(encryptedValue, "secret-encryption-key")).toBe(
      "github-token-example",
    );
  });

  it("rejects payloads that are not OpenSSL salted AES data", () => {
    expect(() => decryptSecret("not-encrypted", "password")).toThrow(
      "Invalid CryptoJS AES payload",
    );
  });

  it("rejects an incorrect password", () => {
    const encryptedValue =
      "U2FsdGVkX1+F6uMRv44Sr035oXa/MNgrexSw8nwAyyIlFbCidOjS2/c6d83amr9J";

    expect(() =>
      decryptSecret(encryptedValue, "wrong-password"),
    ).toThrow();
  });

  it("rejects a modified v2 value", () => {
    const encryptedValue =
      "v2:iSdBJkxhFmSKCyTgU8ioYCWvLuZU79239ohWflJLECgKn68Vv0nJGshlIK5YoOePCFrGCO+YRr0jxV887/ntdw==";
    const modified = `${encryptedValue.slice(0, -3)}AAA`;

    expect(() =>
      decryptSecret(modified, "secret-encryption-key"),
    ).toThrow();
  });
});
