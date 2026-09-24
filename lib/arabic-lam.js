// lib/arabic-lam.js — PROGRAM ORDER 2026-09-24, م٤-د (LIB_NAV_V1): the preposition «ل» on a name.
//
// THE OWNER'S WITNESSES: «ليس عندي كتاب باسم «في ظلال القرآن» لـسيد قطب» and «… «فقه الزكاة» لـالقرضاوي»
// — a tatweel glued on as if «ل» were a separate word. MEASURED (program-2026-09-24/04-quote/measure/
// D-form.md §3, over the 7,400 catalogue authors): the rules the Arabic writes are
//   «ال…»  → «لل…»  the alif of the article drops          القرضاوي → للقرضاوي (693 authors)
//   «الل…» → «لل…»  and one lām merges                     الليث بن سعد → لليث بن سعد (9)
//   «ابن»  → «لابن» the alif of hamzat al-waṣl stays        ابن تيمية → لابن تيمية (414)
//   «أبو»  → «لأبي» one of the five nouns takes the genitive أبو منصور → لأبي منصور (175)
//   «ذو»   → «لذي»
//   anything else Arabic → «ل» attached, no tatweel         سيد قطب → لسيد قطب (1,619)
//   a name that does not start with an Arabic letter keeps «لـ» as the separator.
// Zero imports; the test is made on the letters with their marks removed, and the name is written as given.

const MARKS = /[\u064B-\u0652\u0670\u0640]/gu;

/** «ل» + name, as Arabic writes it. '' for an empty name. */
export function withLam(name) {
  const n = String(name == null ? '' : name).trim();
  if (!n) return '';
  const bare = n.replace(MARKS, '');
  if (!/^[ء-ي]/u.test(bare)) return 'لـ' + n;
  const article = /^ا[\u064B-\u0652\u0670]*ل[\u064B-\u0652\u0670]*/u;
  if (/^الل/u.test(bare)) return 'ل' + n.replace(article, '');
  // The article's alif drops and its lām stays, with whatever mark it carries («لِلْجَعْبَري»).
  if (/^ال/u.test(bare)) return 'ل' + n.replace(/^ا[\u064B-\u0652\u0670]*/u, '');
  const five = /^(أبو|ابو|أبا|ابا)(?= )/u.exec(n);
  if (five) return 'ل' + (five[1][0] === 'أ' ? 'أبي' : 'ابي') + n.slice(five[1].length);
  if (/^ذو(?= )/u.test(n)) return 'لذي' + n.slice(2);
  return 'ل' + n;
}
