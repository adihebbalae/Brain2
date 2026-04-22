import { readFileSync, writeFileSync } from 'fs';

const buf = readFileSync('.agents/state.json');

// Strip BOM if present
let content = (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF)
  ? buf.slice(3).toString('utf8')
  : buf.toString('utf8');

// Fix em dash corruption: the UTF-8 em dash (U+2014) was decoded as Windows-1252,
// turning bytes E2 80 94 into: â (U+00E2) + € (U+20AC) + " (U+201D, right curly quote)
content = content.replace(/\u00e2\u20ac\u201d/g, '\u2014'); // â€" -> —

// Replace remaining smart/curly quotes with ASCII double quote
// (TASK-036 structural delimiters were written with curly quotes)
content = content.replace(/[\u201c\u201d]/g, '"');

// Validate JSON
try {
  JSON.parse(content);
  console.log('JSON valid after fix');
} catch (e) {
  console.error('STILL BROKEN:', e.message.substring(0, 300));
  process.exit(1);
}

// Write back with UTF-8 BOM (for PowerShell 5 compatibility)
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
writeFileSync('.agents/state.json', Buffer.concat([bom, Buffer.from(content, 'utf8')]));
console.log('Fixed and written successfully.');
