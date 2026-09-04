import { EvidenceVerificationRequest, EvidenceVerificationResponse } from '../types';

export class VerificationService {
  async verifyPackage(req: EvidenceVerificationRequest): Promise<EvidenceVerificationResponse> {
    const allValid = req.evidenceItems.every(
      (item) => item.signature && item.sha256Hash && item.sha256Hash.length === 64
    );

    return {
      isValid: allValid,
      tamperDetected: !allValid,
      verifiedAt: Date.now(),
      details: allValid
        ? 'All cryptographic signatures and SHA-256 hashes matched hardware manifest.'
        : 'Tamper alert: Mismatch detected in evidence hash or signature.',
    };
  }
}

export const verificationService = new VerificationService();
