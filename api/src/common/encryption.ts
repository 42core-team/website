import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const FORMAT_PREFIX = "v2:";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function encryptSecret(plaintext: string, passphrase: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = scryptSync(passphrase, salt, KEY_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return `${FORMAT_PREFIX}${Buffer.concat([
    salt,
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64")}`;
}

export function decryptSecret(ciphertext: string, passphrase: string): string {
  if (!ciphertext.startsWith(FORMAT_PREFIX)) {
    throw new Error("Unsupported encrypted secret format");
  }

  const payload = Buffer.from(ciphertext.slice(FORMAT_PREFIX.length), "base64");
  const minimumLength = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  if (payload.length < minimumLength) {
    throw new Error("Invalid encrypted secret");
  }

  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = payload.subarray(SALT_LENGTH + IV_LENGTH, minimumLength);
  const encrypted = payload.subarray(minimumLength);
  const key = scryptSync(passphrase, salt, KEY_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
