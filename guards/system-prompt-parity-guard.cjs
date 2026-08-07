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

  // ── E. PARITY with the copy index.html still carries ─────────────────────
  //
  // STAGE NOTE, so the next reader is not misled: at this commit (م٢ of D02ب) index.html STILL
  // builds and ships the prompt. The move is not done, and this section is the proof that the
  // extraction was verbatim -- the two copies are compared by OUTPUT over the whole measured
  // range, not by eye. When م٤ takes the builder out of the client, this section is replaced
  // in that same commit by its mirror image: "there is no second copy any more". One of the
  // two must always be asserted; a gate that silently checks neither is how a stale copy
  // survives a migration.
  {
    const lines = read('index.html').split(/\r?\n/);
    const s = lines.findIndex((l) => l.startsWith('const buildSystemPrompt = '));
    let e = -1;
    for (let i = s + 1; i < lines.length; i++) if (lines[i] === '};') { e = i; break; }
    if (!ok('index.html still carries the client copy (expected at this stage)', s !== -1 && e !== -1)) {
      console.log('        if the client copy was just REMOVED, this section is the one to replace -- see the stage note above');
    } else {
      const clientSrc = lines.slice(s, e + 1).join('\n');
      let cb = null, err = '';
      try {
        const ctx = vm.createContext({});
        cb = vm.runInContext('(function(){ ' + clientSrc + '\nreturn buildSystemPrompt; })()', ctx);
      } catch (ex) { err = ex.message; }
      if (ok('...and it too is pure enough to evaluate standalone', cb !== null, err)) {
        let n = 0, bad = 0;
        for (const age of [4, 7, 12, 13, 15, 17, 18, 30, 65, 90])
          for (const gender of ['male', 'female'])
            for (const mode of ['chat', 'call']) {
              const name = gender === 'female' ? 'هند' : 'خالد';
              n++;
              if (cb(name, age, gender, mode) !== MOD.buildSystemPrompt(name, age, gender, mode)) bad++;
            }
        ok('client copy and lib module are IDENTICAL over ' + n + ' samples', bad === 0, bad + ' mismatched');
      }
      // the two chat-fast literals, still inline in the client
      const clsLine = lines.find((l) => l.indexOf('أنت مصنِّفُ مساراتٍ فقط') !== -1) || '';
      const co = clsLine.indexOf("system: '") + "system: '".length;
      ok('the classifier literal matches the module',
        clsLine.slice(co, clsLine.indexOf("', messages:", co)) === MOD.CLASSIFIER_SYSTEM_PROMPT);
      const fastLine = lines.find((l) => l.indexOf('__sysPrompt = `') !== -1) || '';
      const fo = fastLine.indexOf('__sysPrompt = `') + '__sysPrompt = `'.length;
      const tpl = fastLine.slice(fo, fastLine.lastIndexOf('`'));
      let fbad = 0;
      for (const age of [4, 7, 12, 15, 30]) if (tpl.split('${p.age}').join(String(age)) !== MOD.buildFastGenPrompt(age)) fbad++;
      ok('the fast-GEN literal matches the module', fbad === 0);
    }
  }

  console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? ' -- FAIL ===' : ' -- PASS ==='));
  process.exit(failures ? 1 : 0);
})();
