import { afterEach, describe, expect, it } from "vitest";
import { credentialHint, decryptClientCredential, encryptClientCredential } from "./providerCredentials";

const originalSecret = process.env.CREDENTIAL_ENCRYPTION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CREDENTIAL_ENCRYPTION_SECRET;
  else process.env.CREDENTIAL_ENCRYPTION_SECRET = originalSecret;
});

describe("client provider credentials", () => {
  it("encrypts a client key at rest and returns only a masked hint for UI display", () => {
    process.env.CREDENTIAL_ENCRYPTION_SECRET = "test-credential-encryption-secret-123456";
    const raw = "client-owned-twitter-api-key-9988";
    const encrypted = encryptClientCredential(raw);

    expect(encrypted).not.toContain(raw);
    expect(decryptClientCredential(encrypted)).toBe(raw);
    expect(credentialHint(raw)).toBe("••••9988");
  });
});
