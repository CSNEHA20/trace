import RNHTMLtoPDF from 'react-native-html-to-pdf';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Sharing } from 'expo-sharing';
import {
  CaseRecord,
  EvidenceRecord,
  EventRecord,
  ActorRecord,
  HashChainRecord,
  NarrativeRecord,
} from '../types';
import {
  IncidentReportOptions,
  IncidentReportMetadata,
  CompleteIncidentReport,
  DEFAULT_INCIDENT_REPORT_OPTIONS,
} from '../types/report';
import { databaseService } from '../services/databaseService';
import { cryptoService } from '../services/cryptoService';
import { logger } from '../utils/logger';

export interface IncidentReportGenerationResult {
  pdfUri: string;
  htmlContent: string;
  manifestTxt: string;
  metadata: IncidentReportMetadata;
  manifestHash: string;
  digitalSignature: string;
}

class IncidentReportGenerator {
  private options: IncidentReportOptions;

  constructor(options?: Partial<IncidentReportOptions>) {
    this.options = { ...DEFAULT_INCIDENT_REPORT_OPTIONS, ...options };
  }

  async generateReport(caseId: string): Promise<IncidentReportGenerationResult | null> {
    try {
      logger.info(`Starting incident report generation for case ${caseId}`);

      // 1. Fetch all case data from local database
      const caseData = await databaseService.getCaseById(caseId);
      if (!caseData) {
        throw new Error(`Case ${caseId} not found`);
      }

      const evidenceItems = await databaseService.getEvidenceForCase(caseId);
      const events = await databaseService.getEventsForCase(caseId);
      const actors = await databaseService.getActorsForCase(caseId);
      const hashChains: HashChainRecord[] = [];
      
      for (const evidence of evidenceItems) {
        const chains = await databaseService.getHashChainForEvidence(evidence.id);
        hashChains.push(...chains);
      }

      const narrative = await databaseService.getLatestNarrativeForCase(caseId);

      // 2. Build the complete report data structure
      const reportData = await this.buildReportData(
        caseData,
        evidenceItems,
        events,
        actors,
        hashChains,
        narrative
      );

      // 3. Generate HTML content
      const htmlContent = this.buildHtmlReport(reportData);
      
      // 4. Generate manifest.txt
      const manifestTxt = this.buildManifestTxt(reportData);

      // 5. Compute manifest hash
      const manifestHash = await cryptoService.computeSHA256(htmlContent + manifestTxt);

      // 6. Compute digital signature
      const digitalSignature = await cryptoService.signPayload(manifestHash);

      // 7. Generate PDF using react-native-html-to-pdf
      const pdfUri = await this.generatePdf(htmlContent, caseData.case_number);

      // 8. Save manifest.txt to file system
      const manifestUri = await this.saveManifestTxt(manifestTxt, caseData.case_number);

      // 9. Create metadata
      const metadata: IncidentReportMetadata = {
        reportId: `IR-${Date.now()}-${this.generateShortId()}`,
        caseId: caseData.id,
        caseNumber: caseData.case_number,
        caseTitle: caseData.title,
        generatedAt: Date.now(),
        generatedBy: caseData.investigator_name,
        victimIdentifier: this.getVictimIdentifier(actors),
        incidentDateRange: this.getIncidentDateRange(events),
        evidenceCount: evidenceItems.length,
        eventCount: events.length,
        hashManifest: manifestHash,
        options: this.options,
        format: this.options.reportFormat,
        fileSize: await this.getFileSize(pdfUri),
        fileUri: pdfUri,
      };

      logger.info(`Incident report generated successfully: ${metadata.reportId}`);

      return {
        pdfUri,
        htmlContent,
        manifestTxt,
        metadata,
        manifestHash,
        digitalSignature,
      };
    } catch (error) {
      logger.error('Incident report generation failed', error);
      throw error;
    }
  }

  private async buildReportData(
    caseData: CaseRecord,
    evidenceItems: EvidenceRecord[],
    events: EventRecord[],
    actors: ActorRecord[],
    hashChains: HashChainRecord[],
    narrative: NarrativeRecord | null
  ): Promise<CompleteIncidentReport> {
    const victimActor = actors.find((a) => a.role === 'victim') || null;
    const victimIdentifier = victimActor?.name || 'Unknown Victim';
    
    let incidentDateRange: { start: number; end: number } | null = null;
    if (events.length > 0) {
      const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
      incidentDateRange = {
        start: sortedEvents[0].timestamp,
        end: sortedEvents[sortedEvents.length - 1].timestamp,
      };
    }

    // Build cover page data
    const coverPage = {
      victimIdentifier,
      victimDisplayMode: this.options.anonymizeVictim ? 'anonymized' as const : 'named' as const,
      incidentDateRange,
      caseReference: caseData.case_number,
      agencyName: this.options.agencyName,
      investigatorName: caseData.investigator_name,
      generatedAt: Date.now(),
    };

    // Build AI narrative
    const aiNarrative = narrative ? {
      id: narrative.id,
      caseId: narrative.case_id,
      content: narrative.content,
      generatedAt: narrative.generated_at,
      eventsSnapshot: narrative.events_snapshot ? JSON.parse(narrative.events_snapshot) : [],
      disclaimer: narrative.disclaimer,
      userReviewed: narrative.user_reviewed,
      userEdited: narrative.user_edited,
    } : null;

    // Build event log
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const eventLog = sortedEvents.map((event) => ({
      timestamp: event.timestamp,
      event: this.getEventTypeLabel(event.event_type),
      severity: event.severity,
      severityLabel: this.getSeverityLabel(event.severity),
      evidenceReferences: event.evidence_ids,
      aiSummary: event.ai_summary,
      source: event.source || 'system',
    }));

    // Build evidence inventory
    const evidenceInventory = evidenceItems.map((item) => ({
      filename: item.original_filename || item.file_name,
      type: item.media_type,
      importDate: item.import_ts,
      sha256: item.sha256_import,
      fileSize: item.file_size || 0,
      mimeType: item.media_type,
      originalFilename: item.original_filename,
      ocrText: item.ocr_text,
      transcription: item.transcription,
    }));

    // Build hash chain
    const hashChain = hashChains.map((chain) => ({
      id: chain.id,
      evidenceId: chain.evidence_id,
      operation: chain.operation,
      payloadHash: chain.payload_hash,
      chainHash: chain.chain_hash,
      timestamp: chain.timestamp,
    }));

    // Build appendix
    const imageEvidence = evidenceItems.filter((e) => e.media_type === 'IMAGE');
    const appendix = imageEvidence.map((item) => ({
      evidenceId: item.id,
      filename: item.file_name,
      type: item.media_type,
      isRedacted: this.options.anonymizeVictim,
      redactionReason: this.options.anonymizeVictim ? 'Victim anonymization policy' : undefined,
    }));

    // Metadata
    const metadata: IncidentReportMetadata = {
      reportId: `IR-${Date.now()}-${this.generateShortId()}`,
      caseId: caseData.id,
      caseNumber: caseData.case_number,
      caseTitle: caseData.title,
      generatedAt: Date.now(),
      generatedBy: caseData.investigator_name,
      victimIdentifier,
      incidentDateRange,
      evidenceCount: evidenceItems.length,
      eventCount: events.length,
      hashManifest: '', // Will be computed later
      options: this.options,
      format: this.options.reportFormat,
    };

    return {
      metadata,
      coverPage,
      aiNarrative,
      eventLog,
      evidenceInventory,
      hashChain,
      appendix,
    };
  }

  private buildHtmlReport(reportData: CompleteIncidentReport): string {
    const { coverPage, aiNarrative, eventLog, evidenceInventory, hashChain, appendix, metadata } = reportData;
    const generatedAt = new Date().toISOString();

    // Build cover page
    const displayName = coverPage.victimDisplayMode === 'anonymized' 
      ? 'VICTIM [REDACTED]' 
      : coverPage.victimIdentifier;

    let dateRangeHtml = 'Not Available';
    if (coverPage.incidentDateRange) {
      const start = new Date(coverPage.incidentDateRange.start).toLocaleString();
      const end = new Date(coverPage.incidentDateRange.end).toLocaleString();
      dateRangeHtml = `${start} to ${end}`;
    }

    const coverPageHtml = `
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
                ${coverPage.victimDisplayMode === 'anonymized' ? 'ANONYMIZED (Victim identity protected)' : 'NAMED (Victim identity disclosed)'}
              </div>
            </div>
            
            <div class="field-group">
              <div class="field-label">INCIDENT DATE RANGE</div>
              <div class="field-value">${dateRangeHtml}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">CASE REFERENCE</div>
              <div class="field-value case-ref">${coverPage.caseReference}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">CASE TITLE</div>
              <div class="field-value">${metadata.caseTitle}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">LEAD INVESTIGATOR</div>
              <div class="field-value">${coverPage.investigatorName}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">AGENCY</div>
              <div class="field-value">${coverPage.agencyName}</div>
            </div>
            
            <div class="field-group">
              <div class="field-label">REPORT GENERATED</div>
              <div class="field-value">${new Date(coverPage.generatedAt).toLocaleString()}</div>
            </div>
          </div>
          
          <div class="cover-footer">
            <div class="classification">CLASSIFICATION: CONFIDENTIAL — FORENSIC EVIDENCE</div>
            <div class="watermark">TRACE FORENSIC SYSTEM</div>
          </div>
        </div>
      </div>
    `;

    // Build AI narrative
    const aiNarrativeHtml = aiNarrative && this.options.includeAiNarrative ? `
      <div class="section-page">
        <h2 class="section-title">2. AI-GENERATED INCIDENT NARRATIVE</h2>
        
        <div class="disclaimer-box">
          <strong>DISCLAIMER:</strong> This narrative was generated by an AI system (Gemma 2B) based on available evidence and event data. 
          It is provided as an investigative aid only and does not constitute legal findings, conclusions, or expert testimony. 
          All content must be independently verified by qualified investigators before use in any legal proceeding.
        </div>
        
        <div class="narrative-content">
          ${aiNarrative.content.replace(/\n/g, '<br />')}
        </div>
        
        <div class="narrative-meta">
          <div>Generated: ${new Date(aiNarrative.generatedAt).toLocaleString()}</div>
          <div>Events Analyzed: ${aiNarrative.eventsSnapshot.length}</div>
          <div>Reviewed: ${aiNarrative.userReviewed ? 'Yes' : 'No'}</div>
          <div>Edited: ${aiNarrative.userEdited ? 'Yes' : 'No'}</div>
        </div>
      </div>
    ` : '';

    // Build event log
    const eventLogHtml = this.options.includeEventLog && eventLog.length > 0 ? `
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
            ${eventLog.map((event, index) => {
              const evidenceRefs = event.evidenceReferences.map((eid) => 
                `<span class="evidence-ref" title="${eid}">${eid.substring(0, 12)}</span>`
              ).join(', ') || '—';

              const severityClass = event.severity >= 4 ? 'severity-high' : event.severity >= 3 ? 'severity-medium' : 'severity-low';

              return `
                <tr>
                  <td class="col-num">${index + 1}</td>
                  <td class="col-timestamp">${new Date(event.timestamp).toLocaleString()}</td>
                  <td class="col-event">${event.event}</td>
                  <td class="col-desc">${event.aiSummary || '—'}</td>
                  <td class="col-severity ${severityClass}">${event.severityLabel} (${event.severity})</td>
                  <td class="col-evidence">${evidenceRefs}</td>
                  <td class="col-source">${event.source}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="section-summary">
          Total Events: ${eventLog.length} | 
          Critical: ${eventLog.filter(e => e.severity === 5).length} | 
          High: ${eventLog.filter(e => e.severity === 4).length} | 
          Medium: ${eventLog.filter(e => e.severity === 3).length} | 
          Low: ${eventLog.filter(e => e.severity <= 2).length}
        </div>
      </div>
    ` : '';

    // Build evidence inventory
    const evidenceInventoryHtml = this.options.includeEvidenceInventory && evidenceInventory.length > 0 ? `
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
            ${evidenceInventory.map((item, index) => {
              const sizeKb = (item.fileSize / 1024).toFixed(1);
              const importDate = new Date(item.importDate).toLocaleString();
              
              let ocrHtml = '';
              if (this.options.includeOCR && item.ocrText) {
                const snippet = item.ocrText.length > 200 ? item.ocrText.substring(0, 200) + '...' : item.ocrText;
                ocrHtml = `<div class="ocr-snippet"><strong>OCR:</strong> ${this.escapeHtml(snippet)}</div>`;
              }
              
              let transcriptionHtml = '';
              if (this.options.includeOCR && item.transcription) {
                const snippet = item.transcription.length > 200 ? item.transcription.substring(0, 200) + '...' : item.transcription;
                transcriptionHtml = `<div class="transcription-snippet"><strong>Transcription:</strong> ${this.escapeHtml(snippet)}</div>`;
              }

              return `
                <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
                  <td class="col-num">${index + 1}</td>
                  <td class="col-filename">${this.escapeHtml(item.filename)}</td>
                  <td class="col-type">${item.type}</td>
                  <td class="col-size">${sizeKb} KB</td>
                  <td class="col-date">${importDate}</td>
                  <td class="col-hash">${item.sha256}</td>
                  <td class="col-details">${ocrHtml}${transcriptionHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="section-summary">
          Total Evidence Items: ${evidenceInventory.length}
        </div>
      </div>
    ` : '';

    // Build hash chain
    const hashChainHtml = this.options.includeHashChain && hashChain.length > 0 ? `
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
            ${hashChain.map((chain, index) => `
              <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
                <td class="col-num">${index + 1}</td>
                <td class="col-evidence">${chain.evidenceId.substring(0, 16)}</td>
                <td class="col-operation">${chain.operation}</td>
                <td class="col-payload-hash">${chain.payloadHash}</td>
                <td class="col-chain-hash">${chain.chainHash}</td>
                <td class="col-timestamp">${new Date(chain.timestamp).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="section-summary">
          Total Chain Entries: ${hashChain.length}
        </div>
      </div>
    ` : '';

    // Build appendix
    const appendixHtml = this.options.includeAppendix && appendix.length > 0 ? `
      <div class="section-page">
        <h2 class="section-title">6. APPENDIX — SELECTED EVIDENCE THUMBNAILS</h2>
        
        <p class="section-intro">
          ${this.options.includeThumbnails ? 
            'Thumbnails of image evidence items. Redacted items indicate victim anonymization.' : 
            'Thumbnails disabled per report configuration.'}
        </p>
        
        <div class="thumbnail-grid">
          ${this.options.includeThumbnails ? appendix.map((item) => `
            <div class="thumbnail-item">
              <div class="thumbnail-placeholder">
                ${item.isRedacted ? 
                  '<div class="redaction-overlay">REDACTED</div>' : 
                  `<div class="image-placeholder">[IMAGE: ${this.escapeHtml(item.filename)}]</div>`
                }
              </div>
              <div class="thumbnail-info">
                <div class="thumb-filename">${this.escapeHtml(item.filename)}</div>
                <div class="thumb-hash">SHA-256: ${item.evidenceId.substring(0, 16)}...</div>
                ${item.isRedacted ? '<div class="redaction-notice">⚠️ Redacted per victim anonymization policy</div>' : ''}
              </div>
            </div>
          `).join('') : '<p class="thumbnails-disabled">Thumbnails not included in this report.</p>'}
        </div>
      </div>
    ` : '';

    // Full HTML
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TRACE Incident Report — ${metadata.caseNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
      @top-center { content: "TRACE INCIDENT REPORT — ${metadata.caseNumber}"; font-size: 8pt; color: #666; }
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
  ${coverPageHtml}
  <div class="page-break"></div>
  
  ${aiNarrativeHtml}
  ${aiNarrativeHtml ? '<div class="page-break"></div>' : ''}
  
  ${this.options.investigatorNotes ? `
  <div class="section-page">
    <h2 class="section-title">INVESTIGATOR NOTES</h2>
    <div class="investigator-notes">
      ${this.escapeHtml(this.options.investigatorNotes).replace(/\n/g, '<br />')}
    </div>
  </div>
  <div class="page-break"></div>
  ` : ''}
  
  ${eventLogHtml}
  ${eventLogHtml ? '<div class="page-break"></div>' : ''}
  
  ${evidenceInventoryHtml}
  ${evidenceInventoryHtml ? '<div class="page-break"></div>' : ''}
  
  ${hashChainHtml}
  ${hashChainHtml ? '<div class="page-break"></div>' : ''}
  
  ${appendixHtml}
  
  <div class="report-seal">
    <div class="seal-title">TRACE Cryptographic Proof Seal</div>
    <div class="seal-row"><span class="seal-label">Report ID:</span><span class="seal-value">${metadata.reportId}</span></div>
    <div class="seal-row"><span class="seal-label">Case:</span><span class="seal-value">${metadata.caseNumber}</span></div>
    <div class="seal-row"><span class="seal-label">Generated:</span><span class="seal-value">${generatedAt}</span></div>
    <div class="seal-row"><span class="seal-label">Manifest Hash:</span><span class="seal-value">${metadata.hashManifest || 'PENDING'}</span></div>
    <div class="seal-row"><span class="seal-label">Algorithm:</span><span class="seal-value">SHA-256 / Ed25519</span></div>
  </div>
</body>
</html>
    `;
  }

  private buildManifestTxt(reportData: CompleteIncidentReport): string {
    const { evidenceInventory, hashChain, metadata } = reportData;
    
    let content = 'TRACE INCIDENT REPORT — HASH CHAIN MANIFEST\n';
    content += '================================================\n\n';
    content += `Case: ${metadata.caseNumber} (${metadata.caseTitle})\n`;
    content += `Report ID: ${metadata.reportId}\n`;
    content += `Generated: ${new Date(metadata.generatedAt).toISOString()}\n`;
    content += `Investigator: ${metadata.generatedBy}\n`;
    content += `Victim: ${metadata.victimIdentifier} (${metadata.victimIdentifier === 'Unknown Victim' ? 'N/A' : 'Protected'})\n`;
    content += `Incident Date Range: ${metadata.incidentDateRange ? 
      `${new Date(metadata.incidentDateRange.start).toISOString()} to ${new Date(metadata.incidentDateRange.end).toISOString()}` : 'N/A'
    }\n`;
    content += `Total Evidence Items: ${metadata.evidenceCount}\n`;
    content += `Total Events: ${metadata.eventCount}\n`;
    content += `Total Hash Chain Entries: ${hashChain.length}\n\n`;
    
    content += 'EVIDENCE INVENTORY:\n';
    content += '-------------------\n';
    evidenceInventory.forEach((item, index) => {
      content += `${index + 1}. ${item.filename}\n`;
      content += `   SHA-256 (Import): ${item.sha256}\n`;
      content += `   Type: ${item.type}\n`;
      content += `   Size: ${item.fileSize} bytes\n`;
      content += `   Imported: ${new Date(item.importDate).toISOString()}\n`;
      if (this.options.includeOCR && item.ocrText) {
        content += `   OCR Text: ${item.ocrText.substring(0, 100)}...\n`;
      }
      content += '\n';
    });
    
    content += 'HASH CHAIN ENTRIES:\n';
    content += '-------------------\n';
    hashChain.forEach((chain, index) => {
      content += `${index + 1}. Evidence: ${chain.evidenceId}\n`;
      content += `   Operation: ${chain.operation}\n`;
      content += `   Payload Hash: ${chain.payloadHash}\n`;
      content += `   Chain Hash: ${chain.chainHash}\n`;
      content += `   Timestamp: ${new Date(chain.timestamp).toISOString()}\n\n`;
    });
    
    content += 'END OF MANIFEST\n';
    
    return content;
  }

  private async generatePdf(htmlContent: string, caseNumber: string): Promise<string> {
    const filename = `TRACE_Incident_Report_${caseNumber}_${Date.now()}.pdf`;
    
    try {
      const options = {
        html: htmlContent,
        fileName: filename,
        directory: 'Documents',
        base64: false,
      };

      const result = await RNHTMLtoPDF.convert(options);
      
      if (result && result.filePath) {
        return Platform.OS === 'ios' ? result.filePath.replace('file://', '') : result.filePath;
      }
      
      throw new Error('PDF generation returned no file path');
    } catch (error) {
      logger.warn('react-native-html-to-pdf failed, trying expo-print fallback', error);
      
      // Fallback to expo-print
      try {
        const { printToFileAsync } = await import('expo-print');
        const file = await printToFileAsync({
          html: htmlContent,
          base64: false,
        });
        
        if (file && file.uri) {
          return file.uri;
        }
      } catch (fallbackError) {
        logger.error('expo-print fallback also failed', fallbackError);
      }
      
      // Last resort: save HTML as file
      const htmlUri = `${FileSystem.documentDirectory}exports/${filename.replace('.pdf', '.html')}`;
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}exports`, { intermediates: true });
      await FileSystem.writeAsStringAsync(htmlUri, htmlContent);
      
      return htmlUri;
    }
  }

  private async saveManifestTxt(manifestTxt: string, caseNumber: string): Promise<string> {
    const filename = `TRACE_Manifest_${caseNumber}_${Date.now()}.txt`;
    const dir = `${FileSystem.documentDirectory}exports`;
    const uri = `${dir}/${filename}`;
    
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.writeAsStringAsync(uri, manifestTxt);
    
    return uri;
  }

  private async getFileSize(uri: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.size || 0;
    } catch {
      return 0;
    }
  }

  private getVictimIdentifier(actors: ActorRecord[]): string {
    const victim = actors.find((a) => a.role === 'victim');
    return victim?.name || 'Unknown Victim';
  }

  private getIncidentDateRange(events: EventRecord[]): { start: number; end: number } | null {
    if (events.length === 0) return null;
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    return {
      start: sorted[0].timestamp,
      end: sorted[sorted.length - 1].timestamp,
    };
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

  private escapeHtml(text: string | undefined | null): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&")
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async shareReport(pdfUri: string, manifestUri?: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        logger.warn('Sharing not available on this platform');
        return false;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share TRACE Incident Report',
        UTI: 'com.adobe.pdf',
      });

      if (manifestUri) {
        await Sharing.shareAsync(manifestUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Share TRACE Hash Manifest',
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to share report', error);
      return false;
    }
  }

  updateOptions(options: Partial<IncidentReportOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): IncidentReportOptions {
    return { ...this.options };
  }
}

export const incidentReportGenerator = new IncidentReportGenerator();