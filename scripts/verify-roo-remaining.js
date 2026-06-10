const fs = require('fs');
const path = require('path');

function walk(dir) {
  let r = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory() && f !== 'node_modules' && f !== 'dist' && f !== '.git' && f !== '__tests__') {
      r = r.concat(walk(p));
    } else if (f.endsWith('.ts') && !f.includes('.spec.') && !f.includes('.test.') && !p.includes('__tests__')) {
      r.push(p);
    }
  }
  return r;
}

const files = walk('src');
let hits = [];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/"[^"]*\bRoo\b[^"]*"/);
    if (match) hits.push({ file: f, line: i + 1, text: match[0].substring(0, 80) });
  }
}
console.log('Remaining user-facing Vertex strings:', hits.length);
hits.forEach(h => console.log(h.file + ':' + h.line, h.text));