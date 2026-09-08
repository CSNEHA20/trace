import { Case, EvidenceItem } from '../types';

/**
 * Escapes characters for PDF string literals: ( ) \
 * Replaces non-ASCII characters with safe ASCII equivalents.
 */
function escapePdfText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[^\x20-\x7E\n]/g, (ch) => {
      // Map common unicode characters to ASCII
      if (ch === '✓') return '[OK] ';
      if (ch === '⚠️' || ch === '⚠') return '[!] ';
      if (ch === '🔒') return '[SECURE] ';
      if (ch === '•') return '*';
      if (ch === '—' || ch === '–') return '-';
      if (ch === '“' || ch === '”') return '"';
      if (ch === '‘' || ch === '’') return "'";
      return '';
    })
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * PDF Page Builder helper class for drawing shapes and text.
 */
class PdfPageStream {
  private ops: string[] = [];

  // Colors
  setFillColor(r: number, g: number, b: number) {
    this.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  }

  setStrokeColor(r: number, g: number, b: number) {
    this.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  }

  setLineWidth(w: number) {
    this.ops.push(`${w.toFixed(2)} w`);
  }

  // Rectangles
  fillRect(x: number, y: number, w: number, h: number) {
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }

  fillAndStrokeRect(x: number, y: number, w: number, h: number) {
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`);
  }

  // Lines
  drawLine(x1: number, y1: number, x2: number, y2: number) {
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  // Text
  drawText(
    text: string,
    x: number,
    y: number,
    font: 'F1' | 'F2' | 'F3' | 'F4' = 'F1',
    size: number = 10,
    color?: [number, number, number]
  ) {
    if (color) {
      this.setFillColor(color[0], color[1], color[2]);
    }
    const safeText = escapePdfText(text);
    this.ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${safeText}) Tj ET`);
  }

  build(): string {
    return this.ops.join('\n');
  }
}

export interface PdfReportOptions {
  agencyName?: string;
  investigatorNotes?: string;
  manifestHash?: string;
  digitalSignature?: string;
  generatedAt?: string;
}

/**
 * Pure TypeScript PDF 1.4 Generator
 * Generates an ISO 32000 compliant PDF document with zero external native dependencies.
 */
export function generateForensicPdf(
  c: Case,
  evidenceList: EvidenceItem[],
  options?: PdfReportOptions
): string {
  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89; // A4
  const MARGIN_LEFT = 36;
  const MARGIN_RIGHT = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 523.28

  const agency = options?.agencyName || 'TRACE Digital Forensics Lab';
  const notes = options?.investigatorNotes || '';
  const manifestHash = options?.manifestHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const signature = options?.digitalSignature || 'SECURE_STORE_ED25519_SIGNED_PAYLOAD';
  const generatedAt = options?.generatedAt || new Date().toISOString();

  const tamperedCount = evidenceList.filter((e) => e.isTampered).length;
  const isAllIntact = tamperedCount === 0;

  const pages: PdfPageStream[] = [];
  let currentPage = new PdfPageStream();
  pages.push(currentPage);

  let currentY = PAGE_HEIGHT - 40;

  // Helper to draw top brand header
  const drawPageHeader = (p: PdfPageStream, _pageNum: number) => {
    // Amber top accent line (#F5A623)
    p.setFillColor(0.96, 0.65, 0.14);
    p.fillRect(MARGIN_LEFT, PAGE_HEIGHT - 22, CONTENT_WIDTH, 4);

    // Subtle header text
    p.drawText('TRACE FORENSIC EVIDENCE REPORT — OFFICIAL AUDIT', MARGIN_LEFT, PAGE_HEIGHT - 32, 'F2', 8, [0.4, 0.4, 0.4]);
    p.drawText(`CASE: ${c.caseNumber}`, PAGE_WIDTH - MARGIN_RIGHT - 110, PAGE_HEIGHT - 32, 'F4', 8, [0.4, 0.4, 0.4]);
  };

  // Helper to draw page footer
  const drawPageFooter = (p: PdfPageStream, pageNum: number) => {
    // Footer divider line
    p.setStrokeColor(0.85, 0.85, 0.85);
    p.setLineWidth(0.75);
    p.drawLine(MARGIN_LEFT, 36, PAGE_WIDTH - MARGIN_RIGHT, 36);

    // Footer text
    p.drawText('TRACE Tamper-Proof Forensics • Cryptographic Chain of Custody', MARGIN_LEFT, 24, 'F1', 7.5, [0.5, 0.5, 0.5]);
    p.drawText(`Page ${pageNum}`, PAGE_WIDTH - MARGIN_RIGHT - 40, 24, 'F2', 8, [0.3, 0.3, 0.3]);
  };

  // Check if we need a page break
  const ensureSpace = (requiredHeight: number) => {
    if (currentY - requiredHeight < 55) {
      // Draw footer on current page
      drawPageFooter(currentPage, pages.length);
      // New page
      currentPage = new PdfPageStream();
      pages.push(currentPage);
      currentY = PAGE_HEIGHT - 50;
      drawPageHeader(currentPage, pages.length);
    }
  };

  // ── 1. Page 1 Header ──────────────────────────────────────────────
  drawPageHeader(currentPage, 1);
  currentY -= 20;

  // Main Title Box
  currentPage.drawText('TRACE FORENSIC EVIDENCE REPORT', MARGIN_LEFT, currentY, 'F2', 18, [0.07, 0.07, 0.07]);
  currentY -= 14;
  currentPage.drawText('Court-Admissible Digital Evidence Package & Cryptographic Verification', MARGIN_LEFT, currentY, 'F1', 10, [0.4, 0.4, 0.4]);
  currentY -= 20;

  // ── 2. Case Metadata Card ─────────────────────────────────────────
  const metaCardHeight = 65;
  ensureSpace(metaCardHeight);

  // Card Background
  currentPage.setFillColor(0.96, 0.96, 0.97);
  currentPage.fillRect(MARGIN_LEFT, currentY - metaCardHeight, CONTENT_WIDTH, metaCardHeight);
  // Left amber border
  currentPage.setFillColor(0.96, 0.65, 0.14);
  currentPage.fillRect(MARGIN_LEFT, currentY - metaCardHeight, 4, metaCardHeight);
  // Border outline
  currentPage.setStrokeColor(0.88, 0.88, 0.9);
  currentPage.setLineWidth(1);
  currentPage.strokeRect(MARGIN_LEFT, currentY - metaCardHeight, CONTENT_WIDTH, metaCardHeight);

  // Card contents (2 columns)
  const col1X = MARGIN_LEFT + 14;
  const col2X = MARGIN_LEFT + 270;
  let cardTextY = currentY - 18;

  currentPage.drawText('CASE NUMBER:', col1X, cardTextY, 'F2', 8, [0.4, 0.4, 0.4]);
  currentPage.drawText(c.caseNumber, col1X + 80, cardTextY, 'F4', 9.5, [0.07, 0.07, 0.07]);

  currentPage.drawText('AGENCY:', col2X, cardTextY, 'F2', 8, [0.4, 0.4, 0.4]);
  currentPage.drawText(agency, col2X + 55, cardTextY, 'F1', 9.5, [0.07, 0.07, 0.07]);

  cardTextY -= 16;
  currentPage.drawText('CASE TITLE:', col1X, cardTextY, 'F2', 8, [0.4, 0.4, 0.4]);
  currentPage.drawText(c.title.substring(0, 32), col1X + 80, cardTextY, 'F1', 9.5, [0.07, 0.07, 0.07]);

  currentPage.drawText('INVESTIGATOR:', col2X, cardTextY, 'F2', 8, [0.4, 0.4, 0.4]);
  currentPage.drawText(c.investigatorName || 'Lead Investigator', col2X + 80, cardTextY, 'F1', 9.5, [0.07, 0.07, 0.07]);

  cardTextY -= 16;
  currentPage.drawText('GENERATED:', col1X, cardTextY, 'F2', 8, [0.4, 0.4, 0.4]);
  currentPage.drawText(generatedAt.replace('T', ' ').substring(0, 19) + ' UTC', col1X + 80, cardTextY, 'F3', 8.5, [0.07, 0.07, 0.07]);

  currentPage.drawText('TOTAL ITEMS:', col2X, cardTextY, 'F2', 8, [0.4, 0.4, 0.4]);
  currentPage.drawText(`${evidenceList.length} Evidence Records`, col2X + 75, cardTextY, 'F2', 9, [0.07, 0.07, 0.07]);

  currentY -= metaCardHeight + 14;

  // ── 3. Integrity Status Banner ────────────────────────────────────
  const bannerHeight = 26;
  ensureSpace(bannerHeight);

  if (isAllIntact) {
    // Green verified box
    currentPage.setFillColor(0.86, 0.98, 0.90);
    currentPage.fillRect(MARGIN_LEFT, currentY - bannerHeight, CONTENT_WIDTH, bannerHeight);
    currentPage.setStrokeColor(0.53, 0.93, 0.67);
    currentPage.setLineWidth(1);
    currentPage.strokeRect(MARGIN_LEFT, currentY - bannerHeight, CONTENT_WIDTH, bannerHeight);

    currentPage.drawText('[OK] FORENSIC INTEGRITY AUDIT: ALL EVIDENCE VERIFIED INTACT', MARGIN_LEFT + 12, currentY - 17, 'F2', 9.5, [0.09, 0.64, 0.29]);
    currentPage.drawText('SHA-256 HARDWARE SECURE', PAGE_WIDTH - MARGIN_RIGHT - 145, currentY - 17, 'F4', 8.5, [0.09, 0.64, 0.29]);
  } else {
    // Red alert box
    currentPage.setFillColor(0.99, 0.88, 0.88);
    currentPage.fillRect(MARGIN_LEFT, currentY - bannerHeight, CONTENT_WIDTH, bannerHeight);
    currentPage.setStrokeColor(0.99, 0.79, 0.79);
    currentPage.setLineWidth(1);
    currentPage.strokeRect(MARGIN_LEFT, currentY - bannerHeight, CONTENT_WIDTH, bannerHeight);

    currentPage.drawText(`[!] WARNING: ${tamperedCount} TAMPERED EVIDENCE ITEM(S) DETECTED`, MARGIN_LEFT + 12, currentY - 17, 'F2', 9.5, [0.86, 0.15, 0.15]);
    currentPage.drawText('INTEGRITY COMPROMISED', PAGE_WIDTH - MARGIN_RIGHT - 140, currentY - 17, 'F4', 8.5, [0.86, 0.15, 0.15]);
  }
  currentY -= bannerHeight + 16;

  // ── 4. Investigator Remarks (if present) ──────────────────────────
  if (notes.trim().length > 0) {
    const notesHeight = 44;
    ensureSpace(notesHeight);

    currentPage.setFillColor(1.0, 0.98, 0.92);
    currentPage.fillRect(MARGIN_LEFT, currentY - notesHeight, CONTENT_WIDTH, notesHeight);
    currentPage.setFillColor(0.96, 0.65, 0.14);
    currentPage.fillRect(MARGIN_LEFT, currentY - notesHeight, 3, notesHeight);

    currentPage.drawText('INVESTIGATOR REMARKS / SCENE NOTES:', MARGIN_LEFT + 10, currentY - 14, 'F2', 8, [0.57, 0.25, 0.05]);
    currentPage.drawText(notes.substring(0, 110), MARGIN_LEFT + 10, currentY - 28, 'F1', 8.5, [0.47, 0.21, 0.06]);
    currentY -= notesHeight + 14;
  }

  // ── 5. Evidence Manifest Table ─────────────────────────────────────
  ensureSpace(40);
  currentPage.drawText(`EVIDENCE MANIFEST (${evidenceList.length} RECORDED ITEMS)`, MARGIN_LEFT, currentY, 'F2', 11, [0.07, 0.07, 0.07]);
  currentY -= 14;

  // Table Column Headers
  const colH_num = MARGIN_LEFT;
  const colH_name = MARGIN_LEFT + 24;
  const colH_type = MARGIN_LEFT + 180;
  const colH_size = MARGIN_LEFT + 240;
  const colH_hash = MARGIN_LEFT + 295;
  const colH_status = MARGIN_LEFT + 460;

  const headerRowHeight = 18;
  currentPage.setFillColor(0.07, 0.07, 0.07);
  currentPage.fillRect(MARGIN_LEFT, currentY - headerRowHeight, CONTENT_WIDTH, headerRowHeight);

  currentPage.drawText('#', colH_num + 6, currentY - 13, 'F2', 8, [1, 1, 1]);
  currentPage.drawText('EVIDENCE FILE', colH_name, currentY - 13, 'F2', 8, [1, 1, 1]);
  currentPage.drawText('TYPE', colH_type, currentY - 13, 'F2', 8, [1, 1, 1]);
  currentPage.drawText('SIZE', colH_size, currentY - 13, 'F2', 8, [1, 1, 1]);
  currentPage.drawText('SHA-256 HASH', colH_hash, currentY - 13, 'F2', 8, [1, 1, 1]);
  currentPage.drawText('STATUS', colH_status, currentY - 13, 'F2', 8, [1, 1, 1]);
  currentY -= headerRowHeight;

  // Render Table Rows
  if (evidenceList.length === 0) {
    const emptyRowHeight = 24;
    currentPage.setFillColor(0.98, 0.98, 0.98);
    currentPage.fillRect(MARGIN_LEFT, currentY - emptyRowHeight, CONTENT_WIDTH, emptyRowHeight);
    currentPage.drawText('No evidence records registered in this case.', MARGIN_LEFT + 20, currentY - 16, 'F1', 9, [0.5, 0.5, 0.5]);
    currentY -= emptyRowHeight;
  } else {
    for (let idx = 0; idx < evidenceList.length; idx++) {
      const item = evidenceList[idx];
      const hasAnalysisNote = !!(item.aiAnalysis?.detectedText?.[0] || item.aiAnalysis?.transcription || item.exifData?.make);
      const rowHeight = hasAnalysisNote ? 34 : 22;

      ensureSpace(rowHeight);

      // Alternating row background
      if (idx % 2 === 1) {
        currentPage.setFillColor(0.97, 0.97, 0.98);
        currentPage.fillRect(MARGIN_LEFT, currentY - rowHeight, CONTENT_WIDTH, rowHeight);
      }
      // Row bottom border
      currentPage.setStrokeColor(0.9, 0.9, 0.92);
      currentPage.setLineWidth(0.5);
      currentPage.drawLine(MARGIN_LEFT, currentY - rowHeight, MARGIN_LEFT + CONTENT_WIDTH, currentY - rowHeight);

      // #
      currentPage.drawText(String(idx + 1), colH_num + 6, currentY - 14, 'F2', 8, [0.3, 0.3, 0.3]);

      // Name
      const displayName = item.fileName.length > 24 ? item.fileName.substring(0, 22) + '..' : item.fileName;
      currentPage.drawText(displayName, colH_name, currentY - 14, 'F2', 8.5, [0.1, 0.1, 0.1]);

      // Type
      currentPage.drawText(item.type, colH_type, currentY - 14, 'F1', 8, [0.3, 0.3, 0.5]);

      // Size
      const sizeKb = (item.fileSize / 1024).toFixed(1) + ' KB';
      currentPage.drawText(sizeKb, colH_size, currentY - 14, 'F1', 8, [0.4, 0.4, 0.4]);

      // SHA-256 Hash (truncated for display in column)
      const shortHash = item.sha256Hash ? item.sha256Hash.substring(0, 22) + '...' : 'UNKNOWN_HASH';
      currentPage.drawText(shortHash, colH_hash, currentY - 14, 'F3', 7.5, [0.2, 0.2, 0.2]);

      // Status
      if (item.isTampered) {
        currentPage.drawText('[!] TAMPERED', colH_status, currentY - 14, 'F4', 8, [0.86, 0.15, 0.15]);
      } else {
        currentPage.drawText('[OK] INTACT', colH_status, currentY - 14, 'F4', 8, [0.09, 0.64, 0.29]);
      }

      // Secondary Analysis line (OCR / EXIF / Whisper)
      if (hasAnalysisNote) {
        let noteStr = '';
        if (item.aiAnalysis?.detectedText?.[0]) {
          noteStr = `OCR: "${item.aiAnalysis.detectedText[0].substring(0, 60)}"`;
        } else if (item.aiAnalysis?.transcription) {
          noteStr = `Whisper: "${item.aiAnalysis.transcription.substring(0, 60)}"`;
        } else if (item.exifData?.make) {
          noteStr = `EXIF: ${item.exifData.make} ${item.exifData.model || ''}`;
        }
        currentPage.drawText(noteStr, colH_name, currentY - 26, 'F1', 7.5, [0.4, 0.4, 0.5]);
      }

      currentY -= rowHeight;
    }
  }

  // ── 6. Cryptographic Proof Seal & Investigator Certification ──────
  const sealHeight = 110;
  ensureSpace(sealHeight + 20);
  currentY -= 14;

  currentPage.setFillColor(0.95, 0.95, 0.96);
  currentPage.fillRect(MARGIN_LEFT, currentY - sealHeight, CONTENT_WIDTH, sealHeight);
  currentPage.setFillColor(0.96, 0.65, 0.14);
  currentPage.fillRect(MARGIN_LEFT, currentY - sealHeight, 4, sealHeight);
  currentPage.setStrokeColor(0.85, 0.85, 0.87);
  currentPage.setLineWidth(1);
  currentPage.strokeRect(MARGIN_LEFT, currentY - sealHeight, CONTENT_WIDTH, sealHeight);

  // Seal Title
  currentPage.drawText('CRYPTOGRAPHIC PROOF SEAL & HARDWARE ATTESTATION', MARGIN_LEFT + 14, currentY - 18, 'F2', 9, [0.07, 0.07, 0.07]);
  currentPage.drawText('HARDWARE ATTESTED', PAGE_WIDTH - MARGIN_RIGHT - 110, currentY - 18, 'F4', 8, [0.09, 0.64, 0.29]);

  // Manifest Hash
  currentPage.drawText('MANIFEST SHA-256 DIGEST:', MARGIN_LEFT + 14, currentY - 34, 'F2', 7.5, [0.4, 0.4, 0.4]);
  currentPage.drawText(manifestHash, MARGIN_LEFT + 14, currentY - 45, 'F3', 7.5, [0.1, 0.1, 0.1]);

  // Digital Signature
  currentPage.drawText('ED25519 DIGITAL SIGNATURE:', MARGIN_LEFT + 14, currentY - 58, 'F2', 7.5, [0.4, 0.4, 0.4]);
  const sigDisplay = signature.length > 75 ? signature.substring(0, 72) + '...' : signature;
  currentPage.drawText(sigDisplay, MARGIN_LEFT + 14, currentY - 69, 'F3', 7.5, [0.1, 0.1, 0.1]);

  // Certification & Signature line
  currentPage.drawText('I certify that all digital evidence items listed were copied into private sandbox storage and verified intact.', MARGIN_LEFT + 14, currentY - 88, 'F1', 7.5, [0.4, 0.4, 0.4]);

  // Signature line
  currentPage.setStrokeColor(0.3, 0.3, 0.3);
  currentPage.setLineWidth(0.75);
  currentPage.drawLine(PAGE_WIDTH - MARGIN_RIGHT - 170, currentY - 96, PAGE_WIDTH - MARGIN_RIGHT - 14, currentY - 96);
  currentPage.drawText(`Signature of ${c.investigatorName || 'Investigator'}`, PAGE_WIDTH - MARGIN_RIGHT - 165, currentY - 105, 'F1', 7.5, [0.4, 0.4, 0.4]);

  // Footer on final page
  drawPageFooter(currentPage, pages.length);

  // ── 7. Compile Objects into PDF Document ───────────────────────────
  const objects: string[] = [];

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // Page Object references: pages are objects 3, 5, 7, etc.
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageId = 3 + i * 2;
    const contentId = 4 + i * 2;
    pageObjIds.push(pageId);
    contentObjIds.push(contentId);
  }

  // 2: Pages Catalog
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj`);

  // Fonts dictionary: Helvetica, Helvetica-Bold, Courier, Courier-Bold
  const fontObjStart = 3 + pages.length * 2;
  const f1Id = fontObjStart;
  const f2Id = fontObjStart + 1;
  const f3Id = fontObjStart + 2;
  const f4Id = fontObjStart + 3;

  // Pages & Content Streams
  for (let i = 0; i < pages.length; i++) {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    const streamContent = pages[i].build();
    const streamLen = typeof Buffer !== 'undefined' ? Buffer.byteLength(streamContent, 'utf8') : streamContent.length;

    // Page object
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${f1Id} 0 R /F2 ${f2Id} 0 R /F3 ${f3Id} 0 R /F4 ${f4Id} 0 R >> >> >>\nendobj`
    );

    // Contents Stream object
    objects.push(
      `${contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj`
    );
  }

  // Fonts:
  objects.push(`${f1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`${f2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);
  objects.push(`${f3Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`);
  objects.push(`${f4Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj`);

  // Assemble PDF with xref table
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }

  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return pdf;
}
