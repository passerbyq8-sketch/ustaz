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
import { lastUserText, lastUserIndex, translateQuestionInPlace, TRANSLATION_FAILED_TEXT, translationNotice } from './question.js';
import { translateAnswer, createSpeculator, renderEarlyParagraph, splitAnswer } from './answer.js';
import { fixedRendition } from './fixed.js';
import { MISSING_DATA } from './published.js';
import { languageEnabled, isProductionEnv } from './enabled.js';
import { callLog } from './model.js';
import { graveHazard } from '../policy/core.js';
import { foreignHazard, canonicalArabic } from './hazard.js';
import { classifyPornographyRequest, classifyYoungPornographyDoubt } from '../policy/porn-request.js';
import { addresseeFor, translatorAddressLine } from '../sync/memory.js';

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
  write(c) { if (this.writableEnded) return false; this.headersSent = true; const b = Buffer.isBuffer(c) ? c : Buffer.from(String(c), 'utf8'); this.chunks.push(b); if (this.onChunk) { try { this.onChunk(b); } catch { /* an observer never breaks the capture */ } } this.emit('first'); return true; }
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
// ITEM r2-2 -- 2026-10-17 brain-line R2: THE EARLY PARAGRAPH IS NOT PRINTED TWICE. MEASURED on the preview (F1 «What are the
// pillars of Islam?», G2): the opening paragraph twice in a row. Rebuilt in the O3b harness, the shown prefix was the final
// Arabic's byte for byte on every BW2-like stream; the opening came out twice when the Arabic itself carried it twice (both
// copies take the speculator's one translation). So, whatever the cause: (1) the shown prefix is matched NORMALIZED -- white
// space, tatweel, tashkeel and [[n]] markers do not count -- and returns where the rest of the final Arabic begins (-1: not a
// prefix); (2) createOnceEmitter, the reader's text writer: once strict (the prefix was not found), a paragraph equal after
// normalization to one shown early does not go out again; and (3) always, a paragraph equal to the one just before it does not.
const EARLY_IGNORABLE = /[\sـً-ْٰ]/u;
const EARLY_MARK = /^\[\[[^\][]{1,12}\]\]/u;
export function matchEarlyPrefix(full, prefix) {
  const F = String(full || ''); const P = String(prefix || '');
  const skip = (s, k) => { for (;;) { if (k < s.length && EARLY_IGNORABLE.test(s[k])) { k += 1; continue; } const m = EARLY_MARK.exec(s.slice(k, k + 16)); if (m) { k += m[0].length; continue; } return k; } };
  let i = 0; let j = 0;
  for (;;) {
    j = skip(P, j);
    if (j >= P.length) return i;
    i = skip(F, i);
    if (i >= F.length || F[i] !== P[j]) return -1;
    i += 1; j += 1;
  }
}
const paragraphKey = (s) => String(s).replace(/\[\[[^\][]{1,12}\]\]/gu, '').replace(/[\sـً-ْٰ]/gu, '').toLowerCase();
const ONCE_MIN_KEY = 12;
export function createOnceEmitter(write) {
  const shown = new Set(); let last = ''; let strict = false;
  return {
    write(s) {
      if (!s) return;
      const k = paragraphKey(s);
      const tag = /^\s*</u.test(s);
      if (k.length >= ONCE_MIN_KEY && !tag && (k === last || (strict && shown.has(k)))) return;
      if (k) last = k;
      write(s);
    },
    markShown(s) { const k = paragraphKey(s); if (k.length >= ONCE_MIN_KEY) shown.add(k); },
    strict() { strict = true; },
  };
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
    // E1: on production a language that is not in config/enabled-languages.json is not in the language layer at all, as a key language or as the
    // language of the question: both take today's road, the one origin/main has (the inner handler with the very same req and res)
    if (!languageEnabled(declared)) return { lang: 'ar', translate: false, reason: 'not_enabled' };
    const text = lastUserText(body.messages);
    const lang = detectQuestionLang(text, keyLangOf(declared));
    if (!languageEnabled(lang)) return { lang: 'ar', translate: false, reason: 'not_enabled' };
    const row = langRow(lang);
    // the deterministic early guards already read these words in this language (porn request, grave hazard): the
    // existing guard decides, on the reader's own text, with no model call -- translating first would only add one
    if (lang !== 'ar' && (classifyPornographyRequest(text).blocked || classifyYoungPornographyDoubt(text) || graveHazard(text))) return { lang, translate: true, early: true, reason: 'early_guard', text };
    // C1: the same two refusals for a request whose words the Arabic guards cannot read: this language's own lexicon decides (no model), and the guards then read a short
    // canonical Arabic sentence of the same request, so the fixed Arabic text they answer with is rendered in the reader's language by the lookup (measured: the translator
    // model sometimes refuses to translate such a request, and the turn then ended in the closed failure sentence instead of the fixed refusal Arabic gets)
    if (lang !== 'ar' && row && row.answerTranslation) { const fh = foreignHazard(text, lang); if (fh) return { lang, translate: true, early: true, reason: 'foreign_hazard', text, substitute: canonicalArabic(fh) }; }
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
  // a non-production request may ask for the timing of its own translator calls, written at the end of the stream as an SSE comment (no reader sees it)
  const calls = headerOf(req, 'x-ezik-lang-debug') === '1' && !isProductionEnv() ? [] : null;
  return calls ? callLog.run(calls, () => translatingGate(req, res, inner, deps, decision, calls)) : translatingGate(req, res, inner, deps, decision, null);
}

async function translatingGate(req, res, inner, deps, decision, calls) {
  const { lang } = decision;
  // ITEM 58: the translator keeps the address the brain used (behind SYNC_SWITCH; '' for everybody else).
  let addressLine = '';
  try { const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; addressLine = translatorAddressLine(await addresseeFor(req, b)); } catch { addressLine = ''; }
  if (decision.substitute) { try { const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; const i = lastUserIndex(b.messages); b.messages[i].content = decision.substitute; if (typeof req.body === 'string') req.body = JSON.stringify(b); } catch { /* the guards then read the reader's own text, as before */ } }
  const now = deps.now || Date.now; const log = deps.log || ((...a) => console.log(...a));
  const tAnswer = deps.translateAnswerImpl || translateAnswer;
  const tQuestion = deps.translateQuestionImpl || translateQuestionInPlace;
  const started = now();
  const cap = new CaptureRes();
  const info = { lang, questionMs: null, questionOk: null, innerMs: null, arFirstMs: null, arLastMs: null, specStarted: 0, specFail: [], firstTextMs: null, totalMs: null };
  let gone = false;
  res.on && res.on('close', () => { gone = true; cap.emit('close'); });
  // the one seat inside the inner handler where the question is translated
  if (!decision.early) req.__langTranslateQuestion = async (messages) => {   // an early-guard question goes to the guards as the reader wrote it
    const r = await tQuestion(messages, { lang });
    info.questionMs = r.ms; info.questionOk = r.ok; info.questionWhy = Array.isArray(r.why) ? r.why.join(',') : '';
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
    if (sseMode) { res.flushHeaders && res.flushHeaders(); /* ITEM O3b (132) -- 2026-10-15 brain-line: the first frame */ try { res.write(frame({ type: 'ezik_status', stage: 'translate' })); for (const e of early.pending.splice(0)) res.write(frame(e)); } catch { /* closed */ } keepalive = setInterval(() => { if (!gone) { try { res.write(': keepalive\n\n'); } catch { /* closed */ } } }, KEEPALIVE_MS); }
  };
  // THE PARALLEL TRANSLATION: the Arabic paragraphs that arrive in the capture while the brain is still writing start to be translated
  // at once. They are only PREPARED here -- nothing is shown before the inner handler has finished and the Arabic is final, and a
  // paragraph is used only when the final Arabic paragraph is the same string (translateAnswer's `spec`).
  const mkSpeculator = deps.createSpeculatorImpl || createSpeculator;
  const speculator = (!decision.early && (!deps.translateAnswerImpl || deps.speculate === true)) ? mkSpeculator({ lang, translate: deps.translateImpl, addressLine }) : null;
  // ITEM O3b (132) -- 2026-10-15 brain-line: THE READER SEES SOMETHING BEFORE THE END.
  //  (1) the first frame, as soon as the inner handler commits its stream, is ezik_status `translate`; the inner handler's
  //      own status frames pass at once, not last;
  //  (2) the leading Arabic paragraphs closed in the stream are shown as soon as their speculated translation is ready
  //      (renderEarlyParagraph: plain prose only), in order; the first one that is not ready-and-plain ends this, and the
  //      rest is translated at the end as before. What the capture carries is the sealed writer's released text, which
  //      it never takes back, so a closed paragraph there IS the final paragraph; the end still checks it byte for byte.
  const early = { arabic: '', shownAr: '', count: 0, done: false, notesSeen: new Set(), printed: new Set(), pending: [] };
  // The reader's text writer, for the paragraphs shown early and for the end alike (it was defined at the end before O3b).
  let first = true; let emitted = '';
  // ITEM r2-2 -- 2026-10-17 brain-line R2: through the once-emitter (a paragraph equal to the one before it, or -- strict -- to one shown early, stays out).
  const once = createOnceEmitter((s) => { if (first) { first = false; info.firstTextMs = now() - started; } emitted += s; res.write(textFrame(s)); });
  const emit = (s) => { if (gone || !s) return; once.write(s); };
  const emitText = emit;
  const statusOut = (e) => { if (gone) return; if (committed && sseMode) res.write(frame(e)); else early.pending.push(e); };
  const pump = () => {
    if (early.done || !speculator || !emitText || !committed || !sseMode || info.questionOk === false) return;
    const pieces = splitAnswer(early.arabic);
    if (!pieces.length || pieces[0].type !== 'text') { if (pieces.length) early.done = true; return; }
    const head = /(^|\n)## نص الفتوى/.exec(pieces[0].s);   // a scholar's published block is translated whole, at the end
    const lead = head ? pieces[0].s.slice(0, head.index) : pieces[0].s;
    const parts = lead.split(/(\n\s*\n)/);
    // the paragraphs of the leading piece that are closed: everything before its last part, unless a tag follows it
    const closedCount = (pieces.length > 1 || head) ? parts.length : parts.length - 1;
    let offset = 0; const spans = [];
    for (let i = 0; i < parts.length; i += 1) { spans.push({ s: parts[i], at: offset, i }); offset += parts[i].length; }
    while (!early.done) {
      const k = early.count * 2;                   // paragraph k, separators between
      if (k >= closedCount) return;
      const para = spans[k].s;
      const entry = speculator.take(para.trim());
      // not speculated (too short, holds a tag, over the cap): it and everything after it wait for the end
      if (!entry) { early.done = true; return; }
      if (entry.out == null) {
        // still being translated: come back when it settles; settled without a translation: the end translates it
        if (entry.__o3bSettled) { early.done = true; return; }
        if (!entry.__o3bWatched) { entry.__o3bWatched = true; Promise.resolve(entry.promise).then(() => { entry.__o3bSettled = true; pump(); }, () => { entry.__o3bSettled = true; pump(); }); }
        return;
      }
      const shown = renderEarlyParagraph(entry, { lang, notesSeen: early.notesSeen, printed: early.printed });
      if (shown == null || !shown.trim()) { early.done = true; return; }
      const sep = k > 0 ? spans[k - 1].s : '';
      emitText((early.count ? sep : '') + para.match(/^\s*/)[0] + shown + para.match(/\s*$/)[0]);
      once.markShown(shown);
      early.shownAr = lead.slice(0, spans[k].at + para.length);
      early.count += 1;
    }
  };
  {
    const dec = new TextDecoder(); let sseBuf = '';
    cap.onChunk = (b) => {
      sseBuf += dec.decode(b, { stream: true });
      const blocks = sseBuf.split('\n\n'); sseBuf = blocks.pop();
      for (const blk of blocks) for (const line of blk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        let e = null; try { e = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (e && e.type === 'ezik_status') { statusOut(e); continue; }
        if (speculator && e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta' && e.delta.text) {
          const at = now() - started; if (info.arFirstMs === null) info.arFirstMs = at; info.arLastMs = at;
          speculator.feed(e.delta.text);
          early.arabic += e.delta.text;
          pump();
        }
      }
    };
  }
  cap.once('first', commit);
  try { await inner(req, cap); } catch (e) { log('[lang] inner threw', { lang, name: e && e.name }); if (!cap.writableEnded) cap.end(); }
  info.innerMs = now() - started;
  if (!committed) commit();
  if (keepalive) clearInterval(keepalive);
  const body = cap.body;
  if (!sseMode) { res.end(body); return; }                                // errors, 4xx/5xx JSON: forwarded as they are
  const events = parseSse(body);
  // POSTSHIP ITEM 7 -- 2026-10-24: a replace frame (a refusal after streamed prose) makes its text the whole answer.
  const replaced = events.filter((e) => e && e.type === 'ezik_replace' && typeof e.text === 'string').pop() || null;
  const arabic = replaced ? replaced.text : events.filter((e) => e && e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta').map((e) => e.delta.text).join('');
  // ITEM O3b (132): the inner handler's status frames already went out as they came (statusOut); the other extras still go last.
  const extras = events.filter((e) => e && typeof e.type === 'string' && /^ezik_/.test(e.type) && e.type !== 'ezik_status' && e.type !== 'ezik_replace');
  let result = null;
  // ITEM O3b (132): what was shown early is a prefix of the final Arabic (checked here byte for byte); the end translates the rest,
  // seeded with the notes and keys those paragraphs printed. A prefix that is not the final text's (it cannot be: the capture holds
  // released text) is logged and the whole is translated after it, so nothing is lost.
  let rest = arabic; let seed = null; const earlyChars = emitted.length;
  if (early.count) {
    // ITEM r2-2 -- 2026-10-17 brain-line R2: matched normalized (matchEarlyPrefix); not found, the whole goes, strict.
    const at = matchEarlyPrefix(arabic, early.shownAr);
    if (at >= 0) { rest = arabic.slice(at); seed = { notesSeen: early.notesSeen, printed: early.printed }; }
    else { once.strict(); log('[lang] early prefix differs from the final Arabic', { lang, shown: early.count }); }
  }
  const fixed = early.count ? null : fixedRendition(lang, arabic);
  // L (amendment 11): when the QUESTION could not be translated, what the inner handler wrote is the reader's own failure sentence (already in the reader's language).
  // It is delivered as it stands: run through the answer translation it was "kept in Arabic" and the line "the translation could not be completed" stood above an error sentence with no Arabic under it.
  // POSTSHIP ITEM 7 -- 2026-10-24: paragraphs were already shown in the reader's language and the answer was then replaced (a
  // refusal after streamed prose): the replacement is translated whole and sent as a replace frame, so nothing shown stays.
  if (replaced && early.count) {
    let out = '';
    try { const r = await tAnswer(arabic, { lang, emit: (piece) => { out += piece; }, spec: null, addressLine }); if (r && typeof r.text === 'string' && r.text) out = r.text; } catch { /* the Arabic below */ }
    if (!out) out = arabic;
    if (!gone) res.write(frame({ type: 'ezik_replace', text: out }));
    result = { text: out, stats: { replaced: true }, degraded: [] };
  } else if (info.questionOk === false) { emit(arabic); result = { text: arabic, stats: { questionFailed: true }, degraded: ['lang:question_failed'] }; }
  else if (fixed) { emit(fixed); result = { text: fixed, stats: { fixed: true }, degraded: [] }; }
  else if (early.count && !/\S/.test(rest)) { emit(rest); result = { text: emitted, stats: { early: early.count }, degraded: [] }; }
  else try { result = await tAnswer(rest, { lang, emit, spec: speculator, addressLine, ...(seed ? { seed } : {}) }); if (result && early.count) result.stats = { ...(result.stats || {}), early: early.count }; }
  catch (e) { log('[lang] answer translation threw', { lang, name: e && e.name }); }
  // a failed translation never loses the answer: the Arabic it was (what was not already shown), after one line in the reader's language
  if (!result && !gone && emitted.length === earlyChars) emit((earlyChars ? '\n\n' : '') + translationNotice(lang) + '\n\n' + (earlyChars ? rest.replace(/^\s+/, '') : arabic));
  for (const x of extras) if (!gone) res.write(frame(x));
  if (!gone) res.write(frame({ type: 'message_stop' }));
  info.totalMs = now() - started; info.specStarted = speculator ? speculator.started : 0; info.specFail = speculator && typeof speculator.failures === 'function' ? speculator.failures().slice(0, 6) : [];
  const degradedAll = (result ? result.degraded : ['lang:answer_translation_threw']).concat([...MISSING_DATA].map((n) => 'lang:data_missing:' + n));
  if (calls && !gone) { try { res.write(': lang-calls ' + JSON.stringify({ info, calls }) + '\n\n'); } catch { /* closed */ } }
  log('[lang]', { ...info, answerChars: arabic.length, outChars: emitted.length, stats: result && result.stats, degraded: degradedAll });
  res.end();
}
