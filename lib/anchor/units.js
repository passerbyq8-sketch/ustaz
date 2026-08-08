// lib/anchor/units.js — EVERY CLAIM ANCHORED TO A SPAN THAT IS REALLY ON THE PAGE.
//
// ── THE DEFECT (قرار ١ب) ─────────────────────────────────────────────────────
// A sourced answer today is prose the model wrote after reading the retrieved pages, with a card
// underneath. The card proves a page was FETCHED. Nothing proves the sentences came from it. So a
// reply could be fluent, correctly cited, and contain a ruling that appears on none of the pages
// beneath it — and every gate in the app would pass, because each of them checks something else.
//
// ── THE CONTRACT, AND WHY THE SERVER COMPOSES ────────────────────────────────
// The model emits UNITS: a claim, the URL it came from, and the SPAN of that page it rests on.
// The server then verifies each span against the page text it actually fetched, drops the ones
// that fail, and assembles what survives.
//
// THE ASSEMBLY IS THE SERVER'S, STRUCTURALLY. The model never writes a sentence joining two
// units, because it never sees two units together — it emits them separately and they are
// composed here. This is the difference between a rule the model is asked to follow and one it
// cannot break: a linking sentence is exactly where an unsupported claim hides, since it belongs
// to neither unit and so is verified against neither page.
//
// ── AND A DROPPED UNIT IS NOT AN ERROR ───────────────────────────────────────
// It is the mechanism working. Zero surviving units is the honest «لم أقف» the app already has;
// it is not a failure state to be worked around.

import { normalizeArabic } from '../route-classify.js';

// The tag the model is taught to emit. Same family as the <source> tag the app already uses, so
// the client's existing tag scanner cannot mistake one for the other.
const UNIT_RE = /<unit\b([^>]*)>([\s\S]*?)<\/unit>/gu;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/gu;

/** A span shorter than this proves nothing — every page contains «والله أعلم». */
export const MIN_SPAN_CHARS = 24;

const fold = (s) => normalizeArabic(String(s == null ? '' : s));

/**
 * Parse the model's reply into units. Anything outside a <unit> tag is DISCARDED, not kept as
 * prose — text the model wrote between units is exactly the linking sentence this design removes.
 *
 * @returns {Array<{claim:string, url:string, span:string}>}
 */
export function parseUnits(replyRaw) {
  const reply = String(replyRaw == null ? '' : replyRaw);
  const out = [];
  UNIT_RE.lastIndex = 0;
  let m;
  while ((m = UNIT_RE.exec(reply)) !== null) {
    const attrs = {};
    ATTR_RE.lastIndex = 0;
    let a;
    while ((a = ATTR_RE.exec(m[1] || '')) !== null) attrs[a[1].toLowerCase()] = a[2];
    const claim = String(m[2] || '').replace(/\s+/g, ' ').trim();
    const url = String(attrs.source || attrs.url || '').trim();
    const span = String(attrs.span || '').replace(/\s+/g, ' ').trim();
    if (!claim) continue;
    out.push({ claim, url, span });
  }
  return out;
}

/**
 * Is this span really on this page?
 *
 * NORMALISED CONTAINMENT, not equality. The model retypes the span rather than copying bytes, so
 * it arrives with different diacritics and spacing; normalizeArabic folds exactly those and
 * nothing that carries meaning. What it does NOT do is loosen the test into similarity: the span
 * must be present as a contiguous run, because "roughly on the page" is what this whole file
 * exists to stop being good enough.
 */
export function spanIsOnPage(span, pageText) {
  const s = fold(span);
  if (!s || s.length < MIN_SPAN_CHARS) return false;
  const hay = fold(pageText);
  if (!hay) return false;
  return hay.indexOf(s) !== -1;
}

/**
 * Verify every unit against the pages actually fetched.
 *
 * @param {Array} units
 * @param {Array<{url:string, passage:string}>} pages
 * @returns {{kept:Array, dropped:Array}}
 */
export function verifyUnits(units, pages) {
  const byUrl = new Map();
  for (const p of pages || []) {
    if (p && p.url) byUrl.set(String(p.url), String(p.passage || ''));
  }
  const kept = [], dropped = [];
  for (const u of units || []) {
    // A UNIT CITING A PAGE WE DID NOT FETCH IS NOT CHECKABLE, AND SO IS NOT PRINTED. The model
    // can name any URL; only the ones this request actually retrieved have text to check against.
    const pageText = byUrl.get(u.url);
    if (pageText === undefined) { dropped.push({ ...u, why: 'url-not-retrieved' }); continue; }
    if (!u.span) { dropped.push({ ...u, why: 'no-span' }); continue; }
    if (!spanIsOnPage(u.span, pageText)) { dropped.push({ ...u, why: 'span-not-on-page' }); continue; }
    kept.push(u);
  }
  return { kept, dropped };
}

/**
 * Compose the surviving units into the reply.
 *
 * ONE POINT PER UNIT, EACH ATTRIBUTED, AND NOTHING BETWEEN THEM. There is no connective tissue
 * because there is nothing to write it with — the server has claims and URLs, not an argument.
 * That is the design: an answer that reads as a list of sourced points is honest about being one.
 */
export function composeUnits(kept, { cardFor = null } = {}) {
  const lines = [];
  for (const u of kept || []) {
    const cite = typeof cardFor === 'function' ? cardFor(u.url) : '';
    lines.push('- ' + u.claim + (cite ? ' ' + cite : ''));
  }
  return lines.join('\n');
}

// ── TAKHRIJ HONESTY (قرار ٥ / P4-C) ──────────────────────────────────────────
//
// The SAME question, asked of a hadith's attribution: does a page we cited actually carry it?
//
// This is narrower than lib/takhrij-lock.js and does not replace it. That module reads a finished
// draft and strips an attribution no fetched page supports — it is the shipped path's defence and
// stays exactly as it is. This one governs the STRUCTURED narrator/ruling fields, which never pass
// through prose at all, so the lock never sees them.

/**
 * May this narrator / ruling be printed?
 *
 * @returns {{narrator:string, ruling:string, dropped:string[]}}
 *   Fields that no cited page carries come back EMPTY, and the hadith is printed without a
 *   takhrij line — never with a guessed one.
 */
export function honestTakhrij(narratorRaw, rulingRaw, pages) {
  const hay = (pages || []).map((p) => fold((p && p.passage) || '')).join(' \n ');
  const dropped = [];
  const keep = (valueRaw, label) => {
    const v = String(valueRaw == null ? '' : valueRaw).trim();
    if (!v) return '';
    const f = fold(v);
    // A one-word attribution («البخاري») is a whole word on the page or it is nothing. Substring
    // containment would let «مسلم» match inside «المسلمين», which is how a hadith ends up
    // attributed to Muslim by a page that merely mentions Muslims.
    const found = (' ' + hay + ' ').indexOf(' ' + f + ' ') !== -1;
    if (found) return v;
    dropped.push(label + ':' + v);
    return '';
  };
  return {
    narrator: keep(narratorRaw, 'narrator'),
    ruling: keep(rulingRaw, 'ruling'),
    dropped,
  };
}

/**
 * Apply honestTakhrij to every <hadith> tag in a draft.
 *
 * THE ATTRIBUTE IS EMPTIED, NOT THE TAG. index.html's resolveHadithAttribution already prints no
 * «رَوَى …» line for an empty narrator (P1-B), so blanking the field is exactly «the hadith with
 * no takhrij line» — the matn survives, which is what قرار ٥ asks for. Dropping the whole tag
 * would delete a hadith because its credit was unverifiable, which is a different and worse thing.
 *
 * @returns {{text:string, dropped:string[]}}
 */
export function honestTakhrijInDraft(draftRaw, pages) {
  const draft = String(draftRaw == null ? '' : draftRaw);
  const allDropped = [];
  const text = draft.replace(/<hadith\b([^>]*)>/gu, (whole, attrs) => {
    const get = (name) => {
      const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'u').exec(attrs);
      return m ? m[1] : '';
    };
    const narrator = get('narrator'), ruling = get('ruling');
    if (!narrator && !ruling) return whole;
    const honest = honestTakhrij(narrator, ruling, pages);
    allDropped.push(...honest.dropped);
    let out = attrs;
    if (narrator && !honest.narrator) out = out.replace(/narrator\s*=\s*"[^"]*"/u, 'narrator=""');
    if (ruling && !honest.ruling) out = out.replace(/ruling\s*=\s*"[^"]*"/u, 'ruling=""');
    return '<hadith' + out + '>';
  });
  return { text, dropped: allDropped };
}

// ── THE INSTRUCTION THE MODEL IS GIVEN ───────────────────────────────────────
// Kept here beside the parser, so the taught shape and the parsed shape cannot drift apart.
export const UNIT_INSTRUCTION = [
  'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
  'اكتبْ جوابَك **وحداتٍ منفصلة**، كلُّ وحدةٍ في وسمٍ مستقلّ، ولا تكتبْ شيئًا خارجَ الوسوم:',
  '<unit source="رابط الصفحة" span="مقطعٌ منقولٌ حرفيًّا من الصفحة">الحكم بعبارتك</unit>',
  '- `span` **منقولٌ حرفيًّا** من نصِّ الصفحةِ المرفقة، لا بمعناه ولا بإعادةِ صياغة.',
  '- `source` رابطُ الصفحةِ التي أُخِذَ منها المقطعُ نفسُه، لا رابطُ صفحةٍ أخرى.',
  '- لا تكتبْ جملةً تربطُ بين وحدتين؛ التطبيقُ هو الذي يُركِّبُ الجواب.',
  '- إن لم تجدْ في الصفحاتِ ما يسندُ نقطةً، فلا تكتبْ لها وحدةً أصلًا.',
].join('\n');
