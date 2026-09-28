import { describe, it, expect } from "vitest";
import { generateAsymmetricKeyPair, signAsymmetricPayload, verifyAsymmetricSignature } from "./asymmetric";

describe("Asymmetric Key Signing (Ed25519 & RSA)", () => {
  it("should generate Ed25519 key pair, sign payload and verify signature", () => {
    const keys = generateAsymmetricKeyPair("ed25519");
    expect(keys.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(keys.privateKey).toContain("BEGIN PRIVATE KEY");

    const payload = "1700000000.{\"event\":\"user.created\",\"id\":123}";
    const signature = signAsymmetricPayload(payload, keys.privateKey, "ed25519");
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(10);

    const isValid = verifyAsymmetricSignature(payload, signature, keys.publicKey, "ed25519");
    expect(isValid).toBe(true);

    const isTamperedValid = verifyAsymmetricSignature(payload + "tampered", signature, keys.publicKey, "ed25519");
    expect(isTamperedValid).toBe(false);
  });

  it("should generate RSA key pair, sign payload and verify signature", () => {
    const keys = generateAsymmetricKeyPair("rsa");
    expect(keys.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(keys.privateKey).toContain("BEGIN PRIVATE KEY");

    const payload = "1700000000.{\"event\":\"payment.succeeded\"}";
    const signature = signAsymmetricPayload(payload, keys.privateKey, "rsa");
    expect(signature).toBeDefined();

    const isValid = verifyAsymmetricSignature(payload, signature, keys.publicKey, "rsa");
    expect(isValid).toBe(true);
  });
});
