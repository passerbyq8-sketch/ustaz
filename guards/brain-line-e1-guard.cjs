// guards/brain-line-e1-guard.cjs -- ITEM E1 (32) -- 2026-10-15 brain-line
//
// THE SCHOLAR MODE IS SHORTER THAN THE DETAILED ONE, AND THE DEPTH WAS LOCKED TO THE FOUNDER. Measured on 7ba44481
// (side-brain-line-2026-10-15/items/32.md): WP03 (scholar) 3815 characters against WP02 (detailed) 4756 on the same
// question -- the scholar instruction (api/ask.js:279) carries none of the detailed mode's «وسّع»: no branching, no
// reasoning from each proof, no scholars' statement of the ruling, nothing for practice; and the instruction reached a
// reader only with the founder's token or DEPTH_FREE_TRIAL (api/ask.js:916-918).
//
// What this guard holds (the order, E1; the owner's decision (d)):
//   (1) the scholar instruction carries the four elements of the detailed one, for the non-khilafi question above all,
//       and keeps «هل تريد أن أزيدك من الأقوال؟» and the cap of four opinions;
//   (2) the instruction follows the mode the reader chose, with no founder token and no DEPTH_FREE_TRIAL (the choice in
//       the client is unchanged); the premium model and the deep budgets keep their lock (pricing is not this order's).
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));
let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}

(async () => {
  const ASK = await esm('api/ask.js');
  const s = ASK.buildDepthInstruction('scholar');
  console.log('-- 1. the scholar instruction');
  ok('the branching connected to the question', s.includes('تفريعاتِه المتّصلةَ بالسؤال'));
  ok('the reasoning from each proof', s.includes('وجهَ دلالةِ كلِّ دليلٍ'));
  ok('the scholars\' statement of the ruling', s.includes('قولَ أهلِ العلمِ في تقريرِه'));
  ok('what helps the reader act', s.includes('ما يُعينُ الطالبَ على العمل'));
  ok('...in the non-khilafi question above all', s.includes('وفي المسألةِ غيرِ الخلافيّةِ خاصّةً'));
  ok('«هل تريد أن أزيدك من الأقوال؟» stays', s.includes('هل تريد أن أزيدك من الأقوال؟'));
  ok('the cap of four stays', s.includes('حتّى أربعةَ أقوالٍ'));
  console.log('-- 2. the instruction follows the chosen mode');
  const src = fs.readFileSync(path.join(REPO, 'api/ask.js'), 'utf8');
  ok('instructionDepth is read from the request alone (the closed list), with no founder or trial condition',
    /const instructionDepth = readRequestedDepth\(body\.depth\);/.test(src));
  ok('the instruction is built from it', /const depthInstruction = band === 'adult' \? buildDepthInstruction\(instructionDepth\) : '';/.test(src));
  ok('the premium model keeps its lock', /const usePremium = band === 'adult' && \(effectiveDepth === 'deep' \|\| effectiveDepth === 'scholar'\);/.test(src)
    && /const effectiveDepth = mayRequestDepth \? readRequestedDepth\(body\.depth\) : undefined;/.test(src));
  console.log('');
  console.log((failures ? 'FAIL' : 'PASS') + ' brain-line-e1: ' + (checks - failures) + '/' + checks);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH ' + (e && e.stack || e)); process.exit(1); });
