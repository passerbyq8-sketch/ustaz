// tools/harvest/fatwa-convert.mjs -- PROGRAM ORDER 2026-09-24, م٦: a harvested batch → fatwa records.
//
// THE OWNER'S ITEM: «محوِّلُ دفعةٍ إلى سجلِّ فتوى (الموقع، المفتي، السؤال، الجواب، الرابط، التاريخ، البصمة)»,
// built as a tool only: no fetch, no scheduling, no publishing, and nothing from the reserved inventory
// enters Ezik. MEASURED (program-2026-09-24/06-harvest/measure/A-record.md, B-harvest.md):
//   * the one local fatwa Q&A batch is a service-shaped dump (24 fields: scholar_id, question_text,
//     answer_text, source_url, source_item_id, date_published, raw_html_sha256, fetched_at, rights…);
//   * its date_published is null in every row, and fetched_at is the FETCH time: it is carried as such
//     and never relabelled as the fatwa's date;
//   * the fingerprint the tree computes is lib/full-fatwa.js fullTextHash(question, answer) -- and it is
//     NOT unique in that batch (8 pairs), so the key is `<scholar>:<source_item_id>` and a shared
//     fingerprint is REPORTED, never merged;
//   * questions and answers carry «السؤال:»/«الجواب:» labels in most rows: the text is carried verbatim
//     (METHOD V1 :106, no editing) and the labels are flagged, not stripped;
//   * a METHOD-V1 page manifest (the harvest's own format) has no question/answer split: its rows are
//     refused with that reason rather than guessed into a pair.
// The rights travel with every record. A reserved source (`held_inventory_pending_permission`) keeps that
// block unchanged; nothing this tool writes is ever publish_allowed.
//
// Usage: node tools/harvest/fatwa-convert.mjs --in <batch.jsonl> --out <records.jsonl> --report <report.json>
//        [--adapter service_dump|method_v1]
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fullTextHash } from '../../lib/full-fatwa.js';
import { FATWA_SCHOLARS } from '../../lib/fatwa-contract.js';
import { hostMatches } from '../../lib/source-registry.js';
import { RIGHTS_HELD, refusePath } from './policy.mjs';

const SCHOLAR_ID_RE = /^[-a-z0-9_]+$/;
const QUESTION_LABEL_RE = /^\s*السؤال\s*:/u;
const ANSWER_LABEL_RE = /^\s*الجواب\s*:/u;

function linkOf(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol !== 'https:') return { ok: false, reason: 'link_not_https' };
    if (u.username || u.password) return { ok: false, reason: 'link_userinfo' };
    return { ok: true, url: u.href, host: u.hostname.toLowerCase().replace(/^www\./, '') };
  } catch { return { ok: false, reason: 'link_unparseable' }; }
}

const isReserved = (row) => row.inventory_destination === 'held_inventory_pending_permission'
  || row.destination === 'held_inventory_pending_permission'
  || (row.rights && typeof row.rights === 'object' && row.rights.destination === 'held_inventory_pending_permission');

/** One service-dump row → { ok, record } | { ok:false, reason }. */
export function convertServiceDumpRow(row, index, ctx = {}) {
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not_an_object' };
  const scholarId = String(row.scholar_id || '');
  if (!SCHOLAR_ID_RE.test(scholarId)) return { ok: false, reason: 'scholar_id' };
  const question = typeof row.question_text === 'string' ? row.question_text : '';
  const answer = typeof row.answer_text === 'string' ? row.answer_text : '';
  if (!question.trim()) return { ok: false, reason: 'question_empty' };
  if (!answer.trim()) return { ok: false, reason: 'answer_empty' };
  const link = linkOf(row.source_url);
  if (!link.ok) return { ok: false, reason: link.reason };
  const registry = FATWA_SCHOLARS.find((s) => s.id === scholarId) || null;
  if (registry && !hostMatches(link.host, registry.sourceDomain)) return { ok: false, reason: 'link_off_domain' };
  const itemId = String(row.source_item_id == null ? '' : row.source_item_id).trim();
  if (!itemId) return { ok: false, reason: 'source_item_id' };
  const reserved = ctx.reserved === true || isReserved(row);
  const published = typeof row.date_published === 'string' && row.date_published.trim() ? row.date_published.trim() : null;
  return {
    ok: true,
    record: {
      key: `${scholarId}:${itemId}`,
      site: link.host,
      mufti: {
        id: scholarId,
        name: String(row.attribution_name || ''),
        kind: String(row.attribution_kind || ''),
        registry_name: registry ? registry.name : null,
      },
      question,
      answer,
      labels: { question: QUESTION_LABEL_RE.test(question), answer: ANSWER_LABEL_RE.test(answer) },
      title: String(row.title || ''),
      link: {
        url: link.url,
        source_item_id: itemId,
        id_in_url: new URL(link.url).pathname.split('/').includes(itemId),
      },
      date: { published, fetched_at: typeof row.fetched_at === 'string' ? row.fetched_at : null },
      fingerprint: {
        full_text_sha256: fullTextHash(question, answer),
        raw_html_sha256: typeof row.raw_html_sha256 === 'string' ? row.raw_html_sha256 : null,
      },
      rights: {
        basis: String(row.rights_basis || ''),
        text_verbatim: String(row.rights_text_verbatim || ''),
        attribution_required: row.attribution_required === 1 || row.attribution_required === true,
        ...(reserved ? RIGHTS_HELD : { destination: 'not_reserved', publish_allowed: false, product_use_allowed: false, permission_status: row.rights_basis ? 'site_statement' : 'unknown' }),
      },
      provenance: {
        input: ctx.inputName || null,
        input_sha256: ctx.inputSha256 || null,
        row: index,
        rowid: Number.isInteger(row.rowid) ? row.rowid : null,
        fatwa_kind: row.fatwa_kind == null ? null : String(row.fatwa_kind),
        content_mode: row.content_mode == null ? null : String(row.content_mode),
        audio_url: typeof row.audio_url === 'string' && row.audio_url ? row.audio_url : null,
      },
    },
  };
}

/** A METHOD-V1 manifest row: a PAGE, with no question/answer split. Refused, with the reason. */
export function convertMethodV1Row(row) {
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not_an_object' };
  if (row.unit === 'page' || !('question' in row && 'answer' in row)) return { ok: false, reason: 'no_question_answer_split' };
  return { ok: false, reason: 'unsupported_method_v1_unit' };
}

/** The whole batch → { records, rejected, collisions, counts }. Keyed by `<scholar>:<source_item_id>`. */
export function convertBatch(rows, { adapter = 'service_dump', inputName = null, inputSha256 = null, reserved = false } = {}) {
  const records = [];
  const rejected = [];
  const seen = new Set();
  const byPrint = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row, i) => {
    const out = adapter === 'method_v1' ? convertMethodV1Row(row) : convertServiceDumpRow(row, i, { inputName, inputSha256, reserved });
    if (!out.ok) { rejected.push({ row: i, reason: out.reason }); return; }
    if (seen.has(out.record.key)) { rejected.push({ row: i, reason: 'duplicate_key', key: out.record.key }); return; }
    seen.add(out.record.key);
    records.push(out.record);
    const fp = out.record.fingerprint.full_text_sha256;
    byPrint.set(fp, [...(byPrint.get(fp) || []), out.record.key]);
  });
  const collisions = [...byPrint.entries()].filter(([, keys]) => keys.length > 1).map(([fingerprint, keys]) => ({ fingerprint, keys }));
  const reasons = {};
  for (const r of rejected) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  return {
    records, rejected, collisions,
    counts: {
      rows: Array.isArray(rows) ? rows.length : 0, records: records.length, rejected: rejected.length, reasons,
      fingerprint_collisions: collisions.length,
      published_date_known: records.filter((r) => r.date.published !== null).length,
      labelled_question: records.filter((r) => r.labels.question).length,
      labelled_answer: records.filter((r) => r.labels.answer).length,
      id_in_url: records.filter((r) => r.link.id_in_url).length,
      held: records.filter((r) => r.rights.destination === RIGHTS_HELD.destination).length,
    },
  };
}

function cli(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  const input = arg('--in');
  const out = arg('--out');
  const reportPath = arg('--report');
  const adapter = arg('--adapter') || 'service_dump';
  if (!input || !out || !reportPath) { console.error('usage: --in <batch.jsonl> --out <records.jsonl> --report <report.json> [--adapter service_dump|method_v1]'); return 2; }
  if ([input, out, reportPath].some(refusePath)) { console.error('refused: C:/EZIK-LIB is not read or written by this tool'); return 2; }
  const bytes = fs.readFileSync(input);
  const inputSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const rows = [];
  const unparsed = [];
  bytes.toString('utf8').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try { rows.push(JSON.parse(line)); } catch { unparsed.push(i + 1); }
  });
  const result = convertBatch(rows, { adapter, inputName: input.split(/[\\/]/).pop(), inputSha256, reserved: /[\\/]harvest[\\/]/i.test(input) });
  fs.writeFileSync(out, result.records.map((r) => JSON.stringify(r)).join('\n') + (result.records.length ? '\n' : ''));
  const report = { tool: 'tools/harvest/fatwa-convert.mjs', adapter, input: { name: input.split(/[\\/]/).pop(), sha256: inputSha256, bytes: bytes.length, unparsed_lines: unparsed },
    counts: result.counts, collisions: result.collisions, rejected: result.rejected.slice(0, 200) };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.counts));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = cli(process.argv.slice(2));
