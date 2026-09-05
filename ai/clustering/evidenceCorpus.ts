import { EvidenceRecord } from '../../frontend/src/types';
import { EvidenceCorpus, EvidenceCorpusItem } from './eventTypes';

function fileNameOf(record: EvidenceRecord): string {
  const path = record.original_filename || record.file_path || record.id;
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || record.id;
}

function extractedText(ocr: string, transcript: string): string {
  return [ocr.trim(), transcript.trim()].filter(Boolean).join('\n');
}

/**
 * Gather OCR and transcription text only. Empty OCR contributes no body text.
 * Evidence order is stable by id so chunking and hashing stay deterministic.
 */
export function buildEvidenceCorpus(caseId: string, evidence: EvidenceRecord[]): EvidenceCorpus {
  const sorted = [...evidence].sort((a, b) => a.id.localeCompare(b.id));
  const items: EvidenceCorpusItem[] = sorted.map((record, index) => {
    const ocrText = (record.ocr_text || '').trim();
    const transcription = (record.transcription || '').trim();
    return {
      id: record.id,
      index: index + 1,
      token: `E${index + 1}`,
      fileName: fileNameOf(record),
      mediaType: record.media_type,
      importTs: record.import_ts,
      exifTs: record.exif_ts,
      userTs: record.user_ts,
      ocrText,
      transcription,
      extractedText: extractedText(ocrText, transcription),
    };
  });

  const catalogText = items
    .map((item) =>
      [
        `${item.token} id=${item.id}`,
        `file=${item.fileName}`,
        `media=${item.mediaType}`,
        `import_ts=${item.importTs}`,
        item.exifTs !== undefined ? `exif_ts=${item.exifTs}` : 'exif_ts=null',
        item.userTs !== undefined ? `user_ts=${item.userTs}` : 'user_ts=null',
        `has_ocr=${item.ocrText.length > 0}`,
        `has_transcript=${item.transcription.length > 0}`,
      ].join(' ')
    )
    .join('\n');

  const bodyText = items
    .filter((item) => item.extractedText.length > 0)
    .map((item) => {
      const blocks = [`[${item.token} ${item.id}]`];
      if (item.ocrText) blocks.push(`OCR:\n${item.ocrText}`);
      if (item.transcription) blocks.push(`TRANSCRIPT:\n${item.transcription}`);
      return blocks.join('\n');
    })
    .join('\n\n');

  return {
    caseId,
    items,
    catalogText,
    bodyText,
    combinedText: bodyText,
  };
}

export function resolveEvidenceRefs(
  refs: string[],
  corpus: EvidenceCorpus
): { resolved: EvidenceCorpusItem[]; unresolved: string[] } {
  const resolved: EvidenceCorpusItem[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  for (const raw of refs) {
    const ref = raw.trim();
    if (!ref) continue;
    const match =
      corpus.items.find((item) => item.id === ref) ||
      corpus.items.find((item) => item.token.toLowerCase() === ref.toLowerCase()) ||
      corpus.items.find((item) => item.fileName.toLowerCase() === ref.toLowerCase()) ||
      corpus.items.find((item) => item.fileName.toLowerCase().includes(ref.toLowerCase()) && ref.length >= 4);

    if (!match) {
      unresolved.push(ref);
      continue;
    }
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    resolved.push(match);
  }

  resolved.sort((a, b) => a.id.localeCompare(b.id));
  return { resolved, unresolved };
}
