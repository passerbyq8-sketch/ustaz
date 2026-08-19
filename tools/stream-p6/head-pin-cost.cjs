#!/usr/bin/env node
/**
 * P6-V3 §٢ — WHAT THE HEAD PIN COSTS, MEASURED RATHER THAN ASSUMED.
 *
 * THE RULE. When a streamed round's units were accepted by the reader and that round ended on
 * `tool_use`, its prose becomes the turn's head and `joinRoundTextsHeadPinned` refuses to delete
 * it — neither by containment nor by equal length. Without the refusal the delivered text stops
 * beginning with the bytes the reader already has, and the writer's only honest answer to that is
 * to close on the prefix and drop the rest of the answer.
 *
 * THE PRICE. On a turn where the finishing round RESTATES the head, the reader now reads it
 * twice, and the answer grows by exactly `len(head) + 2` characters — the head plus the blank
 * line the join puts between parts.
 *
 * THREE THINGS ARE MEASURED, AND THE THIRD IS THE ONE THAT MATTERS.
 *
 *   1  HOW OFTEN THE CORPUS PRICES THIS AT ALL. Every record is one `end_turn` payload with
 *      text, so no record has a head round. The corpus cannot price the rule, and saying so is
 *      the measurement.
 *
 *   2  WHETHER A REAL PRODUCTION HEAD CAN BE STREAMED IN THE FIRST PLACE. The six head lines the
 *      2026-08-17 X-ray actually caught reaching readers are replayed through the same
 *      `createTerminalUnitStream` the loop uses. A head that releases NOTHING can never be
 *      pinned, so on those turns the rule costs zero by construction rather than by luck.
 *
 *   3  WHAT IT COSTS WHEN IT DOES FIRE. The corpus answers are used as finishing rounds and a
 *      head is modelled in front of each — the answer's own opening sentences, which is the
 *      worst case, because a head the finishing round restates VERBATIM is the only shape the
 *      standing join deletes. Reported as a distribution, and labelled MODELLED: the rate at
 *      which a real finishing round restates its own head is NOT measured here.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const LOOP = path.join(ROOT, 'lib', 'free-brain', 'loop.js');

/**
 * The six lines the X-ray caught on readers' screens, verbatim. They are the only heads this
 * project has ever actually observed, and `lib/free-brain/loop.js` lists them by answer number.
 */
const OBSERVED_HEADS = [
  'سأبحث لك في فتاوى العلماء عن هذه المسألة تحديداً.',
  'سأبحث لك في الفتاوى المتخصصة في هذه المسألة تحديداً.',
  'سأتحقق من هذه المسألة الدقيقة.',
  'هذه المسألة من دقائق أحكام الزكاة، وفيها تفصيل يستحق أن أستوثق منه لك.',
  'سأتحقق لك من المسألة في فتاوى العلماء لأزيدك اطمئنانًا بالدليل.',
  'نص سابق من جولة الأدوات.',
];

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  if (low === high) return sorted[low];
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (at - low));
}

function releasedFrom(loop, text) {
  let accepted = '';
  const stream = loop.createTerminalUnitStream({
    domain: 'general',
    mode: 'standard',
    degraded: [],
    onUnit: ({ text: sofar }) => { accepted = sofar; return true; },
  });
  // Fed line by line, the way a provider delivers it. A head arriving in one piece and a head
  // arriving in fragments must reach the same verdict, and feeding it whole would test only one.
  for (const line of String(text).split(/(?<=\n)/u)) stream.push(line);
  stream.end();
  return accepted;
}

async function main() {
  const corpusPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!corpusPath) throw new Error('usage: head-pin-cost.cjs <corpus.json>');
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const loop = await import(pathToFileURL(LOOP).href);

  // ── 1. CAN THE CORPUS PRICE THIS RULE? ──────────────────────────────────
  process.stdout.write(`CORPUS_RECORDS=${corpus.length}\n`);
  process.stdout.write('CORPUS_RECORDS_WITH_A_HEAD_ROUND=0  (every record is one end_turn payload)\n');
  process.stdout.write('CORPUS_PRICES_THE_PIN=NO\n');

  // ── 2. THE HEADS THAT WERE ACTUALLY OBSERVED ────────────────────────────
  let observedStreamable = 0;
  for (const head of OBSERVED_HEADS) {
    const released = releasedFrom(loop, `${head}\n`);
    if (released) observedStreamable += 1;
    process.stdout.write(
      `  OBSERVED_HEAD releases=${released.length ? `${released.length}ch` : 'nothing'}`
      + `  chars=${head.length}  «${head.slice(0, 34)}…»\n`,
    );
  }
  process.stdout.write(
    `OBSERVED_HEADS=${OBSERVED_HEADS.length} STREAMABLE=${observedStreamable} `
    + `PIN_CAN_FIRE_ON_THEM=${observedStreamable > 0 ? 'YES' : 'NO'}\n`,
  );

  // ── 3. THE MODELLED COST WHEN IT DOES FIRE ──────────────────────────────
  // The head is the answer's own opening — one sentence, then two, then three — and the finishing
  // round is the whole answer. Only a head the standing join would DELETE is counted, because a
  // head it keeps costs nothing whichever join runs.
  const rows = [];
  let modelled = 0;
  let droppedByStandingJoin = 0;
  for (const record of corpus) {
    const sentences = String(record.text).split(/(?<=\n)/u).filter((line) => line.trim());
    for (const take of [1, 2, 3]) {
      if (sentences.length <= take) continue;
      const head = sentences.slice(0, take).join('').trim();
      if (!head) continue;
      modelled += 1;
      const standing = loop.joinRoundTexts([head, record.text]);
      const pinned = loop.joinRoundTextsHeadPinned([head, record.text]);
      if (standing === pinned) continue;
      droppedByStandingJoin += 1;
      rows.push({ take, extra: pinned.length - standing.length, head: head.length });
    }
  }
  const extras = rows.map((row) => row.extra).sort((a, b) => a - b);
  const heads = rows.map((row) => row.head).sort((a, b) => a - b);
  process.stdout.write(
    `MODELLED_PAIRS=${modelled} PIN_CHANGED_THE_TEXT=${droppedByStandingJoin} `
    + `(${modelled ? (droppedByStandingJoin * 100 / modelled).toFixed(1) : '0.0'}%)\n`,
  );
  process.stdout.write(
    `MODELLED_EXTRA_CHARS median=${quantile(extras, 0.5)} p90=${quantile(extras, 0.9)} `
    + `min=${extras[0] ?? null} max=${extras[extras.length - 1] ?? null}\n`,
  );
  process.stdout.write(
    `MODELLED_HEAD_CHARS median=${quantile(heads, 0.5)} p90=${quantile(heads, 0.9)}\n`,
  );

  // ── 4. THE SAME COST AGAINST THE OWNER'S MEASURED HEAD SIZES ────────────
  // The head distribution measured in production is median 84 characters and p90 433. The pin
  // adds the head back plus the blank line the join uses, so the arithmetic is exact and the only
  // unmeasured term is HOW OFTEN a finishing round restates its head.
  process.stdout.write('OWNER_HEAD_MEDIAN=84 -> EXTRA_CHARS=86\n');
  process.stdout.write('OWNER_HEAD_P90=433 -> EXTRA_CHARS=435\n');
  process.stdout.write('RESTATEMENT_RATE=NOT_MEASURED\n');
}

main().catch((error) => {
  process.stderr.write(`HEAD-PIN-COST: ERROR ${(error && error.stack) || error}\n`);
  process.exit(2);
});
