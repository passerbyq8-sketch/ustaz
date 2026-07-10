#!/usr/bin/env node
// flip-stream-flag.cjs -- safely flip CALL_STREAM_SPEECH in index.html.
// Node reads/writes UTF-8 correctly (no BOM, no mojibake) -- unlike PowerShell Set-Content.
// Usage:  node flip-stream-flag.cjs on     (false -> true)
//         node flip-stream-flag.cjs off    (true  -> false)
const fs = require('fs');
const FILE = 'index.html';
const mode = (process.argv[2] || 'on').toLowerCase();
if (mode !== 'on' && mode !== 'off') { console.log('usage: node flip-stream-flag.cjs on|off'); process.exit(1); }
const FROM = mode === 'off' ? 'const CALL_STREAM_SPEECH = true;'  : 'const CALL_STREAM_SPEECH = false;';
const TO   = mode === 'off' ? 'const CALL_STREAM_SPEECH = false;' : 'const CALL_STREAM_SPEECH = true;';
let s = fs.readFileSync(FILE, 'utf8');
if (s.charCodeAt(0) === 0xFEFF) { console.log('[WARN] file starts with a BOM -- restore a clean copy first:  git restore index.html'); process.exit(1); }
const n = s.split(FROM).length - 1;
if (n === 0) { console.log('[SKIP] "' + FROM + '" not found (already ' + mode + '?)'); process.exit(1); }
if (n > 1)  { console.log('[FAIL] found ' + n + 'x -- ambiguous, no write'); process.exit(1); }
fs.writeFileSync(FILE, s.split(FROM).join(TO));
console.log('[OK] CALL_STREAM_SPEECH -> ' + (mode === 'off' ? 'false' : 'true') + ' (UTF-8 preserved, no BOM)');
