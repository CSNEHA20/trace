export interface EvidenceVerificationRequest {
  manifestHash: string;
  signature: string;
  evidenceItems: Array<{
    id: string;
    sha256Hash: string;
    signature: string;
  }>;
}

export interface EvidenceVerificationResponse {
  isValid: boolean;
  tamperDetected: boolean;
  verifiedAt: number;
  details: string;
}
