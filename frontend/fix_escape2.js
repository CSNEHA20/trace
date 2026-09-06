const fs = require('fs');
const content = fs.readFileSync('src/report/IncidentReportGenerator.ts', 'utf8');
const fixed = content.replace(
  'private escapeHtml(text: string): string {',
  'private escapeHtml(text: string | undefined | null): string {'
);
fs.writeFileSync('src/report/IncidentReportGenerator.ts', fixed);
console.log('Fixed type');