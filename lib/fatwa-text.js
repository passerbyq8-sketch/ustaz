// lib/fatwa-text.js -- ITEM T1 (141) -- 2026-10-15 brain-line
//
// THE FATWA TEXT AS IT IS SERVED. Measured on 7ba44481 (side-brain-line-2026-10-15/side/141-inventory.md; measure-once-2026-
// 10-05/side/m20-fatwa-symbols.md): of 74,769 stored fatwa texts, 4,970 carry private-use symbols -- the sites write ﷺ, «رضي الله
// عنه», «عليه السلام», «عزّ وجلّ» as one character of their «arabisque» font -- which no reader's font draws; others carry whole
// words in presentation forms (FB50-FEFF), bidi controls and zero-width marks, and empty «[]» where a reference was.
//
// THE MAP IS MEASURED, NOT GUESSED (session tools/t1-fonts.mjs, GET only; side/t1-fonts.md). al-Khathlan and al-Barrak serve one
// font, «AGA Arabesque» (1994, 17,360 bytes); its post table names each glyph. A symbol enters FATWA_PUA_PROVEN only when its
// glyph's name states its text. The rest -- handhalt (F049), akbar1/akbar2 (F052/F054), jalla (F059), f20/f21 (F064/F066),
// radiya1 (F074), sadaka (F077), radiya2 (F079), b1-b16 (F080-F08F) -- is listed for the owner and left as it is (counted):
// «radiya» says «رضي الله عن…» but not of whom, and a guess from the sentence around it is what the order forbids.
//
// THE RULE, applied at service (the stores are not touched): the proven symbols -> their text; presentation forms -> NFKC,
// except the Arabic word ligatures U+FDF2-U+FDFD (ﷺ is U+FDFA: NFKC would spell it out wherever the app writes it); bidi controls
// and zero-width marks removed; empty «[]», «()» removed. One rule for the excerpt and the full text alike.

export const FATWA_PUA_PROVEN = Object.freeze({
  0xF050: 'بسم الله الرحمن الرحيم',   // basmala2
  0xF051: 'الله',                    // allah
  0xF055: 'عزّ وجلّ',                 // azzawajal
  0xF065: 'ﷺ',                       // salla1
  0xF072: 'ﷺ',                       // salla2
  0xF075: 'عليه السلام',              // alyhissalam
});
// For the owner (report section 8): the font's names that do not state their text.
export const FATWA_PUA_UNPROVEN = Object.freeze({
  0xF049: 'handhalt', 0xF052: 'akbar1', 0xF054: 'akbar2', 0xF059: 'jalla', 0xF064: 'f20', 0xF066: 'f21', 0xF074: 'radiya1',
  0xF077: 'sadaka', 0xF079: 'radiya2',
});

const PUA = /[-]/gu;
const FORMS = /[ﭐ-ﷱ﷾-﷿ﹰ-﻾]/gu;   // presentation forms A and B, less the word ligatures and the BOM
const CONTROLS = /[​-‏‪-‮⁠⁦-⁩؜﻿]/gu;
const EMPTY_BRACKETS = /\[\s*\]|\(\s*\)|（\s*）/gu;
const LETTER = /[\p{L}\p{N}]/u;

/** The served text of a fatwa field. `stats` (optional) counts what changed: puaMapped, puaKept, forms, controls, brackets. */
export function cleanFatwaText(value, stats) {
  const s = stats && typeof stats === 'object' ? stats : null;
  const bump = (k, n = 1) => { if (s) s[k] = (s[k] || 0) + n; };
  let t = String(value == null ? '' : value);
  if (!t) return t;
  t = t.replace(PUA, (ch, at, all) => {
    const text = FATWA_PUA_PROVEN[ch.codePointAt(0)];
    if (!text) { bump('puaKept'); return ch; }
    bump('puaMapped');
    const before = at > 0 && !/\s/u.test(all[at - 1]) ? ' ' : '';
    const after = at + 1 < all.length && LETTER.test(all[at + 1]) ? ' ' : '';
    return before + text + after;
  });
  t = t.replace(FORMS, (ch) => { bump('forms'); return ch.normalize('NFKC'); });
  t = t.replace(CONTROLS, () => { bump('controls'); return ''; });
  t = t.replace(EMPTY_BRACKETS, () => { bump('brackets'); return ''; });
  // a removed bracket leaves two spaces: one is kept (the text's own spacing is otherwise untouched)
  if (s ? s.brackets : EMPTY_BRACKETS.test(String(value))) t = t.replace(/[^\S\n]{2,}/gu, ' ');
  return t;
}

/** Every string of a JSON value through cleanFatwaText (the proxy's body). */
export function cleanFatwaJson(value, stats) {
  if (typeof value === 'string') return cleanFatwaText(value, stats);
  if (Array.isArray(value)) return value.map((v) => cleanFatwaJson(v, stats));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanFatwaJson(v, stats);
    return out;
  }
  return value;
}
