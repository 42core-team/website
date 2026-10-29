import { decryptSecret, encryptSecret } from "./encryption";

describe("secret encryption", () => {
  const passphrase = "test passphrase";

  it("round-trips an authenticated secret", () => {
    const encrypted = encryptSecret("new secret", passphrase);

    expect(encrypted).toMatch(/^v2:/);
    expect(decryptSecret(encrypted, passphrase)).toBe("new secret");
  });

  it("uses a unique salt and IV for every encrypted value", () => {
    expect(encryptSecret("same secret", passphrase)).not.toBe(
      encryptSecret("same secret", passphrase),
    );
  });

  it("rejects a modified authenticated secret", () => {
    const encrypted = encryptSecret("new secret", passphrase);
    const replacement = encrypted.endsWith("A") ? "B" : "A";
    const modified = `${encrypted.slice(0, -1)}${replacement}`;

    expect(() => decryptSecret(modified, passphrase)).toThrow();
  });

  it("rejects values that are not in the v2 format", () => {
    // An old CryptoJS (OpenSSL "Salted__") value; that format is no longer read.
    const cryptoJsCiphertext = "U2FsdGVkX18AAQIDBAUGB5swTx/Yx+o+F0LJpOTx9FY=";

    expect(() => decryptSecret(cryptoJsCiphertext, passphrase)).toThrow(
      "Unsupported encrypted secret format",
    );
    expect(() => decryptSecret("plain value", passphrase)).toThrow(
      "Unsupported encrypted secret format",
    );
  });

  it("round-trips empty and unicode secrets", () => {
    for (const secret of ["", "gh_✓_日本語_🔑"]) {
      expect(decryptSecret(encryptSecret(secret, passphrase), passphrase)).toBe(
        secret,
      );
    }
  });

  it("rejects a v2 value that is too short", () => {
    expect(() => decryptSecret("v2:", passphrase)).toThrow(
      "Invalid encrypted secret",
    );
    expect(() => decryptSecret("v2:AAAA", passphrase)).toThrow(
      "Invalid encrypted secret",
    );
  });

  it("rejects a wrong passphrase", () => {
    const encrypted = encryptSecret("new secret", passphrase);

    expect(() => decryptSecret(encrypted, "wrong passphrase")).toThrow();
  });
});
