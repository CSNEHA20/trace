const fs = require('fs');
const content = fs.readFileSync('F:\\SNEHA\\IQOO\\'26-Trace\\frontend\\src\\report\\IncidentReportGenerator.ts', 'utf8');
const fixed = content.replace(
  /\.replace\(\/&\/g, '&'\)/g,
  '.replace(/&/g, "&")'
);
fs.writeFileSync('F:\\SNEHA\\IQOO\\'26-Trace\\frontend\\src\\report\\IncidentReportGenerator.ts', fixed);
console.log('Fixed');