export class SHA256Verifier {
  verifyHash(calculatedHash: string, expectedHash: string): boolean {
    return calculatedHash.toLowerCase() === expectedHash.toLowerCase();
  }
}

export const sha256Verifier = new SHA256Verifier();
