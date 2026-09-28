import { generateKeyPairSync, createSign, createVerify, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";

export interface KeyPairResult {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate asymmetric key pair (Ed25519 or RSA-2048)
 */
export function generateAsymmetricKeyPair(type: "ed25519" | "rsa" = "ed25519"): KeyPairResult {
  if (type === "ed25519") {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { publicKey, privateKey };
  } else {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { publicKey, privateKey };
  }
}

/**
 * Sign payload with private key (Ed25519 or RSA-SHA256)
 */
export function signAsymmetricPayload(
  payload: string,
  privateKeyPem: string,
  type: "ed25519" | "rsa" = "ed25519"
): string {
  const dataBuffer = Buffer.from(payload, "utf-8");
  if (type === "ed25519") {
    const signatureBuffer = cryptoSign(null, dataBuffer, privateKeyPem);
    return signatureBuffer.toString("base64");
  } else {
    const signer = createSign("SHA256");
    signer.update(dataBuffer);
    signer.end();
    return signer.sign(privateKeyPem, "base64");
  }
}

/**
 * Verify signature with public key (Ed25519 or RSA-SHA256)
 */
export function verifyAsymmetricSignature(
  payload: string,
  signatureBase64: string,
  publicKeyPem: string,
  type: "ed25519" | "rsa" = "ed25519"
): boolean {
  try {
    const dataBuffer = Buffer.from(payload, "utf-8");
    const signatureBuffer = Buffer.from(signatureBase64, "base64");

    if (type === "ed25519") {
      return cryptoVerify(null, dataBuffer, publicKeyPem, signatureBuffer);
    } else {
      const verifier = createVerify("SHA256");
      verifier.update(dataBuffer);
      verifier.end();
      return verifier.verify(publicKeyPem, signatureBuffer);
    }
  } catch (err) {
    console.error("Asymmetric signature verification error:", err);
    return false;
  }
}
