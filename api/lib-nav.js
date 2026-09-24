// api/lib-nav.js — PROGRAM ORDER 2026-09-24, م٥ (LIB_NAV_V1): the one server door of the «المكتبة» section.
//
// THE OWNER'S ITEM: «قسمٌ جديدٌ اسمُه «المكتبة»: تصفّحُ الكتبِ بأقسامِها ومؤلّفيها · أبوابُ الكتاب · القراءةُ
// صفحةً صفحةً بالتالي والسابق · البحثُ داخلَ الكتاب · النسخُ والمشاركة. قواعدُ النقلِ نفسُها.»
//
// WHAT IT IS. A token-bearing proxy modelled on api/lessons-browse.js (program-2026-09-24/05-library/
// measure/A-model.md): POST only, one closed list of operations, every input validated before anything
// is asked upstream, every failure a fixed body with no upstream detail, reason codes only in the log,
// and the reader's search words never logged. The shelf is answered here from the catalogue
// (lib/lib-shelf.js), which never reaches the client. A book's chapters, its pages, what follows and a
// search inside it go through lib/lib-nav.js `readOp`, where the quote rules are enforced.
//
// WHO MAY OPEN IT. The same reader the chat's library door serves: an adult (api/ask.js gives library
// quotations to `band === 'adult'` only). The band is lib/reader-fields.js's, whose absent or garbled
// claim resolves to young, so the section fails closed. A child's `status` is { enabled: false }.
//
// THE SWITCH. LIB_NAV_V1, with SHAMELA_BRAIN and the token. Off: every operation but `status` answers 404,
// and `status` answers { enabled: false }, which is how the client knows not to draw the section.
// The navigation base is LIB_NAV_URL (an allow-listed origin, lib/lib-nav.js navOrigin).
import { shelf, sectionBooks, sectionAuthors, authorBooks, shelfBook, findBooks, sectionsAligned } from '../lib/lib-shelf.js';
import { readOp, readingMode } from '../lib/lib-nav.js';
import { readerFromBody } from '../lib/reader-fields.js';

const OPS = Object.freeze(['status', 'shelf', 'books', 'authors', 'author', 'search', 'book', 'toc', 'page', 'next', 'at', 'find']);
const BOOK_ID_RE = /^FC-\d{6}$/;
const MAX_BODY_CHARS = 4096;
/** Under the default function duration: this route has no vercel.json entry, as the lessons routes have none. */
const TURN_MS = 12000;
const NOT_FOUND = Object.freeze({ error: 'not_found' });
const BAD_REQUEST = Object.freeze({ error: 'bad_request' });
const METHOD = Object.freeze({ error: 'method_not_allowed' });
const UNAVAILABLE = Object.freeze({ error: 'unavailable' });

function readBody(req) {
  const raw = req && req.body;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    if (raw.length > MAX_BODY_CHARS) return {};
    try { const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

// Western, Arabic-Indic and Persian digits are the same numbers («الأرقامُ العربيّةُ والهنديّةُ سواء»).
function intOf(value) {
  if (Number.isInteger(value)) return value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const ascii = value.trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  return /^\d{1,6}$/.test(ascii) ? Number(ascii) : null;
}

const textOf = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json(METHOD);
  const body = readBody(req);
  const op = typeof body.op === 'string' ? body.op : '';
  if (!OPS.includes(op)) return res.status(400).json(BAD_REQUEST);
  const libFlagValue = String(process.env.SHAMELA_BRAIN || '').trim().toLowerCase();
  const libNavValue = String(process.env.LIB_NAV_V1 || '').trim().toLowerCase();
  const token = String(process.env.SEARCH_API_TOKEN || '').trim();
  const adult = readerFromBody(body).band === 'adult';
  const enabled = libNavValue === 'on' && libFlagValue === 'on' && token !== '' && adult && sectionsAligned();
  res.setHeader('Cache-Control', 'private, no-store');
  if (op === 'status') return res.status(200).json({ enabled });
  if (!enabled) return res.status(404).json(NOT_FOUND);

  const page = intOf(body.page) || 1;
  const section = intOf(body.section);
  if (op === 'shelf') return res.status(200).json({ sections: shelf() });
  if (op === 'books' || op === 'authors') {
    const out = section === null ? null : (op === 'books' ? sectionBooks(section, page) : sectionAuthors(section));
    return out ? res.status(200).json(out) : res.status(400).json(BAD_REQUEST);
  }
  if (op === 'author') {
    const name = textOf(body.author, 201);
    const out = name === null ? null : authorBooks(name, section, page);
    return out ? res.status(200).json(out) : res.status(400).json(BAD_REQUEST);
  }
  if (op === 'search') {
    const q = textOf(body.q, 120);
    const out = q === null ? null : findBooks(q, page);
    return out ? res.status(200).json(out) : res.status(400).json(BAD_REQUEST);
  }

  const bookId = typeof body.book_id === 'string' ? body.book_id : '';
  if (!BOOK_ID_RE.test(bookId)) return res.status(400).json(BAD_REQUEST);
  // A withheld book does not exist here: the same 404 as an unknown one, and nothing asked upstream.
  const book = shelfBook(bookId);
  if (!book) return res.status(404).json(NOT_FOUND);
  if (op === 'book') return res.status(200).json({ book: { ...book, mode: readingMode(book) } });

  const input = { book_id: bookId, page: intOf(body.page), volume: intOf(body.volume), atom_id: textOf(body.atom_id, 81), q: textOf(body.q, 400) };
  const deps = { flagValue: libFlagValue, token, baseUrl: String(process.env.LIB_NAV_URL || '').trim(), turnMs: TURN_MS };
  if (op === 'find') {
    const { runTool, createEvidenceTable } = await import('../lib/free-brain/tools.js');
    deps.search = { runTool, createEvidenceTable, libFlagValue, libToken: token };
  }
  const got = await readOp(op, input, deps);
  if (got.ok) return res.status(200).json(got.body);
  console.warn('[lib-nav] not served', { outcome: op, reason: got.code });
  if (got.code === 'unavailable') return res.status(502).json(UNAVAILABLE);
  if (got.code === 'bad_request') return res.status(400).json(BAD_REQUEST);
  if (got.code === 'not_found') return res.status(404).json(NOT_FOUND);
  // A book-level answer the reader can act on: no print pages, which volume, no such page, the end,
  // a search too broad. The client draws each one; none carries upstream text.
  return res.status(200).json({ notice: got.code });
}
