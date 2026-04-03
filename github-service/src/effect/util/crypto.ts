import CryptoJS from "crypto-js";
import { Effect } from "effect";

export class DecryptError extends Error {
  readonly _tag = "DecryptError" as const;
  constructor(message = "Failed to decrypt secret") {
    super(message);
  }
}

export const decryptSecret = (encryptedSecret: string, key: string) =>
  Effect.sync(() => {
    const bytes = CryptoJS.AES.decrypt(encryptedSecret, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new DecryptError();
    }
    return decrypted;
  });
