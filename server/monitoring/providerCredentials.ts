import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type ClientProvider = "twitterapi_io" | "official_x";

function encryptionKey() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Secure credential storage is unavailable. Configure CREDENTIAL_ENCRYPTION_SECRET with at least 32 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

export function credentialHint(credential: string) {
  const compact = credential.trim();
  return `••••${compact.slice(-4)}`;
}

/** AES-256-GCM provides confidentiality and authentication at rest. */
export function encryptClientCredential(credential: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(credential.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptClientCredential(encrypted: string) {
  const [version, ivText, tagText, ciphertextText] = encrypted.split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("Stored provider credential is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}
