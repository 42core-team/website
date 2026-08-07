import {
  createCipheriv,
  createDecipheriv,
  createHash,
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
    return decryptLegacyCryptoJs(ciphertext, passphrase);
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

function decryptLegacyCryptoJs(ciphertext: string, passphrase: string): string {
  const payload = Buffer.from(ciphertext, "base64");
  if (
    payload.length < 16 ||
    payload.subarray(0, 8).toString("ascii") !== "Salted__"
  ) {
    throw new Error("Invalid encrypted secret");
  }

  const salt = payload.subarray(8, 16);
  const encrypted = payload.subarray(16);
  const { key, iv } = deriveOpenSslKeyAndIv(passphrase, salt);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

function deriveOpenSslKeyAndIv(
  passphrase: string,
  salt: Buffer,
): { key: Buffer; iv: Buffer } {
  const password = Buffer.from(passphrase, "utf8");
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let length = 0;

  while (length < KEY_LENGTH + 16) {
    previous = createHash("md5")
      .update(Buffer.concat([previous, password, salt]))
      .digest();
    blocks.push(previous);
    length += previous.length;
  }

  const derived = Buffer.concat(blocks);
  return {
    key: derived.subarray(0, KEY_LENGTH),
    iv: derived.subarray(KEY_LENGTH, KEY_LENGTH + 16),
  };
}
