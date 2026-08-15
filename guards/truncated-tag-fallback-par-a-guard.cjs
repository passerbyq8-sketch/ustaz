// guards/truncated-tag-fallback-par-a-guard.cjs — X-014: a cut-off tag must not delete the answer.
//
// THE DEFECT THIS GATE EXISTS TO PIN. stripIncompleteTags() removes a known tag that was opened
// and never closed, by cutting from the tag's index to the end of the string. When the truncated
// tag is the FIRST thing in the reply — a reply that opens with <steps …> or <hadith …> and is
// cut mid-stream — the cut index is 0 and the function returns the empty string. Both readers of
// the final reply start from that output: parseRichMessage() renders it, formatForTTS() speaks
// it. So a server answer that arrived with real prose in it reaches the child as a blank bubble
// and total silence, with nothing anywhere saying that something was dropped.
//
// WHAT IS MEASURED, AND WHY IT IS NOT A FILE SCAN. The text/babel block is extracted from the
// shipped index.html, transformed with the page's own pinned Babel major, and evaluated. The
// three functions driven below are the ones the page really ships. A regex over index.html would
// prove only that some characters are present somewhere.
//
// THE STREAMING PATHS ARE DELIBERATELY NOT RESCUED. formatForStreamPreview() and the call-mode
// feed() run on PARTIAL text, where an unclosed tag is the normal state of an arriving stream and
// cutting is exactly right. Rescuing there would print raw markup to the child mid-answer. The
// rescue is therefore opt-in and asserted below to be OFF by default.
//
// Offline and deterministic. No network, no model. Usage: node guards/truncated-tag-fallback-par-a-guard.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + label); return true; }
  fail++; failures.push(label);
  console.log('  FAIL  ' + label + (detail === undefined ? '' : '  |  ' + detail));
  return false;
}

// ── Boot the shipped client block ───────────────────────────────────────────
function bootClient(source) {
  const html = source === undefined ? fs.readFileSync(INDEX, 'utf8') : source;
  const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
  const mOpen = openRe.exec(html);
  if (!mOpen) throw new Error('no text/babel block in index.html');
  const from = mOpen.index + mOpen[0].length;
  const rawCode = html.slice(from, html.indexOf('</script>', from));

  const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
  const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
  const babelMajor = verMatch ? parseInt(verMatch[1], 10) : 8;
  const jsxRuntime = babelMajor >= 8 ? 'automatic' : 'classic';

  const transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    configFile: false, babelrc: false,
  }).code;

  const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  try { if (!window.TextDecoder) window.TextDecoder = TextDecoder; } catch (e) {}
  try { if (!window.TextEncoder) window.TextEncoder = TextEncoder; } catch (e) {}
  try { if (!window.AbortController) window.AbortController = AbortController; } catch (e) {}
  try { window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } catch (e) {}
  try { window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch (e) {}
  global.window = window; global.document = window.document; global.navigator = window.navigator;

  // The vendored React is a UMD bundle: it reaches for `self`/`globalThis` and assigns onto it.
  // linkedom's window has neither, so without these two the bundle throws before React exists.
  try { window.self = window; } catch (e) {}
  try { window.globalThis = window; } catch (e) {}
  const ctx = vm.createContext(window);
  const vendor = path.join(ROOT, 'vendor');
  for (const f of ['react.umd.js', 'react-dom.umd.js']) {
    vm.runInContext(fs.readFileSync(path.join(vendor, f), 'utf8'), ctx, { filename: f });
  }
  vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
  window.console.error = () => {};
  window.addEventListener('error', () => {});
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });

  const grab = (expr) => {
    try { return vm.runInContext('(' + expr + ')', ctx, { filename: 'guard-api' }); }
    catch (e) { return undefined; }
  };
  return { grab };
}

// ── The fixtures. Each is a NON-EMPTY server answer whose known tag never closed. ──
// Chosen so the truncated tag sits at index 0, which is the case that empties the reply
// completely rather than merely shortening it.
const FIXTURES = [
  {
    id: 'steps-cut-at-zero',
    text: '<steps title="خطواتُ الوضوء">\n١. النيّةُ بالقلب.\n٢. غسلُ الكفّين ثلاثًا.\n٣. المضمضةُ والاستنشاق',
    words: ['النيّة', 'غسلُ الكفّين'],
  },
  {
    id: 'hadith-cut-at-zero',
    text: '<hadith narrator="البخاريّ" ruling="صحيح">إنّما الأعمالُ بالنيّات، وإنّما لكلِّ امرئٍ ما نوى',
    words: ['الأعمالُ بالنيّات'],
  },
  {
    id: 'prose-then-cut-tag',
    text: 'الوضوءُ طهارةٌ عظيمة، وهذه صفتُه.\n<steps title="الصفة">\n١. النيّة',
    words: ['الوضوءُ طهارةٌ عظيمة'],
  },
];

// Text visible to the reader after the rich parse — prose only, tags excluded.
function renderedProse(parse, text, age) {
  const out = parse(text, age === undefined ? 30 : age);
  const segs = (out && out.segments) || [];
  return segs.filter((s) => s && s.type === 'text').map((s) => String(s.content || '')).join(' ').trim();
}

function runSuite(client, phase) {
  const strip = client.grab('stripIncompleteTags');
  const parse = client.grab('parseRichMessage');
  const tts = client.grab('formatForTTS');
  const preview = client.grab('formatForStreamPreview');

  if (!ok(phase + ': the three shipped readers are on the page',
    typeof strip === 'function' && typeof parse === 'function' && typeof tts === 'function')) return;

  for (const f of FIXTURES) {
    ok(phase + ' [' + f.id + '] the server text is not empty to begin with', f.text.trim().length > 0);

    const shown = renderedProse(parse, f.text);
    ok(phase + ' [' + f.id + '] the reader is shown the prose that survived', shown.length > 0,
      'rendered prose is EMPTY -- the whole answer vanished');
    if (shown.length > 0) {
      ok(phase + ' [' + f.id + '] and it is the real prose, not a placeholder',
        f.words.every((w) => shown.includes(w)), JSON.stringify(shown.slice(0, 80)));
      ok(phase + ' [' + f.id + '] with no raw markup left in it',
        !/[<>]/.test(shown), JSON.stringify(shown.slice(0, 80)));
    }

    const spoken = String(tts(f.text) || '').trim();
    ok(phase + ' [' + f.id + '] TTS has something to say', spoken.length > 0,
      'TTS text is EMPTY -- the child hears silence');
    if (spoken.length > 0) {
      ok(phase + ' [' + f.id + '] and TTS carries no raw markup', !/[<>]/.test(spoken),
        JSON.stringify(spoken.slice(0, 80)));
    }
  }

  // The rescue must be recorded, not silent.
  const log = client.grab('EZIK_TAG_RESCUES');
  ok(phase + ': the client records a degraded entry when it rescues',
    Array.isArray(log) && log.length > 0, 'no degraded record was written');
  if (Array.isArray(log) && log.length) {
    ok(phase + ': each degraded record names the tag it rescued from',
      log.every((r) => r && typeof r.tag === 'string' && r.tag.length > 0
        && typeof r.reason === 'string' && r.reason.length > 0),
      JSON.stringify(log.slice(0, 2)));
  }

  // Streaming must NOT be rescued: a partial tag mid-stream is normal and must still be cut.
  if (typeof preview === 'function') {
    const partial = 'الجوابُ يبدأ هنا <steps title="خطوات';
    const p = String(preview(partial) || '');
    ok(phase + ': the streaming preview still CUTS a partial tag (no rescue there)',
      !p.includes('<steps') && !p.includes('title='), JSON.stringify(p.slice(0, 60)));
  }
  ok(phase + ': the default (stream) behaviour of the cleaner is still to cut',
    String(strip('<steps title="x">abc') || '') === '',
    'the rescue must be opt-in, or every streaming caller inherits it');
}

// ── MUTANTS ─────────────────────────────────────────────────────────────────
// Each rewrites the shipped index.html source in memory and requires this gate to notice.
// A mutation that does not change the source is a hard error, never a pass.
function mutants() {
  console.log('\n--- C. REQUIRED MUTANTS ---');
  const original = fs.readFileSync(INDEX, 'utf8');

  const cases = [
    {
      name: 'disable-the-rescue',
      // Neuter the rescue: the cleaner goes back to returning the empty string.
      apply: (s) => s.replace('if (opts && opts.rescue && out.trim() === \'\' && text.trim() !== \'\')',
        'if (false && opts && opts.rescue && out.trim() === \'\' && text.trim() !== \'\')'),
    },
    {
      name: 'rescue-without-sanitising',
      // Rescue, but hand back the raw server text — raw markup reaches the child and ElevenLabs.
      apply: (s) => s.replace('const rescued = rescueTruncated(text);', 'const rescued = text;'),
    },
  ];

  for (const c of cases) {
    const changed = c.apply(original);
    if (changed === original) {
      fail++; failures.push('MUTANT ' + c.name + ' seam moved');
      console.log('  FAIL  MUTANT ' + c.name + ': seam moved, mutation did not apply');
      continue;
    }
    let survived = true;
    const before = fail;
    try {
      const client = bootClient(changed);
      const parse = client.grab('parseRichMessage');
      const tts = client.grab('formatForTTS');
      const f = FIXTURES[0];
      const shown = renderedProse(parse, f.text);
      const spoken = String(tts(f.text) || '').trim();
      if (c.name === 'disable-the-rescue') survived = shown.length > 0 && spoken.length > 0;
      else survived = !/[<>]/.test(shown) && !/[<>]/.test(spoken);
    } catch (e) { survived = false; }
    fail = before;
    ok('MUTANT KILLED: ' + c.name, !survived, 'the defect was reintroduced and this gate stayed green');
  }
}

(function main() {
  console.log('=== truncated-tag-fallback-par-a-guard -- X-014: a cut tag must not empty the answer ===');
  try {
    console.log('\n--- A/B. SHIPPED CLIENT, FINAL-TEXT READERS ---');
    runSuite(bootClient(), 'live');
    if (process.argv.includes('--mutants')) mutants();
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) { console.log('-- FAILURES --'); for (const f of failures) console.log('   ' + f); }
  process.exit(fail === 0 ? 0 : 1);
})();
