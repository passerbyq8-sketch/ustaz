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
      || events[events.length - 1] !== stops[0]) return { valid: false, complete: false };
    const expanded = [startEvent(), blockStart(), ...deltas, blockStop(), stops[0]];
    const verdict = lifecycleVerdict(expanded);
    return { valid: verdict.valid, complete: false };
  }
  let messageStarted = false;
  let messageStopped = false;
  const open = new Set();
  const used = new Set();
  for (const event of events) {
    if (!event || messageStopped) return { valid: false, complete: true };
    if (event.type === 'message_start') {
      if (messageStarted || open.size || used.size || !event.message || event.message.role !== 'assistant') return { valid: false, complete: true };
      messageStarted = true;
    } else if (event.type === 'content_block_start') {
      if (!messageStarted || !Number.isInteger(event.index) || !event.content_block || event.content_block.type !== 'text'
        || open.has(event.index) || used.has(event.index)) return { valid: false, complete: true };
      open.add(event.index); used.add(event.index);
    } else if (event.type === 'content_block_delta') {
      if (!messageStarted || !open.has(event.index) || !event.delta || event.delta.type !== 'text_delta' || typeof event.delta.text !== 'string') return { valid: false, complete: true };
    } else if (event.type === 'content_block_stop') {
      if (!messageStarted || !open.has(event.index)) return { valid: false, complete: true };
      open.delete(event.index);
    } else if (event.type === 'message_stop') {
      if (!messageStarted || open.size) return { valid: false, complete: true };
      messageStopped = true;
    } else return { valid: false, complete: true };
  }
  return { valid: messageStarted && messageStopped && open.size === 0, complete: true };
}

/**
 * A narrow ServerResponse facade. Text deltas are held until the complete answer passes finalize.
 * SSE comments pass through; data frames are replayed in their original order at finalization.
 */
export function createFinalizedSseResponse(target, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const frames = [];
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

  const onAbort = () => { aborted = true; failed = failed || 'aborted'; cancelReplay?.('aborted'); };
  options.signal?.addEventListener?.('abort', onAbort, { once: true });
  const onDisconnect = () => {
    cancelReplay?.('client-disconnect');
    if (!ended) { aborted = true; failed = failed || 'client-disconnect'; }
  };
  target.once?.('close', onDisconnect);

  const writeTarget = (chunk, encoding, callback) => target.write(chunk, encoding, callback);
  const queueOutput = (chunk) => { output.push(chunk); };
  const fail = (reason) => { failed = failed || reason; };
  const writeFailure = () => {
    queueOutput(encode(startEvent()));
    queueOutput(encode(blockStart()));
    queueOutput(encode(textDelta(String(options.failureText || 'server output rejected'))));
    queueOutput(encode(blockStop()));
    queueOutput(encode({ type: 'message_stop' }));
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

  const flush = () => {
    if (ended) return;
    if (pending.length) fail('incomplete-frame');
    if (!stopped) fail('missing-stop');
    const lifecycle = lifecycleVerdict(frames);
    if (!lifecycle.valid) fail('invalid-lifecycle');

    if (failed || aborted) {
      writeFailure();
      return;
    }

    const wireText = frames
      .filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta')
      .map((e) => String(e.delta.text || '')).join('');
    let result;
    try {
      const context = typeof options.context === 'function' ? options.context() : (options.context || {});
      target[FINALIZATION_CONTEXT] = context;
      const separated = separateOwnedCardSuffix(wireText, context.sourceCards);
      result = options.finalize({ ...context, text: separated.prose, cards: context.sourceCards || [] });
      if (result && result.ok && separated.suffix) result = { ...result, text: result.text + separated.suffix };
    } catch {
      writeFailure();
      return;
    }
    if (!result || typeof result !== 'object' || typeof result.text !== 'string' || typeof result.ok !== 'boolean') {
      writeFailure(); return;
    }

    if (result.ok && result.text === wireText && lifecycle.complete) {
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
    let waitingDrain = false;
    replaying = true;
    const pump = () => {
      if (settled) return;
      waitingDrain = false;
      while (index < output.length) {
        if (writeTarget(output[index++]) === false) {
          waitingDrain = true;
          target.once?.('drain', pump);
          return;
        }
      }
      settled = true;
      cleanup();
      target.end(callback);
    };
    const cleanup = () => {
      replaying = false;
      cancelReplay = null;
      if (waitingDrain) target.removeListener?.('drain', pump);
      options.signal?.removeEventListener?.('abort', onAbort);
      target.removeListener?.('close', onDisconnect);
    };
    cancelReplay = (reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback?.(new Error(reason));
    };
    pump();
  };

  const facade = {
    status(code) { target.status(code); return facade; },
    setHeader(name, value) { target.setHeader(name, value); return facade; },
    flushHeaders() { return target.flushHeaders?.(); },
    get headersSent() { return target.headersSent; },
    write(chunk, encoding, callback) {
      if (typeof encoding === 'function') { callback = encoding; encoding = undefined; }
      if (ended) { callback?.(new Error('write after end')); return false; }
      consume(chunk);
      callback?.(failed ? new Error(failed) : undefined);
      return !failed;
    },
    end(chunk, encoding, callback) {
      if (typeof chunk === 'function') { callback = chunk; chunk = undefined; encoding = undefined; }
      else if (typeof encoding === 'function') { callback = encoding; encoding = undefined; }
      if (ended) { callback?.(); return facade; }
      if (chunk != null && chunk !== '') consume(chunk);
      flush();
      target[FINALIZATION_COMPLETE] = true;
      ended = true;
      replay(callback);
      return facade;
    },
    on(name, listener) { target.on?.(name, listener); return facade; },
    once(name, listener) { target.once?.(name, listener); return facade; },
  };
  return facade;
}
