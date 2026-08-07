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

  it("decrypts existing CryptoJS passphrase ciphertext", () => {
    const legacyCiphertext = "U2FsdGVkX18AAQIDBAUGB5swTx/Yx+o+F0LJpOTx9FY=";

    expect(decryptSecret(legacyCiphertext, passphrase)).toBe("legacy secret");
  });
});
