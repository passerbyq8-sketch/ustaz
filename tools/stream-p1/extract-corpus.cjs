#!/usr/bin/env node
/**
 * STREAM-P1 §3 — build the equivalence corpus from the OWNER'S RECORDED ANSWERS.
 *
 * Two archives, one block format. A block header line names the run
 * (`--- NEW/preview-1 --- status=200 ms=8982 chars=699 ...`); the body is every
 * line after it until the next header or the next `====` question rule.
 *
 * Nothing is invented here: the body is carried byte-for-byte apart from the
 * trailing blank lines the archive uses as spacing.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RULE_RE = /^={5,}\s*$/;
const QID_RE = /^(Q\d+)\b(.*)$/;
const BLOCK_RE = /^---\s+(\S+)\s+---\s*(.*)$/;

function parseArchive(file, sourceId) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
  const records = [];
  let qid = null;
  let qsuffix = '';
  let current = null;

  const flush = () => {
    if (!current) return;
    const text = current.body.join('\n').replace(/\s+$/, '');
    if (text.trim()) records.push({ ...current, body: undefined, text });
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (RULE_RE.test(line)) { flush(); continue; }
    const q = QID_RE.exec(line);
    // A question id only counts on its own line between two rules.
    if (q && RULE_RE.test(lines[i - 1] || '') && RULE_RE.test(lines[i + 1] || '')) {
      flush();
      qid = q[1];
      qsuffix = q[2].trim();
      continue;
    }
    const b = BLOCK_RE.exec(line);
    if (b) {
      flush();
      const meta = {};
      for (const m of b[2].matchAll(/([a-z]+)=([^\s]+)/g)) meta[m[1]] = m[2];
      current = {
        id: `${sourceId}:${qid || 'Q?'}${qsuffix ? `/${qsuffix.replace(/\s+/g, '-')}` : ''}/${b[1]}`,
        source: sourceId,
        qid: qid || null,
        run: b[1],
        meta,
        body: [],
      };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  return records;
}

function main() {
  const sessions = process.argv[2];
  const out = process.argv[3];
  if (!sessions || !out) {
    console.error('usage: extract-corpus.cjs <sessions-dir> <out.json>');
    process.exit(2);
  }
  const specs = [
    ['EZIK-BATTERY-ANSWERS-2026-08-17.txt', 'battery2'],
    ['EZIK-REVIEWER-REPAIR-ANSWERS-2026-08-16.txt', 'repair'],
  ];
  const all = [];
  for (const [name, id] of specs) {
    const file = path.join(sessions, name);
    if (!fs.existsSync(file)) {
      console.error(`MISSING ${file}`);
      process.exit(2);
    }
    const records = parseArchive(file, id);
    console.log(`${id.padEnd(9)} ${String(records.length).padStart(4)} answers  <- ${name}`);
    all.push(...records);
  }
  fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf8');
  console.log(`total     ${String(all.length).padStart(4)} answers  -> ${out}`);
}

main();
