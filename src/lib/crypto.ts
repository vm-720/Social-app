import crypto from "node:crypto";

// AES-256-GCM for platform access tokens at rest. TOKEN_ENCRYPTION_KEY is either 32 random bytes,
// base64 encoded (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"),
// or any random string of at least 32 characters, e.g. from a password manager's generator.

const PREFIX = "v1";

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const k = Buffer.from(raw, "base64");
  if (k.length === 32) return k;
  if (raw.length >= 32) return crypto.createHash("sha256").update(raw, "utf8").digest();
  throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters");
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [prefix, iv, tag, ct] = stored.split(":");
  if (prefix !== PREFIX || !iv || !tag || !ct) throw new Error("Stored secret is not in the expected format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
