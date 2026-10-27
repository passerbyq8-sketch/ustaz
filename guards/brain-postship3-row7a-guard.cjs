#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = process.cwd();
const fixturePath = path.join(root, 'guards/fixtures/brain-postship3-row7a-excerpts.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const fail = [];
const check = (condition, message) => { if (!condition) fail.push(message); };

async function main() {
  const loop = await import(pathToFileURL(path.join(root, 'lib/free-brain/loop.js')).href);
  const reviewer = await import(pathToFileURL(path.join(root, 'lib/free-brain/review.js')).href);
  check(fixture.excerpts.length === 3, 'expected three measured excerpts');

  for (const entry of fixture.excerpts) {
    const hash = crypto.createHash('sha256').update(entry.text, 'utf8').digest('hex');
    check(hash === entry.sha256, `${entry.label}: fixture hash changed`);
    check(loop.collectCited(entry.text).length === 0, `${entry.label}: fixture gained a citation`);

    const filtered = loop.withoutUnsourcedRulings(entry.text, []);
    check(filtered.removed === 0, `${entry.label}: filter removed a sentence`);
    check(filtered.rulings === 0, `${entry.label}: filter classified an uncited ruling`);
    check(filtered.notCovered === false, `${entry.label}: filter changed not-covered status`);
    check(filtered.text === entry.text, `${entry.label}: filter changed the excerpt`);

    const result = await reviewer.reviewAnswer({
      text: entry.text,
      evidence: [],
      domain: 'fiqh',
      mode: 'chat',
      khilafFromOpinions: null,
      opinionCount: 0,
      truncated: false,
    });
    check(result.text.startsWith(entry.text), `${entry.label}: reviewer removed the input prefix`);
    check(
      result.verdict?.sentences?.some((sentence) => sentence.action === 'tagged-fiqh-understanding'),
      `${entry.label}: reviewer action changed`,
    );
    if (entry.label !== 'B2') check(result.text === entry.text, `${entry.label}: reviewer output changed`);
    if (entry.label === 'B2') check(Array.from(result.text).length - Array.from(entry.text).length === 49, 'B2: measured reviewer suffix length changed');
  }

  if (fail.length) {
    for (const message of fail) process.stderr.write(`FAIL ${message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`PASS postship3 row7a checks=${fixture.excerpts.length * 9 + 1}\n`);
}

main().catch((error) => {
  process.stderr.write(`FAIL ${error.message}\n`);
  process.exitCode = 1;
});
