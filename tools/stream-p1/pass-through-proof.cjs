#!/usr/bin/env node
/**
 * STREAM-P3 §٤ — THE GATE ON DOOR H-2: THE WRITER PASSES TEXT THROUGH.
 *
 * Four claims, and a mutant for each.
 *
 *   IDENTITY   With no `earlyRelease` option the writer emits the SAME BYTES it emitted
 *              before this door existed. Not «equivalent» — identical, compared against
 *              the file as it stands in HEAD, which this tool checks out for itself.
 *              This is the claim that lets the door ship with the flag off.
 *
 *   DELIVERY   With `earlyRelease` driven by `createSentenceStream`, the text the reader
 *              receives — every `text_delta` in the order it was written — is byte for
 *              byte the text the finalizer approved, on the same 160 recorded answers.
 *              And the early part really was early: it left before `end()` was called.
 *
 *   ORDER      Nothing answer-level overtakes released prose. A `readerSuffix` (the
 *              disagreement tail) always lands after the last released unit.
 *
 *   CONTRACT   The two things the writer refuses to take on trust from its caller: an
 *              approval that does not EXTEND what is already out, and a stream whose
 *              opening is malformed. Both were MISSED by the first version of this gate —
 *              its own caller was too well behaved to exercise either guard — so both now
 *              have a case that misbehaves on purpose. A gate that cannot fail proves
 *              nothing, and that is as true of the gate's fixtures as of its subject.
 *
 *   CUTS       An aborted signal, a stream that stops without `message_stop`, a finalizer
 *              that rejects, and a composition that is not a continuation of what was
 *              sent. In all four the rule is the same and it is §٦/١: WHAT WENT OUT STAYS
 *              OUT AND NOTHING IS SENT ON TOP OF IT. The answer is short, the divergence
 *              is recorded, and no second `message_start` ever reaches the wire.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const LIB = path.join(ROOT, 'lib');
const WRITER = path.join(LIB, 'finalized-sse-writer.js');
const STREAM = path.join(LIB, 'sentence-stream.js');

const MUTANTS = [
  {
    name: 'no-prefix-check-at-flush',
    claim: 'what went out must still be the head of what the finalizer approved',
    find: `      if (!result.text.startsWith(released)) { closeEarly('not-a-prefix'); return; }`,
    replace: '      if (false) { closeEarly(\'not-a-prefix\'); return; }',
  },
  {
    name: 'resend-whole-answer',
    claim: 'only the remainder follows what was already released',
    find: '      const remainder = result.text.slice(released.length);',
    replace: '      const remainder = result.text;',
  },
  {
    name: 'release-without-monotonicity',
    claim: 'an approval may only ever extend what is already out',
    find: `    if (typeof approved !== 'string' || !approved.startsWith(released)) {`,
    replace: '    if (typeof approved !== \'string\' || false) {',
  },
  {
    name: 'release-on-malformed-opening',
    claim: 'a stream cannot earn early delivery by being malformed',
    find: `      // content_block_stop, message_delta, message_stop: the stream is finishing and what
      // is left belongs to flush(). Not an error — just the end of early delivery.
      earlyEligible = false;`,
    replace: '      // MUTANT: keeps eligibility through events that end it.',
  },
  {
    name: 'second-message-start-after-cut',
    claim: 'a failure after early release never opens a second message on the wire',
    find: `      if (earlyOpen) { closeEarly(failed || 'aborted'); return; }`,
    replace: '      if (false) { closeEarly(failed || \'aborted\'); return; }',
  },
];

// ── A TARGET THAT ONLY RECORDS ───────────────────────────────────────────────
function fakeTarget() {
  const listeners = new Map();
  const target = {
    chunks: [],
    ended: false,
    headersSent: false,
    write(chunk, encoding, callback) {
      target.chunks.push(String(chunk));
      const cb = typeof encoding === 'function' ? encoding : callback;
      cb?.();
      return true;
    },
    end(chunk, encoding, callback) {
      const cb = [chunk, encoding, callback].find((x) => typeof x === 'function');
      if (chunk != null && typeof chunk !== 'function') target.chunks.push(String(chunk));
      target.ended = true;
      cb?.();
      return target;
    },
    status() { return target; },
    setHeader() { return target; },
    flushHeaders() {},
    on(name, fn) { listeners.set(name, fn); return target; },
    once(name, fn) { listeners.set(name, fn); return target; },
    removeListener(name) { listeners.delete(name); return target; },
    emit(name) { listeners.get(name)?.(); },
  };
  return target;
}

const frame = (event) => `data: ${JSON.stringify(event)}\n\n`;

/** The provider's own event sequence for one answer, chunked. */
function providerFrames(text, chunker, { thinking = false, noStop = false } = {}) {
  const out = [frame({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', content: [] } })];
  if (thinking) {
    out.push(frame({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }));
    out.push(frame({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'x' } }));
    out.push(frame({ type: 'content_block_stop', index: 0 }));
    out.push(frame({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }));
    for (const piece of chunker(text)) out.push(frame({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: piece } }));
    out.push(frame({ type: 'content_block_stop', index: 1 }));
  } else {
    out.push(frame({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }));
    for (const piece of chunker(text)) out.push(frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } }));
    out.push(frame({ type: 'content_block_stop', index: 0 }));
  }
  if (!noStop) out.push(frame({ type: 'message_stop' }));
  return out;
}

/** Everything the reader actually receives, in order. */
function readerTextOf(chunks) {
  let text = '';
  const types = [];
  for (const chunk of chunks) {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      let event;
      try { event = JSON.parse(line.slice(5).trim()); } catch { continue; }
      types.push(event.type);
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += String(event.delta.text || '');
      }
    }
  }
  return { text, types };
}

const CHUNKERS = {
  whole: (t) => [t],
  size17: (t) => t.match(/[\s\S]{1,17}/gu) || [],
  size64: (t) => t.match(/[\s\S]{1,64}/gu) || [],
  words: (t) => t.match(/\S+\s*/gu) || [],
  lines: (t) => t.split(/(?<=\n)/u),
};

const PAGE_SETTINGS = [
  { name: 'no-pages', pages: [] },
  { name: 'supporting-page', pages: ['صحيح البخاري وصحيح مسلم'] },
];

/** The HEAD copy of the writer, so IDENTITY compares against the real previous file. */
function headWriter() {
  const dir = path.join(os.tmpdir(), 'ezik-stream-p3');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'writer-head.js');
  const source = execFileSync('git', ['--no-pager', 'show', 'HEAD:lib/finalized-sse-writer.js'],
    { cwd: ROOT, maxBuffer: 8 * 1024 * 1024 });
  fs.writeFileSync(file, source);
  return file;
}

function mutatedWriter(mutant) {
  const dir = path.join(os.tmpdir(), 'ezik-stream-p3');
  fs.mkdirSync(dir, { recursive: true });
  const source = fs.readFileSync(WRITER, 'utf8');
  const hits = source.split(mutant.find).length - 1;
  if (hits !== 1) throw new Error(`mutant ${mutant.name}: anchor found ${hits} times, expected 1`);
  const mutated = source.replace(mutant.find, mutant.replace);
  if (mutated === source) throw new Error(`mutant ${mutant.name}: source unchanged`);
  const file = path.join(dir, `writer-${mutant.name}.js`);
  fs.writeFileSync(file, mutated, 'utf8');
  return file;
}

/** One run of the writer over one answer. */
function runWriter(createFinalizedSseResponse, {
  text, frames, finalize, earlyRelease, readerSuffix = '', readerPrefix = '', abortAfter = null,
}) {
  const target = fakeTarget();
  const controller = new AbortController();
  const rejects = [];
  const degrades = [];
  const res = createFinalizedSseResponse(target, {
    finalize,
    context: () => ({
      fallbackText: 'refused', sourceCards: [], readerPrefix, readerSuffix,
      readerCards: [], readerCardPrefix: '', allowWireOwnedCards: false,
      stripUnownedSourceCards: false, strippedWireText: undefined,
    }),
    signal: controller.signal,
    failureText: 'refused',
    onReject: (d) => rejects.push(d),
    onDegrade: (d) => degrades.push(d),
    ...(earlyRelease ? { earlyRelease } : {}),
  });
  let sentBeforeEnd = 0;
  for (let i = 0; i < frames.length; i += 1) {
    if (abortAfter !== null && i === abortAfter) controller.abort();
    res.write(frames[i]);
  }
  sentBeforeEnd = target.chunks.length;
  res.end();
  return { target, rejects, degrades, sentBeforeEnd, text };
}

async function runProof(writerHref, corpus, quiet) {
  const { createFinalizedSseResponse } = await import(writerHref);
  const { createSentenceStream, reviewAndLock } = await import(url.pathToFileURL(STREAM).href);
  const headHref = url.pathToFileURL(headWriter()).href;
  const head = await import(headHref);

  const failures = [];
  const note = (kind, detail) => { if (failures.length < 30) failures.push({ kind, ...detail }); };

  // ── IDENTITY ───────────────────────────────────────────────────────────────
  let identityRuns = 0;
  let identitySame = 0;
  const sample = [...corpus].sort((a, b) => a.text.length - b.text.length)
    .filter((_, i) => i % 4 === 0);
  for (const record of sample) {
    for (const [name, chunker] of Object.entries(CHUNKERS)) {
      for (const shape of [{}, { thinking: true }, { noStop: true }]) {
        const frames = providerFrames(record.text, chunker, shape);
        const finalize = ({ text }) => ({ ok: true, text });
        const now = runWriter(createFinalizedSseResponse, { text: record.text, frames, finalize });
        const before = runWriter(head.createFinalizedSseResponse, { text: record.text, frames, finalize });
        identityRuns += 1;
        if (JSON.stringify(now.target.chunks) === JSON.stringify(before.target.chunks)) identitySame += 1;
        else note('identity', { id: record.id, chunker: name, shape: JSON.stringify(shape) });
      }
    }
  }

  // ── DELIVERY ───────────────────────────────────────────────────────────────
  let deliveryRuns = 0;
  let deliveryOk = 0;
  let streamedEarly = 0;
  let deltasEarly = 0;
  for (const record of corpus) {
    for (const setting of PAGE_SETTINGS) {
      for (const [name, chunker] of Object.entries(CHUNKERS)) {
        if (name === 'whole' && setting.name === 'supporting-page') continue;
        const input = {
          evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: setting.pages,
        };
        const oracle = reviewAndLock({ text: record.text, ...input });
        const stream = createSentenceStream(input);
        const emitted = [];
        let fed = 0;
        const earlyRelease = ({ wireText }) => {
          if (wireText.length > fed) {
            emitted.push(...stream.push(wireText.slice(fed)));
            fed = wireText.length;
          }
          return emitted.join('\n');
        };
        const frames = providerFrames(record.text, chunker);
        const run = runWriter(createFinalizedSseResponse, {
          text: record.text,
          frames,
          finalize: ({ text }) => ({ ok: true, text: reviewAndLock({ text, ...input }).text }),
          earlyRelease,
        });
        deliveryRuns += 1;
        const { text: readerText } = readerTextOf(run.target.chunks);
        const early = readerTextOf(run.target.chunks.slice(0, run.sentBeforeEnd));
        const ok = readerText === oracle.text
          && oracle.text.startsWith(early.text)
          && early.types.filter((t) => t === 'message_start').length <= 1
          && readerTextOf(run.target.chunks).types.filter((t) => t === 'message_start').length === 1;
        if (ok) deliveryOk += 1;
        else {
          note('delivery', {
            id: record.id, chunker: name, pages: setting.name,
            readerBytes: readerText.length, oracleBytes: oracle.text.length,
            earlyBytes: early.text.length,
          });
        }
        if (early.text.length) {
          streamedEarly += 1;
          deltasEarly += early.types.filter((t) => t === 'content_block_delta').length;
        }
      }
    }
  }

  // ── ORDER ──────────────────────────────────────────────────────────────────
  let orderRuns = 0;
  let orderOk = 0;
  const TAIL = '\n\nوفي المسألة خلافٌ بين أهل العلم.';
  for (const record of corpus.slice(0, 40)) {
    const input = { evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [] };
    const stream = createSentenceStream(input);
    const emitted = [];
    let fed = 0;
    const earlyRelease = ({ wireText }) => {
      if (wireText.length > fed) { emitted.push(...stream.push(wireText.slice(fed))); fed = wireText.length; }
      return emitted.join('\n');
    };
    const run = runWriter(createFinalizedSseResponse, {
      text: record.text,
      frames: providerFrames(record.text, CHUNKERS.words),
      // The SAME reviewing finalizer DELIVERY uses. A pass-through finalizer here would
      // return raw wire text, which the released (reviewed) units are correctly NOT a
      // prefix of — the run would diverge by design and the test would be measuring its
      // own mistake rather than the writer's ordering.
      finalize: ({ text }) => {
        const reviewed = reviewAndLock({ text: text.slice(0, text.length - TAIL.length), ...input });
        return { ok: true, text: reviewed.text + TAIL };
      },
      earlyRelease,
      readerSuffix: TAIL,
    });
    orderRuns += 1;
    const { text: readerText } = readerTextOf(run.target.chunks);
    const early = readerTextOf(run.target.chunks.slice(0, run.sentBeforeEnd)).text;
    // The tail must be at the very end, and must never have been part of what went early.
    if (readerText.endsWith(TAIL) && !early.includes(TAIL.trim())) orderOk += 1;
    else note('order', { id: record.id, earlyBytes: early.length, tailAtEnd: readerText.endsWith(TAIL) });
  }

  // ── CONTRACT ───────────────────────────────────────────────────────────────
  const contract = [];
  const contractRecord = corpus.find((r) => r.text.length > 400) || corpus[0];
  const contractInput = { evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [] };
  const contractFinalize = ({ text }) => ({ ok: true, text: reviewAndLock({ text, ...contractInput }).text });

  {
    // (1) A CALLER THAT GOES BACKWARDS. It answers honestly until something has actually
    // been released, and only then returns a string that is not an extension of what is
    // already on the wire. The writer must stop releasing, record the breach, and still
    // deliver the right answer through flush().
    //
    // THE POISON WAITS FOR A REAL RELEASE ON PURPOSE. An earlier version poisoned from the
    // first call, when nothing had gone out yet — and then `startsWith('')` is true for
    // every string, so the monotonicity test has nothing to bite on and the lie reaches
    // the wire. That is not a hole this test can close; it is a limit of the design, and
    // it is written down as case (3) below rather than hidden by a kinder fixture.
    const stream = createSentenceStream(contractInput);
    const emitted = [];
    let fed = 0;
    let onWire = '';
    const POISON = 'ZZZZ';
    const earlyRelease = ({ wireText }) => {
      if (wireText.length > fed) { emitted.push(...stream.push(wireText.slice(fed))); fed = wireText.length; }
      const honest = emitted.join('\n');
      if (onWire && honest.length > onWire.length) return POISON + honest;
      onWire = honest;
      return honest;
    };
    const run = runWriter(createFinalizedSseResponse, {
      text: contractRecord.text,
      frames: providerFrames(contractRecord.text, CHUNKERS.words),
      finalize: contractFinalize,
      earlyRelease,
    });
    const all = readerTextOf(run.target.chunks);
    const oracle = reviewAndLock({ text: contractRecord.text, ...contractInput }).text;
    const ok = all.text === oracle
      && !all.text.includes(POISON)
      && run.rejects.some((r) => r.stage === 'early-release' && r.reason === 'contract');
    contract.push({
      name: 'caller-answer-does-not-extend',
      readerBytes: all.text.length,
      oracleBytes: oracle.length,
      poisonOnWire: all.text.includes(POISON),
      recorded: run.rejects.map((r) => r.stage + ':' + r.reason).join(' '),
      ok,
    });
    if (!ok) note('contract', { name: 'caller-answer-does-not-extend', poison: all.text.includes(POISON) });
  }

  {
    // (2) A MALFORMED OPENING. A `message_delta` lands in the middle of the text block and
    // more deltas follow it — a shape flush() rejects outright. Not one further byte may
    // be released after that event, and the check is the chunk count on the target, taken
    // the instant before the malformed frame is written.
    const stream = createSentenceStream(contractInput);
    const emitted = [];
    let fed = 0;
    const earlyRelease = ({ wireText }) => {
      if (wireText.length > fed) { emitted.push(...stream.push(wireText.slice(fed))); fed = wireText.length; }
      return emitted.join('\n');
    };
    const target = fakeTarget();
    const rejects = [];
    const res = createFinalizedSseResponse(target, {
      finalize: contractFinalize,
      context: () => ({
        fallbackText: 'refused', sourceCards: [], readerPrefix: '', readerSuffix: '',
        readerCards: [], readerCardPrefix: '', allowWireOwnedCards: false,
        stripUnownedSourceCards: false,
      }),
      failureText: 'refused',
      onReject: (d) => rejects.push(d),
      earlyRelease,
    });
    const pieces = CHUNKERS.words(contractRecord.text);
    const half = Math.floor(pieces.length / 2);
    res.write(frame({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', content: [] } }));
    res.write(frame({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }));
    for (const piece of pieces.slice(0, half)) {
      res.write(frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } }));
    }
    const beforeMalformation = target.chunks.length;
    const releasedAtMalformation = readerTextOf(target.chunks).text.length;
    res.write(frame({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }));
    for (const piece of pieces.slice(half)) {
      res.write(frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } }));
    }
    const afterMalformation = target.chunks.length;
    res.write(frame({ type: 'content_block_stop', index: 0 }));
    res.write(frame({ type: 'message_stop' }));
    res.end();
    const all = readerTextOf(target.chunks);
    const ok = afterMalformation === beforeMalformation
      && releasedAtMalformation > 0
      && all.types.filter((t) => t === 'message_start').length === 1;
    contract.push({
      name: 'malformed-opening-earns-nothing',
      releasedBefore: releasedAtMalformation,
      framesAfter: afterMalformation - beforeMalformation,
      recorded: rejects.map((r) => r.stage + ':' + r.reason).join(' '),
      ok,
    });
    if (!ok) {
      note('contract', {
        name: 'malformed-opening-earns-nothing',
        releasedBefore: releasedAtMalformation,
        framesAfter: afterMalformation - beforeMalformation,
      });
    }
  }

  {
    // (3) THE LIMIT, MEASURED. A caller that lies from its FIRST answer gets bytes onto the
    // wire, and no check in this file can stop it: before anything has been released the
    // monotonicity test compares against the empty string, and a content test against the
    // raw wire text is not available — the reviewer rewrites what it approves, so a
    // released unit is legitimately not a substring of what the provider sent.
    //
    // WHAT THE WRITER STILL GUARANTEES, and what this case asserts: the divergence is
    // caught at flush(), it is RECORDED, no second message is opened, and no corrected
    // answer is sent on top of the wrong one. The reader keeps a short answer. That is
    // §٦/١ holding at the only point where it can still hold.
    const stream = createSentenceStream(contractInput);
    const emitted = [];
    let fed = 0;
    const LIE = 'هذا نصٌّ لم يكتبه أحد. ';
    const earlyRelease = ({ wireText }) => {
      if (wireText.length > fed) { emitted.push(...stream.push(wireText.slice(fed))); fed = wireText.length; }
      const honest = emitted.join('\n');
      return honest ? LIE + honest : honest;
    };
    const run = runWriter(createFinalizedSseResponse, {
      text: contractRecord.text,
      frames: providerFrames(contractRecord.text, CHUNKERS.words),
      finalize: contractFinalize,
      earlyRelease,
    });
    const all = readerTextOf(run.target.chunks);
    const early = readerTextOf(run.target.chunks.slice(0, run.sentBeforeEnd));
    const oracle = reviewAndLock({ text: contractRecord.text, ...contractInput }).text;
    const ok = all.text === early.text
      && all.types.filter((t) => t === 'message_start').length === 1
      && run.rejects.some((r) => r.stage === 'early-release' && r.reason === 'not-a-prefix')
      && all.text !== oracle;
    contract.push({
      name: 'caller-lies-from-the-first-byte',
      readerBytes: all.text.length,
      oracleBytes: oracle.length,
      nothingSentOnTop: all.text === early.text,
      recorded: run.rejects.map((r) => r.stage + ':' + r.reason).join(' '),
      ok,
    });
    if (!ok) note('contract', { name: 'caller-lies-from-the-first-byte' });
  }

  // ── CUTS ───────────────────────────────────────────────────────────────────
  const cuts = [];
  const cutRecord = corpus.find((r) => r.text.length > 400) || corpus[0];
  const cutInput = { evidence: [], domain: 'mixed', mode: 'standard', truncated: false, sources: [] };
  const makeEarly = () => {
    const stream = createSentenceStream(cutInput);
    const emitted = [];
    let fed = 0;
    return ({ wireText }) => {
      if (wireText.length > fed) { emitted.push(...stream.push(wireText.slice(fed))); fed = wireText.length; }
      return emitted.join('\n');
    };
  };
  const cutCases = [
    {
      name: 'signal-aborted-mid-stream',
      // flush() is never reached on an abort, so there is nothing to record and nothing to
      // compose. The claim is only that the wire keeps exactly what it had.
      expectRecorded: false,
      expectFinalEqualsEarly: true,
      run: () => runWriter(createFinalizedSseResponse, {
        text: cutRecord.text,
        frames: providerFrames(cutRecord.text, CHUNKERS.words),
        finalize: ({ text }) => ({ ok: true, text }),
        earlyRelease: makeEarly(),
        abortAfter: 40,
      }),
    },
    {
      name: 'stream-ends-without-message-stop',
      run: () => runWriter(createFinalizedSseResponse, {
        text: cutRecord.text,
        frames: providerFrames(cutRecord.text, CHUNKERS.words, { noStop: true }),
        finalize: ({ text }) => ({ ok: true, text }),
        earlyRelease: makeEarly(),
      }),
    },
    {
      name: 'finalizer-refuses-the-answer',
      run: () => runWriter(createFinalizedSseResponse, {
        text: cutRecord.text,
        frames: providerFrames(cutRecord.text, CHUNKERS.words),
        finalize: () => ({ ok: false, text: 'لا يمكنني تقديم هذه الإجابة.' }),
        earlyRelease: makeEarly(),
      }),
    },
    {
      name: 'composition-is-not-a-continuation',
      run: () => runWriter(createFinalizedSseResponse, {
        text: cutRecord.text,
        frames: providerFrames(cutRecord.text, CHUNKERS.words),
        finalize: ({ text }) => ({ ok: true, text }),
        earlyRelease: makeEarly(),
        readerPrefix: 'تنبيهٌ يسبقُ الجواب.',
      }),
    },
  ];
  for (const c of cutCases) {
    const run = c.run();
    const all = readerTextOf(run.target.chunks);
    const early = readerTextOf(run.target.chunks.slice(0, run.sentBeforeEnd));
    const starts = all.types.filter((t) => t === 'message_start').length;
    const nothingWithdrawn = all.text.startsWith(early.text);
    const oneMessage = starts === 1;
    const recorded = run.rejects.length > 0;
    const ok = nothingWithdrawn
      && oneMessage
      && early.text.length > 0
      && (c.expectRecorded === false ? true : recorded)
      && (c.expectFinalEqualsEarly ? all.text === early.text : true);
    cuts.push({
      name: c.name,
      earlyBytes: early.text.length,
      finalBytes: all.text.length,
      messageStarts: starts,
      nothingWithdrawn,
      recorded,
      rejects: run.rejects.map((r) => `${r.stage}:${r.reason}`).join(' '),
      ok,
    });
    if (!ok) {
      note('cut', {
        name: c.name, nothingWithdrawn, oneMessage, recorded,
        earlyBytes: early.text.length, finalBytes: all.text.length,
      });
    }
  }

  const report = {
    identity: { runs: identityRuns, same: identitySame },
    delivery: { runs: deliveryRuns, ok: deliveryOk, streamedEarly, deltasEarly },
    order: { runs: orderRuns, ok: orderOk },
    contract,
    cuts,
    failures,
  };
  report.pass = identitySame === identityRuns
    && deliveryOk === deliveryRuns
    && orderOk === orderRuns
    && contract.every((c) => c.ok)
    && cuts.every((c) => c.ok)
    && streamedEarly > 0;
  if (quiet) return report;

  console.log('IDENTITY  no earlyRelease option, this writer vs HEAD, byte for byte');
  console.log('          ' + identitySame + ' / ' + identityRuns + ' runs identical');
  console.log('');
  console.log('DELIVERY  earlyRelease driven by createSentenceStream');
  console.log('          ' + deliveryOk + ' / ' + deliveryRuns + ' runs: reader text == finalizer text,');
  console.log('          and what left before end() is a prefix of it');
  console.log('          runs that put text on the wire BEFORE end(): ' + streamedEarly
    + '   early deltas: ' + deltasEarly);
  console.log('');
  console.log('ORDER     the disagreement tail never overtakes released prose');
  console.log('          ' + orderOk + ' / ' + orderRuns + ' runs');
  console.log('');
  console.log('CONTRACT  what the writer refuses to take on trust from its caller');
  for (const c of contract) {
    console.log('  ' + (c.ok ? 'OK   ' : 'FAIL ') + c.name.padEnd(34) + '  '
      + JSON.stringify({ ...c, name: undefined, ok: undefined }));
  }
  console.log('');
  console.log('CUTS      what went out stays out, and no second message is opened');
  for (const c of cuts) {
    console.log('  ' + (c.ok ? 'OK   ' : 'FAIL ') + c.name.padEnd(34)
      + ' early ' + String(c.earlyBytes).padStart(5) + 'B  final ' + String(c.finalBytes).padStart(5)
      + 'B  message_start x' + c.messageStarts + '  [' + c.rejects + ']');
  }
  if (failures.length) {
    console.log('\nFAILURES (first ' + failures.length + '):');
    for (const f of failures) console.log('  ' + JSON.stringify(f));
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const selftest = args.includes('--selftest');
  const positional = args.filter((a) => !a.startsWith('--'));
  const corpusPath = positional[0];
  const outPath = positional[1];
  if (!corpusPath) {
    console.error('usage: pass-through-proof.cjs <corpus.json> [out.json] [--selftest]');
    process.exit(2);
  }
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const report = await runProof(url.pathToFileURL(WRITER).href, corpus, false);
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('\nwrote ' + outPath);
  }
  console.log('\n' + (report.pass ? 'GATE PASS' : 'GATE FAIL'));

  let selftestOk = true;
  if (selftest) {
    console.log('\nSELFTEST — each mutant must be caught:');
    // Every tree is built BEFORE any of them runs, so a stale anchor is a hard error and
    // not a mutant that «threw, therefore passed».
    const built = MUTANTS.map((mutant) => ({ mutant, file: mutatedWriter(mutant) }));
    for (const { mutant, file } of built) {
      let caught;
      let detail;
      try {
        const r = await runProof(url.pathToFileURL(file).href, corpus.slice(0, 24), true);
        caught = !r.pass;
        detail = 'identity ' + r.identity.same + '/' + r.identity.runs
          + '  delivery ' + r.delivery.ok + '/' + r.delivery.runs
          + '  order ' + r.order.ok + '/' + r.order.runs
          + '  contract ' + r.contract.filter((c) => c.ok).length + '/' + r.contract.length
          + '  cuts ' + r.cuts.filter((c) => c.ok).length + '/' + r.cuts.length;
      } catch (e) {
        caught = true;
        detail = 'threw: ' + String(e.message || e).slice(0, 60);
      }
      if (!caught) selftestOk = false;
      console.log('  ' + (caught ? 'CAUGHT ' : 'MISSED ') + mutant.name.padEnd(34) + detail
        + '\n           claim: ' + mutant.claim);
    }
    console.log('\nSELFTEST ' + (selftestOk ? 'PASS' : 'FAIL') + ' — ' + MUTANTS.length
      + ' mutants, ' + (selftestOk ? 'all caught' : 'one or more MISSED'));
  }

  process.exit(report.pass && selftestOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
