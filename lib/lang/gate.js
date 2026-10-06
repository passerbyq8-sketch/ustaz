// lib/lang/gate.js -- THE LANGUAGE GATE AROUND /api/ask (item 74).
//
//   request -> detector (ONE function, lib/lang/detect.js) -> one of two roads:
//     * the question is Arabic (or ambiguous with an Arabic key language): the inner handler is called with the
//       very same req and res. Nothing else happens. This is today's road, byte for byte (ruling h9).
//     * the question is in a language of the table that needs translation: the question is translated to Arabic
//       INSIDE the inner handler at the one seat where it is safe (after consent, throttle and the daily cap, and
//       before the classifier), the inner handler runs unchanged against a capture of the response, and the
//       finished Arabic answer -- after every reviewer and filter -- is translated into the question's language
//       and streamed out paragraph by paragraph as each one settles (h4, h8).
import { EventEmitter } from 'node:events';
import { detectQuestionLang } from './detect.js';
import { keyLangOf, langRow, isKnownLang } from './table.js';
import { lastUserText, translateQuestionInPlace, TRANSLATION_FAILED_TEXT } from './question.js';
import { translateAnswer } from './answer.js';
import { fixedRendition } from './fixed.js';
import { MISSING_DATA } from './published.js';
import { graveHazard } from '../policy/core.js';
import { classifyPornographyRequest, classifyYoungPornographyDoubt } from '../policy/porn-request.js';

const KEEPALIVE_MS = 8000;

/** A response object that records instead of sending. Implements exactly what api/ask.js and its helpers call. */
export class CaptureRes extends EventEmitter {
  constructor() { super(); this.statusCode = 200; this.headers = new Map(); this.chunks = []; this.headersSent = false; this.writableEnded = false; this.finished = false; this.writable = true; }
  status(c) { this.statusCode = c; return this; }
  setHeader(k, v) { this.headers.set(String(k).toLowerCase(), [k, v]); return this; }
  getHeader(k) { const e = this.headers.get(String(k).toLowerCase()); return e ? e[1] : undefined; }
  removeHeader(k) { this.headers.delete(String(k).toLowerCase()); }
  flushHeaders() { this.headersSent = true; this.emit('first'); }
  writeHead(code, h) { this.statusCode = code; if (h && typeof h === 'object') for (const k of Object.keys(h)) this.setHeader(k, h[k]); this.headersSent = true; this.emit('first'); return this; }
  write(c) { if (this.writableEnded) return false; this.headersSent = true; this.chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c), 'utf8')); this.emit('first'); return true; }
  json(o) { this.setHeader('Content-Type', 'application/json; charset=utf-8'); return this.end(JSON.stringify(o)); }
  send(c) { return this.end(c); }
  end(c) { if (this.writableEnded) return this; if (c != null && c !== '') this.write(c); this.writableEnded = true; this.finished = true; this.headersSent = true; this.emit('first'); this.emit('finish'); this.emit('close'); return this; }
  get body() { return Buffer.concat(this.chunks).toString('utf8'); }
}

/** Parse an SSE body into events (JSON objects after `data:`) in order. */
export function parseSse(body) {
  const events = [];
  for (const block of String(body).split(/\n\n+/)) {
    let data = '';
    for (const l of block.split('\n')) if (l.startsWith('data:')) data += l.slice(5).trim();
    if (!data) continue;
    try { events.push(JSON.parse(data)); } catch { /* not ours */ }
  }
  return events;
}
const frame = (o) => `data: ${JSON.stringify(o)}\n\n`;
const textFrame = (t) => frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });

function writeSynth(res, text) {
  res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders && res.flushHeaders();
  res.write(textFrame(text)); res.write(frame({ type: 'message_stop' })); res.end();
}

function headerOf(req, name) { const h = req && req.headers; if (!h) return undefined; const v = h[name]; return Array.isArray(v) ? v[0] : v; }

/** What the detector decides for this request: {lang, translate:boolean, text}. Never throws; never mutates req. */
export function decideLanguage(req) {
  try {
    if (!req || req.method !== 'POST') return { lang: 'ar', translate: false };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.messages) || !body.messages.length) return { lang: 'ar', translate: false };
    // voice (mode 'call') stays Arabic-only until the voice session; item 74 phase 4 is deferred
    if (body.mode === 'call') return { lang: 'ar', translate: false, reason: 'voice' };
    // A request that does not declare its interface language (the x-ezik-lang header) is not in the language layer at all: it
    // takes today's road. The client declares it on every request.
    const declared = headerOf(req, 'x-ezik-lang');
    if (!isKnownLang(declared)) return { lang: 'ar', translate: false, reason: 'no_key_language' };
    const text = lastUserText(body.messages);
    const lang = detectQuestionLang(text, keyLangOf(declared));
    const row = langRow(lang);
    // the deterministic early guards already read these words in this language (porn request, grave hazard): the
    // existing guard decides, on the reader's own text, with no model call -- translating first would only add one
    if (lang !== 'ar' && (classifyPornographyRequest(text).blocked || classifyYoungPornographyDoubt(text) || graveHazard(text))) return { lang, translate: true, early: true, reason: 'early_guard', text };
    return { lang, translate: !!(row && row.answerTranslation), text };
  } catch { return { lang: 'ar', translate: false }; }
}

/**
 * @param {Function} inner the unchanged /api/ask handler
 * @param {{translateAnswerImpl?:Function, translateQuestionImpl?:Function, log?:Function, now?:()=>number}} [deps]
 */
export async function languageGate(req, res, inner, deps = {}) {
  const decision = decideLanguage(req);
  if (!decision.translate) return inner(req, res);                       // h9: Arabic is today's road, untouched
  const { lang } = decision;
  const now = deps.now || Date.now; const log = deps.log || ((...a) => console.log(...a));
  const tAnswer = deps.translateAnswerImpl || translateAnswer;
  const tQuestion = deps.translateQuestionImpl || translateQuestionInPlace;
  const started = now();
  const cap = new CaptureRes();
  const info = { lang, questionMs: null, questionOk: null, innerMs: null, firstTextMs: null, totalMs: null };
  let gone = false;
  res.on && res.on('close', () => { gone = true; cap.emit('close'); });
  // the one seat inside the inner handler where the question is translated
  if (!decision.early) req.__langTranslateQuestion = async (messages) => {   // an early-guard question goes to the guards as the reader wrote it
    const r = await tQuestion(messages, { lang });
    info.questionMs = r.ms; info.questionOk = r.ok;
    if (!r.ok) { writeSynth(cap, TRANSLATION_FAILED_TEXT[lang] || TRANSLATION_FAILED_TEXT.en); return false; }
    return true;
  };
  // commit the real response's headers as soon as the inner handler starts answering, then keep the line warm
  let committed = false; let keepalive = null; let sseMode = false;
  const commit = () => {
    if (committed) return; committed = true;
    const ct = String(cap.getHeader('Content-Type') || '');
    sseMode = cap.statusCode === 200 && /text\/event-stream/i.test(ct);
    for (const [, [k, v]] of cap.headers) { if (/^content-length$/i.test(k)) continue; try { res.setHeader(k, v); } catch { /* ignore */ } }
    res.status(cap.statusCode);
    if (sseMode) { res.flushHeaders && res.flushHeaders(); keepalive = setInterval(() => { if (!gone) { try { res.write(': keepalive\n\n'); } catch { /* closed */ } } }, KEEPALIVE_MS); }
  };
  cap.once('first', commit);
  try { await inner(req, cap); } catch (e) { log('[lang] inner threw', { lang, name: e && e.name }); if (!cap.writableEnded) cap.end(); }
  info.innerMs = now() - started;
  if (!committed) commit();
  if (keepalive) clearInterval(keepalive);
  const body = cap.body;
  if (!sseMode) { res.end(body); return; }                                // errors, 4xx/5xx JSON: forwarded as they are
  const events = parseSse(body);
  const arabic = events.filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta').map((e) => e.delta.text).join('');
  const extras = events.filter((e) => e && typeof e.type === 'string' && /^ezik_/.test(e.type));
  let first = true; let emitted = '';
  const emit = (s) => { if (gone || !s) return; if (first) { first = false; info.firstTextMs = now() - started; } emitted += s; res.write(textFrame(s)); };
  let result = null;
  const fixed = fixedRendition(lang, arabic);
  if (fixed) { emit(fixed); result = { text: fixed, stats: { fixed: true }, degraded: [] }; }
  else try { result = await tAnswer(arabic, { lang, emit }); }
  catch (e) { log('[lang] answer translation threw', { lang, name: e && e.name }); }
  if (!result && !gone && !emitted) emit(arabic);                          // a failed translation never loses the answer: the Arabic it was
  for (const x of extras) if (!gone) res.write(frame(x));
  if (!gone) res.write(frame({ type: 'message_stop' }));
  info.totalMs = now() - started;
  const degradedAll = (result ? result.degraded : ['lang:answer_translation_threw']).concat([...MISSING_DATA].map((n) => 'lang:data_missing:' + n));
  log('[lang]', { ...info, answerChars: arabic.length, outChars: emitted.length, stats: result && result.stats, degraded: degradedAll });
  res.end();
}
