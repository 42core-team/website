/// <reference types="jest" />

import { decryptCryptoJsAes } from "./secret-crypto";

describe("decryptCryptoJsAes", () => {
  it("decrypts the format produced by CryptoJS.AES.encrypt", () => {
    const encryptedValue =
      "U2FsdGVkX1+F6uMRv44Sr035oXa/MNgrexSw8nwAyyIlFbCidOjS2/c6d83amr9J";

    expect(decryptCryptoJsAes(encryptedValue, "secret-encryption-key")).toBe(
      "github-token-example",
    );
  });

  it("rejects payloads that are not OpenSSL salted AES data", () => {
    expect(() => decryptCryptoJsAes("not-encrypted", "password")).toThrow(
      "Invalid CryptoJS AES payload",
    );
  });

  it("rejects an incorrect password", () => {
    const encryptedValue =
      "U2FsdGVkX1+F6uMRv44Sr035oXa/MNgrexSw8nwAyyIlFbCidOjS2/c6d83amr9J";

    expect(() =>
      decryptCryptoJsAes(encryptedValue, "wrong-password"),
    ).toThrow();
  });
});
