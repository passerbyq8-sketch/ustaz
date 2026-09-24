// lib/lib-nav.js — PROGRAM ORDER 2026-09-24, م٤ (LIB_NAV_V1): a book's page by its number, and what
// follows it, from the library's navigation routes.
//
// THE OWNER'S ITEM (م٤-أ): «الصفحةُ برقمِها: التراثُ والفتاوى الصفحةُ كاملة (ذرّاتُها كلُّها بترتيبِها) ·
// المعاصرُ فقرةٌ منها بالعزو · المرقَّمُ آليًّا يُقالُ إنّه بلا صفحاتِ طبعةٍ ويُعرَضُ الباب · الممنوعُ يُردّ ·
// والأرقامُ العربيّةُ والهنديّةُ سواء». And his decision of the same day: the service returns every
// complete atom overlapping the page, so a quoted page may start before or end after it. That is kept,
// and the card shows the REAL range from the first and last atoms, never «the requested page».
//
// MEASURED (program-2026-09-24/04-quote/measure/A-page.md): today «انقل لي نص الصفحة ١٤٠ من الجزء الأول من
// كتاب بداية المجتهد لابن رشد» is answered «لا أستطيع أن أنقل لك صفحة بعينها برقمها…», because the
// search door had no page route and the detector threw the page and the volume away. The navigation
// contract (Codex, 2026-09-24) adds POST /page, /next and /toc, on the PREVIEW instance only.
//
// WHAT THIS MODULE IS. Pure apart from the one door below: it reads no environment. The switch, the
// token and the base URL are read in api/ask.js and handed down. Nothing a reader is shown is folded,
// and no reply names the machinery («المكتبة»، «الفهرس»، «الشاملة» …).
//
// THE SECOND DOOR, NAMED. lib/lib-service.js `searchLibrary` is the one door to /search (gate libbook
// A7). This file is the one door to /page, /next and /toc: `navCall`, on an allow-listed origin, with
// the same refusals searchLibrary makes (flag, token, POST JSON, no redirect, origin before and
// after, JSON type, size, timeout) — and unlike it, it READS an error body, because the contract's
// meaning (numbering_auto, volume_required, page_not_found …) lives there. It mints no `lib:` ids.
import {
  foldArabic, normalizeTitle, resolveBook, catalogBook, echo, blockquote, modernParagraph,
  noBookReply, askWhichReply, blockedReply, unavailableReply, HEADING_MAX, ASK_LIST_MAX,
} from './lib-quote.js';

const BOOK_MARK = '\u{1F4D6}';
const SEP = ' · ';

// ── THE DOOR ────────────────────────────────────────────────────────────────────
/** The only two origins a navigation call may reach. The switch chooses; nothing else can. */
export const LIB_NAV_ORIGINS = Object.freeze(['https://lib.ezik.app', 'https://lib-preview.ezik.app']);
export const LIB_NAV_PATHS = Object.freeze({ page: '/page', next: '/next', toc: '/toc' });
/** One call, and the whole turn: under the ~30 s a mobile carrier gives an idle socket (api/ask.js). */
export const LIB_NAV_CALL_MS = 9000;
export const LIB_NAV_TURN_MS = 20000;
export const LIB_NAV_MAX_JSON_BYTES = 4 * 1024 * 1024;

/** The allow-listed origin a base URL names, or null. An empty base means the live origin. */
export function navOrigin(baseUrl) {
  const raw = String(baseUrl == null ? '' : baseUrl).trim();
  if (!raw) return LIB_NAV_ORIGINS[0];
  try {
    const u = new URL(raw);
    return LIB_NAV_ORIGINS.includes(u.origin) && (u.pathname === '/' || u.pathname === '') && !u.search && !u.username
      ? u.origin : null;
  } catch { return null; }
}

function timeLeft(deadline) {
  return Number.isFinite(deadline) ? deadline - Date.now() : LIB_NAV_TURN_MS;
}

/**
 * POST one navigation route. Never throws.
 *   → { ok:true, status, payload } | { ok:false, status, code, message, retryAfter, reason }
 * opts: { flagValue, token, baseUrl, fetchImpl, signal, deadline }
 */
export async function navCall(route, body, opts = {}) {
  const fail = (reason, extra = {}) => ({ ok: false, status: 0, code: '', message: '', retryAfter: 0, reason, ...extra });
  if (opts.flagValue !== 'on') return fail('nav_flag_off');
  const token = opts.token;
  if (typeof token !== 'string' || !token) return fail('nav_token_missing');
  const path = LIB_NAV_PATHS[route];
  if (!path) return fail('nav_route_unknown');
  const origin = navOrigin(opts.baseUrl);
  if (!origin) return fail('nav_origin_refused');
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return fail('nav_no_fetch');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const left = timeLeft(opts.deadline);
    if (left < 500) return fail('nav_deadline');
    const url = new URL(path, origin);
    let response;
    try {
      const signals = [AbortSignal.timeout(Math.min(LIB_NAV_CALL_MS, left))];
      if (opts.signal) signals.push(opts.signal);
      response = await fetchImpl(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.any ? AbortSignal.any(signals) : signals[0],
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
    } catch { return fail('nav_unreachable'); }
    let payload = null;
    try {
      const final = new URL(response.url || url.href);
      if (final.origin !== origin) return fail('nav_redirect_refused');
      const type = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (!type.includes('application/json')) return fail('nav_content_type', { status: response.status });
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > LIB_NAV_MAX_JSON_BYTES) return fail('nav_body_too_large', { status: response.status });
      payload = JSON.parse(text);
    } catch { return fail('nav_invalid_json', { status: response && response.status }); }
    if (response.ok) {
      return payload && typeof payload === 'object' ? { ok: true, status: response.status, payload } : fail('nav_bad_contract');
    }
    const error = payload && payload.error && typeof payload.error === 'object' ? payload.error : {};
    const code = String(error.code || '');
    const retryAfter = Number(response.headers?.get?.('retry-after') || 0);
    // The shared queue was full: asked again once, after the second it names, if the turn has time.
    if (response.status === 503 && code === 'search_queue_full' && attempt === 0 && retryAfter <= 2
      && timeLeft(opts.deadline) > 1500 + retryAfter * 1000) {
      await new Promise((r) => setTimeout(r, Math.max(0, retryAfter) * 1000));
      continue;
    }
    return { ok: false, status: response.status, code, message: String(error.message || ''), retryAfter, reason: 'nav_http_' + response.status };
  }
  return fail('nav_queue_full');
}

// ── READING THE REQUEST ─────────────────────────────────────────────────────────
const ORDINAL_UNITS = [
  ['الاول', 'اول', 'الاولي', 'الحادي', 'حادي'], ['الثاني', 'ثاني'], ['الثالث', 'ثالث'], ['الرابع', 'رابع'],
  ['الخامس', 'خامس'], ['السادس', 'سادس'], ['السابع', 'سابع'], ['الثامن', 'ثامن'], ['التاسع', 'تاسع'],
];
const ORDINAL_TENS = { العشرون: 20, العشرين: 20, الثلاثون: 30, الثلاثين: 30, الاربعون: 40, الاربعين: 40,
  الخمسون: 50, الخمسين: 50, الستون: 60, الستين: 60, السبعون: 70, السبعين: 70, الثمانون: 80, الثمانين: 80,
  التسعون: 90, التسعين: 90 };
const unitOf = (w) => {
  const i = ORDINAL_UNITS.findIndex((forms) => forms.includes(w));
  return i === -1 ? 0 : i + 1;
};
/** An ordinal at words[i] (folded), as { value, length } or null: الأول … التاسع والتسعون. */
export function ordinalAt(words, i) {
  const w = words[i];
  if (w === undefined) return null;
  if (w === 'العاشر' || w === 'عاشر') return { value: 10, length: 1 };
  if (ORDINAL_TENS[w]) return { value: ORDINAL_TENS[w], length: 1 };
  const u = unitOf(w);
  if (!u) return null;
  if (words[i + 1] === 'عشر') return { value: 10 + u, length: 2 };
  const next = words[i + 1];
  if (next && next.startsWith('و') && ORDINAL_TENS[next.slice(1)]) return { value: ORDINAL_TENS[next.slice(1)] + u, length: 2 };
  return { value: u, length: 1 };
}

const PAGE_WORDS = new Set(['صفحه', 'الصفحه', 'ص', 'صفحات', 'الصفحات', 'صفحتين', 'الصفحتين']);
const VOLUME_WORDS = new Set(['الجزء', 'جزء', 'ج', 'المجلد', 'مجلد', 'مج']);
const NUMBER_WORDS = new Set(['الخمسين', 'المئه', 'الماءه', 'الالف', 'العشرين', 'الثلاثين', 'الاربعين', 'الستين',
  'السبعين', 'الثمانين', 'التسعين', 'المائه', 'المئتين', 'الخامسه', 'العاشره', 'الاولي', 'الثانيه', 'الثالثه']);
const REQUEST_WORDS = new Set(['نص', 'النص', 'بنص', 'انقل', 'انقلي', 'انسخ', 'اقتبس', 'اقرا', 'اكتب', 'هات',
  'اعطني', 'اعطيني', 'اعرض', 'اريد', 'ابي', 'ابغي', 'ارسل']);
const LEAD_WORDS = new Set([...REQUEST_WORDS, 'لي', 'لنا', 'من', 'في', 'ما', 'ماذا', 'رقم', 'فضلك', 'لو', 'سمحت']);
const TITLE_STOP = new Set(['ثم', 'لخصه', 'لخصها', 'ولخصه', 'اشرحه', 'اشرحها', 'واشرحه', 'وضحه', 'وضحها',
  'بحروفه', 'بنصه', 'بالنص', 'حرفيا', 'كاملا', 'كامله', 'لو', 'رجاء']);
const KITAB = new Set(['كتاب', 'كتابه', 'الكتاب']);
const isNum = (w) => /^\d+$/.test(w);

/**
 * The reader's message → { page, volume, titleWords, cue, needDigits, pages } or null. Pages and
 * volumes in Arabic («١٤٠»), Persian («۱۴۰») and Western digits are one number; «الجزء الأول», «ج١»,
 * «المجلد 1» and «١/١٤٠» name the same volume. A number written in words asks for digits.
 */
export function parsePageAsk(text) {
  const src = String(text == null ? '' : text);
  if (!src.trim() || src.length > 1200) return null;
  // «١/١٤٠» — volume/page, the citation convention. Read on the RAW text: folding turns «/» into a space.
  const slash = /(?:^|[^\d٠-٩۰-۹])([\d٠-٩۰-۹]{1,3})\s*\/\s*([\d٠-٩۰-۹]{1,5})(?![\d٠-٩۰-۹])/u.exec(src);
  const folded = foldArabic(src);
  // Glued forms («ص140»، «ج1»، «صفحه140») are split before the words are read.
  const words = folded.replace(/(^| )(ص|ج|مج|صفحه|الصفحه)(\d+)(?= |$)/gu, '$1$2 $3').split(' ').filter(Boolean);
  let page = null;
  let volume = null;
  let needDigits = false;
  const used = new Set();
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (PAGE_WORDS.has(w) || (w === 'رقم' && PAGE_WORDS.has(words[i + 1]))) {
      let j = w === 'رقم' ? i + 2 : i + 1;
      if (words[j] === 'رقم') j += 1;
      if (isNum(words[j])) {
        if (page === null) { page = Number(words[j]); for (let k = i; k <= j; k += 1) used.add(k); }
      } else if (words[j] && (NUMBER_WORDS.has(words[j]) || ordinalAt(words, j))) needDigits = true;
      continue;
    }
    if (VOLUME_WORDS.has(w) && volume === null) {
      if (isNum(words[i + 1])) { volume = Number(words[i + 1]); used.add(i); used.add(i + 1); continue; }
      const ord = ordinalAt(words, i + 1);
      if (ord) { volume = ord.value; for (let k = i; k <= i + ord.length; k += 1) used.add(k); }
    }
  }
  if (page === null && slash) {
    const digit = (s) => Number(foldArabic(s));
    volume = digit(slash[1]);
    page = digit(slash[2]);
  }
  if (page === null && !needDigits) return null;
  const cue = words.some((w) => REQUEST_WORDS.has(w));
  // The title: after «كتاب» when the reader wrote it; otherwise the words the page and volume do not
  // take, with the request words in front of it and the tail after it («ثم لخصه») removed.
  let titleWords;
  const kitab = words.findIndex((w) => KITAB.has(w));
  if (kitab !== -1) {
    titleWords = [];
    for (let k = kitab + 1; k < words.length && !used.has(k) && !TITLE_STOP.has(words[k]); k += 1) {
      if (PAGE_WORDS.has(words[k]) || VOLUME_WORDS.has(words[k])) break;
      titleWords.push(words[k]);
    }
  } else {
    const free = words.map((w, k) => (used.has(k) || isNum(w) ? null : w));
    const runs = [];
    let run = [];
    for (const w of free) {
      if (w === null) { if (run.length) runs.push(run); run = []; } else run.push(w);
    }
    if (run.length) runs.push(run);
    const cleaned = runs.map((r) => {
      let out = r.slice();
      while (out.length && LEAD_WORDS.has(out[0])) out = out.slice(1);
      const stop = out.findIndex((w) => TITLE_STOP.has(w));
      if (stop !== -1) out = out.slice(0, stop);
      while (out.length && (out[out.length - 1] === 'من' || out[out.length - 1] === 'في')) out = out.slice(0, -1);
      return out;
    }).filter((r) => r.length);
    titleWords = cleaned.sort((a, b) => b.length - a.length)[0] || [];
  }
  const slashed = !!slash && page !== null && !words.some((w) => PAGE_WORDS.has(w));
  return { page, volume, titleWords, cue, needDigits, slashed };
}

/** The title readings: as written, and with an author glued to its tail («… لابن رشد»، «… للعثيمين»). */
function titleReadings(titleWords) {
  const out = [];
  if (!titleWords.length) return out;
  out.push({ title: titleWords.join(' '), author: '' });
  for (let k = Math.max(1, titleWords.length - 4); k < titleWords.length; k += 1) {
    const w = titleWords[k];
    if (!(w.startsWith('لل') || w.startsWith('لا')) || w.length < 4) continue;
    const first = w.startsWith('لل') ? 'ال' + w.slice(2) : 'ا' + w.slice(2);
    out.push({ title: titleWords.slice(0, k).join(' '), author: [first, ...titleWords.slice(k + 1)].join(' ') });
    break;
  }
  return out;
}

// One WORK may sit on the shelf as two editions; page numbers belong to an edition.
const workKey = (b) => normalizeTitle(b.title).replace(/ (?:ت|ط|تحقيق|طبعه) .*$/, '') + '|' + foldArabic(b.author);

/**
 * parsePageAsk() output → { outcome, book?, books?, titleText } — which book, or why not.
 * outcomes: 'page' (one book, one edition) · 'no_book' · 'ask_which' · 'editions' · 'blocked' · 'need_digits'
 */
export function planPage(ask) {
  if (!ask) return null;
  if (ask.needDigits && ask.page === null) return ask.cue ? { outcome: 'need_digits' } : null;
  let best = null;
  for (const r of titleReadings(ask.titleWords)) {
    const got = resolveBook(r.title, r.author);
    if (!best || got.tier > best.got.tier) best = { r, got };
  }
  // No request word («الصفحة ١٤٠ من بداية المجتهد»): taken only on a strong title (the quote seat's Q6).
  if (!best || (!ask.cue && best.got.tier < 2)) {
    if (!ask.cue) return null;
    return { outcome: 'no_book', titleText: ask.titleWords.join(' ') };
  }
  const { got } = best;
  if (!got.books.length) return { outcome: 'no_book', titleText: best.r.title, authorText: best.r.author };
  const open = got.books.filter((b) => !b.blocked);
  if (!open.length) return { outcome: 'blocked', book: got.books[0] };
  const works = new Map();
  for (const b of open) {
    const k = workKey(b);
    if (!works.has(k)) works.set(k, []);
    works.get(k).push(b);
  }
  if (works.size > 1) return { outcome: 'ask_which', books: open };
  if (open.length > 1) return { outcome: 'editions', books: open };
  return { outcome: 'page', book: open[0] };
}

// ── COMPOSING ───────────────────────────────────────────────────────────────────
const posInt = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

function headingOf(atom) {
  const path = atom && Array.isArray(atom.heading_path) ? atom.heading_path : [];
  let heading = String(path.length ? path[path.length - 1] : '').trim().replace(/^[-–—\s]+/u, '').trim();
  if (heading.length > HEADING_MAX) {
    const cut = heading.lastIndexOf(' ', HEADING_MAX);
    heading = heading.slice(0, cut > 0 ? cut : HEADING_MAX) + '…';
  }
  return heading;
}

/**
 * The range the atoms really cover, from the FIRST atom's start to the LAST atom's end — never the
 * page that was asked for (owner, 2026-09-24). '' when a page may not be shown: every atom must be
 * citable print, with its locators.
 */
export function realRange(atoms) {
  const list = Array.isArray(atoms) ? atoms : [];
  if (!list.length) return '';
  if (!list.every((a) => a && a.page_citable === true && a.numbering === 'print')) return '';
  const first = list[0];
  const last = list[list.length - 1];
  const s = posInt(first.page_start);
  const e = posInt(last.page_end);
  if (s === null || e === null) return '';
  const v1 = posInt(first.volume);
  const v2 = posInt(last.volume);
  if (v1 !== null && v2 !== null && v1 !== v2) return `ج${v1} ص${s} – ج${v2} ص${e}`;
  const pages = e > s ? `ص${s}–${e}` : `ص${s}`;
  return v1 !== null ? `ج${v1}${SEP}${pages}` : pages;
}

/** The card line: the book, its author, and the real range (or, where no page may show, the heading). */
export function navCard(book, atoms) {
  const parts = [`${BOOK_MARK} «${String(book.title || '').trim()}»`];
  const author = String(book.author || '').trim();
  if (author) parts.push(author);
  const range = realRange(atoms);
  if (range) parts.push(range);
  else {
    const heading = headingOf(atoms[0]);
    if (heading) parts.push(heading);
  }
  return parts.join(SEP);
}

/** The atoms' text as the envelope joined it; null when the envelope's own text disagrees. */
function joinedText(envelope) {
  const atoms = Array.isArray(envelope.atoms) ? envelope.atoms : [];
  const joined = atoms.map((a) => String(a.text || '')).join('\n');
  if (typeof envelope.text === 'string' && envelope.text !== joined) return null;
  return joined;
}

/**
 * A /page or /next envelope → the reply for this book's class, or null when it cannot be trusted.
 *   turath, fatwa: every atom, whole, in order · modern: one paragraph with its atom's own range.
 * Returns { text, lastAtomId }.
 */
export function composeNavReply(book, envelope, { page = null } = {}) {
  const atoms = Array.isArray(envelope && envelope.atoms) ? envelope.atoms.filter((a) => a && typeof a.text === 'string') : [];
  if (!atoms.length) return null;
  const joined = joinedText(envelope);
  if (joined === null) return null;
  if (book.cls === 'modern') {
    const atom = atoms.find((a) => posInt(a.page_start) === page) || atoms[0];
    const paragraph = modernParagraph(atom.text, '', false);
    if (!paragraph) return null;
    return { text: navCard(book, [atom]) + '\n\n' + blockquote(paragraph), lastAtomId: String(atom.atom_id || '') };
  }
  return {
    text: navCard(book, atoms) + '\n\n' + blockquote(joined.replace(/\r\n?/g, '\n').trim()),
    lastAtomId: String(atoms[atoms.length - 1].atom_id || ''),
  };
}

// ── THE SENTENCES ───────────────────────────────────────────────────────────────
// None names the machinery, none invents a page, and every number in them is the reader's own.
const ar = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));

export function needDigitsReply() {
  return 'اكتب لي رقم الصفحة بالأرقام، ومعه الجزء إن كان الكتاب في أكثر من جزء؛ كأن تقول: '
    + '«انقل لي نص الصفحة ١٤٠ من الجزء الأول من كتاب بداية المجتهد».';
}

export function editionsReply(books, page) {
  const list = books.slice(0, ASK_LIST_MAX).map((b) => `- «${b.title}»`);
  return `هذا الكتاب عندي في أكثر من طبعة، وأرقامُ الصفحات تختلف بينها؛ فمن أيّ طبعةٍ تريد الصفحة ${ar(page)}؟\n\n`
    + list.join('\n');
}

export function autoReply(book, headings, chapter = '') {
  const head = `كتاب «${book.title}» مرقّمٌ ترقيمًا آليًّا، فليس له صفحاتُ طبعةٍ أنقلُ منها صفحةً برقمها.`;
  const named = chapter ? ` والبابُ الذي يقابلُ ما طلبت: «${chapter}».` : '';
  const list = (Array.isArray(headings) ? headings : []).slice(0, ASK_LIST_MAX).map((h) => `- ${h}`);
  return head + named + (list.length ? '\n\nومن أبوابه:\n\n' + list.join('\n') : '')
    + '\n\nاذكر لي البابَ أو المسألةَ التي تريدها منه، وأنقلُ لك نصَّها بحروفه.';
}

export function numberingUnavailableReply(book, headings) {
  const list = (Array.isArray(headings) ? headings : []).slice(0, ASK_LIST_MAX).map((h) => `- ${h}`);
  return `لا أعرفُ لكتاب «${book.title}» ترقيمَ طبعةٍ أثقُ به، فلا أنقلُ منه صفحةً برقمها.`
    + (list.length ? '\n\nومن أبوابه:\n\n' + list.join('\n') : '')
    + '\n\nاذكر لي المسألةَ أو البابَ الذي تريده منه، وأنقلُ لك نصَّه بحروفه مع موضعه.';
}

export function volumeRequiredReply(book, page) {
  return `كتاب «${book.title}» في أكثر من جزء؛ فمن أيّ جزءٍ تريد الصفحة ${ar(page)}؟ `
    + `كأن تقول: «انقل لي نص الصفحة ${ar(page)} من الجزء الأول من كتاب ${book.title}».`;
}

export function pageNotFoundReply(book, page, volume) {
  const where = volume !== null && volume !== undefined ? ` من الجزء ${ar(volume)}` : '';
  return `لم أجد الصفحة ${ar(page)}${where} في «${book.title}». تأكّد من رقم الصفحة والجزء، `
    + 'أو اذكر لي المسألة التي تريدها منه وأنقل لك ما جاء فيها بحروفه.';
}

// ── THE TURN ────────────────────────────────────────────────────────────────────
function topHeadings(tocPayload) {
  const nodes = tocPayload && Array.isArray(tocPayload.headings) ? tocPayload.headings : [];
  return nodes.map((n) => String((n && n.heading) || '').trim()).filter(Boolean);
}

function headingByAtom(tocPayload, atomId) {
  const walk = (nodes) => {
    for (const n of Array.isArray(nodes) ? nodes : []) {
      if (n && n.atom_id === atomId) return String(n.heading || '').trim();
      const inner = walk(n && n.children);
      if (inner) return inner;
    }
    return '';
  };
  return atomId ? walk(tocPayload && tocPayload.headings) : '';
}

async function tocOf(book, deps) {
  const got = await navCall('toc', { book_id: book.id }, deps);
  return got.ok && got.payload && got.payload.book_id === book.id ? got.payload : null;
}

/** The chapter atom a numbering_auto message names («… atom_id=FC-000162:0001:001.»), or ''. */
const chapterAtomIn = (message) => ((/atom_id=([A-Za-z0-9_.:-]{1,80})/.exec(String(message || '')) || [])[1] || '');

/**
 * A page request, whole: which book, the call, and the reply. Returns { outcome, text, cursor? } or
 * null when the message is not a page request after all. deps: { flagValue, token, baseUrl,
 * fetchImpl?, signal? } — the switch has already been decided by the caller.
 */
export async function answerPageRequest(text, deps = {}) {
  const ask = parsePageAsk(text);
  if (!ask) return null;
  const plan = planPage(ask);
  if (!plan) return null;
  const nav = { ...deps, deadline: Date.now() + LIB_NAV_TURN_MS };
  switch (plan.outcome) {
    case 'need_digits': return { outcome: 'page_need_digits', text: needDigitsReply() };
    case 'no_book': return { outcome: 'page_no_book', text: noBookReply(plan.titleText, plan.authorText || '') };
    case 'blocked': return { outcome: 'page_blocked', text: blockedReply(plan.book) };
    case 'ask_which': return { outcome: 'page_ask_which', text: askWhichReply(plan.books) };
    case 'editions': return { outcome: 'page_editions', text: editionsReply(plan.books, ask.page) };
    default: break;
  }
  const book = plan.book;
  // Auto-numbered in the catalogue: it has no print pages to ask for. Its chapters are named instead.
  if (book.auto) {
    const toc = await tocOf(book, nav);
    return { outcome: 'page_auto', text: autoReply(book, toc ? topHeadings(toc) : []) };
  }
  const body = { book_id: book.id, page: ask.page };
  if (ask.volume !== null) body.volume = ask.volume;
  let got = await navCall('page', body, nav);
  // «الجزء الأول» of a one-volume book whose atoms carry no volume: asked once more without it.
  if (!got.ok && got.status === 404 && got.code === 'page_not_found' && ask.volume === 1) {
    got = await navCall('page', { book_id: book.id, page: ask.page }, nav);
  }
  if (!got.ok) {
    if (got.code === 'numbering_auto') {
      const toc = await tocOf(book, nav);
      return { outcome: 'page_auto', text: autoReply(book, toc ? topHeadings(toc) : [], headingByAtom(toc, chapterAtomIn(got.message))) };
    }
    if (got.code === 'numbering_unavailable') {
      const toc = await tocOf(book, nav);
      return { outcome: 'page_unnumbered', text: numberingUnavailableReply(book, toc ? topHeadings(toc) : []) };
    }
    if (got.code === 'volume_required') return { outcome: 'page_volume_required', text: volumeRequiredReply(book, ask.page) };
    if (got.code === 'page_not_found') return { outcome: 'page_not_found', text: pageNotFoundReply(book, ask.page, ask.volume) };
    return { outcome: 'page_unavailable', text: unavailableReply(book), reason: got.code || got.reason };
  }
  // The deny list is Ezik's, not the service's: the answer is checked again for the book it names.
  const envelope = got.payload;
  const owner = catalogBook(envelope.book_id);
  if (envelope.book_id !== book.id || !owner || owner.blocked) {
    return { outcome: 'page_unavailable', text: unavailableReply(book), reason: 'nav_book_mismatch' };
  }
  const composed = composeNavReply(owner, envelope, { page: ask.page });
  if (!composed) return { outcome: 'page_unavailable', text: unavailableReply(book), reason: 'nav_text_mismatch' };
  return { outcome: 'page_quoted', text: composed.text, cursor: { bid: owner.id, at: composed.lastAtomId } };
}

// ── م٤-ب · «كمّل» ────────────────────────────────────────────────────────────────
export function modernContinueReply(book) {
  return `كتاب «${book.title}» من الكتب المعاصرة، وما أنقله منه فقرةٌ واحدةٌ بعزوها لا أكثر؛ `
    + 'فاذكر لي مسألةً أخرى منه وأنقلُ لك فقرتَها.';
}

export function endOfBookReply(book) {
  return `انتهى كتاب «${book.title}» عند الموضع الذي نقلتُه، فليس بعده نصٌّ أنقله.`;
}

/**
 * «كمّل» after a quotation: what follows the last atom shown, never an atom twice. The cursor is a
 * hint from the client's history: the book, its class and the withheld list come from the catalogue,
 * and the answer must be for that same book. Returns { outcome, text, cursor? } or null (not ours).
 *   turath, fatwa → the rest of a cut atom, else POST /next unit=page · auto → /next unit=atom ·
 *   modern → one paragraph is all it gives, said so, no call · withheld → refused.
 */
export async function answerContinue(cursor, deps = {}) {
  if (!cursor || typeof cursor.bid !== 'string' || typeof cursor.at !== 'string') return null;
  const book = catalogBook(cursor.bid);
  if (!book) return null;
  if (book.blocked) return { outcome: 'continue_blocked', text: blockedReply(book) };
  if (book.cls === 'modern') return { outcome: 'continue_modern', text: modernContinueReply(book) };
  const nav = { ...deps, deadline: Date.now() + LIB_NAV_TURN_MS };
  // The rest of the atom the last quotation cut: re-read on its printed page, from where it stopped.
  if (Number.isInteger(cursor.from) && cursor.from > 0 && !book.auto && Number.isInteger(cursor.p)) {
    const body = { book_id: book.id, page: cursor.p };
    if (Number.isInteger(cursor.v) && cursor.v > 0) body.volume = cursor.v;
    const got = await navCall('page', body, nav);
    const env = got.ok ? got.payload : null;
    const atom = env && env.book_id === book.id && Array.isArray(env.atoms)
      ? env.atoms.find((a) => a && a.atom_id === cursor.at) : null;
    const full = atom && typeof atom.text === 'string' ? atom.text.replace(/\r\n?/g, '\n') : '';
    const rest = full.length > cursor.from ? full.slice(cursor.from).trim() : '';
    if (rest) {
      return { outcome: 'continue_rest', text: navCard(book, [atom]) + '\n\n' + blockquote(rest), cursor: { bid: book.id, at: atom.atom_id } };
    }
  }
  const got = await navCall('next', { atom_id: cursor.at, unit: book.auto ? 'atom' : 'page' }, nav);
  if (!got.ok) return { outcome: 'continue_unavailable', text: unavailableReply(book), reason: got.code || got.reason };
  const env = got.payload;
  const owner = catalogBook(env.book_id);
  if (env.book_id !== book.id || !owner || owner.blocked || owner.cls === 'modern') {
    return { outcome: 'continue_unavailable', text: unavailableReply(book), reason: 'nav_book_mismatch' };
  }
  const all = Array.isArray(env.atoms) ? env.atoms : [];
  const atoms = all.filter((a) => a && a.atom_id !== cursor.at);
  if (!atoms.length) return { outcome: 'continue_end', text: endOfBookReply(owner) };
  const composed = composeNavReply(owner, { ...env, atoms, text: atoms.length === all.length ? env.text : undefined });
  if (!composed) return { outcome: 'continue_unavailable', text: unavailableReply(book), reason: 'nav_text_mismatch' };
  return { outcome: 'continue_quoted', text: composed.text, cursor: { bid: owner.id, at: composed.lastAtomId } };
}

export const __navTest = Object.freeze({ titleReadings, joinedText, headingByAtom, chapterAtomIn, topHeadings });
