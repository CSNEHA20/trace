export class PdfBuilder {
  buildHtmlReport(caseData: Record<string, unknown>, evidenceItems: Array<Record<string, unknown>>): string {
    return `
      <html>
        <head><title>TRACE Forensic Report</title></head>
        <body>
          <h1>TRACE Forensic Evidence Case Report</h1>
          <p>Case ID: ${caseData.id || ''}</p>
          <p>Total Items: ${evidenceItems.length}</p>
        </body>
      </html>
    `;
  }
}

export const pdfBuilder = new PdfBuilder();
