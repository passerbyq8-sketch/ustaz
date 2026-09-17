#!/usr/bin/env node
/**
 * REPLAY STREAM STOP — deterministic, offline, no model call, no key.
 *
 * Takes the answers tools/stream-p1/live-stream-timeline.cjs recorded against production and asks
 * the shipped stream stages, unit by unit, WHICH RULE ends the streamed prefix and at which
 * character. The live timeline says when the text arrived; this says why it could not arrive
 * sooner. It changes nothing and asserts nothing.
 *
 * The delivered text stands in for the model's raw text. What the server appends after the model
 * (source and book cards, the «فهم لا فتوى» footer, the khilaf tail, «المصدر:») is cut off first,
 * because none of it passes through the unit stream.
 *
 * For every unit the reviewer releases it applies, in the order lib/sentence-stream.js `offer`
 * applies them, the four tests that end a streamed prefix:
 *   unsettled       settled === false                     lib/sentence-stream.js:145
 *   ref_drop        refDropWouldChange(unit)              lib/sentence-stream.js:153
 *   takhrij_lock    lockTakhrij(unit, sources) changed it lib/sentence-stream.js:161
 *   tidy            tidyWouldChange(unit)                 lib/sentence-stream.js:161
 * with `sources` = [] (what lib/free-brain/loop.js createTerminalUnitStream passes). Then it runs
 * the real createTerminalUnitStream (the item-36 hold on) over the same text and reports the
 * prefix it accepts, so the two can be compared with the live streamed prefix.
 *
 * Prints ASCII only. Usage:
 *   node tools/stream-p1/replay-stream-stop.cjs <call.json>... [--domain=fiqh|general|both]
 *        [--json=path]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const ARG = {};
const FILES = [];
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/u.exec(a);
  if (m) ARG[m[1]] = m[2] === undefined ? 'true' : m[2];
  else FILES.push(a);
}
const DOMAINS = ARG.domain === 'fiqh' ? ['fiqh'] : ARG.domain === 'general' ? ['general'] : ['general', 'fiqh'];

// Everything from the first server-owned tail line on is not model text.
const SERVER_TAIL_RE = /^(?:【فهمٌ لا فتوى】|وتُراجَع المسألة مع أهل العلم|المصدر:|<source\b|<book\b)/u;
function modelText(delivered) {
  const lines = String(delivered).split('\n');
  const at = lines.findIndex((line) => SERVER_TAIL_RE.test(line.trim()));
  return (at < 0 ? lines : lines.slice(0, at)).join('\n').replace(/\s+$/u, '');
}

// The live streamed prefix: every text chunk but the last burst.
function liveStreamed(rec) {
  const text = (rec.timeline || []).filter((c) => c.chars > 0);
  if (text.length <= 1) return 0;
  return text[text.length - 1].charStart;
}

async function main() {
  const reviewer = await import(pathToFileURL(path.join(ROOT, 'lib', 'output-reviewer.js')).href);
  const ss = await import(pathToFileURL(path.join(ROOT, 'lib', 'sentence-stream.js')).href);
  const lock = await import(pathToFileURL(path.join(ROOT, 'lib', 'takhrij-lock.js')).href);
  const loop = await import(pathToFileURL(path.join(ROOT, 'lib', 'free-brain', 'loop.js')).href);
  const out = [];
  for (const file of FILES) {
    const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const text = modelText(rec.text);
    const live = liveStreamed(rec);
    for (const domain of DOMAINS) {
      // 1. The unit walk, test by test.
      const records = [];
      const rs = reviewer.createReviewStream({
        evidence: [], domain, mode: '', khilafFromOpinions: null, opinionCount: null, truncated: null,
        onUnit: (r) => records.push(r),
      });
      const realLog = console.log; const realWarn = console.warn;
      console.log = () => {}; console.warn = () => {};
      try {
        const fed = loop.stripCitations(loop.deliverableText(text));
        rs.push(fed);
        rs.end();
      } finally { console.log = realLog; console.warn = realWarn; }
      let at = 0;
      let stop = null;
      for (const r of records) {
        for (const unit of r.produced) {
          let reason = null;
          let detail = '';
          if (r.settled === false) reason = 'unsettled';
          else if (ss.refDropWouldChange(unit)) reason = 'ref_drop';
          else {
            const locked = lock.lockTakhrij(unit, []);
            if (locked.droppedSentences.length || locked.text !== unit) {
              reason = 'takhrij_lock';
              detail = `spans=${locked.droppedSentences.map((d) => d.spans.length).join('+')}`;
            } else if (ss.tidyWouldChange(unit)) reason = 'tidy';
          }
          if (reason && !stop) {
            stop = {
              reason, detail, atChar: at, unitChars: unit.length,
              isCard: /^\s*<(?:hadith|verse|steps|source|book)\b/u.test(unit),
              colonLineBefore: /[:：]\s*$/u.test(text.slice(0, at).trimEnd()),
              unitHead: unit.slice(0, 60), before: text.slice(Math.max(0, at - 60), at),
            };
          }
          at += unit.length + 1;
        }
      }
      // 2. The real terminal unit stream with the item-36 hold, as the loop opens it.
      const accepted = [];
      const notes = [];
      console.log = () => {}; console.warn = () => {};
      let res;
      try {
        const ts = loop.createTerminalUnitStream({
          domain, mode: '', degraded: notes,
          ascription: { frame: reviewer.prophetFrame, namesTheProphet: reviewer.frameNamesProphet },
          onUnit: (d) => { accepted.push(d.piece); return true; },
        });
        for (let i = 0; i < text.length; i += 7) ts.push(text.slice(i, i + 7));
        res = ts.end();
      } finally { console.log = realLog; console.warn = realWarn; }
      const acceptedChars = res.acceptedPrefix.length;
      const row = {
        file: path.basename(file), domain, liveStreamedChars: live, modelChars: text.length,
        replayAcceptedChars: acceptedChars, firstStop: stop,
        holdNotes: notes.filter((n) => /^[\x20-\x7e]*$/u.test(n)),
      };
      out.push(row);
      const s = stop
        ? `stop=${stop.reason}${stop.detail ? '(' + stop.detail + ')' : ''} at_char=${stop.atChar} card=${stop.isCard} colon_before=${stop.colonLineBefore}`
        : 'stop=none';
      console.log(`${row.file} domain=${domain} live_streamed=${live} replay_accepted=${acceptedChars} model_chars=${text.length} ${s} notes=${row.holdNotes.join('|') || '-'}`);
    }
  }
  if (ARG.json) fs.writeFileSync(ARG.json, JSON.stringify(out, null, 2));
}

main().catch((e) => { console.log('replay-stream-stop failed: ' + String(e && e.stack).replace(/[^\x20-\x7e\n]/gu, '?')); process.exit(1); });
