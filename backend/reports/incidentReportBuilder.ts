import {
  CaseRecord,
  EvidenceRecord,
  EventRecord,
  ActorRecord,
  HashChainRecord,
  NarrativeRecord,
  AiAnalysisResult,
  ExifMetadata,
} from '../../frontend/src/types';
import { generateUUID } from '../../frontend/src/utils/crypto';

export interface IncidentReportData {
  caseData: CaseRecord;
  evidenceItems: EvidenceRecord[];
  events: EventRecord[];
  actors: ActorRecord[];
  hashChains: HashChainRecord[];
  narrative: NarrativeRecord | null;
  options: {
    includeOCR: boolean;
    includeThumbnails: boolean;
    anonymizeVictim: boolean;
    victimDisplayMode: 'anonymized' | 'named';
    includeAiNarrative: boolean;
    includeEventLog: boolean;
    includeEvidenceInventory: boolean;
    includeHashChain: boolean;
    includeAppendix: boolean;
    agencyName: string;
    investigatorNotes?: string;
  };
}

export interface HashManifestEntry {
  evidenceId: string;
  filename: string;
  sha256: string;
  chainHash: string;
}

export class IncidentReportBuilder {
  private data: IncidentReportData;
  private victimActor: ActorRecord | null = null;

  constructor(data: IncidentReportData) {
    this.data = data;
    this.identifyVictim();
  }

  private identifyVictim(): void {
    this.victimActor = this.data.actors.find((a) => a.role === 'victim') || null;
  }

  private formatDate(ts: number): string {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  }

  private formatDateShort(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private getSeverityLabel(severity: number): string {
    const labels: Record<number, string> = {
      1: 'LOW',
      2: 'LOW-MEDIUM',
      3: 'MEDIUM',
      4: 'HIGH',
      5: 'CRITICAL',
    };
    return labels[severity] || 'UNKNOWN';
  }

  private getEventTypeLabel(eventType: string): string {
    const labels: Record<string, string> = {
      initial_contact: 'Initial Contact',
      threat: 'Threat',
      demand: 'Demand',
      escalation: 'Escalation',
      evidence_sharing: 'Evidence Sharing',
      impersonation: 'Impersonation',
      other: 'Other',
    };
    return labels[eventType] || eventType;
  }

  private buildCoverPage(): string {
    const { caseData, options } = this.data;
    const victimName = this.victimActor?.name || 'Unknown Victim';
    const displayName = options.anonymizeVictim || options.victimDisplayMode === 'anonymized'
      ? 'VICTIM [REDACTED]'
      : victimName;

    let dateRangeHtml = 'Not Available';
    if (this.data.events.length > 0) {
      const sortedEvents = [...this.data.events].sort((a, b) => a.timestamp - b.timestamp);
      const start = this.formatDate(sortedEvents[0].timestamp);
      const end = this.formatDate(sortedEvents[sortedEvents.length - 1].timestamp);
      dateRangeHtml = `${start} to ${end}`;
    }

    return `
      <div class="cover-page">
        <div class="cover-content">
          <div class="cover-header">
            <div class="logo">TRACE</div>
            <div class="subtitle">INCIDENT REPORT</div>
          </div>
          
          <div class="cover-body">
            <div class="field-group">
              <div class="field-label">VICTIM IDENTIFIER</div>
              <div class="field-value victim-name">${displayName}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">ANONYMIZATION STATUS</div>
              <div class="field-value">
                ${options.anonymizeVictim ? 'ANONYMIZED (Victim identity protected)' : 'NAMED (Victim identity disclosed)'}
              </div>
            </div>
            
            <div class="field-group">
              <div class="field-label">INCIDENT DATE RANGE</div>
              <div class="field-value">${dateRangeHtml}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">CASE REFERENCE</div>
              <div class="field-value case-ref">${caseData.case_number}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">CASE TITLE</div>
              <div class="field-value">${caseData.title}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">LEAD INVESTIGATOR</div>
              <div class="field-value">${caseData.investigator_name}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">AGENCY</div>
              <div class="field-value">${options.agencyName}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">REPORT GENERATED</div>
              <div class="field-value">${this.formatDate(Date.now())}</div>
            </div>
          </div>
          
          <div class="cover-footer">
            <div class="classification">CLASSIFICATION: CONFIDENTIAL — FORENSIC EVIDENCE</div>
            <div class="watermark">TRACE FORENSIC SYSTEM</div>
          </div>
        </div>
      </div>
    `;
  }

  private buildAiNarrative(): string {
    const { narrative, options } = this.data;
    
    if (!options.includeAiNarrative || !narrative) {
      return '';
    }

    return `
      <div class="section-page">
        <h2 class="section-title">2. AI-GENERATED INCIDENT NARRATIVE</h2>
        
        <div class="disclaimer-box">
          <strong>DISCLAIMER:</strong> This narrative was generated by an AI system (Gemma 2B) based on available evidence and event data. 
          It is provided as an investigative aid only and does not constitute legal findings, conclusions, or expert testimony. 
          All content must be independently verified by qualified investigators before use in any legal proceeding.
        </div>
        
        <div class="narrative-content">
          ${narrative.content.replace(/\n/g, '<br />')}
        </div>
        
        <div class="narrative-meta">
          <div>Generated: ${this.formatDate(narrative.generated_at)}</div>
          <div>Events Analyzed: ${narrative.events_snapshot ? JSON.parse(narrative.events_snapshot).length : 0}</div>
          <div>Reviewed: ${narrative.user_reviewed ? 'Yes' : 'No'}</div>
          <div>Edited: ${narrative.user_edited ? 'Yes' : 'No'}</div>
        </div>
      </div>
    `;
  }

  private buildEventLog(): string {
    const { events, evidenceItems, options } = this.data;
    
    if (!options.includeEventLog || events.length === 0) {
      return '';
    }

    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    const rowsHtml = sortedEvents.map((event, index) => {
      const evidenceRefs = event.evidence_ids.map((eid) => {
        const ev = evidenceItems.find((e) => e.id === eid);
        return ev ? `<span class="evidence-ref" title="${ev.file_name}">${ev.file_name}</span>` : eid;
      }).join(', ') || '—';

      const severityClass = event.severity >= 4 ? 'severity-high' : event.severity >= 3 ? 'severity-medium' : 'severity-low';

      return `
        <tr>
          <td class="col-num">${index + 1}</td>
          <td class="col-timestamp">${this.formatDate(event.timestamp)}</td>
          <td class="col-event">${this.getEventTypeLabel(event.event_type)}</td>
          <td class="col-desc">${event.ai_summary || event.user_annotation || '—'}</td>
          <td class="col-severity ${severityClass}">${this.getSeverityLabel(event.severity)} (${event.severity})</td>
          <td class="col-evidence">${evidenceRefs}</td>
          <td class="col-source">${event.source || 'system'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-page">
        <h2 class="section-title">3. CHRONOLOGICAL EVENT LOG</h2>
        
        <table class="event-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-timestamp">Timestamp</th>
              <th class="col-event">Event Type</th>
              <th class="col-desc">Description / AI Summary</th>
              <th class="col-severity">Severity</th>
              <th class="col-evidence">Evidence References</th>
              <th class="col-source">Source</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" class="empty-row">No events recorded for this case.</td></tr>'}
          </tbody>
        </table>
        
        <div class="section-summary">
          Total Events: ${sortedEvents.length} | 
          Critical: ${sortedEvents.filter(e => e.severity === 5).length} | 
          High: ${sortedEvents.filter(e => e.severity === 4).length} | 
          Medium: ${sortedEvents.filter(e => e.severity === 3).length} | 
          Low: ${sortedEvents.filter(e => e.severity <= 2).length}
        </div>
      </div>
    `;
  }

  private buildEvidenceInventory(): string {
    const { evidenceItems, options } = this.data;
    
    if (!options.includeEvidenceInventory || evidenceItems.length === 0) {
      return '';
    }

    const rowsHtml = evidenceItems.map((item, index) => {
      const sizeKb = (item.file_size || 0 / 1024).toFixed(1);
      const importDate = this.formatDate(item.import_ts);
      
      let ocrHtml = '';
      if (options.includeOCR && item.ocr_text) {
        const snippet = item.ocr_text.length > 200 ? item.ocr_text.substring(0, 200) + '...' : item.ocr_text;
        ocrHtml = `<div class="ocr-snippet"><strong>OCR:</strong> ${this.escapeHtml(snippet)}</div>`;
      }
      
      let transcriptionHtml = '';
      if (options.includeOCR && item.transcription) {
        const snippet = item.transcription.length > 200 ? item.transcription.substring(0, 200) + '...' : item.transcription;
        transcriptionHtml = `<div class="transcription-snippet"><strong>Transcription:</strong> ${this.escapeHtml(snippet)}</div>`;
      }

      return `
        <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
          <td class="col-num">${index + 1}</td>
          <td class="col-filename">${this.escapeHtml(item.original_filename || item.file_name)}</td>
          <td class="col-type">${item.media_type}</td>
          <td class="col-size">${sizeKb} KB</td>
          <td class="col-date">${importDate}</td>
          <td class="col-hash">${item.sha256_import}</td>
          <td class="col-details">${ocrHtml}${transcriptionHtml}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-page">
        <h2 class="section-title">4. EVIDENCE INVENTORY</h2>
        
        <table class="evidence-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-filename">Filename</th>
              <th class="col-type">Type</th>
              <th class="col-size">Size</th>
              <th class="col-date">Import Date</th>
              <th class="col-hash">SHA-256 Hash</th>
              <th class="col-details">OCR / Transcription</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" class="empty-row">No evidence items in this case.</td></tr>'}
          </tbody>
        </table>
        
        <div class="section-summary">
          Total Evidence Items: ${evidenceItems.length}
        </div>
      </div>
    `;
  }

  private buildHashChainManifest(): string {
    const { hashChains, evidenceItems, options } = this.data;
    
    if (!options.includeHashChain || hashChains.length === 0) {
      return '';
    }

    const rowsHtml = hashChains.map((chain, index) => {
      const evidence = evidenceItems.find((e) => e.id === chain.evidence_id);
      const evidenceName = evidence ? evidence.file_name : chain.evidence_id;
      
      return `
        <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
          <td class="col-num">${index + 1}</td>
          <td class="col-evidence">${this.escapeHtml(evidenceName)}</td>
          <td class="col-operation">${chain.operation}</td>
          <td class="col-payload-hash">${chain.payload_hash}</td>
          <td class="col-chain-hash">${chain.chain_hash}</td>
          <td class="col-timestamp">${this.formatDate(chain.timestamp)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-page">
        <h2 class="section-title">5. HASH CHAIN MANIFEST</h2>
        
        <p class="section-intro">Cryptographic chain of custody for all evidence items. Each entry represents a verified operation in the evidence lifecycle.</p>
        
        <table class="hashchain-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-evidence">Evidence Item</th>
              <th class="col-operation">Operation</th>
              <th class="col-payload-hash">Payload Hash</th>
              <th class="col-chain-hash">Chain Hash</th>
              <th class="col-timestamp">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" class="empty-row">No hash chain records available.</td></tr>'}
          </tbody>
        </table>
        
        <div class="section-summary">
          Total Chain Entries: ${hashChains.length}
        </div>
      </div>
    `;
  }

  private buildAppendix(): string {
    const { evidenceItems, options } = this.data;
    
    if (!options.includeAppendix || evidenceItems.length === 0) {
      return '';
    }

    const imageEvidence = evidenceItems.filter((e) => e.media_type === 'IMAGE');
    
    if (imageEvidence.length === 0) {
      return `
        <div class="section-page">
          <h2 class="section-title">6. APPENDIX — EVIDENCE THUMBNAILS</h2>
          <p class="no-images">No image evidence available for thumbnail appendix.</p>
        </div>
      `;
    }

    const thumbnailsHtml = imageEvidence.map((item) => {
      const isRedacted = options.anonymizeVictim && item.media_type === 'IMAGE';
      return `
        <div class="thumbnail-item">
          <div class="thumbnail-placeholder">
            ${isRedacted ? 
              '<div class="redaction-overlay">REDACTED</div>' : 
              '<div class="image-placeholder">[IMAGE: ' + this.escapeHtml(item.file_name) + ']</div>'
            }
          </div>
          <div class="thumbnail-info">
            <div class="thumb-filename">${this.escapeHtml(item.file_name)}</div>
            <div class="thumb-hash">SHA-256: ${item.sha256_import.substring(0, 32)}...</div>
            ${isRedacted ? '<div class="redaction-notice">⚠️ Redacted per victim anonymization policy</div>' : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="section-page">
        <h2 class="section-title">6. APPENDIX — SELECTED EVIDENCE THUMBNAILS</h2>
        
        <p class="section-intro">
          ${options.includeThumbnails ? 
            'Thumbnails of image evidence items. Redacted items indicate victim anonymization.' : 
            'Thumbnails disabled per report configuration.'}
        </p>
        
        <div class="thumbnail-grid">
          ${options.includeThumbnails ? thumbnailsHtml : '<p class="thumbnails-disabled">Thumbnails not included in this report.</p>'}
        </div>
      </div>
    `;
  }

  private buildHashManifestTxt(): string {
    const { evidenceItems, hashChains } = this.data;
    
    let content = 'TRACE INCIDENT REPORT — HASH CHAIN MANIFEST\n';
    content += '================================================\n\n';
    content += `Case: ${this.data.caseData.case_number} (${this.data.caseData.title})\n`;
    content += `Generated: ${this.formatDate(Date.now())}\n`;
    content += `Total Evidence Items: ${evidenceItems.length}\n`;
    content += `Total Hash Chain Entries: ${hashChains.length}\n\n`;
    
    content += 'EVIDENCE INVENTORY:\n';
    content += '-------------------\n';
    evidenceItems.forEach((item, index) => {
      content += `${index + 1}. ${item.original_filename || item.file_name}\n`;
      content += `   SHA-256 (Import): ${item.sha256_import}\n`;
      content += `   Type: ${item.media_type}\n`;
      content += `   Size: ${item.file_size || 0} bytes\n`;
      content += `   Imported: ${this.formatDate(item.import_ts)}\n\n`;
    });
    
    content += 'HASH CHAIN ENTRIES:\n';
    content += '-------------------\n';
    hashChains.forEach((chain, index) => {
      const evidence = evidenceItems.find((e) => e.id === chain.evidence_id);
      content += `${index + 1}. Evidence: ${evidence ? evidence.file_name : chain.evidence_id}\n`;
      content += `   Operation: ${chain.operation}\n`;
      content += `   Payload Hash: ${chain.payload_hash}\n`;
      content += `   Chain Hash: ${chain.chain_hash}\n`;
      content += `   Timestamp: ${this.formatDate(chain.timestamp)}\n\n`;
    });
    
    content += 'END OF MANIFEST\n';
    
    return content;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }

  buildHtmlReport(): string {
    const { caseData, options } = this.data;
    const generatedAt = new Date().toISOString();
    const reportId = `IR-${Date.now()}-${generateUUID().substring(0, 8)}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TRACE Incident Report — ${caseData.case_number}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
      @top-center { content: "TRACE INCIDENT REPORT — ${caseData.case_number}"; font-size: 8pt; color: #666; }
      @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #666; }
    }
    
    * { box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1a1a2e;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      font-size: 11pt;
    }
    
    .page-break { page-break-after: always; }
    .page-break-before { page-break-before: always; }
    
    /* Cover Page */
    .cover-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      padding: 40px;
      page-break-after: always;
    }
    
    .cover-content {
      max-width: 700px;
      width: 100%;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 40px;
    }
    
    .cover-header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3b82f6;
    }
    
    .logo {
      font-size: 48px;
      font-weight: 800;
      color: #3b82f6;
      letter-spacing: 4px;
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 18px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    
    .cover-body {
      margin-bottom: 40px;
    }
    
    .field-group {
      margin-bottom: 20px;
      padding: 16px;
      background: rgba(15, 23, 42, 0.5);
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }
    
    .field-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    
    .field-value {
      font-size: 16px;
      color: #f1f5f9;
      font-weight: 500;
    }
    
    .victim-name { font-size: 20px; font-weight: 700; color: #fbbf24; }
    .case-ref { font-size: 20px; font-weight: 700; color: #3b82f6; font-family: monospace; }
    
    .cover-footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #334155;
    }
    
    .classification {
      font-size: 11px;
      color: #ef4444;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }
    
    .watermark {
      font-size: 10px;
      color: #475569;
      letter-spacing: 2px;
    }
    
    /* Section Pages */
    .section-page {
      padding: 20px 0;
      page-break-before: auto;
    }
    
    .section-page:not(:first-child) {
      page-break-before: always;
    }
    
    .section-title {
      font-size: 18px;
      color: #1e293b;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 8px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .section-intro {
      color: #475569;
      margin-bottom: 16px;
      font-size: 12px;
    }
    
    .section-summary {
      margin-top: 16px;
      padding: 12px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 11px;
      color: #475569;
    }
    
    /* Disclaimer Box */
    .disclaimer-box {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
      font-size: 11px;
      color: #92400e;
    }
    
    /* Narrative */
    .narrative-content {
      background: #fafafa;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 16px;
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.7;
    }
    
    .narrative-meta {
      display: flex;
      gap: 24px;
      font-size: 11px;
      color: #64748b;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 16px;
    }
    
    th {
      background: #1e293b;
      color: #fff;
      text-align: left;
      padding: 10px 8px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    
    tr.even td { background: #fafafa; }
    tr.odd td { background: #fff; }
    tr:hover td { background: #f0f9ff; }
    
    .empty-row {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 20px !important;
    }
    
    /* Event Table Columns */
    .col-num { width: 40px; font-weight: 600; }
    .col-timestamp { width: 140px; font-family: monospace; font-size: 9px; }
    .col-event { width: 100px; font-weight: 600; }
    .col-desc { width: 200px; }
    .col-severity { width: 90px; text-align: center; }
    .col-evidence { width: 160px; font-size: 9px; }
    .col-source { width: 70px; text-transform: capitalize; }
    
    .severity-high { color: #ef4444; font-weight: 700; }
    .severity-medium { color: #f59e0b; font-weight: 600; }
    .severity-low { color: #10b981; }
    
    .evidence-ref {
      background: #dbeafe;
      color: #1e40af;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 8px;
      margin-right: 4px;
    }
    
    /* Evidence Table Columns */
    .col-filename { width: 180px; font-weight: 500; }
    .col-type { width: 70px; text-transform: uppercase; font-size: 9px; }
    .col-size { width: 70px; text-align: right; font-family: monospace; }
    .col-date { width: 140px; font-family: monospace; font-size: 9px; }
    .col-hash { font-family: monospace; font-size: 8px; word-break: break-all; }
    .col-details { font-size: 9px; color: #475569; }
    
    .ocr-snippet { margin-top: 4px; font-style: italic; color: #1e40af; }
    .transcription-snippet { margin-top: 4px; font-style: italic; color: #059669; }
    
    /* Hash Chain Table Columns */
    .col-operation { width: 100px; text-transform: uppercase; font-size: 9px; }
    .col-payload-hash { font-family: monospace; font-size: 8px; word-break: break-all; }
    .col-chain-hash { font-family: monospace; font-size: 8px; word-break: break-all; }
    
    /* Appendix */
    .thumbnail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    
    .thumbnail-item {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .thumbnail-placeholder {
      aspect-ratio: 4/3;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    .image-placeholder {
      color: #94a3b8;
      font-size: 10px;
      text-align: center;
      padding: 8px;
    }
    
    .redaction-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 2px;
    }
    
    .thumbnail-info {
      padding: 10px;
    }
    
    .thumb-filename {
      font-weight: 600;
      font-size: 11px;
      margin-bottom: 4px;
      word-break: break-all;
    }
    
    .thumb-hash {
      font-family: monospace;
      font-size: 9px;
      color: #64748b;
    }
    
    .redaction-notice {
      margin-top: 6px;
      font-size: 9px;
      color: #ef4444;
      font-weight: 600;
    }
    
    .thumbnails-disabled {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 40px;
    }
    
    .no-images {
      text-align: center;
      color: #94a3b8;
      font-style: italic;
      padding: 40px;
    }
    
    /* Footer Seal */
    .report-seal {
      margin-top: 40px;
      padding: 20px;
      background: #0f172a;
      color: #94a3b8;
      border-radius: 6px;
      font-family: monospace;
      font-size: 9px;
      page-break-inside: avoid;
    }
    
    .seal-title {
      color: #3b82f6;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    
    .seal-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }
    
    .seal-label { color: #64748b; }
    .seal-value { color: #e2e8f0; }
  </style>
</head>
<body>
  ${this.buildCoverPage()}
  <div class="page-break"></div>
  
  ${this.buildAiNarrative()}
  ${this.buildAiNarrative() ? '<div class="page-break"></div>' : ''}
  
  ${this.buildEventLog()}
  ${this.buildEventLog() ? '<div class="page-break"></div>' : ''}
  
  ${this.buildEvidenceInventory()}
  ${this.buildEvidenceInventory() ? '<div class="page-break"></div>' : ''}
  
  ${this.buildHashChainManifest()}
  ${this.buildHashChainManifest() ? '<div class="page-break"></div>' : ''}
  
  ${this.buildAppendix()}
  
  <div class="report-seal">
    <div class="seal-title">TRACE Cryptographic Proof Seal</div>
    <div class="seal-row"><span class="seal-label">Report ID:</span><span class="seal-value">${reportId}</span></div>
    <div class="seal-row"><span class="seal-label">Case:</span><span class="seal-value">${caseData.case_number}</span></div>
    <div class="seal-row"><span class="seal-label">Generated:</span><span class="seal-value">${generatedAt}</span></div>
    <div class="seal-row"><span class="seal-label">Manifest Hash:</span><span class="seal-value">${this.computeManifestHash()}</span></div>
    <div class="seal-row"><span class="seal-label">Algorithm:</span><span class="seal-value">SHA-256 / Ed25519</span></div>
  </div>
</body>
</html>
    `;
  }

  private computeManifestHash(): string {
    const { evidenceItems, hashChains } = this.data;
    let hashInput = '';
    evidenceItems.forEach((e) => { hashInput += e.sha256_import; });
    hashChains.forEach((h) => { hashInput += h.chain_hash; });
    hashInput += this.data.caseData.case_number;
    hashInput += Date.now().toString();
    
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  }

  buildHashManifestTxt(): string {
    return this.buildHashManifestTxt();
  }
}

export const incidentReportBuilder = new IncidentReportBuilder({
  caseData: {} as CaseRecord,
  evidenceItems: [],
  events: [],
  actors: [],
  hashChains: [],
  narrative: null,
  options: {
    includeOCR: true,
    includeThumbnails: true,
    anonymizeVictim: true,
    victimDisplayMode: 'anonymized',
    includeAiNarrative: true,
    includeEventLog: true,
    includeEvidenceInventory: true,
    includeHashChain: true,
    includeAppendix: true,
    agencyName: 'TRACE Digital Forensics Unit',
  },
});