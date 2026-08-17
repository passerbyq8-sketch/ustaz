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
  // ── VERSE AND SURAH AT POSITION 0 (أ-٧ / CI-01) ──────────────────────────
  // These two tags were the ONLY ones the rescue deleted to the end of the text instead of to
  // the end of the tag, so a reply that opened with a cut āyah and continued in ordinary prose
  // reached the child as nothing at all — 0 characters shown, 0 spoken, 0 in the parents' log.
  // Both shapes are pinned: WITH prose after the tag, where the prose must survive, and WITHOUT
  // it, where there is genuinely nothing to rescue and the RECORD is what must still be written.
  {
    id: 'verse-cut-at-zero-with-prose',
    text: '<verse surah="البقرة" ayah="٢٥٥">اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ\nوهذا شرحٌ نثريٌّ حقيقيٌّ بعد الآية يجب أن يصل الطفل.',
    words: ['شرحٌ نثريٌّ حقيقيٌّ'],
  },
  {
    id: 'surah-cut-at-zero-with-prose',
    text: '<surah num="112" from="1" to="4">قل هو الله أحد\nونصيحةٌ نثريّةٌ للطفل بعدها.',
    words: ['ونصيحةٌ نثريّةٌ للطفل'],
  },
  {
    id: 'verse-cut-at-zero-no-prose',
    text: '<verse surah="الفاتحة" ayah="١">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    words: [],
    // Nothing follows the tag, so there is no prose to show. The reply is still EMPTIED, and an
    // emptying with nothing to rescue is the case the old code recorded nowhere at all.
    expectEmpty: true,
  },
  // REPLACED (أ-٧). The old `prose-then-cut-tag` fixture was SCENERY: its prose sits BEFORE the
  // tag, so stripIncompleteTags never empties it, the rescue never runs, and it measured ZERO
  // rescue records while appearing to test the rescue. It is replaced by a fixture whose prose
  // sits AFTER the cut tag — which is the only arrangement that actually empties the reply and
  // therefore the only one that drives the code this gate exists to hold.
  {
    id: 'cut-tag-then-prose',
    text: '<steps title="الصفة">\n١. النيّة\nوبعد الخطوات نصيحةٌ نثريّةٌ لا علاقة لها بالوسم.',
    words: ['نصيحةٌ نثريّةٌ لا علاقة لها بالوسم'],
    mustRescue: true,
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
  const log = client.grab('formatForLog');
  const preview = client.grab('formatForStreamPreview');
  const rescues = client.grab('EZIK_TAG_RESCUES');

  // FOUR readers, not three. formatForLog is the parents' log — the surface a parent opens to
  // check what their child was told — and it was the one reader this gate never drove, so an
  // answer could vanish from it while the other three were proven fine.
  if (!ok(phase + ': the four shipped final-text readers are on the page',
    typeof strip === 'function' && typeof parse === 'function' && typeof tts === 'function'
      && typeof log === 'function')) return;

  for (const f of FIXTURES) {
    ok(phase + ' [' + f.id + '] the server text is not empty to begin with', f.text.trim().length > 0);
    const before = Array.isArray(rescues) ? rescues.length : 0;

    const shown = renderedProse(parse, f.text);
    const spoken = String(tts(f.text) || '').trim();
    const logged = String(log(f.text) || '').trim();

    if (f.expectEmpty) {
      // Nothing followed the tag, so no reader can be given prose. What must NOT happen is that
      // the emptying goes unrecorded — see the rescue-ledger assertion below.
      ok(phase + ' [' + f.id + '] there is genuinely no prose to rescue', shown.length === 0);
    } else {
      for (const [reader, text] of [['display', shown], ['TTS', spoken], ['parent log', logged]]) {
        ok(phase + ' [' + f.id + '] the ' + reader + ' keeps the prose that survived', text.length > 0,
          reader + ' is EMPTY -- the whole answer vanished');
        if (text.length > 0) {
          ok(phase + ' [' + f.id + '] ...and the ' + reader + ' carries the REAL prose',
            f.words.every((w) => text.includes(w)), JSON.stringify(text.slice(0, 90)));
          ok(phase + ' [' + f.id + '] ...with no raw markup in the ' + reader,
            !/[<>]/.test(text), JSON.stringify(text.slice(0, 90)));
        }
      }
    }

    // EVERY fixture must have driven the rescue. A fixture that records nothing is scenery: it
    // asserts against code that never ran, which is exactly what `prose-then-cut-tag` did.
    const added = (Array.isArray(rescues) ? rescues.length : 0) - before;
    ok(phase + ' [' + f.id + '] the rescue path actually RAN for this fixture', added > 0,
      'zero rescue records: this fixture does not empty the reply, so it tests nothing');
  }

  // The rescue must be recorded, not silent.
  ok(phase + ': the client records a degraded entry when it rescues',
    Array.isArray(rescues) && rescues.length > 0, 'no degraded record was written');
  if (Array.isArray(rescues) && rescues.length) {
    ok(phase + ': each degraded record names the tag it rescued from',
      rescues.every((r) => r && typeof r.tag === 'string' && r.tag.length > 0
        && typeof r.reason === 'string' && r.reason.length > 0),
      JSON.stringify(rescues.slice(0, 2)));
    // AND IT IS WRITTEN EVEN WHEN NOTHING SURVIVES. `if (rescued)` used to guard the ledger write
    // as well as the return, so the worst case — an answer emptied with no prose to recover —
    // left no trace anywhere and was indistinguishable from "the model said nothing".
    ok(phase + ': an emptying with NOTHING to rescue is still recorded',
      rescues.some((r) => r && r.rescued === false),
      'no unrescuable emptying was recorded: ' + JSON.stringify(rescues.map((r) => r && r.reason)));
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

// ── B2. §٤ — THE REVIEW MARK IS A LABEL, AND A LABEL IS NOT SPOKEN ──────────
//
// K-5 (XI-04) made 【…】 a badge on the SCREEN and took the brackets off the CLIPBOARD. The VOICE
// was outside that item's scope and was left as it was — so of the four readers this gate exists
// to protect, one was still being handed the raw mark and read «فهمٌ لا فتوى» out loud in the
// middle of the answer. Every other tag on the page is either rewritten to natural speech or
// silenced; this was the one that was neither.
//
// THE INFORMATION IS NOT TAKEN FROM THE READER, and that is what the negative witnesses below are
// for. The badge is still drawn, and a notice's own sentence is prose and must still be spoken in
// full. Only the bracketed LABEL goes. An assertion that the mark is gone, on its own, would be
// satisfied just as well by a voice that had gone silent.
//
// THE FIXTURES ARE READ OFF THE PRODUCER, NOT RETYPED. lib/output-reviewer.js is the only writer
// of these marks and is not this round's file to edit, so the strings are lifted from its source
// verbatim. This is not tidiness: the marks carry Arabic diacritics, retyping puts the shadda and
// the damma in a different ORDER than the file holds them, and the assertion then compares two
// strings that look identical and are not — a green assertion about nothing.
// SCOPED TO THE `TAGS` DECLARATION, not to the whole file, and the difference is not cosmetic.
// Reading every 【…】 in the source picks up the prose comment at :669 as a FOURTH mark — it
// spells «فهمٌ لا نصٌّ منقول» with the damma before the shadda where the constant at :9 has the
// shadda before the damma. Same NFC, same rendering, different code units, so `Set` keeps both.
// That is this file demonstrating the retyping hazard on itself, and it is the reason the strings
// below are lifted from the DECLARATION and the reason index.html matches the mark by its
// brackets rather than by its letters.
function reviewMarks() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'output-reviewer.js'), 'utf8');
  const tagsAt = src.indexOf('const TAGS = Object.freeze({');
  const tagsBlock = tagsAt === -1 ? '' : src.slice(tagsAt, src.indexOf('});', tagsAt));
  const marks = [...new Set(tagsBlock.match(/【[^】\n]{1,80}】/gu) || [])];
  const start = src.indexOf('const NOTICES = Object.freeze({');
  const block = start === -1 ? '' : src.slice(start, src.indexOf('});', start));
  const bodies = [...block.matchAll(/\+\s*'([^']+)'/gu)].map((m) => m[1]);
  return { marks, bodies };
}

function reviewMarkSuite(client, phase) {
  console.log('\n--- B2. the review mark is not spoken ---');
  const tts = client.grab('formatForTTS');
  const { marks, bodies } = reviewMarks();
  // The pairing below is positional, so the shape it assumes is asserted rather than trusted:
  // three marks, and a notice for all but the first (which `tag()` appends bare).
  if (!ok(phase + ': the review marks were read off lib/output-reviewer.js, not retyped',
    typeof tts === 'function' && marks.length === 3 && bodies.length === marks.length - 1,
    'marks=' + marks.length + ' bodies=' + bodies.length)) return;

  // Prose either side of the mark. Defined once and compared against itself, never against a
  // string retyped elsewhere.
  const BEFORE = 'وإن توضأ منها احتياطا فحسن لا واجب.';
  const AFTER = 'وهذا الذي عليه عامة أهل العلم.';

  marks.forEach((mark, i) => {
    // Shape (a) — `tag()` appends the bare mark straight after the sentence it is about.
    const spoken = String(tts(BEFORE + mark + ' ' + AFTER) || '');
    ok(phase + ' [mark ' + i + ']: the mark is not spoken when it closes a sentence',
      !spoken.includes(mark), JSON.stringify(spoken.slice(0, 140)));
    ok(phase + ' [mark ' + i + ']: ...and neither ornate bracket reaches the voice',
      !spoken.includes('【') && !spoken.includes('】'), JSON.stringify(spoken.slice(0, 140)));
    // NEGATIVE WITNESS 1 — the answer's own prose is still spoken, on BOTH sides, and the two
    // sentences are not welded together by deleting the mark to nothing.
    ok(phase + ' [mark ' + i + ']: ...while the prose either side of it is spoken, whole and apart',
      spoken.includes(BEFORE + ' ' + AFTER), JSON.stringify(spoken.slice(0, 160)));
  });

  bodies.forEach((body, i) => {
    // Shape (b) — a NOTICE is `mark + ' ' + sentence`, its own line.
    const mark = marks[i + 1];
    const spoken = String(tts(mark + body) || '');
    ok(phase + ' [notice ' + i + ']: the notice\'s label is not spoken',
      !spoken.includes(mark), JSON.stringify(spoken.slice(0, 140)));
    // NEGATIVE WITNESS 2 — the notice's SENTENCE is the honest disclosure the reader is owed. It
    // is prose, not a label, and dropping it with the label would be a removal, not a repair.
    ok(phase + ' [notice ' + i + ']: ...while its sentence is still spoken in full',
      spoken.includes(body.trim()), JSON.stringify(spoken.slice(0, 200)));
  });
}

// ── B3. §٣ — THE MARK IS A BADGE IN THE PARENT LOG TOO, NOT RAW CHARACTERS ──
//
// THE FOURTH READER, AND THE LAST ONE HOLDING THE DEFECT. K-5/XI-04 made 【…】 a badge on the SCREEN
// and took the ornate pair off the CLIPBOARD; §٤ of the A-3 round took it out of the VOICE. The
// parents' log kept it verbatim — and the owner's objection to the mark was its SHAPE, «بين قوسينِ
// غريبين», so the surface a parent opens in order to check what their child was told was still
// showing exactly the thing that was complained about.
//
// AND THE TWO HALVES ARE ASSERTED SEPARATELY, BECAUSE ONLY ONE OF THEM IS TRUE OF THE VOICE.
//   the voice DROPS the label — a label is not a sentence to read aloud (B2 above)
//   the log KEEPS it — a parent checking an answer needs to know it was understanding and not a
//                      sourced fatwa. «ولا تُنزَعِ المعلومةُ» is §٣'s own clause.
// So «no ornate brackets» alone would be satisfied by a log that had DELETED the mark, which is the
// one outcome §٣ forbids. Every case below therefore asserts the label's words are still there.
//
// THE SHAPE IS THIS SURFACE'S OWN BADGE. `formatForLog` already emits ` [المصدر: …] `,
// ` [سورة …، آية …] ` and ` [تلاوة سورة …] `, so the review mark joins that idiom rather than
// inventing a second one. Asserted below by reading those forms out of index.html, so the claim
// «the log's own idiom» is checked and not merely stated.
function reviewMarkLogSuite(client, phase) {
  console.log('\n--- B3. the review mark is a badge in the parent log ---');
  const log = client.grab('formatForLog');
  const { marks, bodies } = reviewMarks();
  if (!ok(phase + ': the parent log reader is on the page and the marks were read off the producer',
    typeof log === 'function' && marks.length === 3 && bodies.length === marks.length - 1,
    'marks=' + marks.length + ' bodies=' + bodies.length)) return;

  const BEFORE = 'وإن توضأ منها احتياطا فحسن لا واجب.';
  const AFTER = 'وهذا الذي عليه عامة أهل العلم.';

  marks.forEach((mark, i) => {
    // The label's own words, taken from the mark itself so nothing is retyped. See `reviewMarks`
    // for why retyping a mark that carries diacritics is a green assertion about nothing.
    const label = mark.slice(1, -1).trim();
    // Shape (a) — `tag()` appends the bare mark straight after the sentence it is about.
    const logged = String(log(BEFORE + mark + ' ' + AFTER) || '');
    ok(phase + ' [mark ' + i + ']: neither ornate bracket reaches the parent log',
      !logged.includes('【') && !logged.includes('】'), JSON.stringify(logged.slice(0, 160)));
    // NEGATIVE WITNESS — §٣: «ولا تُنزَعِ المعلومةُ». The meaning stays visible to the parent.
    ok(phase + ' [mark ' + i + ']: ...and the label\'s own words are still there for the parent',
      logged.includes(label), JSON.stringify(logged.slice(0, 160)));
    ok(phase + ' [mark ' + i + ']: ...set off as a badge in the log\'s own idiom, [ … ]',
      logged.includes('[' + label + ']'), JSON.stringify(logged.slice(0, 160)));
    // ...and the prose either side survives, whole and not welded together by the substitution.
    ok(phase + ' [mark ' + i + ']: ...while the prose either side is kept, whole and apart',
      logged.includes(BEFORE) && logged.includes(AFTER)
        && logged.indexOf(BEFORE) < logged.indexOf(AFTER), JSON.stringify(logged.slice(0, 200)));
  });

  bodies.forEach((body, i) => {
    // Shape (b) — a NOTICE is `mark + ' ' + sentence` on its own line. Both halves must arrive.
    const mark = marks[i + 1];
    const label = mark.slice(1, -1).trim();
    const logged = String(log(mark + body) || '');
    ok(phase + ' [notice ' + i + ']: the notice\'s label arrives as a badge, not as raw characters',
      logged.includes('[' + label + ']') && !logged.includes('【'), JSON.stringify(logged.slice(0, 200)));
    ok(phase + ' [notice ' + i + ']: ...and its sentence arrives in full',
      logged.includes(body.trim()), JSON.stringify(logged.slice(0, 240)));
  });

  // A mark inside a CARD BODY is not the prose's, and the log renders card bodies through their own
  // converters. Driven so the substitution is known not to reach inside one and mangle it.
  const inCard = '<steps title="خطوات">\n١. اغسل رجليك\n</steps>\n' + marks[0] + ' ' + AFTER;
  const loggedCard = String(log(inCard) || '');
  ok(phase + ': a card body is unharmed by the substitution, and the mark after it is still a badge',
    loggedCard.includes('اغسل رجليك') && loggedCard.includes('[' + marks[0].slice(1, -1).trim() + ']')
      && !loggedCard.includes('【'), JSON.stringify(loggedCard.slice(0, 200)));

  // AND THE IDIOM IS THE SURFACE'S OWN, read out of the file rather than asserted about it.
  const index = fs.readFileSync(INDEX, 'utf8');
  for (const form of ['` [المصدر: ${s}] `', '` [${ref}] `', '` [تلاوة سورة ${name}${rangePart}] `']) {
    ok(phase + ': the log already sets a label off with [ … ] — ' + form.slice(0, 22),
      index.includes(form.replace(/`/g, '')), form);
  }
  // Matched by the BRACKETS and not by the label text — the same constant the screen badge and the
  // voice use, for the reason `reviewMarks` records about the two mark orders in one file.
  ok(phase + ': the log matches the mark by EZIK_NOTICE_ALL, not by the label\'s letters',
    /t = t\.replace\(EZIK_NOTICE_ALL, \(_all, label\) =>/u.test(index));
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
    {
      name: 'verse-tag-eats-the-tail-again',
      // Put the tail-cut back: the āyah tag deletes to the END OF THE TEXT rather than to the end
      // of its own extent. This is CI-01 exactly, and the fixtures whose prose follows the tag
      // must go dark.
      apply: (s) => s.replace(
        'const VERSE_TAG_EXTENT = /<(verse|surah)\\b[^>]*>(?:[\\s\\S]*?<\\/\\1>|[^<\\n]*)/g;',
        'const VERSE_TAG_EXTENT = /<(verse|surah)\\b[^>]*>[\\s\\S]*$/g;'),
      check: (parse, tts, log) => {
        const f = FIXTURES.find((x) => x.id === 'verse-cut-at-zero-with-prose');
        return renderedProse(parse, f.text).length > 0 && String(tts(f.text) || '').trim().length > 0;
      },
    },
    {
      name: 'ledger-written-only-when-something-survives',
      // Restore the `if (rescued)` guard around the ledger write: an emptying with nothing to
      // recover goes back to leaving no trace at all.
      // Single-line seam on purpose: index.html is CRLF in the working tree and LF in the object
      // store, so any mutation anchor that spans a line break matches in one checkout and not the
      // other — and a seam that silently fails to apply is a mutant that silently never runs.
      apply: (s) => s.replace('    EZIK_TAG_RESCUES.push({', '    if (rescued) EZIK_TAG_RESCUES.push({'),
      ledger: true,
    },
    {
      name: 'the-review-mark-is-spoken-again',
      // §٤ removed. This is the shipped behaviour of 17 August: the badge is drawn on the screen
      // and the clipboard is clean, and the listener is still read «فهمٌ لا فتوى» mid-answer.
      // Single-line seam, for the CRLF/LF reason recorded on the mutant above.
      apply: (s) => s.replace('  t = t.replace(EZIK_NOTICE_ALL, \' \');',
        '  // mutant: the review mark goes back to the voice'),
      check: (parse, tts) => reviewMarks().marks.every((m) =>
        !String(tts('وإن توضأ منها احتياطا فحسن لا واجب.' + m) || '').includes(m)),
    },
    {
      name: 'the-review-mark-is-raw-characters-in-the-parent-log-again',
      // §٣ removed. This is the state A-3 declared and left open: the badge is on the screen, the
      // clipboard is clean, the voice is clean — and the parents' log still shows 【فهمٌ لا فتوى】
      // as raw characters, which is the very shape the owner objected to.
      apply: (s) => s.replace(
        '  t = t.replace(EZIK_NOTICE_ALL, (_all, label) => \' [\' + String(label || \'\').trim() + \'] \');',
        '  // mutant: the ornate pair goes back to the parents\' log'),
      // THE PROPERTY IS BOTH HALVES AT ONCE. «No ornate bracket» alone would also be satisfied by a
      // log that DELETED the mark, and §٣ forbids that outcome by name — so the label's words have
      // to be there as well. A mutant that merely drops the mark dies on the second clause.
      check: (parse, tts, logFn) => reviewMarks().marks.every((m) => {
        const label = m.slice(1, -1).trim();
        const logged = String(logFn('وإن توضأ منها احتياطا فحسن لا واجب.' + m) || '');
        return !logged.includes('【') && !logged.includes('】') && logged.includes('[' + label + ']');
      }),
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
      const logFn = client.grab('formatForLog');
      const f = FIXTURES[0];
      const shown = renderedProse(parse, f.text);
      const spoken = String(tts(f.text) || '').trim();
      if (c.ledger) {
        // Drive every fixture, then ask whether the unrescuable emptying left a record.
        const rescues = client.grab('EZIK_TAG_RESCUES');
        for (const fx of FIXTURES) { renderedProse(parse, fx.text); tts(fx.text); logFn(fx.text); }
        survived = Array.isArray(rescues) && rescues.some((r) => r && r.rescued === false);
      } else if (typeof c.check === 'function') {
        survived = c.check(parse, tts, logFn);
      } else if (c.name === 'disable-the-rescue') survived = shown.length > 0 && spoken.length > 0;
      else survived = !/[<>]/.test(shown) && !/[<>]/.test(spoken);
    } catch (e) { survived = false; }
    fail = before;
    ok('MUTANT KILLED: ' + c.name, !survived, 'the defect was reintroduced and this gate stayed green');
  }
}

// ── C. THE SERVER SIDE OF THE SAME DEFECT (merge §٥) ────────────────────────
//
// SAME DEFECT, ONE LAYER UP, AND IT WAS NAMED AND LEFT OPEN. Branch أ's report item 11 recorded
// that api/ask.js strips an UNCLOSED `<source` tag with `[\s\S]*$` — cut to the END OF THE STRING
// — while its two twins had already been corrected to stop at the tag's own boundary:
// lib/finalized-sse-writer.js `stripUnownedSourceCards` uses `[^<\n]*`, and
// lib/route-classify.js `createSourceFilter` ends an unclosed card's extent at a newline.
//
// WHAT THAT COST, MEASURED on the two shapes below: an unclosed tag in the MIDDLE of a reply
// deleted every sentence after it, and an unclosed tag at the START of a reply deleted the reply.
// That is this gate's own headline defect — «a cut tag must not empty the answer» — arriving on
// the server instead of in the browser, at NINE call sites: the child benign draft, the identity
// draft, the world draft, the ruling draft and the entity-repair draft among them.
//
// The repair is the twins' expression, verbatim, at all nine.
function serverStrip() {
  console.log('\n--- C. api/ask.js: an unclosed <source> must not eat the rest of the answer ---');
  const ask = fs.readFileSync(path.join(ROOT, 'api', 'ask.js'), 'utf8');
  const WRITER = fs.readFileSync(path.join(ROOT, 'lib', 'finalized-sse-writer.js'), 'utf8');

  const OLD_FORM = /\.replace\(\/<source\\b\[\^>\]\*>\?\[\\s\\S\]\*\$\/i, ''\)/g;
  const NEW_FORM = /\.replace\(\/<source\\b\[\^>\]\*>\?\[\^<\\n\]\*\/giu, ''\)/g;
  const oldCount = (ask.match(OLD_FORM) || []).length;
  const newCount = (ask.match(NEW_FORM) || []).length;
  ok('C1 no buffered draft still cuts to the end of the string', oldCount === 0, 'found ' + oldCount);
  ok('C2 every one of the nine sites now uses the tag-bounded form', newCount === 9, 'found ' + newCount);
  ok('C3 ...and it is the twin\'s expression, not a third dialect',
    /\.replace\(\/<source\\b\[\^>\]\*>\?\[\^<\\n\]\*\/giu, ''\)/.test(WRITER),
    'lib/finalized-sse-writer.js no longer carries the form this was unified with');

  // Executed, not scanned: both expressions are run over the two shapes that matter.
  const strip = (second) => (text) => String(text)
    .replace(/<source\b[^>]*>[\s\S]*?<\/source>/gi, '').replace(second, '').trim();
  const fixed = strip(/<source\b[^>]*>?[^<\n]*/giu);
  const broken = strip(/<source\b[^>]*>?[\s\S]*$/i);
  const MID = 'الجواب الأول.\n<source site="x" url="https://a/b">عنوان\nوالجواب الثاني، وهو الأهم.';
  const HEAD = '<source site="x" url="https://a/b">عنوان\nكل الجواب هنا.';
  const CLOSED = 'الجواب الأول. <source site="x" url="https://a/b">عنوان</source>\nوالجواب الثاني.';

  ok('C4 an unclosed tag mid-answer no longer deletes what follows it',
    fixed(MID).includes('والجواب الثاني') && !broken(MID).includes('والجواب الثاني'), JSON.stringify(fixed(MID)));
  ok('C5 an unclosed tag at the START no longer empties the whole reply',
    fixed(HEAD) === 'كل الجواب هنا.' && broken(HEAD) === '', JSON.stringify(fixed(HEAD)));
  ok('C6 the tag itself is still removed — this widens no markup through',
    !/[<>]/.test(fixed(MID)) && !/[<>]/.test(fixed(HEAD)), JSON.stringify([fixed(MID), fixed(HEAD)]));
  ok('C7 a WELL-FORMED card is treated exactly as before — the repair is scoped to the broken shape',
    fixed(CLOSED) === broken(CLOSED), JSON.stringify([fixed(CLOSED), broken(CLOSED)]));

  // The mutant is the pre-repair expression itself, run over the same two shapes.
  ok('C8 MUTANT KILLED: restoring `[\\s\\S]*$` empties the reply again',
    broken(HEAD) === '' && broken(MID) !== fixed(MID),
    'the old expression no longer differs from the new one, so C4/C5 prove nothing');
}

(function main() {
  console.log('=== truncated-tag-fallback-par-a-guard -- X-014: a cut tag must not empty the answer ===');
  try {
    console.log('\n--- A/B. SHIPPED CLIENT, FINAL-TEXT READERS ---');
    const liveClient = bootClient();
    runSuite(liveClient, 'live');
    reviewMarkSuite(liveClient, 'live');
    reviewMarkLogSuite(liveClient, 'live');
    serverStrip();
    if (process.argv.includes('--mutants')) mutants();
  } catch (e) {
    console.error('GUARD ERROR:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('\n=== ' + pass + '/' + (pass + fail) + ' — ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ===');
  if (fail) { console.log('-- FAILURES --'); for (const f of failures) console.log('   ' + f); }
  process.exit(fail === 0 ? 0 : 1);
})();
