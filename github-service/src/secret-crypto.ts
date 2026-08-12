import { createDecipheriv, createHash, scryptSync } from "node:crypto";

const V2_FORMAT_PREFIX = "v2:";
const V2_SALT_LENGTH = 16;
const V2_IV_LENGTH = 12;
const V2_AUTH_TAG_LENGTH = 16;
const OPENSSL_SALTED_PREFIX = Buffer.from("Salted__", "ascii");
const LEGACY_SALT_LENGTH = 8;
const AES_256_KEY_LENGTH = 32;
const AES_BLOCK_LENGTH = 16;

/**
 * Decrypts secrets written by the API, including the current authenticated
 * AES-256-GCM format and legacy CryptoJS values.
 */
export function decryptSecret(encryptedValue: string, password: string): string {
  if (!encryptedValue.startsWith(V2_FORMAT_PREFIX)) {
    return decryptCryptoJsAes(encryptedValue, password);
  }

  const payload = Buffer.from(
    encryptedValue.slice(V2_FORMAT_PREFIX.length),
    "base64",
  );
  const minimumLength =
    V2_SALT_LENGTH + V2_IV_LENGTH + V2_AUTH_TAG_LENGTH;

  if (payload.length < minimumLength) {
    throw new Error("Invalid v2 encrypted secret");
  }

  const salt = payload.subarray(0, V2_SALT_LENGTH);
  const iv = payload.subarray(
    V2_SALT_LENGTH,
    V2_SALT_LENGTH + V2_IV_LENGTH,
  );
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

function deriveOpenSslKeyAndIv(password: string, salt: Buffer) {
  const passwordBytes = Buffer.from(password, "utf8");
  const requiredLength = AES_256_KEY_LENGTH + AES_BLOCK_LENGTH;
  const blocks: Buffer[] = [];
  let previousBlock = Buffer.alloc(0);
  let derivedLength = 0;

  while (derivedLength < requiredLength) {
    previousBlock = createHash("md5")
      .update(Buffer.concat([previousBlock, passwordBytes, salt]))
      .digest();
    blocks.push(previousBlock);
    derivedLength += previousBlock.length;
  }

  const derivedBytes = Buffer.concat(blocks);
  return {
    key: derivedBytes.subarray(0, AES_256_KEY_LENGTH),
    iv: derivedBytes.subarray(
      AES_256_KEY_LENGTH,
      AES_256_KEY_LENGTH + AES_BLOCK_LENGTH,
    ),
  };
}

/**
 * Decrypts the OpenSSL-compatible AES-256-CBC payload emitted by
 * CryptoJS.AES.encrypt(value, password).
 */
export function decryptCryptoJsAes(
  encryptedValue: string,
  password: string,
): string {
  const payload = Buffer.from(encryptedValue, "base64");
  const headerLength = OPENSSL_SALTED_PREFIX.length + LEGACY_SALT_LENGTH;
  const ciphertext = payload.subarray(headerLength);

  if (
    payload.length <= headerLength ||
    !payload
      .subarray(0, OPENSSL_SALTED_PREFIX.length)
      .equals(OPENSSL_SALTED_PREFIX) ||
    ciphertext.length % AES_BLOCK_LENGTH !== 0
  ) {
    throw new Error("Invalid CryptoJS AES payload");
  }

  const salt = payload.subarray(OPENSSL_SALTED_PREFIX.length, headerLength);
  const { key, iv } = deriveOpenSslKeyAndIv(password, salt);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
}
