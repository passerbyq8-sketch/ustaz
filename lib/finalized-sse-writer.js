const DEFAULT_LIMITS = Object.freeze({
  totalBytes: 2 * 1024 * 1024,
  pendingBytes: 256 * 1024,
  events: 20000,
});
export const FINALIZATION_COMPLETE = Symbol.for('ustaz.finalized-sse.complete');
export const FINALIZATION_CONTEXT = Symbol.for('ustaz.finalized-sse.context');

const encode = (event) => `data: ${JSON.stringify(event)}\n\n`;
const startEvent = () => ({ type: 'message_start', message: { id: 'server-finalized', type: 'message', role: 'assistant', content: [] } });
const blockStart = () => ({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
const blockStop = () => ({ type: 'content_block_stop', index: 0 });
const textDelta = (text) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });

// A degradation ledger for the server side of the empty-bubble family, mirroring the client's
// EZIK_TAG_RESCUES. It exists so that a strip which EMPTIES an answer leaves a trace: the old
// code could turn 69 characters into 0 and record nothing anywhere, which is the failure that
// cannot be investigated because it looks exactly like "the model returned nothing".
// In-memory, bounded, never sent anywhere.
const MAX_LEDGER = 50;
export const SSE_STRIP_LEDGER = [];
function recordStrip(entry) {
  SSE_STRIP_LEDGER.push(entry);
  if (SSE_STRIP_LEDGER.length > MAX_LEDGER) SSE_STRIP_LEDGER.shift();
}

/**
 * Remove every model-owned source card while preserving all surrounding prose.
 *
 * THE SECOND PASS DELETES A TAG, NOT A TAIL (أ-٦/١). It used to read
 * `/<source\b[^>]*>?[\s\S]*$/` — an UNCLOSED card swallowed the entire remainder of the answer,
 * so a reply whose last line opened a card lost every sentence after it. Measured: 69 characters
 * of prose reduced to 0, with no rescue and no record. The extent of an unclosed tag is the tag
 * and its own line: up to the next `<` or the next newline, whichever comes first. Everything
 * beyond that boundary was never inside the card and survives.
 *
 * THE THIRD PASS DELETES A CLOSER THAT NEVER HAD AN OPENER (AA-30). Both passes above are
 * anchored on `<source\b`, and a closing tag begins `</s` -- the slash sits where the
 * `s` is looked for, so NEITHER pattern can see `</source>` standing on its own. Measured: an
 * orphan closer survived every stripper on every path, server and client alike, and reached the
 * reader as raw markup. It is taken LAST, on purpose: by the time this pass runs, every
 * well-formed pair has been consumed whole by the first pass and every unclosed opener by the
 * second, so a `</source>` still standing is one with no opener in front of it. A well-formed
 * pair is therefore stripped byte for byte as it was before this pass existed.
 */
export function stripUnownedSourceCards(value) {
  return String(value || '')
    .replace(/<source\b[^>]*>[\s\S]*?<\/source>/giu, '')
    .replace(/<source\b[^>]*>?[^<\n]*/giu, '')
    .replace(/<\/source>/giu, '');
}

function parseFrame(bytes) {
  const raw = bytes.toString('utf8');
  const lines = raw.split(/\r?\n/);
  let data = '';
  for (const line of lines) {
    if (line.startsWith('data:')) data += line.slice(5).trimStart();
  }
  if (!data) return { event: null, raw };
  return { event: JSON.parse(data), raw };
}

function separateOwnedCardSuffix(text, cards) {
  const value = String(text || '');
  const owned = (Array.isArray(cards) ? cards : []).map((card) => String((card && card.tag) || '')).filter(Boolean);
  if (!owned.length) return { prose: value, suffix: '' };
  let cursor = value.length;
  const found = [];
  while (cursor > 0) {
    let whitespace = cursor;
    while (whitespace > 0 && /\s/u.test(value[whitespace - 1])) whitespace--;
    const tag = owned.find((candidate) => whitespace >= candidate.length
      && value.slice(whitespace - candidate.length, whitespace) === candidate);
    if (!tag) break;
    found.unshift({ start: whitespace - tag.length, end: cursor });
    cursor = whitespace - tag.length;
  }
  if (!found.length) return { prose: value, suffix: '' };
  return { prose: value.slice(0, found[0].start), suffix: value.slice(found[0].start) };
}

function lifecycleVerdict(events) {
  const hasLifecycle = events.some((event) => event && ['message_start', 'content_block_start', 'content_block_stop'].includes(event.type));
  if (!hasLifecycle) {
    const stops = events.filter((event) => event && event.type === 'message_stop');
    const deltas = events.filter((event) => event && event.type === 'content_block_delta');
    if (stops.length !== 1 || deltas.length === 0 || events.length !== stops.length + deltas.length
      || events[events.length - 1] !== stops[0]) return { valid: false, complete: false, textOnly: true, reason: 'compact-shape' };
    const expanded = [startEvent(), blockStart(), ...deltas, blockStop(), stops[0]];
    const verdict = lifecycleVerdict(expanded);
    return { ...verdict, complete: false };
  }
  let messageStarted = false;
  let messageStopped = false;
  let messageDeltaSeen = false;
  let nextBlockIndex = 0;
  let textOnly = true;
  const open = new Map();
  const used = new Set();
  const reject = (reason) => ({ valid: false, complete: true, textOnly, reason });
  for (const event of events) {
    if (!event || messageStopped) return reject('event-after-message-stop');
    if (event.type === 'message_start') {
      if (messageStarted || open.size || used.size || !event.message || event.message.role !== 'assistant') return reject('message-start');
      messageStarted = true;
    } else if (event.type === 'content_block_start') {
      if (!messageStarted || messageDeltaSeen || open.size !== 0 || !Number.isInteger(event.index) || event.index < 0
        || event.index !== nextBlockIndex || !event.content_block
        || !['text', 'thinking', 'redacted_thinking'].includes(event.content_block.type)
        || open.has(event.index) || used.has(event.index)) return reject('content-block-start');
      const blockType = event.content_block.type;
      if (blockType !== 'text') textOnly = false;
      open.set(event.index, blockType); used.add(event.index);
      nextBlockIndex += 1;
    } else if (event.type === 'content_block_delta') {
      const blockType = open.get(event.index);
      if (!messageStarted || messageDeltaSeen || !blockType || !event.delta) return reject('content-block-delta');
      const validText = blockType === 'text'
        && event.delta.type === 'text_delta' && typeof event.delta.text === 'string';
      const validThinking = blockType === 'thinking'
        && ((event.delta.type === 'thinking_delta' && typeof event.delta.thinking === 'string')
          || (event.delta.type === 'signature_delta' && typeof event.delta.signature === 'string'));
      if (!validText && !validThinking) return reject(`content-block-delta:${blockType}:${event.delta.type || 'unknown'}`);
    } else if (event.type === 'content_block_stop') {
      if (!messageStarted || messageDeltaSeen || !open.has(event.index)) return reject('content-block-stop');
      open.delete(event.index);
    } else if (event.type === 'message_delta') {
      if (!messageStarted || open.size || used.size === 0
        || !event.delta || typeof event.delta !== 'object'
        || (event.usage !== undefined && (!event.usage || typeof event.usage !== 'object'))) {
        return reject('message-delta');
      }
      messageDeltaSeen = true;
    } else if (event.type === 'ping') {
      if (!messageStarted) return reject('ping-before-message');
    } else if (event.type === 'message_stop') {
      if (!messageStarted || open.size) return reject('message-stop');
      messageStopped = true;
    } else return reject(`unsupported-event:${event.type || 'unknown'}`);
  }
  return {
    valid: messageStarted && messageStopped && open.size === 0,
    complete: true,
    textOnly,
    reason: messageStarted && messageStopped && open.size === 0 ? '' : 'incomplete-lifecycle',
  };
}

/**
 * A narrow ServerResponse facade. Text deltas are held until the complete answer passes finalize.
 * SSE comments pass through; data frames are replayed in their original order at finalization.
 */
export function createFinalizedSseResponse(target, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const frames = [];
  // ── DOOR H-2: THE PASS-THROUGH (STREAM-P3 §٤) ──────────────────────────────
  //
  // ABSENT `options.earlyRelease`, NOTHING BELOW RUNS AND NOT ONE BYTE MOVES. `released`
  // stays empty, `earlyOpen` stays false, and every branch that reads them takes the path
  // it took before this door existed. That is the default, and it is what every caller on
  // the delivery path uses today.
  //
  // WITH IT, the writer stops being a pure accumulator. After each text delta it asks the
  // caller: of the text that has arrived, how much is APPROVED to leave now? The caller
  // answers with a prefix — in this repo that answer comes from `createSentenceStream`,
  // which releases a unit only once the local reviewer, the takhrij lock, the reach of the
  // rebuild's tidy pass, and the settled-attribution test have all cleared it.
  //
  // THREE THINGS THE WRITER CHECKS FOR ITSELF, because a delivery file does not take a
  // caller's word for the one rule it exists to keep:
  //   1. the answer must be a string and must EXTEND what has already gone out. It is NOT
  //      required to be a prefix of the raw wire text, and that is not an omission: the
  //      reviewer rewrites what it approves — it tags an unsupported attribution, joins its
  //      units with a newline the model never wrote — so a released unit is generally not a
  //      substring of what the provider sent. The invariant that matters is «a prefix of the
  //      FINAL text», and nothing but `flush()` is in a position to check it;
  //   2. the frames so far must form a valid opening: one text block, open, no thinking,
  //      no `message_delta`, nothing after a stop. A stream cannot earn early delivery by
  //      being malformed in a way `flush()` would have caught;
  //   3. at `flush()`, what went out must be a prefix of what the finalizer approved.
  //
  // AND IF (3) FAILS THERE IS NO UNDO. The bytes are on the wire. §٦/١ says zero sentences
  // are withdrawn or replaced, so the writer does not send a corrected answer on top of a
  // wrong one: it closes the block where it stands, records the divergence, and the reader
  // keeps a SHORT answer rather than a contradictory one. Same rule as a cut stream.
  let released = '';
  let earlyOpen = false;
  let earlyText = '';
  let earlyRelease = typeof options.earlyRelease === 'function' ? options.earlyRelease : null;
  let earlyEligible = earlyRelease !== null;
  let earlyBlockOpen = false;
  let earlyMessageStarted = false;
  let pending = Buffer.alloc(0);
  let totalBytes = 0;
  let eventCount = 0;
  let stopped = false;
  let ended = false;
  let failed = '';
  let aborted = !!(options.signal && options.signal.aborted);
  let replaying = false;
  let cancelReplay = null;
  const output = [];

  const reportReject = (stage, reason) => {
    try { options.onReject?.({ stage, reason: String(reason || 'unknown') }); } catch {}
  };

  const onAbort = () => {
    aborted = true;
    failed = failed || 'aborted';
    cancelReplay?.('aborted');
  };
  options.signal?.addEventListener?.('abort', onAbort, { once: true });
  const onDisconnect = () => {
    aborted = true;
    failed = failed || 'client-disconnect';
    cancelReplay?.('client-disconnect');
  };
  target.once?.('close', onDisconnect);
  const detachTerminalListeners = () => {
    options.signal?.removeEventListener?.('abort', onAbort);
    target.removeListener?.('close', onDisconnect);
  };

  // Every byte-release path converges here: early opening, approved deltas, comments, and final
  // replay.  P6 observes the one sink instead of teaching five callers five timing behaviours.
  const writeTarget = (chunk, encoding, callback) => {
    const accepted = target.write(chunk, encoding, callback);
    try {
      options.onWireWrite?.({
        at: Date.now(),
        bytes: Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), 'utf8'),
      });
    } catch {}
    return accepted;
  };
  const queueOutput = (chunk) => { output.push(chunk); };
  const fail = (reason) => { failed = failed || reason; };
  const writeFailure = () => {
    queueOutput(encode(startEvent()));
    queueOutput(encode(blockStart()));
    queueOutput(encode(textDelta(String(options.failureText || 'server output rejected'))));
    queueOutput(encode(blockStop()));
    queueOutput(encode({ type: 'message_stop' }));
  };

  /**
   * Track just enough lifecycle to know an opening is well formed. This is deliberately
   * NOT a second copy of `lifecycleVerdict`: that one judges a COMPLETE stream, and the
   * question here is whether an INCOMPLETE one is safe so far. Anything unexpected ends
   * eligibility for good; it never fails the response, because `flush()` still judges the
   * whole stream exactly as it did before.
   */
  const trackEarlyLifecycle = (evt) => {
    if (!earlyEligible) return;
    if (evt.type === 'message_start') {
      if (earlyMessageStarted || !evt.message || evt.message.role !== 'assistant') { earlyEligible = false; return; }
      earlyMessageStarted = true;
    } else if (evt.type === 'content_block_start') {
      if (!earlyMessageStarted || earlyBlockOpen || evt.index !== 0
        || !evt.content_block || evt.content_block.type !== 'text') { earlyEligible = false; return; }
      earlyBlockOpen = true;
    } else if (evt.type === 'content_block_delta') {
      if (!earlyBlockOpen || evt.index !== 0 || !evt.delta || evt.delta.type !== 'text_delta'
        || typeof evt.delta.text !== 'string') { earlyEligible = false; return; }
      earlyText += evt.delta.text;
    } else {
      // content_block_stop, message_delta, message_stop: the stream is finishing and what
      // is left belongs to flush(). Not an error — just the end of early delivery.
      earlyEligible = false;
    }
  };

  /** Ask the caller how much of what has arrived may go now, and send only that much. */
  const attemptEarlyRelease = () => {
    if (!earlyEligible || failed || aborted || stopped || ended) return;
    let approved;
    try {
      approved = earlyRelease({ wireText: earlyText, events: [...frames] });
    } catch {
      earlyEligible = false;
      return;
    }
    if (typeof approved !== 'string' || !approved.startsWith(released)) {
      // A contract break stops early delivery and nothing else: what is already out stays
      // out, and the rest is decided by flush() the ordinary way.
      earlyEligible = false;
      reportReject('early-release', 'contract');
      return;
    }
    if (approved.length === released.length) return;
    try {
      if (!earlyOpen) {
        writeTarget(encode(startEvent()));
        writeTarget(encode(blockStart()));
        earlyOpen = true;
      }
      writeTarget(encode(textDelta(approved.slice(released.length))));
    } catch (error) {
      earlyEligible = false;
      reportReject('early-release', error?.message || 'write-failed');
      return;
    }
    released = approved;
  };

  const acceptFrame = (frame) => {
    eventCount++;
    if (eventCount > limits.events) { fail('event-overflow'); return; }
    let parsed;
    try { parsed = parseFrame(frame); } catch { fail('malformed-json'); return; }
    const evt = parsed.event;
    if (!evt) {
      // Only comments/empty protocol frames may bypass finalization.
      if (/^(?:\s*:\s*[^\r\n]*\r?\n)*\s*$/u.test(parsed.raw)) writeTarget(frame);
      else fail('non-data-frame');
      return;
    }
    if (stopped) { fail('event-after-stop'); return; }
    frames.push(evt);
    if (evt.type === 'message_stop') stopped = true;
    trackEarlyLifecycle(evt);
    attemptEarlyRelease();
  };

  const consume = (chunk) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
    totalBytes += buf.length;
    if (totalBytes > limits.totalBytes) { fail('total-overflow'); return; }
    pending = pending.length ? Buffer.concat([pending, buf]) : buf;
    if (pending.length > limits.pendingBytes) { fail('pending-overflow'); return; }
    while (true) {
      const lf = pending.indexOf(Buffer.from('\n\n'));
      const crlf = pending.indexOf(Buffer.from('\r\n\r\n'));
      let at = -1;
      let sep = 0;
      if (lf !== -1 && (crlf === -1 || lf < crlf)) { at = lf; sep = 2; }
      else if (crlf !== -1) { at = crlf; sep = 4; }
      if (at === -1) break;
      const frame = pending.subarray(0, at + sep);
      pending = pending.subarray(at + sep);
      acceptFrame(frame);
    }
  };

  /**
   * The wire already carries an open message, so a fresh `message_start` would be a protocol
   * violation and a second answer on top of the first. The block is closed where it stands.
   * What the reader keeps is short and true; nothing is withdrawn.
   */
  const closeEarly = (reason) => {
    reportReject('early-release', reason);
    try { options.onDegrade?.({ stage: 'early-release', reason, released: released.length }); } catch {}
    recordStrip({ reason: 'early-release-' + reason, before: released.length, after: released.length });
    queueOutput(encode(blockStop()));
    queueOutput(encode({ type: 'message_stop' }));
  };

  const flush = () => {
    if (ended) return;
    if (pending.length) fail('incomplete-frame');
    if (!stopped) fail('missing-stop');
    const lifecycle = lifecycleVerdict(frames);
    if (!lifecycle.valid) fail(`invalid-lifecycle:${lifecycle.reason || 'unknown'}`);

    if (failed || aborted) {
      reportReject('protocol', failed || 'aborted');
      if (earlyOpen) { closeEarly(failed || 'aborted'); return; }
      writeFailure();
      return;
    }

    const wireText = frames
      .filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta')
      .map((e) => String(e.delta.text || '')).join('');
    let result;
    let approvedAttachmentSuffix = '';
    let scaffoldPrefix = '';
    let scaffoldSuffix = '';
    try {
      const context = typeof options.context === 'function'
        ? options.context({ wireText, events: [...frames] })
        : (options.context || {});
      target[FINALIZATION_CONTEXT] = context;
      const sourceCards = Array.isArray(context.sourceCards) ? context.sourceCards : [];
      const filteredWireText = context.stripUnownedSourceCards === true
        ? (typeof context.strippedWireText === 'string'
            ? context.strippedWireText
            : stripUnownedSourceCards(wireText))
        : wireText;
      // أ-٦/٢ — the server records an emptying the same way the client does, and it records it
      // whether or not anything survived. A strip that removes everything is the single most
      // important event on this path and it used to be the only one that left no trace.
      if (wireText.trim() && !filteredWireText.trim()) {
        recordStrip({ reason: 'source-strip-emptied-reply', before: wireText.length, after: filteredWireText.length });
        try { options.onDegrade?.({ stage: 'source-strip', reason: 'emptied-reply', before: wireText.length }); } catch {}
      }
      const separated = context.allowWireOwnedCards === false
        ? { prose: filteredWireText, suffix: '' }
        : separateOwnedCardSuffix(filteredWireText, sourceCards);
      const readerPrefix = typeof context.readerPrefix === 'string' ? context.readerPrefix : '';
      const derivedSuffix = typeof context.readerSuffixFor === 'function'
        ? context.readerSuffixFor(separated.prose, { events: [...frames] })
        : '';
      if (typeof derivedSuffix !== 'string') throw new Error('invalid-reader-suffix');
      const readerSuffix = (typeof context.readerSuffix === 'string' ? context.readerSuffix : '')
        + derivedSuffix;
      scaffoldPrefix = readerPrefix;
      scaffoldSuffix = readerSuffix;
      const composedProse = (readerPrefix
        ? readerPrefix + (separated.prose ? '\n\n' : '')
        : '') + separated.prose + readerSuffix;
      const ownedTags = new Set(sourceCards.map((card) => String((card && card.tag) || '')).filter(Boolean));
      // A card may never become an orphan when upstream completed with no prose. Server-owned
      // prefixes are disclosure context, not evidence for an absent model answer.
      const readerCards = separated.prose.trim() && Array.isArray(context.readerCards)
        ? context.readerCards : [];
      const readerCardTags = readerCards.map((card) => String((card && card.tag) || ''));
      if (readerCardTags.some((tag) => !tag || !ownedTags.has(tag))) throw new Error('unowned-reader-card');
      const readerCardSuffix = readerCardTags.length
        ? String(context.readerCardPrefix || '') + readerCardTags.join('\n')
        : '';
      approvedAttachmentSuffix = separated.suffix + readerCardSuffix;
      if (Buffer.byteLength(composedProse + separated.suffix + readerCardSuffix, 'utf8') > limits.totalBytes) {
        reportReject('compose', 'output-overflow');
        if (earlyOpen) { closeEarly('output-overflow'); return; }
        writeFailure();
        return;
      }
      result = options.finalize({ ...context, text: composedProse, cards: sourceCards });
    } catch (error) {
      reportReject('compose', error?.message || error);
      if (earlyOpen) { closeEarly('compose'); return; }
      writeFailure();
      return;
    }
    if (!result || typeof result !== 'object' || typeof result.text !== 'string' || typeof result.ok !== 'boolean') {
      reportReject('finalize-contract', 'invalid-result');
      if (earlyOpen) { closeEarly('finalize-contract'); return; }
      writeFailure(); return;
    }
    let substantiveText = result.text;
    if (scaffoldPrefix && substantiveText === scaffoldPrefix) substantiveText = '';
    else if (scaffoldPrefix && substantiveText.startsWith(scaffoldPrefix + '\n\n')) {
      substantiveText = substantiveText.slice(scaffoldPrefix.length + 2);
    }
    if (scaffoldSuffix && substantiveText.endsWith(scaffoldSuffix)) {
      substantiveText = substantiveText.slice(0, -scaffoldSuffix.length);
    }
    if (result.ok && substantiveText.trim() && approvedAttachmentSuffix) {
      result = { ...result, text: result.text + approvedAttachmentSuffix };
    }

    // ── AN EMPTY APPROVAL IS A FAILURE, NOT AN ANSWER (أ-٦/٣) ───────────────
    //
    // A finalize result of `{ ok: true, text: '' }` used to be replayed faithfully: a structurally
    // PERFECT SSE stream — message_start, an empty block, message_stop — carrying not one byte for
    // the reader. Everything downstream reported success, and the child got a blank bubble and
    // silence. There is no situation in which shipping nothing is the right outcome: if the whole
    // answer was removed, the honest act is to say so.
    //
    // The test is on the SUBSTANTIVE text, not on result.text, so a server-owned prefix (a live-
    // search disclosure, a scholar lead) cannot stand in for a model answer that never arrived —
    // that scaffold is disclosure context, and disclosure with nothing to disclose is an empty
    // bubble wearing a hat.
    if (result.ok && !substantiveText.trim()) {
      reportReject('finalize-empty', 'approved-empty-text');
      try { options.onDegrade?.({ stage: 'finalize', reason: 'approved-empty-text' }); } catch {}
      recordStrip({ reason: 'finalize-approved-empty-text', before: wireText.length, after: 0 });
      if (earlyOpen) { closeEarly('approved-empty-text'); return; }
      writeFailure();
      return;
    }

    if (earlyOpen) {
      // §٦/١, checked and not assumed. Everything already on the wire must still be the
      // head of the answer the finalizer approved.
      if (!result.text.startsWith(released)) { closeEarly('not-a-prefix'); return; }
      const remainder = result.text.slice(released.length);
      if (remainder) queueOutput(encode(textDelta(remainder)));
      queueOutput(encode(blockStop()));
      queueOutput(encode({ type: 'message_stop' }));
      return;
    }
    if (result.ok && result.text === wireText && lifecycle.complete && lifecycle.textOnly) {
      for (const event of frames) if (event.type !== 'message_stop') queueOutput(encode(event));
    } else {
      queueOutput(encode(startEvent()));
      queueOutput(encode(blockStart()));
      if (result.text) queueOutput(encode(textDelta(result.text)));
      queueOutput(encode(blockStop()));
    }
    queueOutput(encode({ type: 'message_stop' }));
  };

  const replay = (callback) => {
    let index = 0;
    let settled = false;
    let endingTarget = false;
    let waitingDrain = false;
    let callbackCalled = false;
    replaying = true;
    const finishCallback = (error) => {
      if (callbackCalled) return;
      callbackCalled = true;
      callback?.(error);
    };
    const pump = () => {
      if (settled || endingTarget) return;
      waitingDrain = false;
      while (index < output.length) {
        let accepted;
        try { accepted = writeTarget(output[index++]); } catch (error) {
          settled = true;
          cleanup();
          finishCallback(error);
          return;
        }
        if (settled || aborted) return;
        if (accepted === false) {
          waitingDrain = true;
          target.once?.('drain', pump);
          return;
        }
      }
      if (aborted) { cancelReplay?.(failed || 'aborted'); return; }
      endingTarget = true;
      try {
        target.end(() => {
          if (settled) return;
          settled = true;
          cleanup();
          finishCallback();
        });
      } catch (error) {
        settled = true;
        cleanup();
        finishCallback(error);
      }
    };
    const cleanup = () => {
      replaying = false;
      cancelReplay = null;
      if (waitingDrain) target.removeListener?.('drain', pump);
      detachTerminalListeners();
    };
    cancelReplay = (reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      finishCallback(new Error(reason));
    };
    pump();
  };

  const facade = {
    status(code) { target.status(code); return facade; },
    setHeader(name, value) { target.setHeader(name, value); return facade; },
    flushHeaders() { return target.flushHeaders?.(); },
    get headersSent() { return target.headersSent; },
    armEarlyRelease(approve) {
      // The route is chosen after the facade is created.  Arming is allowed only before the first
      // data event, so a non-streaming exit cannot be converted halfway through its lifecycle.
      if (typeof approve !== 'function' || frames.length || pending.length || earlyOpen
        || stopped || ended || failed || aborted) return false;
      earlyRelease = approve;
      earlyEligible = true;
      return true;
    },
    write(chunk, encoding, callback) {
      if (typeof encoding === 'function') { callback = encoding; encoding = undefined; }
      if (ended || aborted) { callback?.(new Error(ended ? 'write after end' : (failed || 'aborted'))); return false; }
      consume(chunk);
      callback?.(failed ? new Error(failed) : undefined);
      return !failed;
    },
    end(chunk, encoding, callback) {
      if (typeof chunk === 'function') { callback = chunk; chunk = undefined; encoding = undefined; }
      else if (typeof encoding === 'function') { callback = encoding; encoding = undefined; }
      if (ended) { callback?.(); return facade; }
      if (aborted) {
        target[FINALIZATION_COMPLETE] = true;
        ended = true;
        detachTerminalListeners();
        callback?.(new Error(failed || 'aborted'));
        return facade;
      }
      if (chunk != null && chunk !== '') consume(chunk);
      flush();
      target[FINALIZATION_COMPLETE] = true;
      ended = true;
      replay(callback);
      return facade;
    },
    on(name, listener) { target.on?.(name, listener); return facade; },
    once(name, listener) { target.once?.(name, listener); return facade; },
    removeListener(name, listener) { target.removeListener?.(name, listener); return facade; },
  };
  return facade;
}
