// tools/card-drop-measure.mjs — §٤ of the ب-١ order: MEASURE THE CAUSE, DO NOT FIX IT.
//
// THE OBSERVATION. Call 3 of the A-3 round (question 19, pass 2, request
// `gvg6j-1786949937302-fa7baad17a95`) returned `retrieved: 4`, `cited: [2, 3, 4]` and ONE card. The
// card ceiling is three, so the ceiling is not what cut it. Two candidates were named:
//
//   (1) DEDUPLICATION — three of the four rows came off one page, so three citations bought one card.
//   (2) ROWS WITH NO USABLE LINK, dropped in silence.
//
// This file decides between them by driving the shipped rules. It changes nothing.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEvidenceTable } from '../lib/free-brain/tools.js';
import { pickReaderCards } from '../lib/free-brain/loop.js';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const line = (s) => process.stdout.write(s + '\n');
// api/ask.js's own card builder is a Vercel handler export and pulls the whole request path in, so
// the SHAPE it produces is reproduced here in one line instead: a tag string that contains the full
// href. That is the only property this measurement needs from it, and it is asserted below against
// the handler's source rather than assumed.
const tagOf = (row) => (row.url ? { tag: `<source site="x" url="${row.url}">${row.title || ''}</source>` } : null);

line('=== §٤ — cited 3, cards 1. Which candidate produces it? (measured, not fixed) ===');
line('observed on 17 August: retrieved 4 · cited [2,3,4] · cards 1 · one <source> delivered,');
line('and that one was https://binbaz.org.sa/fatwas/1538 — a row that HAD a page.');
line('');

// ── CANDIDATE 1 — DEDUPLICATION. It is not merely absent here; it is UNREACHABLE ──
// Two independent facts about the shipped code, each driven rather than argued:
//   a. `createEvidenceTable.add` returns the EXISTING row whenever a non-empty url repeats, so two
//      rows in one table can never share a non-empty url.
//   b. `buildSourceTag`'s tag string contains the full href, and `pickReaderCards` deduplicates on
//      that whole string — so two DISTINCT urls can never fold into one card.
// Together: three cited rows cannot collapse to one card by deduplication.
line('--- candidate 1: deduplication');
const distinct = [1538, 1539, 1540].map((id, i) => ({
  ref: i + 1, url: `https://binbaz.org.sa/fatwas/${id}`, title: 'فتوى ' + id,
}));
line(`  three DISTINCT pages cited -> ${pickReaderCards(distinct, 3, tagOf).length} cards`);
const table = createEvidenceTable();
for (const row of distinct) table.add({ url: row.url, title: row.title });
const echo = table.add({ url: distinct[0].url, title: 'نفسُ الصفحةِ مرّةً ثانية' });
line(`  and the TABLE refuses a repeated page before the card step is reached:`);
line(`    4 adds -> ${table.rows.length} rows; the fourth add returned ref ${echo.ref}, the existing row`);
line(`    so no two rows in one table share a non-empty url, and dedup has nothing to fold`);
// The property the tag string must have for (b) to hold, read from api/ask.js rather than assumed.
const askSource = readFileSync(join(REPO, 'api', 'ask.js'), 'utf8');
line(`  and the card tag carries the full href, so two urls cannot make one tag: `
  + `${/tag: `<source site="\$\{host\}" url="\$\{url\}">/u.test(askSource) ? 'confirmed in api/ask.js' : 'NOT CONFIRMED'}`);
line('  VERDICT: unreachable. Deduplication cannot be the cause.');
line('');

// ── CANDIDATE 2 — ROWS WITH NO PAGE, DROPPED IN SILENCE ──────────────────────
line('--- candidate 2: cited rows that carry no page');
const mixed = [
  { ref: 2, url: '', publisher: 'الموسوعة الفقهية الكويتية', title: 'مصطلحٌ من الموسوعة' },
  { ref: 3, url: '', publisher: 'الموسوعة الفقهية الكويتية', title: 'مصطلحٌ آخر' },
  { ref: 4, url: 'https://binbaz.org.sa/fatwas/1538', title: 'حكم المسح على الخفين بعد خلعهما بعد المسح' },
];
const cards = pickReaderCards(mixed, 3, tagOf);
line(`  cited [2,3,4] where refs 2 and 3 carry no url -> ${cards.length} card`);
line(`  and it is the linked one: ${cards.map((c) => c.tag.match(/url="([^"]+)"/u)[1]).join(', ')}`);
line('  which reproduces the observed number exactly, on the observed page.');
line('');
// AND THE DROP IS SILENT. `dropCard` in api/ask.js prints `[card] drop empty-url`, which would have
// made this visible — but `pickReaderCards` tests `row.url` FIRST and never calls the builder, so
// that line cannot run for a row with no page. Nothing in the platform log says a card was lost.
const loopSource = readFileSync(join(REPO, 'lib', 'free-brain', 'loop.js'), 'utf8');
line('--- and the drop is SILENT, which is the part that costs the reader');
line(`  pickReaderCards short-circuits before the builder: `
  + `${/const card = row && row\.url \? buildTag\(row\) : null;/u.test(loopSource) ? 'confirmed' : 'NOT CONFIRMED'}`);
line(`  api/ask.js's dropCard would have logged it: `
  + `${/console\.warn\(`\[card\] drop \$\{reason\} — \$\{where\}`\)/u.test(askSource) ? "confirmed — `[card] drop empty-url`" : 'NOT CONFIRMED'}`);
line('  ...but it is never reached for a row with no url, so no line is printed for the loss.');
line('');
line('=== VERDICT ===');
line('Candidate 2. The reader loses the attribution of a claim the text DID cite, and the platform');
line('log records nothing at all about the loss. Which is the card-relevance threshold item of the');
line('next round, and is deliberately NOT touched here.');
