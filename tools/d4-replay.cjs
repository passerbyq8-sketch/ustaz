'use strict';
const fs = require('node:fs');
const path = require('node:path');
const replay = require('../guards/d4-replay.cjs');
(async () => {
  const label = process.argv[2] || 'after';
  const output = process.argv[3];
  if (!output) throw Error('usage: node tools/d4-replay.cjs before|after output.json');
  const mod = await replay.load(label);
  const rows = [];
  for (const row of replay.data.rows) {
    const result = await replay.replay(mod, row);
    rows.push(result);
    console.log(JSON.stringify({ id: row.id, label, truncated: result.truncated, chars: result.finalText.length,
      cards: result.cards.length, calls: result.replayedCalls, unavailableCalls: result.unavailableCalls, network: result.networkAttempts }));
  }
  const live = replay.data.live.map(r => ({ ...r, hollow: mod.loop.hollowAnswerReason(r.text, r.question),
    cleaned: mod.loop.withoutMechanismTalk(r.text) }));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ base: replay.data.base, label, head: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    networkAttempts: replay.networkAttempts(), rows, live }, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
