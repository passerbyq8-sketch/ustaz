#!/usr/bin/env node
/*
 * recon-audit.cjs  --  READ-ONLY structural audit for Al-Murabbi (repo: ustaz)
 * -------------------------------------------------------------------------
 * SAFE: reads files + git metadata ONLY. Writes NOTHING. Commits NOTHING.
 * TRACKED in git on purpose (bug 43): the recon-*.cjs pattern in .gitignore is cancelled for
 * this one file by an explicit "!recon-audit.cjs", because it is a gate -- gates.json registers
 * it as `recon`. "git check-ignore recon-audit.cjs" matches nothing.
 * Run from the repo root:  node recon-audit.cjs [--expected-head <sha>]
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
function optionValue(name, argv = process.argv.slice(2)){
  const inline = argv.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1).trim() || null;
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
    ? argv[index + 1].trim() : null;
}
function baselineVerdict(actual, expected){
  const a = String(actual || '').trim(), e = String(expected || '').trim();
  if (!e) return 'absent';
  return a && (a === e || a.startsWith(e)) ? 'match' : 'mismatch';
}

// line-numbered search
function grepLines(src, re){
  const out = [];
  const lines = src.split(NL);
  for (let i=0;i<lines.length;i++){ if (re.test(lines[i])) out.push({ n:i+1, t:lines[i] }); re.lastIndex=0; }
  return out;
}
function extractArrayBody(src, name){
  const i = src.indexOf(name); if (i<0) return null;
  const assignment = src.indexOf('=', i + name.length); if (assignment<0) return null;
  const b = src.indexOf('[', assignment); if (b<0) return null;
  let depth=0, quote='', escaped=false, lineComment=false, blockComment=false;
  for (let k=b;k<src.length;k++){
    const c=src[k], next=src[k+1];
    if (lineComment){ if (c==='\n' || c==='\r') lineComment=false; continue; }
    if (blockComment){ if (c==='*' && next==='/'){ blockComment=false; k++; } continue; }
    if (quote){
      if (escaped){ escaped=false; continue; }
      if (c==='\\'){ escaped=true; continue; }
      if (c===quote) quote='';
      continue;
    }
    if (c==='/' && next==='/'){ lineComment=true; k++; continue; }
    if (c==='/' && next==='*'){ blockComment=true; k++; continue; }
    if (c==="'" || c==='"' || c==='`'){ quote=c; continue; }
    if (c==='[') depth++;
    else if (c===']'){
      depth--;
      if (depth===0) return src.slice(b+1, k);
    }
  }
  return null;
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

head('0) SOURCE ARRAY EXTRACTOR');
{
  const fixture = `const TARGET = ['literal ]', ['nested', "still ]"], /* ] */ ['tail']];\nconst AFTER = ['outside'];`;
  const body = extractArrayBody(fixture, 'TARGET');
  if (body && body.includes("'literal ]'") && body.includes("['nested', \"still ]\"]")
    && body.includes("['tail']") && !body.includes('outside')) {
    pass('array extraction balances nested arrays and ignores brackets in strings/comments');
  } else {
    fail('array extraction stopped before the matching outer ]: ' + JSON.stringify(body));
  }
}

if (baselineVerdict('abcdef', null) === 'absent'
  && baselineVerdict('abcdef', 'abcdef') === 'match'
  && baselineVerdict('abcdef', 'abc') === 'match'
  && baselineVerdict('abcdef', 'fedcba') === 'mismatch') {
  pass('optional HEAD baseline distinguishes absent, match, and mismatch');
} else {
  fail('optional HEAD baseline verdicts are inconsistent');
}

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
  // THE LIVE DOCUMENT, NOT A PATH IT NEVER OCCUPIED. This pointed at the repo root, where no
  // khilaf-policy.md has ever been, so the check reported «absent (optional)» on every run and
  // never once read the policy it names. It lives in docs/, it is tracked, and it is now
  // measured like everything else here.
  { rel:'docs/khilaf-policy.md',       mustTrack:true  },
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
  const currentHead = (git('rev-parse HEAD') || '').trim();
  const expectedHead = optionValue('--expected-head');
  const headVerdict = baselineVerdict(currentHead, expectedHead);
  info('HEAD = ' + currentHead);
  if (headVerdict === 'absent') info('no expected HEAD supplied; baseline comparison skipped');
  else if (headVerdict === 'match') pass('HEAD matches explicit expected baseline ' + expectedHead);
  else warn('HEAD differs from explicit expected baseline ' + expectedHead);
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
  // ── REVIEWED NON-SECRET LITERALS ──────────────────────────────────────────
  // The patterns above are deliberately shape-based: `SOMETHING_SECRET: '<28 chars>'` is what
  // a real leak looks like, and the scanner SHOULD keep firing on that shape everywhere. No
  // pattern below is edited, loosened, or given an exception — the scan runs at full strength.
  // What is added is a narrow list of literals a human has read and confirmed are offline
  // fixtures, so a known-safe line stops costing a FAIL that trains people to ignore FAILs.
  //
  // THREE PROPERTIES KEEP THIS FROM BECOMING A HOLE:
  //   1. It pins the SHA-256 of the EXACT trimmed line — not the file, not the line number.
  //      Editing the value, lengthening it, or swapping in a real credential changes the
  //      digest, retires the exemption, and the scanner fires again on the very next run.
  //   2. An entry matching nothing is itself a FAIL, so a fixture that is deleted or reworded
  //      cannot leave a live exemption lying around for a future secret to land inside.
  //   3. Each entry carries its reason, so the next reader re-audits the decision rather than
  //      inheriting it silently.
  //
  // THE DIGEST IS NOT COSMETIC. Writing the exempted line out in full would reproduce the
  // very shape the scanner hunts for, inside the scanner — the first attempt at this list did
  // exactly that and recon began reporting itself. A digest states which line was reviewed
  // without restating its contents, which is also what makes the mechanism safe to reuse for
  // a fixture that genuinely looks sensitive.
  const sha16 = (s) => require('crypto').createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
  const REVIEWED_NON_SECRETS = [
    {
      file: 'guards/search-budget-p0-guard.cjs',
      sha16: 'e89fad57e6b03345',
      what: 'offline HMAC fixture assigned to the search-budget identity env name',
      why: 'the caller-digest test runs with no network and no Upstash; this value '
         + 'authenticates nothing, here or anywhere else',
    },
  ];
  const usedExemptions = new Set();
  let hits = 0;
  for (const rel of targets){
    const src = read(rel); if (src === null) continue;
    const lines = src.split(NL);
    for (let i=0;i<lines.length;i++){
      const line = lines[i];
      if (line.indexOf('process.env') !== -1) continue; // proper usage
      const exempt = REVIEWED_NON_SECRETS.find(e => e.file === rel && e.sha16 === sha16(line.trim()));
      for (const p of patterns){
        if (p.re.test(line)){
          if (exempt) usedExemptions.add(exempt);
          else { hits++; fail('possible secret (' + p.label + ') in ' + rel + ':' + (i+1) + '  -> <REDACTED>'); }
        }
        p.re.lastIndex = 0;
      }
    }
  }
  for (const e of REVIEWED_NON_SECRETS){
    if (usedExemptions.has(e)) pass('reviewed non-secret fixture still matches exactly: ' + e.file);
    else fail('stale secret-scan exemption for ' + e.file + ' matches nothing -- remove it, or '
      + 'restore the line it was written for; an exemption that matches nothing is a hole '
      + 'waiting for a real secret to land in');
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
    // S97: the two document-tool bundles (html2pdf, mammoth) are no longer <script src> tags --
    // they are fetched on idle AFTER the first paint, so their pinned URLs now live in a JS string
    // literal instead of an attribute. The pin check has to follow them there: a dependency that
    // moved out of an attribute is still a supply-chain dependency, and scanning attributes alone
    // would have silently dropped both from this audit while still reporting a clean run.
    const urls = [];
    const seen = new Set();
    const collect = (u) => {
      if (!/cdnjs|unpkg|jsdelivr|esm\.sh|skypack|cdn\./i.test(u)) return;
      if (seen.has(u)) return;
      seen.add(u); urls.push(u);
    };
    let m;
    const attrRe = /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
    while((m=attrRe.exec(src))) collect(m[1]);
    const litRe = /["'](https?:\/\/[^"'\s]+\.js)["']/gi;   // a script URL held in a JS string
    while((m=litRe.exec(src))) collect(m[1]);
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
  flag('CALL_STREAM_SPEECH',   /CALL_STREAM_SPEECH\s*=\s*(true|false)/, 'true');

  const markerChecks = [
    ['tts-num-words injection', /tts-num-words/],
    // D02ب: buildSystemPrompt is DELIBERATELY NOT in this list any more. It is not in index.html
    // to be found -- the prompt moved to lib/system-prompt.js so the server owns it, and the
    // client now posts {name, age, gender, mode} instead. Leaving it here produced a standing
    // WARN that read like a broken token when it was in fact the whole point of the change, and
    // a warning nobody can act on is one nobody reads. Gate `systemprompt` asserts the real
    // invariant: the module is the only builder, and no second copy has come back here.
    ['deriveCaps',              /deriveCaps/],
    ['formatForTTS',            /formatForTTS/],
    // The token below is NOT parseSegments. `git log -S parseSegments -- index.html` is empty
    // over the whole history: the name never existed there, so this entry could only ever have
    // warned. The real splitter it stands for is parseRichMessage, declared at index.html:3760
    // and called at three (6566, 10958, 11226), so this check can now actually be absent.
    ['parseRichMessage',        /parseRichMessage/],
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
    // 24 as of 2026-08-03: the 14 that were here, plus eftaa.awqaf.gov.kw promoted from the
    // under-18 fallback tier to the adult list, plus 7 domains in the first batch and 2 in the
    // second (tafsir.net, al-abbaad.com). The exact membership and the per-source scope are
    // asserted by source-registry-guard.cjs; this stays a count lock so a silent addition here
    // is visible in the audit too.
    // 24 until 2026-08-05; 22 after the first measured deferrals; 19 since the 2026-08-14
    // re-measurement deferred islamstory.com, al-badr.net and othmanalkhamees.com too.
    if (adult.length){ info('SITES_ADULT (' + adult.length + '): ' + adult.join(', ')); if (adult.length===19) pass('SITES_ADULT count = 19 (measured 2026-08-14)'); else warn('SITES_ADULT count = ' + adult.length + ' (expected 19 -- update deliberately)'); }
    else warn('could not extract SITES_ADULT');
    // WIDENED 2026-08-05 by an explicit decision of the project's owner, from 2 to 8, then reduced
    // to 7 on 2026-08-14 when islamstory.com measured HTTP 521. It changes
    // WHICH VETTED PAGES a child's search may draw from and nothing about what is said to a child:
    // the khilaf policy, the age floor and the worship lock are all downstream of retrieval.
    if (minor.length){ info('SITES_MINOR (' + minor.length + '): ' + minor.join(', ')); if (minor.length===7) pass('SITES_MINOR count = 7 (measured 2026-08-14)'); else warn('SITES_MINOR count = ' + minor.length + ' (expected 7 -- update deliberately)'); }
    else warn('could not extract SITES_MINOR');

    // minor set must be the strict subset
    // THE CHILD ROSTER, by name. The exact membership is asserted by source-registry-guard.cjs;
    // this stays here as an audit-visible lock so a domain appearing on a child's list is never a
    // diff nobody reads. Every one of the seven is currently eligible and searchable.
    const MINOR_EXPECTED = ['islamqa.info', 'binbaz.org.sa', 'islamweb.net', 'alukah.net',
      'iifa-aifi.org', 'ibn-jebreen.com', 'almosleh.com'];
    const minorOk = minor.length === MINOR_EXPECTED.length && MINOR_EXPECTED.every((d) => minor.includes(d));
    if (minor.length) { if (minorOk) pass('SITES_MINOR == the seven currently measured ready (khilaf policy unchanged)'); else warn('SITES_MINOR is not the expected seven -- CHILD-SAFETY: verify'); }

    // gate functions & slugs
    for (const g of ['isKhameesBlocked','isTafsirAppBookBlocked','retrieve']){
      if (src.indexOf(g) !== -1) pass('present: ' + g); else warn('NOT found: ' + g);
    }
    // The `site:` filter used to be assembled here as siteFilterFor(). It moved to
    // lib/brave-query.js on 2026-08-03, so that assembly and MEASUREMENT live in one file --
    // the adult-retrieval outage was a query built in one place and measured in none. What
    // this line now checks is that retrieve.js gets its queries from that owner and does not
    // grow a second formula of its own.
    if (/from '\.\/brave-query\.js'/.test(src) && !/function siteFilterFor/.test(src)){
      pass('query assembly delegated to lib/brave-query.js (no local site: filter)');
    } else {
      fail('retrieve.js must build queries via lib/brave-query.js and keep no site: filter of its own');
    }
    if (/\bkashaf\b/.test(src) && /\balrazi\b/.test(src)) pass('tafsir book-block slugs present: kashaf + alrazi');
    else warn('tafsir block slugs kashaf/alrazi not both found');
    if (/othmanalkhamees\.com/.test(src)) pass('othmanalkhamees.com present (Khamis sect-gated source)');
    if (/BRAVE_API_KEY/.test(src)) pass('BRAVE_API_KEY referenced'); else warn('BRAVE_API_KEY not referenced in retrieve.js');
    // Dead source. It was removed once as a dead SPA and, re-probed on 2026-08-03, the domain
    // is now PARKED: every path returns a 114-byte stub redirecting to a GoDaddy /lander.
    // What matters is whether it is SEARCHABLE, not whether the file mentions it -- the
    // registry row that records why it is refused necessarily names it, and so does the
    // comment in the allow-list. So the test is membership of the arrays, and it is a FAIL:
    // a parked domain on a fatwa allow-list would let its next owner be cited as a shaykh.
    if (adult.includes('shkhudheir.com') || minor.includes('shkhudheir.com')){
      fail('shkhudheir.com is on a SITES_ list -- it is a parked domain, it must not be searchable');
    } else pass('shkhudheir.com is on no SITES_ list (parked domain, refused by the registry)');
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
  // FROZEN VENDOR PAGES ARE NOT OUR TEXT, AND SCANNING THEM BREAKS THIS CHECK.
  //
  // data/transfer-fixtures/*.html are the bytes eight hosts served on 2026-08-08, kept so the
  // transfer extractors are tested against real markup instead of pages their own author wrote.
  // Their manifest publishes a SHA8 of each, and .gitattributes marks them `-text` for exactly
  // that reason: normalising an ending in either direction breaks the attestation.
  //
  // So their endings are whatever each host sent, and seven of them are mixed. Scanning them
  // does not merely add seven warnings — the PASS below is `!mixed`, a SINGLE verdict over ALL
  // files, so those seven made it unreachable forever. This check exists to catch a stray CR in
  // OUR files (the anchor-matching hazard, defect 40); with the fixtures in scope it could never
  // report on our files again. Excluding them is what keeps the check alive.
  const isFrozenFixture = (t) => t.startsWith('data/transfer-fixtures/');
  const targets = isRepo ? TRACKED.filter(t=>textExt.test(t) && !isFrozenFixture(t)) : ['index.html'];
  let mixed=0, bom=0;
  for (const rel of targets){
    const buf = readBuf(rel); if (!buf) continue;
    if (buf.length>=3 && buf[0]===0xEF && buf[1]===0xBB && buf[2]===0xBF){ bom++; warn('UTF-8 BOM at start of ' + rel + ' (can break parsing/anchors)'); }
    const s = buf.toString('latin1');
    const crlf = (s.match(/\r\n/g)||[]).length;
    const loneLf = (s.match(/(?<!\r)\n/g)||[]).length;
    if (crlf>0 && loneLf>0){ mixed++; warn('MIXED line endings in ' + rel + ' (CRLF=' + crlf + ', lone LF=' + loneLf + ') -- anchor-matching hazard'); }
  }
  if (!mixed) pass('no mixed line endings in ' + (isRepo ? 'tracked' : 'checked') + ' text files');
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
 * 14) GATE ROSTER  (gates.json is the single gate-roster source -- item 50)
 * ---------------------------------------------------------------- */
head('14) GATE ROSTER (single source: gates.json)');
{
  // Lock on the gate roster: gates.json is the ONE authoritative list of gate
  // scripts. Adding or removing a gate requires deliberately updating this count,
  // exactly like REFERRAL_CASES_EXPECTED above -- a silent drift here means a guard
  // stopped being enforced and nobody noticed.
  // S92: 11 -> 12, chat-history-guard.cjs (the saved-conversations gate).
  // S93: 12 -> 13, markdown-guard.cjs (the display-only Markdown gate).
  // S-RFC-v0.5-R2: 33 -> 35. 34th rfc-v05r2-guard (entities, eras, age policy, slot proof) and
  //       35th rfc-v05r2-runtime-guard (cache, daily budget, query bounds, mutations, SSE). Both
  //       live under guards/ rather than the repo root, which is why item 14 below had to learn
  //       that a gate script may carry a directory.
  // S-RFC-v0.5-R2-REVIEW: 35 -> 36. 36th rfc-v05r2-wiring-guard — the review of the first round
  //       found that the policy core was asserted to be IMPORTED rather than driven, so this one
  //       calls api/ask.js's own default export and replaces only globalThis.fetch. It is the
  //       gate that fails if the wiring is removed while every module test still passes.
  // S-RFC-v0.5-R2-ROUND3: 36 -> 37. 37th rfc-v05r2-round3-guard — the policy router over BOTH
  //       paths, a policy block per ISSUE rather than per question, provenance A/B/C classified
  //       from the evidence, and a Gate 3 that judges every claim a sentence rests on.
  // S-BATCH5-STEP1: 54 -> 55. 55th retrieval-observability — NO PAGE IS DROPPED IN SILENCE.
  //       buildSourceTag returned a bare `null` from seven places and pickVerifiedSources
  //       swallowed it with `continue`, so "the provider found nothing" and "we fetched good
  //       pages and could not encode one of them" produced the SAME empty log. Every drop now
  //       names its reason and its url, and the second case has a line of its own.
  // S-BATCH5-STEP3: 55 -> 56. 56th ruling-source — A RULING COMES FROM A PAGE, OR IT DOES NOT GO
  //       OUT. «ذهب إلى المسجد فهل يصح؟» was answered «يجب الطهور قبل دخول المسجد» over a card
  //       about الحائض. A whole class with no guard: no name to police, no hadith to grade, no
  //       qawl preferred — every check we had asks about the SOURCE or about a NAME, and none
  //       asked whether the page in hand says this. Held inside the EXISTING screen, never a
  //       second one beside it; the frozen texts are outside it wholly.
  // S-BATCH5-STEP6B: 56 -> 57. 57th world-parity — the embedded map in quest.html had drifted to
  //       13 regions against quest-data/world.json's 27, and loadJSON() fell back to it in
  //       silence. Fourteen regions existed in the data and could not be reached from the copy.
  // S-BATCH5-STEP6C: 57 -> 58. 58th wird -- tools/wird-guard.cjs held 307 real assertions over a
  //       shipped feature and nothing ran it, so three of them had been red and silent since the
  //       S110 dock gave the pager a second renderer shape and renamed the reader exit handler.
  //       A guard nobody runs is a guard that asserts nothing; it is fixed and listed.
  // S-BATCH5-STEP9: 58 -> 59. 59th voice-safety -- api/chat.js was a byte pipe: no hazard triage,
  //       no age policy, no source. A child asking BY VOICE how to mix cleaning chemicals reached
  //       the vendor and came back answered, while the same question TYPED was refused. graveHazard
  //       and the age policy now run on the voice turn BEFORE any model call; guardAIConsent is
  //       untouched and its precedence is asserted.
  // D14: 59 -> 60. 60th madinahafs -- tools/madina-hafs-guard.cjs, 99 assertions over the 604
  //       mushaf page assets, their register and the licence notice, and nothing ran it. The
  //       same defect as wird (58th) in the same place: a real guard over a shipped feature,
  //       sitting outside the roster, asserting nothing. It passed 99/0 unchanged on the day
  //       it was listed, so listing it cost no edit to the guard itself.
  // D15: 60 -> 61. 61st i18nui -- guards/i18n-ui-guard.cjs, 245 assertions over the two
  //       interface languages, and nothing ran it. Same defect as wird (58th) and madinahafs
  //       (60th) in the same place. It differs from those two in one way worth recording: it
  //       could NOT be listed unchanged. Its part E was anchored to a commit id pinned in its
  //       own source, so it failed 11 of its own assertions on any tree that had moved past
  //       that commit -- and converted the whole section to a single SKIP when git was absent
  //       while still printing "232/232 checks passed". D07 re-anchored it first; the eleven
  //       were adjudicated one by one and every one was a stale scope seal, not a regression.
  // D41: 61 -> 62. 62nd adhkartwins -- guards/adhkar-twins-guard.cjs, a SHA-256 comparison of
  //       the two adhkar.json copies: the root one that SHIPS to the browser and lib/data/ the
  //       server reads. This one differs from D14/D15 above: those listed a real guard that
  //       already existed and was simply outside the roster. This gate is NEW, because nothing
  //       in the tree was checking the twins at all -- while lib/ratelimit.js already names
  //       this exact duplication as the thing that taught it "two copies of one number is one
  //       number waiting to drift". It COMPARES ONLY: no copy is edited, deleted or
  //       regenerated, and on a mismatch a human decides which one is right.
  // D02ب/م٢: 62 -> 63. 63rd systemprompt -- guards/system-prompt-parity-guard.cjs. The system
  //       prompt moved to lib/system-prompt.js, where the SERVER owns it. It was built by
  //       index.html and shipped in the body, so the text governing what the model may say to
  //       a child was supplied by the client being governed. Moving a 900-line Arabic prompt
  //       is the kind of change whose errors are invisible -- a dropped diacritic reads the
  //       same to a reviewer and differently to the model -- so the port was GENERATED from
  //       index.html, not retyped, and this gate pins the output fingerprints.
  const GATES_EXPECTED = 90;   // 90th: bootinvariants -- guards/boot-invariants-guard.cjs. Three
                               //       properties of index.html were being re-verified BY HAND, in
                               //       prose, at the end of order after order for weeks: the diagnostic
                               //       catcher is the first script after <body>; ErrorBoundary is
                               //       defined AND MOUNTED; pinPassRef is present at every one of its
                               //       positions. A check rewritten from memory each time is a check
                               //       that will be forgotten once, and the once is the only one that
                               //       matters. The scripts between <body> and the catcher are COUNTED,
                               //       so a benign insertion fails; the mount is read from the syntax
                               //       tree, not from a substring a comment could satisfy; and the
                               //       breaker is counted BY ROLE (one declaration, one increment, one
                               //       ceiling, three resets) because line numbers move and roles do
                               //       not. It READS index.html and never writes it: all three mutants
                               //       were applied to a temporary copy outside the tree.
                               // 89th: vacuousassert -- guards/vacuous-assertion-guard.cjs. Items 106
                               //       and 106-ب each repaired the same defect by hand: a region cut at
                               //       a literal anchor returns '' when the anchor moves, and '' satisfies
                               //       every negative assertion written over it, so the check prints PASS
                               //       at its loudest while reading nothing. Eight sites in three guards,
                               //       then sixty-four in one. Nothing stopped the next one being written.
                               //       This gate parses all 144 .cjs files in scope with Babel -- not with a
                               //       regular expression, which mis-measured this twice -- and fails on any
                               //       (emptyable region x negative assertion) pair that is not protected
                               //       inside its OWN condition and not in a named exception list. Six live
                               //       sites in three guards were found and repaired in the same commit.
                               // 88th: telemetrytext -- guards/telemetry-text-guard.cjs. The handler
                               //       printed the reader's own question on three lines: the planner's
                               //       derived queries, the resolved topic, and twelve words claim-gate
                               //       lifted verbatim out of the question. All three are deleted; the
                               //       gate sweeps every console call on every api/ handler under two
                               //       rules -- denied expressions, and an explicit allow-list of field
                               //       names -- and kills four mutants: a restored field, a renamed one,
                               //       one hidden inside an array, and an unreviewed name.
                               // 87th: standingnotice -- guards/standing-notice-band-guard.cjs. The standing
                               //       notice under the composer carried «راجِعْ ما يهمُّك مع والديك» with NO
                               //       condition at all, so every adult reader was being sent to his parents.
                               //       The gate boots the shipped babel block, drives standingNoticeKey through
                               //       deriveCaps from real ages, and kills two mutants: the unconditional line,
                               //       and the condition inverted so the child loses the clause instead.
                               // 81st-86th: the pure output-reviewer matrix and the five mutation-backed
                               //       FreeBrain-B guards. They constrain the output boundary without touching
                               //       the parallel answer-path owner.
                               // 76th-80th: the five answer-path guards of parallel round A, listed in the
                               //       merge round because gates.json belonged to the other writer while they
                               //       were being built. Each is registered WITH --mutants, without which the
                               //       mutation half never runs in the suite and the gate asserts half of what
                               //       its own report claims: promptconsistency (the prompt does not contradict
                               //       itself on the verse or on the age bound, read from the LIVE text and with
                               //       the bound derived from index.html) -- truncatedtag (a tag cut at offset
                               //       zero no longer empties display AND voice together, and the rescue stays
                               //       opt-in: the four final-text readers pass it, the streaming path does not)
                               //       -- explicitfailure (no silent excision in EITHER finaliser: the sentence
                               //       falls whole and `degraded` always rides along) -- scholarseparation (the
                               //       SERVER, not the prompt, splits the shaykh's saying from the general
                               //       ruling; site 2 in api/ask.js stays BLOCKED and its safe state is pinned)
                               //       -- cardorcontext (a stored page earns a card or never enters the context)
                               // 75th: guardhonesty -- governing claims are measured against sealed repository evidence and killed mutants
                               // 74th: retiredchat -- unused model-only relays stay 410 and /api/ask remains the only answer path
                               //       or a browser speech engine before an explicit, versioned consent
                               // 52nd: source-attribution — a person is named by a page or not at all;
                               //       the four ordered tiers (byline > domain owner > name in text >
                               //       nobody), read by BOTH the legacy screen and the ledger's Gate 3
                               // 53rd: referral-tail — the referral to ahl al-'ilm is the server's own
                               //       sentence, rotated so it stays read, and NEVER appended to the
                               //       frozen acts of worship
                               //       (Apple 5.1.1(i) / 5.1.2(i)). NOT optional: it is a full gate.
                               //       «ما رأي خالد عبدالرحمن في قصر الصلاة؟» was treated as a
                               //       request for a scholar's fatwa, so the app hunted for one,
                               //       found nothing, and asked the reader for the shaykh's
                               //       official website. A registry can say "is this one of OURS";
                               //       it cannot say "is this a scholar at all". The model's world
                               //       knowledge answers that — for a NAME only, after the plan,
                               //       and only ever narrowing.
                               // 40th: rfc-v05r2-consistency-guard — one answer unit may not both
                               //       credit a man and disclaim having found him. The served
                               //       reply stated his position, quoted مجموع الفتاوى, called his
                               //       view weak and advised القضاء, then said «لم أقف على نصٍّ
                               //       مباشرٍ له». The handler already INSTRUCTED the model not to
                               //       attribute; an instruction is a request, so the check is now
                               //       deterministic and guards every buffered exit — including
                               //       round 1 answering with no tool_use, which is the one the
                               //       defect escaped through.
                               // 39th: rfc-v05r2-historical-guard — a historical scholar is not
                               //       asked for a website. «ما رأي ابن تيمية فيمن ترك الصلاة؟»
                               //       was answered with «اذكر رابط موقعه الرسمي» because the
                               //       legacy plan decided identity from the CONTEMPORARY registry
                               //       and never asked the entity layer for the man's era. Covers
                               //       the whole historical roster, both honorific forms, thread
                               //       contamination, and a real source mutation.
                               // 38th: rfc-v05r2-mode-guard — the three-mode rollout switch.
                               //       The store value the old switch needed has never been
                               //       written, so activation authority moved to the
                               //       environment and the store became an optional brake.
                               //       (The reason recorded here until 2026-08-07 — «every
                               //       secret reads back empty, they are stored write-only» —
                               //       was stamped MEASURED and was false: reads work; only
                               //       the WRITE was never attempted. lib/ledger/flag.js.) That
                               //       is a change to what decides who sees a different answer,
                               //       so off/internal/public/unset/garbage are enumerated.
                               // 33rd: ledger-seam-guard — the JOIN between a request and the
                               //       engine, driven with req/res doubles rather than matched
                               //       with a regex. Three defects lived in that gap while five
                               //       ledger gates stayed green: the engine's question came
                               //       from the legacy attribution classifier, the extraction
                               //       cache was read with an undefined adapter version, and the
                               //       Upstash flag read sat outside the request deadline.
                               // 28th-32nd: the five ledger-RAG guards. They cover a PARALLEL
                               //       answer path that is default-OFF (lib/ledger/**, reached
                               //       only via lib/ledger/flag.js), so they gate code the
                               //       shipped route never executes -- which is exactly why they
                               //       have to be gated: an unexercised path rots silently.
                               //       ledger-contract   (capabilities, source policy, query IR)
                               //       ledger-retrieval  (bounds matrix, ranking, SSRF, canonical)
                               //       ledger-gates      (byte offsets, the three gates, mutations)
                               //       ledger-runtime    (flag, kill switch, cache keys, telemetry)
                               //       ledger-fixtures   (the nine questions, end to end)
                               // 27th: smart-retrieval-guard (a scholar's name starts a search,
                               //       it does not end one; the canned refusal is no longer a
                               //       global fallback)
                               // 26th: brave-query-guard    (no Brave query the app can build
                               //       exceeds 400 chars / 50 words -- the ceiling that took
                               //       adult retrieval down while 25 gates stayed green)
                               // 25th: source-registry-guard (one row per approved domain, no
                               //       duplicate/www evasion, per-source SCOPE, and a page is
                               //       admitted on its own evidence rather than on its host)
                               // 23rd: attribution-guard    (a named scholar's opinion may not be
                               //       stated without a retrieved source BY HIM that answers it)
                               // 22nd: quest-ux-guard       (S100 -- accessible game feedback: the
                               //       bank sealed by hash, no early reveal, no second answer,
                               //       the tally and the mistake review)
                               // 21st: a11y-guard           (S99 -- local reading preferences: text
                               //       size, reading mode, reduced motion)
                               // 20th: chat-ux-guard        (S98 -- the reply controls: fold, quick
                               //       actions, quote, local favourites, local search)
                               // 19th: theme-coverage-guard (S95 -- dark mode reaches every surface)
                               // 15th: quran-quest-guard   (phase 2 -- Quran-category balance + verbatim text)
                               // 16th: prayer-quest-guard  (phase 3 -- prayer coverage, sourcing, attribution)
                               // 17th: quest-bank-integrity-guard (phase 4 -- bank-wide structure; freezes the
                               //       394 protected questions at commit 17bb52a)
                               // 18th: quest-content-review-guard (phase 5 -- per-question review manifest:
                               //       coverage, fingerprints, locating sources, duplicate-free)
  // Root *.cjs files that are deliberately NOT gates (build helpers / one-shot tools).
  // Every root .cjs must be classified as either a gate (in gates.json) or listed here.
  const NON_GATE_CJS = new Set([
    'build-golden-md.cjs',
    'build-mushaf-layout.cjs',
    'esc.cjs',
    'flip-stream-flag.cjs',
    'quran-verify.cjs',
  ]);

  const gRaw = read('gates.json');
  if (gRaw === null){
    fail('gates.json missing -- the single gate-roster source is gone');
  } else {
    let gates = null;
    try { gates = JSON.parse(gRaw); } catch(e){ fail('gates.json INVALID JSON: ' + e.message); }
    if (gates === null){ /* parse failure already reported */ }
    else if (!Array.isArray(gates)){
      fail('gates.json is not a JSON array of {name, script, args} entries');
    } else {
      // (b) roster-count lock
      if (gates.length === GATES_EXPECTED) pass('gates.json entry count = ' + GATES_EXPECTED);
      else fail('gates.json entry count = ' + gates.length + ' (expected exactly ' + GATES_EXPECTED + ' -- update GATES_EXPECTED deliberately)');

      // .gitattributes eol=lf pins (normalize whitespace: single- and multi-space lines both match)
      const ga = read('.gitattributes') || '';
      const gaPinned = new Set();
      for (const line of ga.split(NL)){
        const toks = line.trim().split(/\s+/);
        if (toks.length >= 3 && toks[1] === 'text' && toks.slice(2).includes('eol=lf')) gaPinned.add(toks[0]);
      }

      // (a) each gate script: present on disk + tracked in git + pinned eol=lf
      const gateScripts = new Set();
      for (const entry of gates){
        const s = entry && entry.script;
        if (!s){ fail('gates.json entry has no "script" field: ' + JSON.stringify(entry)); continue; }
        gateScripts.add(s);
        if (!stat(s)) fail('gate script missing on disk: ' + s + '  (named in gates.json)');
        else if (isRepo && !TRACKED_SET.has(s)) fail('gate script not tracked in git: ' + s + '  (named in gates.json)');
        else if (!gaPinned.has(s)) fail('gate script not pinned "' + s + ' text eol=lf" in .gitattributes');
        else pass('gate ok (on disk, tracked, eol=lf pinned): ' + s);
      }

      // (c) every root .cjs must be classified: gate or non-gate
      let unclassified = 0;
      for (const rel of fs.readdirSync(ROOT)){
        if (!rel.endsWith('.cjs')) continue;
        if (gateScripts.has(rel) || NON_GATE_CJS.has(rel)) continue;
        unclassified++;
        fail('new .cjs must be classified: gate or non-gate -- ' + rel);
      }
      if (!unclassified) pass('every root .cjs is classified (gate or non-gate)');
    }
  }
}

/* ---------------------------------------------------------------- *
 * 15) CLIENT/SERVER BODY-CAP MIRROR  (item 1 / defects 44+45)
 * ---------------------------------------------------------------- */
head('15) CLIENT/SERVER BODY-CAP MIRROR');
{
  // The client refuses/trims an oversized body BEFORE the server 413s it -- but only while the
  // client's mirror equals the server's cap. This makes the mirror unable to drift: read the number
  // from BOTH files and FAIL on any mismatch (same shape as GATES_EXPECTED). Server of record is
  // lib/ratelimit.js MAX_CHAT_BODY_BYTES; the client mirror is index.html SERVER_MAX_CHAT_BODY_BYTES.
  const evalIntExpr = (expr) => {
    const e = String(expr).trim();
    if (!/^[\d_*+\-/()\s]+$/.test(e)) return null; // arithmetic over integer literals only -- no identifiers
    try { const v = Function('"use strict"; return (' + e + ');')(); return Number.isFinite(v) ? v : null; }
    catch (_) { return null; }
  };
  const grab = (rel, re, label) => {
    const s = read(rel);
    if (s === null) return { err: 'cannot read ' + rel };
    const m = s.match(re);
    if (!m) return { err: label + ' not found in ' + rel };
    const v = evalIntExpr(m[1]);
    return v === null ? { err: label + ' unparseable in ' + rel + ': ' + m[1].trim() } : { v };
  };
  const server = grab('lib/ratelimit.js', /MAX_CHAT_BODY_BYTES\s*=\s*([^;]+);/, 'MAX_CHAT_BODY_BYTES');
  const client = grab('index.html', /SERVER_MAX_CHAT_BODY_BYTES\s*=\s*([^;]+);/, 'SERVER_MAX_CHAT_BODY_BYTES');
  if (server.err) fail('body-cap mirror: ' + server.err);
  else if (client.err) fail('body-cap mirror: ' + client.err);
  else if (server.v !== client.v) fail('body-cap mirror DRIFT: lib/ratelimit.js MAX_CHAT_BODY_BYTES=' + server.v +
    ' != index.html SERVER_MAX_CHAT_BODY_BYTES=' + client.v + ' -- the client no longer measures what the server enforces (re-sync the mirror)');
  else pass('body-cap mirror intact: client SERVER_MAX_CHAT_BODY_BYTES == server MAX_CHAT_BODY_BYTES == ' + server.v + ' bytes');
}

/* ---------------------------------------------------------------- *
 * 15B) COMMIT IDS QUOTED IN DOCUMENTATION  (item 115-ب)
 * ---------------------------------------------------------------- */
head('15B) COMMIT IDS QUOTED IN DOCUMENTATION');
{
  // WHY THIS EXISTS. Two documents attribute a behaviour to a commit id, and nothing read either
  // one. A commit id in prose is the cheapest kind of claim to make and the easiest to leave
  // dangling: history gets rewritten, a branch gets squashed, a behaviour moves to another file,
  // and the sentence keeps naming a hash that resolves to nothing. Both are checked here.
  //
  // NOT A BLANKET SWEEP, DELIBERATELY. A blanket "every hex string in a .md must resolve" was
  // measured first and is wrong: 16 of the 48 hex-ish tokens in this tree's documents are content
  // fingerprints, not commits -- the twelve SHA-16 prefixes in golden-set-worship.md, and the
  // upstream commit plus the md5 in MUSHAF-MADINA-ASSET-NOTICE.md, which belong to somebody else's
  // repository and cannot resolve here by design. So the ids that are PRESENTED AS COMMITS OF THIS
  // REPOSITORY are registered, and each is checked twice: it is still written where it is claimed
  // to be, and it still names a commit.
  const DOC_COMMITS = [
    { file: 'docs/khilaf-policy.md', id: 'eb49517',
      what: 'the commit that made the minor-band source ladder structural in lib/retrieve.js' },
    { file: 'EZIK-RFC-V0.5-R2-FROZEN.md', id: '2046114a98f5d248672bc209914ec4baeff8a3d6',
      what: 'the frozen historical baseline of the RFC v0.5-R2 rollout' },
    { file: 'EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md', id: '2046114a98f5d248672bc209914ec4baeff8a3d6',
      what: 'the same baseline, quoted as START_HEAD and START_ORIGIN' },
  ];
  if (!isRepo){
    info('git is unavailable -- the ' + DOC_COMMITS.length + ' documented commit ids cannot be resolved');
  } else {
    let bad = 0;
    for (const entry of DOC_COMMITS){
      const body = read(entry.file);
      if (body === null){ fail('documented commit id: ' + entry.file + ' is missing'); bad++; continue; }
      if (body.indexOf(entry.id) === -1){
        fail('documented commit id: ' + entry.file + ' no longer quotes ' + entry.id
          + ' (' + entry.what + ') -- the registration outlived the sentence it guards');
        bad++; continue;
      }
      if (git('cat-file -t ' + entry.id) === null){
        fail('documented commit id: ' + entry.file + ' names ' + entry.id + ' (' + entry.what
          + ') and it resolves to nothing in this repository');
        bad++;
      }
    }
    if (!bad) pass('every commit id quoted in documentation still resolves (' + DOC_COMMITS.length + ' ids)');
  }
}

/* ---------------------------------------------------------------- *
 * 16) CURRENT IMPLEMENTATION-REPORT FACTS
 * ---------------------------------------------------------------- */
head('16) CURRENT IMPLEMENTATION-REPORT FACTS');
{
  const report = read('EZIK-RFC-V0.5-R2-IMPLEMENTATION-REPORT.md') || '';
  let gates = [];
  try { gates = JSON.parse(read('gates.json') || '[]'); } catch (_) { /* item 14 reports this */ }
  const gateCount = gates.length;
  const summaryBeforeThisCheck = { pass: P, warn: W, fail: F };
  const reconLine = /RECON\s+PASS=(\d+)\s+WARN=(\d+)\s+FAIL=(\d+)/.exec(report);
  const wirdEntry = gates.find((entry) => entry && entry.name === 'wird');
  const gatesSectionAt = report.indexOf('## K. Gates and tests');
  const gatesSectionEnd = report.indexOf('\n## ', gatesSectionAt + 4);
  const gatesSection = gatesSectionAt === -1 ? '' : report.slice(gatesSectionAt,
    gatesSectionEnd === -1 ? report.length : gatesSectionEnd);
  const problems = [];
  if (!wirdEntry || wirdEntry.script !== 'tools/wird-guard.cjs') problems.push('governing wird entry is missing');
  if (/not present in this repository and not in `gates\.json`/.test(report)) problems.push('stale wird absence claim remains');
  if (!report.includes('`tools/wird-guard.cjs` is present and registered in `gates.json` as `wird`')) {
    problems.push('current wird fact is not stated');
  }
  if (!gatesSection.includes('All ' + gateCount + ' gates')) problems.push('gate-count prose is stale');
  if (!gatesSection.includes('TOTAL_GATES        ' + gateCount + '/' + gateCount + ' PASS')) problems.push('TOTAL_GATES is stale');
  for (const entry of gates) {
    if (!new RegExp('(?:^|\\s)' + entry.name + '\\s+0(?:\\s|·|$)', 'm').test(gatesSection)) {
      problems.push('gate roster omits ' + entry.name);
    }
  }
  if (!reconLine || Number(reconLine[1]) !== summaryBeforeThisCheck.pass
    || Number(reconLine[2]) !== summaryBeforeThisCheck.warn
    || Number(reconLine[3]) !== summaryBeforeThisCheck.fail) {
    problems.push('RECON summary is stale (current ' + summaryBeforeThisCheck.pass + '/'
      + summaryBeforeThisCheck.warn + '/' + summaryBeforeThisCheck.fail + ')');
  }
  if (problems.length) fail('implementation report drift: ' + problems.join('; '));
  else info('implementation report matches gates.json, wird registration, and this recon summary');
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
