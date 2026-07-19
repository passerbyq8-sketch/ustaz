#!/usr/bin/env node
/*
 * recon-audit.cjs  --  READ-ONLY structural audit for Al-Murabbi (repo: ustaz)
 * -------------------------------------------------------------------------
 * SAFE: reads files + git metadata ONLY. Writes NOTHING. Commits NOTHING.
 * Auto-ignored by the existing .gitignore (recon-*.cjs pattern).
 * Run from the repo root:  node recon-audit.cjs
 *
 * WARN / "not found" on a marker usually just means the token name differs
 * or the documented state changed -- it is a signal to eyeball, not proof of a bug.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');

const ROOT = process.cwd();
let P = 0, W = 0, F = 0;
const FAILS = [];
const NL = /\r?\n/;

function pass(m){ P++; console.log('  [PASS] ' + m); }
function warn(m){ W++; console.log('  [WARN] ' + m); }
function fail(m){ F++; FAILS.push(m); console.log('  [FAIL] ' + m); }
function info(m){ console.log('  [INFO] ' + m); }
function head(t){ console.log('\n=== ' + t + ' ==='); }

function read(rel){ try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch(e){ return null; } }
function readBuf(rel){ try { return fs.readFileSync(path.join(ROOT, rel)); } catch(e){ return null; } }
function stat(rel){ try { return fs.statSync(path.join(ROOT, rel)); } catch(e){ return null; } }
function git(args){
  try { return cp.execSync('git ' + args, { cwd: ROOT, stdio: ['ignore','pipe','ignore'] }).toString(); }
  catch(e){ return null; }
}
function kb(n){ return (n/1024).toFixed(1) + ' KB'; }

// line-numbered search
function grepLines(src, re){
  const out = [];
  const lines = src.split(NL);
  for (let i=0;i<lines.length;i++){ if (re.test(lines[i])) out.push({ n:i+1, t:lines[i] }); re.lastIndex=0; }
  return out;
}
function extractArrayBody(src, name){
  const i = src.indexOf(name); if (i<0) return null;
  const b = src.indexOf('[', i); if (b<0) return null;
  const e = src.indexOf(']', b); if (e<0) return null;
  return src.slice(b+1, e);
}
function domainsIn(body){
  if (!body) return [];
  const out=[]; const re=/['"]([a-z0-9.\-]+\.[a-z]{2,})['"]/gi; let m;
  while((m=re.exec(body))) out.push(m[1]);
  return out;
}

console.log('==================================================================');
console.log(' Al-Murabbi  ::  recon-audit  (read-only, writes nothing)');
console.log(' root: ' + ROOT);
console.log(' time: ' + new Date().toISOString());
console.log('==================================================================');

const isRepo = !!git('rev-parse --is-inside-work-tree');
if (!isRepo) warn('not a git repo here (git checks will be skipped -- run from C:\\Users\\passe\\projects\\ustaz)');

const trackedRaw = isRepo ? (git('ls-files') || '') : '';
const TRACKED = trackedRaw.split(NL).map(s=>s.trim()).filter(Boolean);
const TRACKED_SET = new Set(TRACKED);

/* ---------------------------------------------------------------- *
 * 1) FILE INVENTORY
 * ---------------------------------------------------------------- */
head('1) FILE INVENTORY');
const EXPECT = [
  { rel:'index.html',                  mustTrack:true  },
  { rel:'quest.html',                  mustTrack:true  },
  { rel:'api/ask.js',                  mustTrack:true  },
  { rel:'api/chat.js',                 mustTrack:true  },
  { rel:'api/chat-fast.js',            mustTrack:true  },
  { rel:'api/tts.js',                  mustTrack:true  },
  { rel:'api/tashkeel.js',             mustTrack:true  },
  { rel:'api/report.js',               mustTrack:true  },
  { rel:'lib/retrieve.js',             mustTrack:true  },
  { rel:'lib/encyclopedia.js',         mustTrack:true  },
  { rel:'lib/ratelimit.js',            mustTrack:true  },
  { rel:'lib/limit-message.js',        mustTrack:true  },
  { rel:'lib/data/adhkar.json',        mustTrack:true  },
  { rel:'quran-uthmani.json',          mustTrack:true  },
  { rel:'quest-data/trivia-golden.json',mustTrack:true  },
  { rel:'quest-data/world.json',        mustTrack:true  },
  { rel:'quest-data/rewards.json',      mustTrack:true  },
  { rel:'lib/data/fiqh-search.json.gz',mustTrack:true  },
  { rel:'babel-gate.cjs',              mustTrack:true  },
  { rel:'runtime-gate.cjs',            mustTrack:true  },
  { rel:'worship-guard.cjs',           mustTrack:true  },
  { rel:'worship-golden.json',         mustTrack:true  },
  { rel:'referral-golden.json',        mustTrack:true  },
  { rel:'package.json',                mustTrack:true  },
  { rel:'.gitignore',                  mustTrack:true  },
  { rel:'khilaf-policy.md',            mustTrack:false },
  { rel:'vercel.json',                 mustTrack:false },
  { rel:'package-lock.json',           mustTrack:false },
];
for (const f of EXPECT){
  const s = stat(f.rel);
  if (s){
    if (f.rel === 'index.html'){
      const src = read(f.rel) || '';
      pass(f.rel + '  (' + kb(s.size) + ', ' + src.split(NL).length + ' lines)');
    } else {
      pass(f.rel + '  (' + kb(s.size) + ')');
    }
  } else {
    if (f.mustTrack) fail('MISSING: ' + f.rel);
    else info('absent (optional): ' + f.rel);
  }
}

/* ---------------------------------------------------------------- *
 * 2) GIT INTEGRITY & TRACKING
 * ---------------------------------------------------------------- */
head('2) GIT INTEGRITY & TRACKING');
if (isRepo){
  const shortHead = (git('rev-parse --short HEAD') || '').trim();
  info('HEAD = ' + shortHead + '   (handoff documents b3bd4b1)');
  if (shortHead && shortHead.indexOf('b3bd4b1') !== 0) warn('HEAD differs from documented b3bd4b1 -- fine if you committed since.');
  const porcelain = (git('status --porcelain') || '').trim();
  if (!porcelain) pass('working tree clean');
  else { info('working tree has uncommitted changes:'); porcelain.split(NL).forEach(l=>info('    ' + l)); }

  // runtime assets that MUST ship to Vercel
  const MUST = ['quran-uthmani.json','lib/data/adhkar.json','lib/data/fiqh-search.json.gz'];
  for (const m of MUST){
    if (TRACKED_SET.has(m)) pass('tracked (ships to Vercel): ' + m);
    else fail('runtime asset NOT tracked -> deploy will lack it: ' + m);
  }

  // things that must NEVER be tracked
  const banned = [
    { re:/(^|\/)\.env($|\.)/i,        label:'.env secret file' },
    { re:/\.bak$/i,                   label:'.bak backup' },
    { re:/^probe-/i,                  label:'probe- temp' },
    { re:/^apply-.*\.cjs$/i,          label:'apply-*.cjs temp' },
    { re:/^recon-.*\.cjs$/i,          label:'recon-*.cjs temp' },
    { re:/^fix-.*\.cjs$/i,            label:'fix-*.cjs temp' },
    { re:/^payload-.*\.txt$/i,        label:'payload-*.txt temp' },
    { re:/\.cjs\.txt$/i,              label:'*.cjs.txt temp' },
    { re:/(^|\/)\.vercel(\/|$)/i,     label:'.vercel dir' },
    { re:/(^|\/)node_modules(\/|$)/i, label:'node_modules' },
  ];
  let bannedHits = 0;
  for (const t of TRACKED){
    for (const b of banned){
      if (b.re.test(t)){ if (t === 'recon-audit.cjs') continue; /* bug 43: this guard is intentionally tracked */ bannedHits++; fail('SHOULD NOT be tracked (' + b.label + '): ' + t); }
    }
  }
  if (!bannedHits) pass('no temp/secret/build files are tracked');
} else {
  info('skipped (not a git repo here)');
}

/* ---------------------------------------------------------------- *
 * 3) .gitignore COVERAGE
 * ---------------------------------------------------------------- */
head('3) .gitignore COVERAGE');
{
  const gi = read('.gitignore');
  if (gi === null) fail('.gitignore missing');
  else {
    const need = ['.env','*.bak','apply-*.cjs','recon-*.cjs','fix-*.cjs','probe-*.mjs','probe-*.txt','payload-*.txt','*.cjs.txt','.vercel','node_modules'];
    for (const n of need){
      if (gi.split(NL).some(l=>l.trim()===n || l.trim().startsWith(n))) pass('ignored: ' + n);
      else warn('pattern not found in .gitignore: ' + n + '  (you never run "git add ." so lower risk, but add it)');
    }
  }
}

/* ---------------------------------------------------------------- *
 * 4) SECRET LEAK SCAN (tracked text files)  -- values are REDACTED
 * ---------------------------------------------------------------- */
head('4) SECRET LEAK SCAN (tracked files, values redacted)');
{
  const textExt = /\.(js|cjs|mjs|html|json|md|txt|yml|yaml|env)$/i;
  const targets = isRepo ? TRACKED.filter(t=>textExt.test(t)) : [];
  const patterns = [
    { re:/sk-ant-[A-Za-z0-9_\-]{6,}/,                             label:'Anthropic key literal' },
    { re:/https:\/\/[a-z0-9\-]+\.upstash\.io/i,                   label:'Upstash URL literal' },
    { re:/(?:api[_-]?key|secret|token|passwd|password|bearer)\s*[:=]\s*['"][^'"]{16,}['"]/i, label:'generic secret literal' },
    { re:/(ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|BRAVE_API_KEY|UPSTASH_REDIS_REST_(URL|TOKEN))\s*[:=]\s*['"]/, label:'env-name assigned a literal' },
  ];
  let hits = 0;
  for (const rel of targets){
    const src = read(rel); if (src === null) continue;
    const lines = src.split(NL);
    for (let i=0;i<lines.length;i++){
      const line = lines[i];
      if (line.indexOf('process.env') !== -1) continue; // proper usage
      for (const p of patterns){
        if (p.re.test(line)){ hits++; fail('possible secret (' + p.label + ') in ' + rel + ':' + (i+1) + '  -> <REDACTED>'); }
        p.re.lastIndex = 0;
      }
    }
  }
  if (isRepo && !hits) pass('no hardcoded secrets found in tracked files');
  if (!isRepo) info('skipped (needs git-tracked file list)');
}

/* ---------------------------------------------------------------- *
 * 5) ENV VARS REFERENCED (what Vercel MUST have set)
 * ---------------------------------------------------------------- */
head('5) ENV VARS REFERENCED IN SERVER CODE');
{
  const files = ['api/ask.js','api/chat.js','api/chat-fast.js','api/tts.js','api/tashkeel.js',
                 'lib/retrieve.js','lib/encyclopedia.js','lib/ratelimit.js','lib/limit-message.js'];
  const seen = new Set();
  for (const f of files){
    const src = read(f); if (!src) continue;
    const re = /process\.env\.([A-Z0-9_]+)/g; let m;
    while((m=re.exec(src))) seen.add(m[1]);
  }
  if (seen.size){
    info('these MUST be set in Vercel (Project Settings > Environment Variables):');
    [...seen].sort().forEach(v=>info('    ' + v));
    const wanted = ['ANTHROPIC_API_KEY','ELEVENLABS_API_KEY','BRAVE_API_KEY'];
    for (const w of wanted){ if (!seen.has(w)) warn('expected env var not referenced anywhere: ' + w); }
  } else warn('no process.env.* references found (unexpected)');
}

/* ---------------------------------------------------------------- *
 * 6) DEPENDENCY MANIFEST vs ACTUAL IMPORTS
 * ---------------------------------------------------------------- */
head('6) DEPENDENCIES: declared vs used');
{
  const pkgRaw = read('package.json');
  let deps = {};
  if (pkgRaw){
    try {
      const pkg = JSON.parse(pkgRaw);
      deps = Object.assign({}, pkg.dependencies||{}, pkg.devDependencies||{});
      info('package.json deps: ' + (Object.keys(deps).join(', ') || '(none)'));
    } catch(e){ fail('package.json is not valid JSON: ' + e.message); }
  } else fail('package.json missing');

  const BUILTIN = new Set(['fs','path','url','http','https','zlib','crypto','stream','util','os',
    'child_process','events','buffer','process','querystring','assert','net','tls','dns','string_decoder','timers','punycode','v8','vm','worker_threads','readline','module','perf_hooks']);
  const files = ['api/ask.js','api/chat.js','api/chat-fast.js','api/tts.js','api/tashkeel.js',
                 'lib/retrieve.js','lib/encyclopedia.js','lib/ratelimit.js','lib/limit-message.js'];
  const used = new Set();
  for (const f of files){
    const src = read(f); if (!src) continue;
    const reqRe = /require\(\s*['"]([^'".][^'"]*)['"]\s*\)/g;
    const impRe = /from\s+['"]([^'".][^'"]*)['"]/g;
    let m;
    while((m=reqRe.exec(src))) used.add(m[1]);
    while((m=impRe.exec(src))) used.add(m[1]);
  }
  const topName = s => s.startsWith('@') ? s.split('/').slice(0,2).join('/') : s.split('/')[0];
  const externals = new Set();
  for (const u of used){
    const nm = u.replace(/^node:/,'');
    if (BUILTIN.has(nm)) continue;
    externals.add(topName(nm));
  }
  if (externals.size){
    for (const e of [...externals].sort()){
      if (deps[e]) pass('declared & used: ' + e);
      else fail('USED but NOT in package.json -> Vercel build will break: ' + e);
    }
  } else info('no external imports found in server code (or files unreadable)');

  const nm = stat('node_modules');
  if (nm) info('node_modules present (needed locally for gates)');
  else warn('node_modules absent -- run "npm install" before local gates');
}

/* ---------------------------------------------------------------- *
 * 7) CDN PIN INTEGRITY (index.html <head>)
 * ---------------------------------------------------------------- */
head('7) CDN PIN INTEGRITY (index.html)');
{
  const src = read('index.html');
  if (!src) fail('cannot read index.html');
  else {
    const urls = [];
    const re = /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi; let m;
    while((m=re.exec(src))){
      const u = m[1];
      if (/cdnjs|unpkg|jsdelivr|esm\.sh|skypack|cdn\./i.test(u)) urls.push(u);
    }
    if (!urls.length) info('no external CDN script/link tags detected');
    const verRe = /@\d+\.\d+\.\d+|\/\d+\.\d+\.\d+\//;
    for (const u of urls){
      if (verRe.test(u)) pass('pinned: ' + u);
      else warn('NOT version-pinned (supply-chain / breakage risk): ' + u);
    }
    if (src.indexOf('@babel/standalone@7.26.4') !== -1) pass('babel standalone pinned to 7.26.4 (documented)');
    else warn('did not find @babel/standalone@7.26.4 -- version may have moved');
    if (/mammoth[^"']*1\.11\.0/.test(src)) pass('mammoth pinned to 1.11.0 (documented)');
    else warn('did not find mammoth 1.11.0 -- version may have moved');
    if (/integrity\s*=/.test(src)) info('some SRI integrity= attributes present');
    else info('no SRI (integrity=) on CDN tags -- optional hardening for a child app');
  }
}

/* ---------------------------------------------------------------- *
 * 8) KNOWN MARKERS & FROZEN-SURFACE PRESENCE (index.html)
 * ---------------------------------------------------------------- */
head('8) MARKERS & FROZEN-SURFACE PRESENCE (index.html)');
{
  const src = read('index.html') || '';
  function flag(name, re, expected){
    const m = src.match(re);
    if (!m) { warn(name + ': not found (token may differ or state changed)'); return; }
    const val = m[1];
    if (expected !== undefined && val !== expected) warn(name + ' = ' + val + '  (docs say ' + expected + ')');
    else info(name + ' = ' + val);
  }
  flag('PERSIST_CONVERSATION', /PERSIST_CONVERSATION\s*=\s*(true|false)/, 'true');
  flag('SCHOLAR_ENABLED',      /SCHOLAR_ENABLED\s*=\s*(true|false)/, 'true');
  flag('CALL_STREAM_SPEECH',   /CALL_STREAM_SPEECH\s*=\s*(true|false)/, 'false');

  const markerChecks = [
    ['tts-num-words injection', /tts-num-words/],
    ['buildSystemPrompt',       /buildSystemPrompt/],
    ['deriveCaps',              /deriveCaps/],
    ['formatForTTS',            /formatForTTS/],
    ['parseSegments',           /parseSegments/],
    ['createCallSpeechStream',  /createCallSpeechStream/],
    ['playDhikrRecitation',     /playDhikrRecitation/],
    ['tagPattern',              /tagPattern/],
  ];
  for (const [label, re] of markerChecks){
    if (re.test(src)) pass('present: ' + label);
    else warn('NOT found: ' + label + '  (token may differ)');
  }
  // tag names inside tagPattern
  const tp = src.match(/tagPattern\s*=\s*\/([^\n]+)/);
  if (tp) info('tagPattern line: ' + tp[1].slice(0,120));
}

/* ---------------------------------------------------------------- *
 * 9) RAG SOURCE LISTS & GATES (lib/retrieve.js)
 * ---------------------------------------------------------------- */
head('9) RAG SOURCE LISTS & GATES (lib/retrieve.js)');
{
  const src = read('lib/retrieve.js');
  if (!src) fail('cannot read lib/retrieve.js');
  else {
    const adult = domainsIn(extractArrayBody(src, 'SITES_ADULT'));
    const minor = domainsIn(extractArrayBody(src, 'SITES_MINOR'));
    if (adult.length){ info('SITES_ADULT (' + adult.length + '): ' + adult.join(', ')); if (adult.length===12) pass('SITES_ADULT count = 12 (matches handoff)'); else warn('SITES_ADULT count = ' + adult.length + ' (handoff says 12)'); }
    else warn('could not extract SITES_ADULT');
    if (minor.length){ info('SITES_MINOR (' + minor.length + '): ' + minor.join(', ')); if (minor.length===2) pass('SITES_MINOR count = 2 (matches handoff)'); else warn('SITES_MINOR count = ' + minor.length + ' (handoff says 2)'); }
    else warn('could not extract SITES_MINOR');

    // minor set must be the strict subset
    const minorOk = minor.includes('islamqa.info') && minor.includes('binbaz.org.sa') && minor.length===2;
    if (minor.length) { if (minorOk) pass('SITES_MINOR == {islamqa.info, binbaz.org.sa} (khilaf policy)'); else warn('SITES_MINOR is not exactly islamqa+binbaz -- CHILD-SAFETY: verify'); }

    // gate functions & slugs
    for (const g of ['isKhameesBlocked','isTafsirAppBookBlocked','siteFilterFor','retrieve']){
      if (src.indexOf(g) !== -1) pass('present: ' + g); else warn('NOT found: ' + g);
    }
    if (/\bkashaf\b/.test(src) && /\balrazi\b/.test(src)) pass('tafsir book-block slugs present: kashaf + alrazi');
    else warn('tafsir block slugs kashaf/alrazi not both found');
    if (/othmanalkhamees\.com/.test(src)) pass('othmanalkhamees.com present (Khamis sect-gated source)');
    if (/BRAVE_API_KEY/.test(src)) pass('BRAVE_API_KEY referenced'); else warn('BRAVE_API_KEY not referenced in retrieve.js');
    // dead source that was removed
    if (/shkhudheir\.com/.test(src)) warn('shkhudheir.com still present (handoff says it was REMOVED -- dead SPA)');
  }
}

/* ---------------------------------------------------------------- *
 * 10) DATA FILE VALIDITY
 * ---------------------------------------------------------------- */
head('10) DATA FILE VALIDITY');
function checkJson(rel, expectCount, countPath){
  const raw = read(rel);
  if (raw === null){ fail('missing / unreadable: ' + rel); return; }
  try {
    const j = JSON.parse(raw);
    const target = countPath ? j[countPath] : j;
    const n = Array.isArray(target) ? target.length : (target && typeof target === 'object' ? Object.keys(target).length : 0);
    info(rel + ' valid JSON (' + (Array.isArray(j)?'array':'object') + (countPath ? ', .' + countPath : '') + ' = ' + n + ' entries)');
    if (expectCount !== undefined){ if (n===expectCount) pass(rel + ' entry count = ' + expectCount); else fail(rel + ' entry count = ' + n + ' (expected exactly ' + expectCount + ')'); }
  } catch(e){ fail(rel + ' INVALID JSON: ' + e.message); }
}
checkJson('worship-golden.json');
// Intentional lock on the child-safety referral surface: changing referral-golden.json requires deliberately updating this count.
const REFERRAL_CASES_EXPECTED = 9;
checkJson('referral-golden.json', REFERRAL_CASES_EXPECTED, 'cases');
checkJson('lib/data/adhkar.json');
checkJson('quran-uthmani.json');
// Quest game data: validate JSON parses. NO expected count -- the trivia bank grows
// intentionally each batch; a fixed count would turn red on every legitimate addition.
checkJson('quest-data/trivia-golden.json');
checkJson('quest-data/world.json');
checkJson('quest-data/rewards.json');
{
  const buf = readBuf('lib/data/fiqh-search.json.gz');
  if (!buf) fail('missing: lib/data/fiqh-search.json.gz');
  else {
    try {
      const out = zlib.gunzipSync(buf);
      const j = JSON.parse(out.toString('utf8'));
      const n = Array.isArray(j) ? j.length : (j.documents ? j.documents.length : Object.keys(j).length);
      pass('fiqh-search.json.gz gunzips + parses (' + n + ' records, uncompressed ' + (out.length/1048576).toFixed(1) + ' MB)');
      if (n >= 3000 && n <= 3200) pass('fiqh record count ~3070 (matches)'); else info('fiqh record count = ' + n + ' (handoff says 3070)');
    } catch(e){ fail('fiqh-search.json.gz failed to gunzip/parse: ' + e.message); }
  }
}

/* ---------------------------------------------------------------- *
 * 11) SERVERLESS HANDLER SANITY  (surface only -- deep review reads code)
 * ---------------------------------------------------------------- */
head('11) SERVERLESS HANDLER SANITY');
{
  const apis = ['api/ask.js','api/chat.js','api/chat-fast.js','api/tts.js','api/tashkeel.js'];
  for (const f of apis){
    const src = read(f); if (!src){ fail('cannot read ' + f); continue; }
    const hasHandler = /export\s+default|module\.exports/.test(src);
    const hasMethod  = /\.method\b/.test(src);
    if (hasHandler) pass(f + ': handler export present'); else warn(f + ': no default export / module.exports found');
    if (!hasMethod) info(f + ': no req.method guard detected (verify method allow-list)');
    if (f === 'api/ask.js'){
      const readsBand  = /\bband\b/.test(src);
      const readsDepth = /\bdepth\b/.test(src);
      if (readsBand || readsDepth) info('api/ask.js reads client band/depth -> DEEP REVIEW: confirm the server does NOT trust these blindly (age-gate bypass risk)');
    }
  }
}

/* ---------------------------------------------------------------- *
 * 12) LINE ENDINGS & BOM (tracked text files)
 * ---------------------------------------------------------------- */
head('12) LINE ENDINGS & BOM');
{
  const textExt = /\.(js|cjs|mjs|html|json|md)$/i;
  const targets = isRepo ? TRACKED.filter(t=>textExt.test(t)) : ['index.html'];
  let mixed=0, bom=0;
  for (const rel of targets){
    const buf = readBuf(rel); if (!buf) continue;
    if (buf.length>=3 && buf[0]===0xEF && buf[1]===0xBB && buf[2]===0xBF){ bom++; warn('UTF-8 BOM at start of ' + rel + ' (can break parsing/anchors)'); }
    const s = buf.toString('latin1');
    const crlf = (s.match(/\r\n/g)||[]).length;
    const loneLf = (s.match(/(?<!\r)\n/g)||[]).length;
    if (crlf>0 && loneLf>0){ mixed++; warn('MIXED line endings in ' + rel + ' (CRLF=' + crlf + ', lone LF=' + loneLf + ') -- anchor-matching hazard'); }
  }
  if (isRepo && !mixed) pass('no mixed line endings in tracked text files');
  if (!bom) pass('no UTF-8 BOM in checked files');
}

/* ---------------------------------------------------------------- *
 * 13) REPORT BODY CAP vs WORSHIP GOLDEN  (derived constant -- defect 20)
 * ---------------------------------------------------------------- */
head('13) REPORT BODY CAP vs WORSHIP GOLDEN');
{
  const gRaw = read('worship-golden.json');
  const rRaw = read('api/report.js');
  if (!gRaw) fail('cannot read worship-golden.json');
  else if (!rRaw) fail('cannot read api/report.js');
  else {
    let maxCard = null;
    try {
      const g = JSON.parse(gRaw);
      const cards = (g && g.blocks) ? Object.values(g.blocks) : [];
      // report.js caps with String.length / .slice() == UTF-16 code units; measure the same way.
      maxCard = cards.reduce((mx,b)=> Math.max(mx, (b && typeof b.rawText === 'string') ? b.rawText.length : 0), 0);
    } catch(e){ fail('worship-golden.json INVALID JSON: ' + e.message); }
    const m = rRaw.match(/LONGEST_CARD_CHARS\s*=\s*(\d+)/);
    const declared = m ? parseInt(m[1], 10) : null;
    if (maxCard === null){ /* JSON failure already reported above */ }
    else if (declared === null) warn('LONGEST_CARD_CHARS not found in api/report.js (token may differ)');
    else if (declared === maxCard) pass('LONGEST_CARD_CHARS = ' + declared + ' == longest worship card (' + maxCard + ' UTF-16 units)');
    else if (declared < maxCard) fail('LONGEST_CARD_CHARS = ' + declared + ' < longest card ' + maxCard + ' -> report body cap TOO SMALL, will reject full-card reports (re-derive in api/report.js)');
    else warn('LONGEST_CARD_CHARS = ' + declared + ' > longest card ' + maxCard + ' -> cap oversized/stale (re-derive in api/report.js)');
  }
}

/* ---------------------------------------------------------------- *
 * SUMMARY
 * ---------------------------------------------------------------- */
console.log('\n==================================================================');
console.log(' SUMMARY   PASS=' + P + '   WARN=' + W + '   FAIL=' + F);
if (F){
  console.log(' -- FAILURES (fix before anything else) --');
  FAILS.forEach(m=>console.log('   * ' + m));
} else {
  console.log(' No structural FAILs. WARNs are eyeball items, not necessarily bugs.');
}
console.log('==================================================================');
process.exit(F > 0 ? 1 : 0);
