// lib/mojaz.js — THE BRIEF TIER'S THREE SWITCHES AND ITS PROMPT EDITS.
//
//   MOJAZ_PROMPT_V1    the order's instruction block and examples go last in the writer's system; the
//                      opening-message phase (a phase no /api/ask request is in) comes out of it; the
//                      output ceiling is 1024 tokens; the writer is shown the judge's top two sources.
//   MOJAZ_GUARDS_V1    lib/mojaz-guards.js runs on the sentences before the reader has them.
//   MOJAZ_ESCALATE_V1  a brief turn that ended with nothing to show is written again once, on MODEL_ESCALATE.
//
// A switch reads `on`, `true` or `1`; anything else — an unset variable, a typo — is OFF, the same
// reading lib/free-brain/flag.js gives STREAM_V1. With all three OFF nothing in this file is called.
//
// WHERE THE BRIEF TIER IS. api/ask.js decides it once, from values it already holds: an adult
// reader whose effective depth is neither 'deep' nor 'scholar'. A younger reader, the detailed
// tier and the scholar tier never reach any of this.
//
// It imports only lib/mojaz-prompt.js (two strings and two numbers, no imports of its own), so a test drives it with strings.

import { MOJAZ_BLOCK, MOJAZ_EXAMPLES } from './mojaz-prompt.js';

const ON_WORDS = new Set(['on', 'true', '1']);
const isOn = (value) => ON_WORDS.has(String(value == null ? '' : value).trim().toLowerCase());

/** @returns {{prompt:boolean, guards:boolean, escalate:boolean, any:boolean, escalateModel:string}} */
export function mojazFlags(env = process.env) {
  const prompt = isOn(env.MOJAZ_PROMPT_V1);
  const guards = isOn(env.MOJAZ_GUARDS_V1);
  const escalate = isOn(env.MOJAZ_ESCALATE_V1);
  const escalateModel = String(env.MODEL_ESCALATE || '').trim();
  return { prompt, guards, escalate: escalate && escalateModel !== '', any: prompt || guards || escalate, escalateModel };
}

/** The brief tier: an adult, and not the detailed or the scholar depth. */
export function isMojazTier({ band, effectiveDepth } = {}) {
  return band === 'adult' && effectiveDepth !== 'deep' && effectiveDepth !== 'scholar';
}

// ── editing a built system prompt, by what it says and not by where it sits ──────────────────────
const DIACRITICS_RE = /[ً-ٰٟـۖ-ۭ]/u;
const FOLD = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي', 'ة': 'ه' };

/** Folded text and, for every folded character, where it stood in the original. */
function foldWithMap(text) {
  let folded = '';
  const map = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (DIACRITICS_RE.test(ch)) continue;
    let c = FOLD[ch] || ch;
    if (/\s/u.test(c)) {
      c = ' ';
      if (folded.endsWith(' ')) continue;
    }
    folded += c;
    map.push(i);
  }
  return { folded, map };
}
const foldText = (text) => foldWithMap(String(text)).folded;

// Every needle is written in ordinary spelling and folded with the same function the prompt goes through.
const needle = (text) => foldText(text);

/** The paragraph (blank-line bounded) that holds every needle, or null. */
function paragraphAround(text, folded, map, needles) {
  const first = folded.indexOf(needles[0]);
  if (first < 0) return null;
  const at = map[first];
  const start = text.lastIndexOf('\n\n', at) + 2 > 1 ? text.lastIndexOf('\n\n', at) + 2 : 0;
  const stop = text.indexOf('\n\n', at);
  const end = stop < 0 ? text.length : stop;
  const paragraph = foldText(text.slice(start, end));
  return needles.every((n) => paragraph.includes(n)) ? { start, end: stop < 0 ? end : end + 2 } : null;
}

function removeRange(text, range) {
  return text.slice(0, range.start) + text.slice(range.end);
}

function removeParagraph(text, needles) {
  const { folded, map } = foldWithMap(text);
  const range = paragraphAround(text, folded, map, needles.map(needle));
  return range ? { text: removeRange(text, range), chars: range.end - range.start } : null;
}

/** Removes every line that starts with one of `starts` (folded) and holds `contains` (folded). */
function removeLines(text, starts, contains) {
  const lines = text.split('\n');
  let chars = 0;
  const kept = lines.filter((line) => {
    const f = foldText(line).trim();
    const hit = starts.some((s) => f.startsWith(needle(s))) && f.includes(needle(contains));
    if (hit) chars += line.length + 1;
    return !hit;
  });
  return chars ? { text: kept.join('\n'), chars } : null;
}

/** Removes the section whose heading holds `heading`, up to the next «═══» heading or the end. */
function removeSection(text, heading) {
  const { folded, map } = foldWithMap(text);
  const at = folded.indexOf(needle(heading));
  if (at < 0) return null;
  let start = map[at];
  start = text.lastIndexOf('\n', start) + 1;
  const next = text.indexOf('\n═══', map[at] + 1);
  const end = next < 0 ? text.length : next + 1;
  return { text: text.slice(0, start).replace(/\n+$/u, '\n') + text.slice(end), chars: end - start };
}

// The edits. Each one removes text that speaks to a phase no /api/ask request is in: the app never
// asks the model to open a conversation (the greeting sentence is nowhere in app.jsx), so every
// request is a reply to something the reader wrote. The rules that stay say what a reply is.
// Safety, policy, the age gate, attribution and the khilaf rules are not on this list and are not
// touched; a pattern that does not match changes nothing, and the result says which ones did.
const GREETING_EXAMPLE = 'السلام عليكم ورحمة الله وبركاته، تفضل';
const EDITS = [
  { name: 'opening_exception', run: (t) => removeParagraph(t, ['استثناء واحد لا غير', 'رسالة الافتتاح', 'تفتح انت المحادثة']) },
  { name: 'opening_rule_a', run: (t) => removeParagraph(t, ['(أ) رسالة الافتتاح الأولى', 'حين تبادر انت']) },
  { name: 'opening_one_line', run: (t) => removeParagraph(t, ['الترحيب سطر واحد قصير', 'في الافتتاح']) },
  { name: 'opening_examples', run: (t) => removeLines(t, ['✗', '✓'], '(افتتاح)') },
  { name: 'opening_start_section', run: (t) => removeSection(t, '═══ ابدأ المحادثة ═══') },
  { name: 'opening_name_example', run: (t) => removeLines(t, ['-'], 'للمبادأة عند بداية المحادثة') },
  { name: 'voice_greeting_examples', run: (t) => removeLines(t, ['- مثال', '- خطأ'], GREETING_EXAMPLE) },
];

/** @returns {{text:string, edits:Array<{name:string, chars:number}>}} */
export function pruneOpeningPhase(text) {
  let out = String(text == null ? '' : text);
  const edits = [];
  for (const edit of EDITS) {
    const result = edit.run(out);
    if (!result) continue;
    out = result.text;
    edits.push({ name: edit.name, chars: result.chars });
  }
  return { text: out, edits };
}

/**
 * The writer's system for a brief turn: the opening phase out, the order's block and examples last.
 * `system` is what api/ask.js builds: an array of text blocks (the first one cached) or a string.
 * The two appended blocks carry no cache_control, like every per-request text on this path.
 *
 * @returns {{system:(Array|string), edits:Array<{name:string, chars:number}>, addedChars:number}}
 */
export function mojazSystem(system, { prune = true } = {}) {
  const addition = `${MOJAZ_BLOCK}\n\n${MOJAZ_EXAMPLES}`;
  const edits = [];
  const pruneBlock = (text) => {
    if (!prune) return text;
    const result = pruneOpeningPhase(text);
    edits.push(...result.edits);
    return result.text;
  };
  if (typeof system === 'string') {
    return { system: [{ type: 'text', text: pruneBlock(system), cache_control: { type: 'ephemeral' } }, { type: 'text', text: addition }], edits, addedChars: addition.length };
  }
  if (!Array.isArray(system)) return { system, edits, addedChars: 0 };
  const blocks = system.map((block) => (block && block.type === 'text' && typeof block.text === 'string' ? { ...block, text: pruneBlock(block.text) } : block));
  return { system: [...blocks, { type: 'text', text: addition }], edits, addedChars: addition.length };
}

/** The brief tier's output ceiling applied to whatever budget the caller computed. */
export function mojazCap(budget, cap) {
  const n = Number(budget);
  return Number.isFinite(n) && n > 0 ? Math.min(n, cap) : cap;
}

/** The sources the writer is shown: the judge's own order (a direct match first, then the kept in the order they stood), top `n`. */
export function topSourcesInJudgeOrder(kept, direct, n) {
  const first = Array.isArray(direct) ? direct.filter((row) => Array.isArray(kept) && kept.includes(row)) : [];
  const rest = (Array.isArray(kept) ? kept : []).filter((row) => !first.includes(row));
  return [...first, ...rest].slice(0, n);
}
