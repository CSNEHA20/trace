import { generateForensicPdf } from '../src/services/pdfGenerator';
import { Case, EvidenceItem } from '../src/types';

describe('PDF 1.4 Pure TypeScript Generator', () => {
  const mockCase: Case = {
    id: 'CASE-TEST-001',
    caseNumber: 'TR-2026-0089',
    title: 'Digital Extortion Forensic Investigation',
    description: 'Investigation into threatening messages and extortion attempts',
    investigatorName: 'Detective SNEHA C',
    status: 'ACTIVE',
    createdAt: 1772640000000,
    updatedAt: 1772640000000,
    evidenceIds: ['EV-1', 'EV-2'],
  };

  const mockEvidence: EvidenceItem[] = [
    {
      id: 'EV-1',
      caseId: 'CASE-TEST-001',
      title: 'Chat Screenshot Evidence',
      fileName: 'chat_export_001.png',
      fileUri: 'file:///data/vault/chat_export_001.png',
      fileSize: 452000,
      mimeType: 'image/png',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      type: 'IMAGE',
      timestamp: 1772641000000,
      isTampered: false,
      aiAnalysis: {
        detectedText: ['Pay 50000 within 24 hours or private files will be released'],
      },
    },
    {
      id: 'EV-2',
      caseId: 'CASE-TEST-001',
      title: 'Threat Voicemail Recording',
      fileName: 'voicemail_call.m4a',
      fileUri: 'file:///data/vault/voicemail_call.m4a',
      fileSize: 1240000,
      mimeType: 'audio/m4a',
      sha256Hash: 'a8f0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b899',
      type: 'AUDIO',
      timestamp: 1772642000000,
      isTampered: false,
      aiAnalysis: {
        transcription: 'Listen carefully, this is your final warning.',
      },
    },
  ];

  it('generates a valid ISO 32000 / PDF 1.4 document', () => {
    const pdf = generateForensicPdf(mockCase, mockEvidence, {
      agencyName: 'TRACE Digital Forensics Unit',
      investigatorNotes: 'Suspect identified via encrypted messaging metadata.',
      manifestHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      digitalSignature: 'SIG_TRACE_HARDWARE_ED25519_abcdef0123456789',
      generatedAt: '2026-09-08T18:00:00.000Z',
    });

    // 1. PDF Header
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);

    // 2. Contains Catalog and Pages structure
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('/Type /Pages');
    expect(pdf).toContain('/Type /Page');

    // 3. Contains Standard Fonts
    expect(pdf).toContain('/BaseFont /Helvetica');
    expect(pdf).toContain('/BaseFont /Helvetica-Bold');
    expect(pdf).toContain('/BaseFont /Courier');
    expect(pdf).toContain('/BaseFont /Courier-Bold');

    // 4. Contains Case Information
    expect(pdf).toContain('(TR-2026-0089)');
    expect(pdf).toContain('(TRACE Digital Forensics Unit)');
    expect(pdf).toContain('(Detective SNEHA C)');

    // 5. Contains Evidence Items
    expect(pdf).toContain('(chat_export_001.png)');
    expect(pdf).toContain('(voicemail_call.m4a)');
    expect(pdf).toContain('[OK] INTACT');

    // 6. Contains Cryptographic Proof Seal
    expect(pdf).toContain('CRYPTOGRAPHIC PROOF SEAL');
    expect(pdf).toContain('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(pdf).toContain('SIG_TRACE_HARDWARE_ED25519_');

    // 7. Contains XREF table and EOF marker
    expect(pdf).toContain('xref\n0 ');
    expect(pdf).toContain('trailer\n<< /Size ');
    expect(pdf).toContain('startxref\n');
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('handles empty evidence list gracefully', () => {
    const pdf = generateForensicPdf(mockCase, [], {
      agencyName: 'TRACE Digital Forensics Unit',
    });

    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf).toContain('No evidence records registered in this case.');
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('flags tampered evidence prominently in status banner and rows', () => {
    const tamperedEvidence: EvidenceItem[] = [
      ...mockEvidence,
      {
        id: 'EV-3',
        caseId: 'CASE-TEST-001',
        title: 'Tampered Document',
        fileName: 'altered_invoice.pdf',
        fileUri: 'file:///data/vault/altered_invoice.pdf',
        fileSize: 84000,
        mimeType: 'application/pdf',
        sha256Hash: '9999999999999999999999999999999999999999999999999999999999999999',
        type: 'DOCUMENT',
        timestamp: 1772643000000,
        isTampered: true,
      },
    ];

    const pdf = generateForensicPdf(mockCase, tamperedEvidence);

    expect(pdf).toContain('[!] WARNING: 1 TAMPERED EVIDENCE');
    expect(pdf).toContain('INTEGRITY COMPROMISED');
    expect(pdf).toContain('[!] TAMPERED');
  });
});
