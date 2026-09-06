const fs = require('fs');
const content = fs.readFileSync('src/report/IncidentReportGenerator.ts', 'utf8');
const fixed = content.replace(
  'private escapeHtml(text: string | undefined | null): string {\n    return text\n      .replace(/&/g, "&")',
  'private escapeHtml(text: string | undefined | null): string {\n    if (!text) return "";\n    return text\n      .replace(/&/g, "&")'
);
fs.writeFileSync('src/report/IncidentReportGenerator.ts', fixed);
console.log('Fixed implementation');