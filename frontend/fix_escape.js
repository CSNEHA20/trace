const fs = require('fs');
const content = fs.readFileSync('src/report/IncidentReportGenerator.ts', 'utf8');
const fixed = content.replace(
  /\.replace\(\/&\/g, '&'\)/g,
  '.replace(/&/g, "&")'
);
fs.writeFileSync('src/report/IncidentReportGenerator.ts', fixed);
console.log('Fixed');