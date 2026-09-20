// lib/today-line.js
// THE SERVER KNOWS WHAT DAY IT IS. THIS IS THE ONE PLACE IT SAYS SO TO THE MODEL.
//
// ── THE MEASURED DEFECT ─────────────────────────────────────────────────────
// Asked «كم تاريخ اليوم؟» in production, the app answered **2025** — the model's training year,
// stated as today's date, with no hedge. Not because the clock was missing: lib/daycap.js has
// computed the Kuwait date on every single request since the day cap shipped. The clock was
// simply never handed to the model. The defect was wiring, not arithmetic.
//
// ── WHY THE TEXT IS BUILT HERE AND NOT WHERE IT IS USED ─────────────────────
// It could have been three lines inside api/ask.js. It is a module because the seat it occupies
// is the most dangerous one in this round, and a module can be driven by a guard without driving
// a handler, a socket and a model. lib/daycap.js cannot host it either: that file is required to
// contain ZERO raw Arabic code points — every character of its reader-facing wording is a \uXXXX
// escape, for the byte-reversal reason stated in its own header — and a prompt block written
// under that rule would be unreadable and unreviewable. So the DATE comes from there and the
// ARABIC lives here.
//
// ── WHERE IT MAY BE INSTALLED, AND THE TWO SEATS THAT ARE FORBIDDEN ─────────
// It is appended as an INDEPENDENT system block by api/ask.js's appendDepthBlock(), the same
// mechanism the depth instruction uses. Both alternatives are measured failures:
//
//   * buildSystemPrompt() — guards/system-prompt-parity-guard.cjs pins FIVE sha256 fingerprints
//     of its output and separately asserts that the builder varies with exactly four values and
//     is deterministic for a fixed four. A date inside it reds all five every midnight and
//     destroys determinism outright.
//   * buildDepthInstruction() — api/ask.js gates it on `band === 'adult'`, so a child and a
//     teenager would never be told the date; and guards/answer-shape-guard.cjs pins that the
//     brief depth injects the empty string, which a date block would immediately violate.
//
// The block is therefore unconditional: every band, every depth, every route.
//
// ── NO NETWORK, NO LIBRARY, NO STATE ────────────────────────────────────────
// Pure arithmetic over `nowMs`, which is a parameter so a guard can pin a known instant.

import { kuwaitDayStamp, KUWAIT_OFFSET_MS } from './daycap.js';

// Sunday-first, because that is what getUTCDay() returns 0 for, and Sunday is the first day of
// the week in Kuwait as well. Written out rather than derived, so nothing depends on a locale
// table that may or may not be present in a serverless runtime.
const WEEKDAYS_AR = Object.freeze([
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
]);

/**
 * The Kuwait weekday name for a Kuwait day stamp.
 * @param {string} stamp 'YYYY-MM-DD' as kuwaitDayStamp() returns it
 * @returns {string} the Arabic weekday, or '' if the stamp is not a date
 */
export function kuwaitWeekday(stamp) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(stamp || ''));
  if (!m) return '';
  // Date.UTC on the SHIFTED calendar date. The stamp already carries the +3h shift, so reading
  // it back as a UTC midnight gives the weekday of the Kuwait day and not of the UTC day — which
  // are different for three hours out of every twenty-four, and that is exactly the window where
  // getting it wrong is most likely and least visible.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return WEEKDAYS_AR[d.getUTCDay()] || '';
}

/**
 * The Kuwait wall clock, HH:MM, at the given instant.
 * Same offset constant as the day stamp, imported rather than restated.
 */
export function kuwaitClock(nowMs = Date.now()) {
  return new Date(nowMs + KUWAIT_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * THE BLOCK ITSELF.
 *
 * It states three facts and forbids four inferences, and the forbidding is the larger half. A
 * model handed today's date will cheerfully use it to date things it has no date for — «سعر
 * اليوم», «خبر اليوم» — which would turn a fix for the calendar into a new source of invented
 * currency in the answer. So the block says, in as many words, that the date licenses the date
 * and nothing else.
 *
 * @param {number} nowMs
 * @returns {string} the system block, or '' if the stamp could not be read (fail silent: an
 *          absent block leaves today's behaviour, a malformed one would teach a wrong date)
 */
export function buildTodayBlock(nowMs = Date.now()) {
  const stamp = kuwaitDayStamp(nowMs);
  const weekday = kuwaitWeekday(stamp);
  if (!weekday) return '';
  const clock = kuwaitClock(nowMs);
  return [
    'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا):',
    `اليومُ بتوقيتِ الكويتِ هو ${weekday}، وتاريخُه الميلاديُّ ${stamp}، والساعةُ عندَ وصولِ هذا السؤالِ ${clock} تقريبًا.`,
    'هذه ساعةُ الخادمِ وتقويمُه، وهي صحيحةٌ الآن. فإن سُئلتَ عن تاريخِ اليومِ أو عن يومِ الأسبوعِ أو عن الساعةِ فأجِبْ منها مباشرةً، ولا تقلْ إنّك لا تعرفُ التاريخ، ولا تُحِلْ إلى تاريخِ انتهاءِ تدريبِك، ولا تعتذرْ.',
    'وما عدا ذلك فلا تبنِ عليها شيئًا: ليست مصدرًا لسعرٍ ولا لخبرٍ ولا لأيِّ رقمٍ متحرّك، ولا تجعلْها تاريخًا لمعلومةٍ لم يَرِدْ معها تاريخُها. ولا تذكرِ التاريخَ في جوابِك إن لم يُسألْ عنه.',
    'وإن سُئلتَ عن التاريخِ الهجريِّ فقلْ إنّ الذي عندك هو الميلاديُّ وحدَه، ولا تُقدِّرِ الهجريَّ بحسابٍ من عندِك.',
  ].join('\n');
}
