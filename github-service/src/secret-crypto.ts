import { createDecipheriv, scryptSync } from "node:crypto";

const V2_FORMAT_PREFIX = "v2:";
const V2_SALT_LENGTH = 16;
const V2_IV_LENGTH = 12;
const V2_AUTH_TAG_LENGTH = 16;
const AES_256_KEY_LENGTH = 32;

/**
 * Decrypts secrets written by the API in the authenticated AES-256-GCM format.
 */
export function decryptSecret(
  encryptedValue: string,
  password: string,
): string {
  if (!encryptedValue.startsWith(V2_FORMAT_PREFIX)) {
    throw new Error("Unsupported encrypted secret format");
  }

  const payload = Buffer.from(
    encryptedValue.slice(V2_FORMAT_PREFIX.length),
    "base64",
  );
  const minimumLength = V2_SALT_LENGTH + V2_IV_LENGTH + V2_AUTH_TAG_LENGTH;

  if (payload.length < minimumLength) {
    throw new Error("Invalid v2 encrypted secret");
  }

  const salt = payload.subarray(0, V2_SALT_LENGTH);
  const iv = payload.subarray(V2_SALT_LENGTH, V2_SALT_LENGTH + V2_IV_LENGTH);
  const authTag = payload.subarray(
    V2_SALT_LENGTH + V2_IV_LENGTH,
    minimumLength,
  );
  const ciphertext = payload.subarray(minimumLength);
  const key = scryptSync(password, salt, AES_256_KEY_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
