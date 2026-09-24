// lib/quote-cursor.js — PROGRAM ORDER 2026-09-24, م٤-ب (LIB_NAV_V1): where the last quotation stopped.
//
// THE OWNER'S ITEM (م٤-ب): «كمّل»: ما بعدَ آخرِ نقلٍ في المحادثة — المقطعُ أو الصفحةُ التالية — للتراثِ
// والفتاوى؛ والمعاصرُ يُقالُ فيه إنّه فقرةٌ واحدة. And «never show an atom twice when moving on».
//
// MEASURED (program-2026-09-24/04-quote/measure/B-continue.md): the quote reply carried no ids, the
// client keeps only the raw text, and the server keeps no state — so nothing could say where the last
// quotation stopped. The carrier chosen is the one measured invisible in EVERY reader the client has
// (screen, voice, parents' log, stream preview, copy/share, lessons query) and yet sent back in the
// history byte for byte: an EMPTY book chip, `<book bid="…" at="…"></book>`. An empty title draws no
// card (app.jsx BookCard returns null), and no new tag name is invented (gate chatux holds the registry).
//
// WHAT THIS MODULE IS. Zero imports and pure, so api/ask.js can load it on every request: the markers
// are read, and then TAKEN OUT of every assistant turn before anything reads the history — the switch
// on or off — because a replayed marker would become the model's vocabulary (the reason the client
// strips its own <incomplete/>).
//
// A MARKER IS CLIENT-SUPPLIED, SO IT IS A HINT AND NEVER AUTHORITY: lib/lib-nav.js re-derives the class,
// the withheld list and the book from the catalogue and from the service's answer, and refuses a
// mismatch.

const ID = '[A-Za-z0-9_.:-]{1,80}';
const MARKER_RE = new RegExp(`\\n?<book bid="(${ID})" at="(${ID})"(?: from="(\\d{1,7})" v="(\\d{1,4})" p="(\\d{1,6})")?></book>`, 'g');
const SAFE = new RegExp(`^${ID}$`);

/** The marker for one position. `from`/`v`/`p` say where a quotation cut inside its atom stopped. */
export function cursorMarker(cursor) {
  if (!cursor || !SAFE.test(String(cursor.bid || '')) || !SAFE.test(String(cursor.at || ''))) return '';
  const cut = Number.isInteger(cursor.from) && cursor.from > 0 && Number.isInteger(cursor.v) && cursor.v >= 0
    && Number.isInteger(cursor.p) && cursor.p >= 0
    ? ` from="${cursor.from}" v="${cursor.v}" p="${cursor.p}"` : '';
  return `\n<book bid="${cursor.bid}" at="${cursor.at}"${cut}></book>`;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === 'text').map((b) => String(b.text || '')).join('\n');
  return '';
}

/**
 * The cursor of the assistant turn IMMEDIATELY before the reader's last message, or null. Only that
 * turn: the «كمّل» button sits under every answer, and an old quotation must not capture it later.
 */
export function readCursor(messages) {
  const list = Array.isArray(messages) ? messages : [];
  if (list.length < 2 || !list[list.length - 1] || list[list.length - 1].role !== 'user') return null;
  const prev = list[list.length - 2];
  if (!prev || prev.role !== 'assistant') return null;
  let last = null;
  const re = new RegExp(MARKER_RE.source, 'g');
  for (let m; (m = re.exec(textOf(prev.content)));) last = m;
  if (!last) return null;
  const cursor = { bid: last[1], at: last[2] };
  if (last[3]) { cursor.from = Number(last[3]); cursor.v = Number(last[4]); cursor.p = Number(last[5]); }
  return cursor;
}

/** Every assistant turn without its markers. The same array back when there were none. */
export function stripCursorMarkers(messages) {
  if (!Array.isArray(messages)) return messages;
  let changed = false;
  const out = messages.map((m) => {
    if (!m || m.role !== 'assistant') return m;
    if (typeof m.content === 'string') {
      const next = m.content.replace(new RegExp(MARKER_RE.source, 'g'), '');
      if (next === m.content) return m;
      changed = true;
      return { ...m, content: next };
    }
    if (Array.isArray(m.content)) {
      let touched = false;
      const content = m.content.map((b) => {
        if (!b || b.type !== 'text' || typeof b.text !== 'string') return b;
        const next = b.text.replace(new RegExp(MARKER_RE.source, 'g'), '');
        if (next === b.text) return b;
        touched = true;
        return { ...b, text: next };
      });
      if (!touched) return m;
      changed = true;
      return { ...m, content };
    }
    return m;
  });
  return changed ? out : messages;
}

// ── «كمّل» ──────────────────────────────────────────────────────────────────────
/** The button's own sentence, frozen by the owner (guards/chat-bar-actions-guard.cjs), byte for byte. */
export const CONTINUE_PROMPT = 'كمّل الشرح من آخر نقطة، من دون إعادة ما سبق.';

const norm = (value) => String(value == null ? '' : value)
  .replace(/[\u064B-\u0652\u0670\u0640]/gu, '')
  .replace(/[أإآٱ]/gu, 'ا').replace(/ة/gu, 'ه').replace(/ى/gu, 'ي')
  .replace(/[^ء-ي\s]+/gu, ' ')
  .replace(/\s+/gu, ' ').trim();

const CONTINUE_FORMS = new Set([
  'كمل', 'اكمل', 'تابع', 'واصل', 'استمر', 'وبعدين', 'التالي', 'كمل النص', 'اكمل النص', 'كمل القراءه',
  'اكمل القراءه', 'كمل النقل', 'اكمل النقل', 'تابع النقل', 'تابع القراءه', 'كمل من الكتاب', 'اكمل من الكتاب',
  'الصفحه التاليه', 'اقرا الصفحه التاليه', 'الصفحه التي بعدها', 'اقرا الصفحه التي بعدها', 'انقل الصفحه التاليه',
  'كمل لو سمحت', 'كمل من فضلك', 'اكمل لو سمحت', 'اكمل من فضلك', 'كمل لي', 'اكمل لي', 'كمل الباب', 'اكمل الباب',
]);

/** The reader asks for what follows: the button's sentence, or one of the short forms, and nothing else. */
export function isContinueRequest(text) {
  const raw = String(text == null ? '' : text).trim();
  if (raw === CONTINUE_PROMPT) return true;
  return CONTINUE_FORMS.has(norm(raw));
}
