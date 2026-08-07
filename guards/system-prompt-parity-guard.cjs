// guards/system-prompt-parity-guard.cjs -- ONE SYSTEM PROMPT, AND THE SERVER OWNS IT.
//
// -- WHY THIS GATE EXISTS (D02ب) ---------------------------------------------
// The system prompt was built by index.html and shipped in the request body. The server
// forwarded whatever arrived. So the text governing what the model may say to a child was
// supplied by the client being governed -- every rule in it was advisory, and a hand-rolled
// POST could replace all of it.
//
// lib/system-prompt.js is now the only builder. This gate exists because moving a 900-line
// Arabic prompt is exactly the kind of change whose errors are invisible: a dropped diacritic,
// a normalised space, a re-ordered clause. None of those would show up in review, and all of
// them change what a child is told.
//
// -- WHAT IT PINS -------------------------------------------------------------
// A) The module is PURE. It is evaluated in a bare VM sandbox with no window, no document, no
//    localStorage. Anything reaching for a browser global throws, and that is a failure here.
// B) Output fingerprints across the measured range (young/teen/adult x chat/call x male/female)
//    are pinned by SHA-256. This is the check that still works after index.html stops carrying
//    a copy -- it does not depend on there being a second copy to compare against.
// C) The prompt only ever varies with {name, age, gender, mode}. Two calls with the same four
//    values return the same text, and each of the four demonstrably changes it.
// D) index.html no longer BUILDS a prompt to send. The client ships the four fields; if a
//    second copy of the builder ever reappears there, that is the drift this gate was written
//    to catch and it fails.
//
// Usage: node guards/system-prompt-parity-guard.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const esm = (rel) => import('file://' + path.join(REPO, rel).replace(/\\/g, '/'));

// The measured fingerprints. Generated, not typed: they came from the D02ب port proof, where
// the module and index.html's then-live copy were shown identical over 40 samples. Changing
// the prompt is allowed -- changing it WITHOUT re-measuring these is not.
const PINNED = [
  { age: 7,  gender: 'male',   mode: 'chat', name: 'خالد', len: 53590, sha: '4b34983184c904896c21b837b9a05599c94d2d91a44745ff7a227773ca2ba42f' },
  { age: 15, gender: 'female', mode: 'chat', name: 'هند',  len: 52079, sha: '4940f7cca468eb17a6a9d29e8bdf2b0f5b0101d4bd43cc83260f48b469e17f33' },
  { age: 30, gender: 'male',   mode: 'chat', name: 'خالد', len: 51859, sha: '8560d0133437301e0c053332994f3fc869c9a531dffa8300fd8b6d1894045ed0' },
  { age: 7,  gender: 'male',   mode: 'call', name: 'خالد', len: 66673, sha: 'd79f60840bac6cf9846838f1ac0f08b86bbd1e4276a2205baae5f4767fbf4487' },
  { age: 30, gender: 'female', mode: 'call', name: 'هند',  len: 64979, sha: 'd9a088d5dabd9d781e8c013aab2027a6b4bbbbcf5a411d8eac9de2bc0ca9efc6' },
];

(async function main() {
  console.log('=== system-prompt-parity-guard -- the server owns the prompt, and it has not drifted ===');

  // ── A. the module loads and is PURE ──────────────────────────────────────
  const src = read('lib/system-prompt.js');
  let MOD = null;
  try { MOD = await esm('lib/system-prompt.js'); }
  catch (e) {
    ok('lib/system-prompt.js loads', false, e.message);
    console.log('\n=== ' + (checks - failures) + '/' + checks + ' -- FAIL ===');
    process.exit(1);
  }
  ok('lib/system-prompt.js loads', true);
  ok('...and exports buildSystemPrompt', typeof MOD.buildSystemPrompt === 'function');
  ok('...and exports CLASSIFIER_SYSTEM_PROMPT', typeof MOD.CLASSIFIER_SYSTEM_PROMPT === 'string' && MOD.CLASSIFIER_SYSTEM_PROMPT.length > 200);
  ok('...and exports buildFastGenPrompt', typeof MOD.buildFastGenPrompt === 'function');

  // Purity: run the builder's own source in a sandbox with NOTHING in it. A reach for
  // window/document/localStorage is a ReferenceError, and that is the point.
  {
    const s = src.indexOf('export const buildSystemPrompt = ');
    const bodyFrom = src.slice(s + 'export '.length);
    let end = bodyFrom.indexOf('\n};\n');
    const fnSrc = bodyFrom.slice(0, end + 3);
    let pure = true, err = '';
    try {
      const ctx = vm.createContext({});
      const f = vm.runInContext('(function(){ ' + fnSrc + '\nreturn buildSystemPrompt; })()', ctx);
      const out = f('خالد', 7, 'male', 'chat');
      pure = typeof out === 'string' && out.length > 1000;
    } catch (e) { pure = false; err = e.message; }
    ok('the builder is PURE -- it runs with no browser globals at all', pure, err);
  }

  // ── B. pinned output fingerprints ────────────────────────────────────────
  for (const p of PINNED) {
    const t = MOD.buildSystemPrompt(p.name, p.age, p.gender, p.mode);
    ok('prompt pinned: age=' + p.age + ' ' + p.gender + ' ' + p.mode,
      t.length === p.len && sha(t) === p.sha,
      'expected len ' + p.len + ' sha ' + p.sha + '\n        actual   len ' + t.length + ' sha ' + sha(t));
  }

  // ── C. it varies with the four fields, and ONLY with them ────────────────
  {
    const base = () => MOD.buildSystemPrompt('خالد', 30, 'male', 'chat');
    ok('same four values -> same text (deterministic)', base() === base());
    ok('name changes it',   MOD.buildSystemPrompt('سعد', 30, 'male', 'chat') !== base());
    ok('age changes it',    MOD.buildSystemPrompt('خالد', 7, 'male', 'chat') !== base());
    ok('gender changes it', MOD.buildSystemPrompt('خالد', 30, 'female', 'chat') !== base());
    ok('mode changes it',   MOD.buildSystemPrompt('خالد', 30, 'male', 'call') !== base());
    ok('mode defaults to chat', MOD.buildSystemPrompt('خالد', 30, 'male') === base());
    // the band fork is the safety-relevant one: three distinct texts at the three boundaries
    const y = MOD.buildSystemPrompt('خالد', 12, 'male', 'chat');
    const t = MOD.buildSystemPrompt('خالد', 13, 'male', 'chat');
    const a = MOD.buildSystemPrompt('خالد', 18, 'male', 'chat');
    ok('the band fork is real at 12/13/18', y !== t && t !== a && y !== a);
    // An unusable age must NOT read as adult. parseInt('nonsense') is NaN, `|| 0` makes it 0,
    // and 0 is the young band -- the safest reading, which is the floor rule this codebase
    // applies everywhere else. Asserted by WHICH BAND BLOCK is emitted, not by whole-text
    // equality: the prompt prints the raw age back ("عمره nonsense سنة"), so the young text
    // for a garbled age is legitimately not byte-equal to the young text for 0.
    const YOUNG_MARK = 'أنت الآن مع صغيرٍ';
    const ADULT_MARK = 'أنت الآن مع راشدٍ';
    for (const bad of ['nonsense', '', null, undefined, {}, [], NaN]) {
      const t = MOD.buildSystemPrompt('خالد', bad, 'male', 'chat');
      ok('a garbled age (' + JSON.stringify(bad) + ') falls to the YOUNG band, never adult',
        t.indexOf(YOUNG_MARK) !== -1 && t.indexOf(ADULT_MARK) === -1);
    }
    ok('...while a real adult age still reaches the adult band', a.indexOf(ADULT_MARK) !== -1);
  }

  // ── D. the fast-channel pair ─────────────────────────────────────────────
  {
    ok('the classifier prompt emits only DEEN/GEN wording',
      /DEEN/.test(MOD.CLASSIFIER_SYSTEM_PROMPT) && /GEN/.test(MOD.CLASSIFIER_SYSTEM_PROMPT));
    ok('the classifier prompt carries NO reader fact',
      !/\$\{/.test(MOD.CLASSIFIER_SYSTEM_PROMPT));
    const f7 = MOD.buildFastGenPrompt(7), f9 = MOD.buildFastGenPrompt(9);
    ok('the fast answer prompt carries the age', f7 !== f9 && f7.indexOf('7') !== -1);
    ok('...and forbids religious content on the thin route', /لا تخُض في أيّ موضوعٍ دينيّ/.test(f7));
  }

  // ── E. THERE IS NO SECOND COPY ───────────────────────────────────────────
  //
  // This section was, at م٢, the parity proof: the module and the copy index.html still carried
  // were compared by OUTPUT over 40 samples and shown identical. م٤ then removed the client copy,
  // and this is its mirror image. It is the same guarantee stated from the other side -- one
  // builder, and the client does not own it -- and one of the two forms has been asserted at
  // every commit in between. The pinned fingerprints in (B) are what carry the prompt's identity
  // forward now that there is nothing left to compare against.
  {
    const html = read('index.html');
    ok('index.html declares no buildSystemPrompt of its own',
      html.indexOf('const buildSystemPrompt = ') === -1,
      'a second copy of the builder is back in the client -- that is the drift this gate exists for');
    ok('...and builds no prompt variable to ship', html.indexOf('__sysPrompt') === -1);
    ok('...and posts no `system` field on any route',
      html.indexOf('system: __sysPrompt') === -1 && !/\bsystem:\s*'أنت مصنِّف/.test(html),
      'the client is shipping a system prompt again');
    // the four fields REPLACED it -- absence of `system` is only half the contract
    ok('the client posts the four reader fields instead',
      /name: p\.name, age: p\.age, gender: p\.gender, mode/.test(html));
    // and `band` reaches all three routes, not two of them (م٥)
    ok('band is sent unconditionally, not gated on an endpoint',
      html.indexOf("...(endpoint === '/api/chat' ? { band:") === -1
      && html.indexOf("...(mode === 'chat' && endpoint === '/api/ask' ? { band:") === -1
      && /^\s*band: deriveCaps\(p\.age\)\.band,$/m.test(html),
      'a route-conditional band is back -- that is the hole api/chat-fast.js could not close alone');
    ok('...and the classifier turn carries it too',
      /max_tokens: 8[^\n]*band: deriveCaps\(p\.age\)\.band/.test(html));
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' -- FAIL ===' : ' -- PASS ==='));
  process.exit(failures ? 1 : 0);
})();
