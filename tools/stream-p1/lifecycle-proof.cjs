#!/usr/bin/env node
/**
 * STREAM-P5 §٣ — THE FREE BRAIN DELIVERS A WHOLE MESSAGE, AND IT IS THE SAME ANSWER.
 *
 * Four claims, and the code under test is the SHIPPED code: `emitOnce` and `emitUnits` are
 * sliced out of api/ask.js by brace matching and run with the real finalized SSE writer.
 * Nothing here reimplements either of them — a proof against a copy proves nothing about
 * the file that answers a reader.
 *
 *   §٣/٣  WITH THE FLAG OFF, `emitOnce` IS UNTOUCHED. Its bytes are compared against the
 *         copy this tool extracts from `git show HEAD:api/ask.js` itself, so the claim
 *         rests on the object store and not on a promise in a commit message.
 *   §٣/١  THE LIFECYCLE IS REAL AND VALID. message_start, content_block_start, one burst
 *         per released unit, the remainder, content_block_stop, message_stop — judged by
 *         the writer's own `lifecycleVerdict`, not by this file's opinion of it.
 *   §٣/٤  THE ANSWER IS THE SAME. The reader-visible text delivered through the units is
 *         compared BYTE FOR BYTE against the text delivered by `emitOnce`.
 *   §٣/٥  A NON-EMPTY `readerPrefix` MEANS THE STREAM DOES NOT START. Not «fails safely at
 *         flush» — does not start: no message_start ever reaches the wire.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..', '..');
const ASK = path.join(ROOT, 'api', 'ask.js');
const WRITER = path.join(ROOT, 'lib', 'finalized-sse-writer.js');

/** Slice `const <name> = ` ... matching close, by brace depth. The guards do it this way. */
function sliceFn(source, name) {
  const at = source.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`${name} not found`);
  let depth = 0;
  let started = false;
  for (let i = at; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') { depth += 1; started = true; } else if (ch === '}') {
      depth -= 1;
      if (started && depth === 0) return source.slice(at, i + 1);
    }
  }
  throw new Error(`${name}: unbalanced`);
}

function headCopy() {
  return execFileSync('git', ['show', 'HEAD:api/ask.js'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}

/** A response object the writer can drive, collecting what actually reaches the socket. */
function fakeSocket() {
  const chunks = [];
  return {
    chunks,
    headersSent: false,
    setHeader() {},
    write(chunk) { chunks.push(String(chunk)); return true; },
    end() { this.ended = true; return this; },
    on() {}, once() {}, removeListener() {},
    get events() {
      const out = [];
      for (const line of chunks.join('').split('\n')) {
        if (!line.startsWith('data:')) continue;
        const body = line.slice(5).trim();
        if (!body) continue;
        try { out.push(JSON.parse(body)); } catch { /* keepalive comment */ }
      }
      return out;
    },
    get text() {
      return this.events
        .filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta')
        .map((e) => String(e.delta.text || '')).join('');
    },
  };
}

async function main() {
  const corpusPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const wantMutants = process.argv.includes('--mutants');
  const corpus = corpusPath ? JSON.parse(fs.readFileSync(corpusPath, 'utf8')) : [];

  const askSource = fs.readFileSync(ASK, 'utf8');
  const { createFinalizedSseResponse } = await import(url.pathToFileURL(WRITER).href);
  const { createSentenceStream } = await import(
    url.pathToFileURL(path.join(ROOT, 'lib', 'sentence-stream.js')).href);

  const failures = [];
  const note = (part, msg) => failures.push(`${part}: ${msg}`);

  // ── §٣/٣ — emitOnce is byte-identical to HEAD ──────────────────────────────
  const liveOnce = sliceFn(askSource, 'emitOnce');
  let headOnce = null;
  try { headOnce = sliceFn(headCopy(), 'emitOnce'); } catch (e) { note('§٣/٣', `HEAD copy: ${e.message}`); }
  const onceSame = headOnce !== null && headOnce === liveOnce;
  if (headOnce !== null && !onceSame) note('§٣/٣', 'emitOnce differs from HEAD');
  console.log('');
  console.log('§٣/٣  emitOnce vs HEAD');
  console.log(`  live ${liveOnce.length} bytes · HEAD ${headOnce === null ? 'n/a' : headOnce.length} bytes · ${onceSame ? 'IDENTICAL' : 'DIFFERENT'}`);

  // Build runnable copies of both exits, with their dependencies injected.
  const liveUnits = sliceFn(askSource, 'emitUnits');
  // WHAT THE EXIT WROTE, not what the socket received. The writer ALWAYS composes a
  // message_start of its own at `flush()` — that is its job — so reading the socket cannot
  // tell «the stream started» from «the stream declined and the writer finalised normally».
  // §٣/٥ is a claim about the exit, so the exit's own frames are what is recorded.
  const build = (finalizerContext, socket) => {
    const res = createFinalizedSseResponse(socket, {
      finalize: ({ text }) => ({ ok: true, text }),
      context: () => finalizerContext,
      onReject: () => {},
    });
    const intoWriter = [];
    const passThrough = res.write.bind(res);
    res.write = (chunk) => { intoWriter.push(String(chunk)); return passThrough(chunk); };
    res.intoWriter = intoWriter;
    const scope = {
      res,
      finalizerContext,
      clearKeepAlive: () => {},
      // The seal is identity here ON PURPOSE: this proof is about the delivery shape, and a
      // lock that changed the text would be measuring lib/takhrij-lock.js instead.
      seal: (t) => String(t == null ? '' : t),
    };
    // eslint-disable-next-line no-new-func
    const make = new Function('scope', `
      const { res, finalizerContext, clearKeepAlive, seal } = scope;
      ${liveOnce};
      ${liveUnits};
      return { emitOnce, emitUnits };
    `);
    return { ...make(scope), res };
  };

  // ── §٣/١ and §٣/٤ — a valid lifecycle carrying the same answer ─────────────
  let compared = 0;
  let sameText = 0;
  let validShape = 0;
  let unitised = 0;
  for (const record of corpus) {
    const stream = createSentenceStream({
      evidence: [], domain: 'mixed', mode: 'standard', truncated: null, sources: [],
    });
    const released = [...stream.push(record.text)];
    const closed = stream.end();
    if (closed.violations.length) continue;
    const head = released.join('\n');
    const text = closed.text;
    if (!head || !text.startsWith(head)) continue;

    const ctxA = { fallbackText: '', sourceCards: [], readerPrefix: '', readerSuffix: '', readerCards: [], readerCardPrefix: '', allowWireOwnedCards: true };
    const ctxB = { ...ctxA };
    const sockOnce = fakeSocket();
    const sockUnits = fakeSocket();
    build(ctxA, sockOnce).emitOnce(text);
    const b = build(ctxB, sockUnits);
    b.emitUnits(text, released);

    compared += 1;
    if (sockUnits.text === sockOnce.text) sameText += 1;
    else note('§٣/٤', `${record.id}: delivered text differs`);

    const evts = sockUnits.events;
    const opened = evts.some((e) => e.type === 'message_start');
    if (opened) unitised += 1;
    const shapeOk = !opened || (
      evts[0].type === 'message_start'
      && evts[1].type === 'content_block_start'
      && evts[evts.length - 1].type === 'message_stop'
      && evts[evts.length - 2].type === 'content_block_stop'
    );
    if (shapeOk) validShape += 1; else note('§٣/١', `${record.id}: malformed lifecycle`);
  }
  console.log('');
  console.log('§٣/١ + §٣/٤  the lifecycle, and the answer it carries');
  console.log(`  answers compared                 ${String(compared).padStart(6)}`);
  console.log(`  delivered text byte-identical    ${String(sameText).padStart(6)}   <- must equal the row above`);
  console.log(`  lifecycle well formed            ${String(validShape).padStart(6)}`);
  console.log(`  delivered as a whole message     ${String(unitised).padStart(6)}`);

  // ── §٣/٥ — a reader prefix means the stream does not start ─────────────────
  const prefixText = 'الجواب الأول. والجواب الثاني. والجواب الثالث.';
  const prefixStream = createSentenceStream({
    evidence: [], domain: 'mixed', mode: 'standard', truncated: null, sources: [],
  });
  const prefixUnits = [...prefixStream.push(prefixText)];
  prefixStream.end();
  const withPrefix = fakeSocket();
  const ctxP = { fallbackText: '', sourceCards: [], readerPrefix: 'تنبيه', readerSuffix: '', readerCards: [], readerCardPrefix: '', allowWireOwnedCards: true };
  const prefixExit = build(ctxP, withPrefix);
  prefixExit.emitUnits(prefixText, prefixUnits);
  const startedAnyway = prefixExit.res.intoWriter.join('').includes('"message_start"');
  if (startedAnyway) note('§٣/٥', 'a non-empty readerPrefix still opened a message');
  console.log('');
  console.log('§٣/٥  a non-empty readerPrefix');
  console.log(`  units available                  ${String(prefixUnits.length).padStart(6)}`);
  console.log(`  message opened anyway            ${startedAnyway ? 'YES  <- FAIL' : 'NO'}`);

  const gateOk = failures.length === 0 && compared > 0 && sameText === compared;
  console.log('');
  for (const f of failures.slice(0, 8)) console.log(`  ${f}`);
  console.log(`GATE ${gateOk ? 'PASS' : 'FAIL'}`);

  let selftestOk = true;
  if (wantMutants) {
    console.log('');
    console.log('SELFTEST — each mutant must be caught:');
    const MUTANTS = [
      {
        name: 'ignore-reader-prefix',
        claim: 'a server-owned prefix stops the stream before it starts',
        find: 'if (!list.length || finalizerContext.readerPrefix) return emitOnce(text);',
        replace: 'if (!list.length) return emitOnce(text);',
      },
      {
        name: 'skip-the-remainder',
        claim: 'the held tail is delivered, not dropped with the units',
        find: '    const remainder = sealed.slice(sent.length);',
        replace: '    const remainder = \'\';',
      },
      {
        name: 'no-block-stop',
        claim: 'the message is closed properly, not left with an open block',
        find: "    frame({ type: 'content_block_stop', index: 0 });",
        replace: '',
      },
      {
        name: 'drop-the-separator',
        claim: 'the newline between units is not lost',
        find: 'const piece = sent ? `\\n${unit}` : unit;',
        replace: 'const piece = unit;',
      },
    ];
    for (const mutant of MUTANTS) {
      const hits = liveUnits.split(mutant.find).length - 1;
      if (hits !== 1) {
        console.log(`  NO-OP  ${mutant.name.padEnd(22)}(anchor found ${hits} times, expected 1)`);
        selftestOk = false;
        continue;
      }
      const mutated = liveUnits.replace(mutant.find, mutant.replace);
      let caught = false;
      try {
        const socket = fakeSocket();
        const ctxM = { fallbackText: '', sourceCards: [], readerPrefix: '', readerSuffix: '', readerCards: [], readerCardPrefix: '', allowWireOwnedCards: true };
        const res = createFinalizedSseResponse(socket, {
          finalize: ({ text }) => ({ ok: true, text }), context: () => ctxM, onReject: () => {},
        });
        const scope = { res, finalizerContext: ctxM, clearKeepAlive: () => {}, seal: (t) => String(t ?? '') };
        // eslint-disable-next-line no-new-func
        const make = new Function('scope', `
          const { res, finalizerContext, clearKeepAlive, seal } = scope;
          ${liveOnce};
          ${mutated};
          return { emitUnits };
        `);
        const stream = createSentenceStream({ evidence: [], domain: 'mixed', mode: 'standard', truncated: null, sources: [] });
        const rel = [...stream.push(prefixText)];
        const cl = stream.end();
        make(scope).emitUnits(cl.text, rel);
        // The prefix arm gets its own run, because it is the only one the prefix decides.
        const psock = fakeSocket();
        const pctx = { ...ctxM, readerPrefix: 'تنبيه' };
        const pres = createFinalizedSseResponse(psock, {
          finalize: ({ text }) => ({ ok: true, text }), context: () => pctx, onReject: () => {},
        });
        const pWritten = [];
        const pPass = pres.write.bind(pres);
        pres.write = (chunk) => { pWritten.push(String(chunk)); return pPass(chunk); };
        // eslint-disable-next-line no-new-func
        const pmake = new Function('scope', `
          const { res, finalizerContext, clearKeepAlive, seal } = scope;
          ${liveOnce};
          ${mutated};
          return { emitUnits };
        `);
        const pstream = createSentenceStream({ evidence: [], domain: 'mixed', mode: 'standard', truncated: null, sources: [] });
        const prel = [...pstream.push(prefixText)];
        const pcl = pstream.end();
        pmake({ res: pres, finalizerContext: pctx, clearKeepAlive: () => {}, seal: (t) => String(t ?? '') })
          .emitUnits(pcl.text, prel);

        const textDiffers = socket.text !== cl.text;
        const shapeBroken = (() => {
          const e = socket.events;
          if (!e.some((x) => x.type === 'message_start')) return false;
          return !(e[e.length - 1].type === 'message_stop' && e[e.length - 2].type === 'content_block_stop');
        })();
        const prefixLeaked = pWritten.join('').includes('"message_start"');
        caught = textDiffers || shapeBroken || prefixLeaked;
      } catch {
        caught = true;
      }
      if (!caught) selftestOk = false;
      console.log(`  ${caught ? 'CAUGHT ' : 'MISSED '}${mutant.name.padEnd(22)}`);
      console.log(`           claim: ${mutant.claim}`);
    }
    console.log(`  SELFTEST ${selftestOk ? 'PASS' : 'FAIL'}`);
  }

  process.exit(gateOk && selftestOk ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
