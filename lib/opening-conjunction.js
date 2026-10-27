// lib/opening-conjunction.js -- A DELIVERED ANSWER NEVER OPENS ON A «و» LEFT BEHIND BY A REMOVED UNIT (order EZIK-COMPREHENSIVE-ORDER-2026-10-02, 3.4h).
//
// THE OWNER'S PREVIEW OF 2 OCT, ANSWER 9, opened «والجمهور يرون أن الحديث على ظاهره وعمومه…» as if its beginning had fallen. MEASURED on the real handler:
// (1) a first unit held by the before-writing holder and the next kept as the opening, and (2) a first sentence lifted by the finalizer's takhrij lock («روى البخاري
// أن النبي ﷺ قال: …» -> «ومعناه أن …»): either way the answer begins on the conjunction of a sentence the reader never saw. The seats already take a welded «ف»
// off the head of the answer (OPENING_FA_RE in lib/bw2-units.js); this is the same act for «و», and it adds NO line for the reader (the owner, 25 Sep: no lines
// in place of lifted sentences) -- the one letter goes and the rest of the sentence stands exactly as written.
//
// WHEN IT STRIPS. ONLY WHEN THE HEAD OF THE ANSWER WAS REMOVED (`afterRemoval`: a unit held before the first release, a first sentence lifted by the lock). An answer that
// nothing was taken out of is returned byte for byte, as every other stage of the finalizer returns it (its guards pin that), even if it opens on a «و».
// Given a removed head, a leading «و» is a conjunction, and goes, when what follows it is
//   (a) the article: «والجمهور», «والمالكية», «واليوم» -- except the few words that ARE words beginning «وال» (والد، والدة، والدان، والدين، والدي، والي: «والدين» may be
//       «and the religion» or «the parents», so it stays: doubt is not a strip);
//   (b) a closed list of function words and demonstratives: «وقد», «وهذا», «وكذلك», «ولهذا», «ومعناه», «ومن», «وإن» ...;
//   (c) any other word, but never a root that begins with «و» (وقت، وجه، وجب، وجد، ورد، وضع، وصل، وصف، وقع، وعد، وزن، وسط، وقف، ولد، وطن، وجود، وسيلة، وهب، وضوء ...),
//       which a bare strip would break.
// Only the first token of the text is read; a heading, a card tag or anything that is not a plain word first is left alone. Pure: no I/O.

const DIAC = '\\u064B-\\u0652\\u0670';
const FIRST_TOKEN_RE = new RegExp('^(\\s*)\\u0648([' + DIAC + ']?)([\\u0621-\\u064A\\u0671' + DIAC + '\\u0640]+)', 'u');
const FOLD_RE = new RegExp('[' + DIAC + '\\u0640]', 'gu');
const fold = (s) => s.replace(FOLD_RE, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي');

// «والد/والدة/والدان/والدين/والدي/والدك/والدها/والي»: words of their own (and «والدين» is ambiguous): not a conjunction + article
const WORDS_WITH_WAW_AL = /^ال(?:د(?:ة|ان|ين|ي|ك|ها|هم|هما|يه|يها)?|ي|يه)$/u;
const FUNCTION_WORDS = new Set(['قد', 'لقد', 'كذلك', 'اما', 'لهذا', 'لذلك', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'تلك', 'من', 'ان', 'لا', 'ما', 'كل', 'بعض',
  'هناك', 'ثم', 'لكن', 'فيه', 'فيها', 'به', 'بها', 'له', 'لها', 'عليه', 'عليها', 'عند', 'بعد', 'قبل', 'اذا', 'لو', 'كما', 'يجوز', 'يجب', 'معناه', 'معناها']);
const WAW_ROOTS = new Set(['وقت', 'وجه', 'وجب', 'وجد', 'ورد', 'وضع', 'وصل', 'وصف', 'وقع', 'وعد', 'وزن', 'وسط', 'وقف', 'ولد', 'وطن', 'وجود', 'وسيله', 'وهب',
  'وضوء', 'وجوه', 'وجبه', 'وصيه', 'وفاه', 'وعظ', 'وعي', 'وحد', 'وحي', 'وفد', 'وفق', 'وقار', 'وقاء', 'وسع', 'وسوسه', 'وثيقه', 'وثن', 'وصول', 'وقوف', 'وقوع',
  'وجهه', 'وعيد', 'وعده', 'وراثه', 'وراء', 'وسائل', 'وظيفه', 'وظائف', 'وطء', 'وكاله', 'وكيل', 'ولاء', 'ولايه', 'ولي', 'ولده', 'ولدان', 'وليمه', 'ويل']);

/**
 * @param {string} text
 * @param {{afterRemoval?: boolean}} [opts]  the head of the answer was removed (a held unit, a lifted sentence)
 * @returns {{text:string, stripped:boolean}}
 */
const OPENING_DIACRITICS = '[\\u064b-\\u065f\\u0670]*';
const openingWordPattern = (hex) => Array.from(String.fromCodePoint(...hex.split(' ').map((part) => parseInt(part, 16))))
  .map((letter) => letter + OPENING_DIACRITICS).join('');
const openingShaddaWordPattern = (hex) => {
  const letters = String.fromCodePoint(...hex.split(' ').map((part) => parseInt(part, 16)));
  const chars = Array.from(letters);
  const last = chars.pop();
  return chars.map((letter) => letter + OPENING_DIACRITICS).join('')
    + last + '[\\u064b-\\u0650\\u0652-\\u065f\\u0670]*\\u0651' + OPENING_DIACRITICS;
};
const openingPhrasePattern = (words) => words.map(openingWordPattern).join('\\s+');
const openingReplacementRules = [
  { pattern: openingShaddaWordPattern('648 644 643 646'), value: String.fromCodePoint(0x625, 0x646, 0x651) },
  { pattern: openingShaddaWordPattern('644 643 646'), value: String.fromCodePoint(0x625, 0x646, 0x651) },
  { pattern: openingWordPattern('648 644 643 646 647'), value: String.fromCodePoint(0x625, 0x646, 0x647) },
  { pattern: openingWordPattern('644 643 646 647'), value: String.fromCodePoint(0x625, 0x646, 0x647) },
  { pattern: openingWordPattern('648 644 643 646 647 627'), value: String.fromCodePoint(0x625, 0x646, 0x647, 0x627) },
  { pattern: openingWordPattern('644 643 646 647 627'), value: String.fromCodePoint(0x625, 0x646, 0x647, 0x627) },
];
const openingRemovalPhrases = [
  ['644 643 646'], ['648 644 643 646'], ['628 644'], ['648 628 644'],
  ['625 644 627', '623 646'], ['625 644 627', '623 646'],
  ['63a 64a 631', '623 646'], ['63a 64a 631', '623 646'],
  ['648 645 639', '630 644 643'], ['645 639', '630 644 643'],
  ['648 644 630 644 643'], ['644 630 644 643'],
  ['648 644 647 630 627'], ['644 647 630 627'],
  ['648 639 644 64a 647'], ['641 639 644 64a 647'],
];
const OPENING_CONNECTIVE_END = '(?=$|\\s|[\\u060c\\u061b.,:!?\\u061f])';
const OPENING_CONNECTIVE_AFTER = '(?:\\s+|[\\u060c\\u061b.,:!?\\u061f]+\\s*|$)';

/** Remove an opening connective that lost the sentence it depended on. */
export function cleanDanglingOpeningConnective(text) {
  const value = String(text == null ? '' : text);
  const leading = /^\s*/u.exec(value)[0];
  let body = value.slice(leading.length);
  for (const rule of openingReplacementRules) {
    const match = new RegExp('^' + rule.pattern + OPENING_CONNECTIVE_END, 'u').exec(body);
    if (match) return leading + rule.value + body.slice(match[0].length);
  }
  for (const phrase of openingRemovalPhrases) {
    const pattern = openingPhrasePattern(phrase);
    const match = new RegExp('^' + pattern + OPENING_CONNECTIVE_AFTER, 'u').exec(body);
    if (match) return leading + body.slice(match[0].length);
  }
  return value;
}

export function stripOpeningConjunction(text, opts = {}) {
  const value = String(text == null ? '' : text);
  const m = FIRST_TOKEN_RE.exec(value);
  if (!m) return { text: value, stripped: false };
  const token = m[3];
  const bare = fold(token);
  const whole = 'و' + bare;
  if (opts.afterRemoval !== true) return { text: value, stripped: false };
  let strip = false;
  if (/^ال/u.test(bare)) strip = bare.length >= 4 && !WORDS_WITH_WAW_AL.test(bare); // an article-led word is (a)'s alone: when (a) declines it, nothing else strips it
  else if (FUNCTION_WORDS.has(bare)) strip = true;
  else if (bare.length >= 3 && !WAW_ROOTS.has(whole) && !/^و/u.test(bare)) strip = true;
  if (!strip) return { text: value, stripped: false };
  // the «و» goes with the vowel mark it carried; the word after it is untouched
  return { text: m[1] + token + value.slice(m[0].length), stripped: true };
}
