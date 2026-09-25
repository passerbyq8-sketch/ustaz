#!/usr/bin/env node
// tools/trace-read.mjs -- read the DIAG_TRACE_V1 trace of a preview deployment back into one readable file per turn
// (order د-١ §٢ row 14). The trace itself is written by lib/diag-trace.js.
//
//   node tools/trace-read.mjs <deployment-url-or-id> --since <ISO|30m|2h> [--until <ISO|rel>] [--out <dir>] [--cwd <linked tree>]
//   node tools/trace-read.mjs --from-file <logs.jsonl> [--out <dir>]
//
// It pages `vercel logs <deployment> --json` backwards through the window (the CLI repeats rows under --limit, so
// every page is keyed by row id and paging stops when a page brings nothing new), collects every `[diag-trace]`
// line from each request's log lines, joins each turn's numbered lines back into its byte stream, checks every
// line's sha and the whole stream's sha and length against the turn's closing line, and writes for each turn
// <out>/<turn>.json (every record, in order, and the join's integrity) and <out>/<turn>.md (the same, readable,
// stage by stage). A turn with a missing line, a bad sha or no closing line says so at the top of both files.
// It prints no environment value and reads nothing but the logs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { joinTraceLines, DIAG_TRACE_TAG } = await import(pathToFileURL(path.join(HERE, '..', 'lib', 'diag-trace.js')).href);

const argv = process.argv.slice(2);
const opt = (name, dflt = '') => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const OUT = path.resolve(opt('out', 'trace-out'));
const FROM = opt('from-file');
const DEPLOYMENT = positional[0] || '';
if (!FROM && !DEPLOYMENT) {
  console.error('usage: node tools/trace-read.mjs <deployment-url-or-id> --since <ISO|rel> [--until <ISO|rel>] [--out dir] [--cwd dir]\n'
    + '       node tools/trace-read.mjs --from-file <logs.jsonl> [--out dir]');
  process.exit(2);
}

// ── THE ROWS ──────────────────────────────────────────────────────────────────────────────────────
function parseRows(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    try { rows.push(JSON.parse(s)); } catch { /* not a row */ }
  }
  return rows;
}

function fetchRows() {
  const since = opt('since', '1h');
  let until = opt('until', '');
  const cwd = opt('cwd', process.cwd());
  const seen = new Map();
  for (let page = 0; page < 50; page += 1) {
    const args = ['logs', DEPLOYMENT, '--json', '--no-branch', '--limit', '1000', '--since', since];
    if (until) args.push('--until', until);
    const r = spawnSync('vercel', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 512 * 1024 * 1024 });
    if (r.status !== 0) { console.error(String(r.stderr || '').split('\n').slice(-5).join('\n')); process.exit(1); }
    const rows = parseRows(r.stdout);
    let fresh = 0;
    let oldest = Infinity;
    for (const row of rows) {
      const key = row.id || JSON.stringify([row.timestamp, row.requestId, row.message]);
      if (!seen.has(key)) { seen.set(key, row); fresh += 1; }
      if (Number.isFinite(row.timestamp)) oldest = Math.min(oldest, row.timestamp);
    }
    if (!fresh || !Number.isFinite(oldest)) break;
    const next = new Date(oldest).toISOString();
    if (next === until) break;
    until = next;
  }
  return [...seen.values()];
}

const rows = FROM ? parseRows(fs.readFileSync(FROM, 'utf8')) : fetchRows();
const lines = [];
const seenLines = new Set();
for (const row of rows) {
  const messages = [row.message, ...(Array.isArray(row.logs) ? row.logs.map((l) => l && l.message) : [])];
  for (const m of messages) {
    if (typeof m !== 'string' || !m.includes(DIAG_TRACE_TAG + ' ')) continue;
    // A request row carries its lines, and the CLI may also print a line as a row of its own: keep one copy.
    if (seenLines.has(m)) continue;
    seenLines.add(m);
    lines.push(m);
  }
}
const turns = joinTraceLines(lines);

// ── THE READABLE FILE ─────────────────────────────────────────────────────────────────────────────
const fence = (s) => '```\n' + String(s ?? '').replace(/```/g, '`​``') + '\n```';
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 160);
const table = (head, rowsOf) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rowsOf.map((r) => '| ' + r.map(cell).join(' | ') + ' |')].join('\n');
const j = (v) => fence(JSON.stringify(v, null, 2));

function render(rec) {
  const d = rec.data || {};
  const h = `### ${rec.seq} · ${rec.stage} · t=${(rec.t / 1000).toFixed(2)} s`;
  switch (rec.stage) {
    case 'route':
      return `${h}\n\n**السؤال كما وصل:**\n\n${fence(d.question)}\n\n${j({ ...d, question: undefined })}`;
    case 'fetch': {
      const q = d.req || {};
      const res = d.res || {};
      const headLine = `\`${q.method} ${q.url}\` → **${d.status ?? d.error}** · ${d.ms} ms${d.bodyMs != null ? ` (جسم ${d.bodyMs} ms)` : ''}`;
      if (q.kind === 'provider') {
        return `${h} (نموذج)\n\n${headLine}\n\n${j({ model: q.model, maxTokens: q.maxTokens, stream: q.stream, systemHead: q.systemHead, systemSha: q.systemSha, tools: q.tools, messages: q.messages, stop: res.stop, usage: res.usage, textChars: res.textChars })}`
          + `\n\n**آخرُ ما أُرسل:**\n\n${fence(q.lastText)}${res.text != null ? `\n\n**الردُّ الخامّ:**\n\n${fence(res.text)}` : ''}`;
      }
      let body = `${h} (خدمة)\n\n${headLine}\n\n**الطلب:** ${j(q.body || q.query || {})}`;
      if (Array.isArray(res.hits)) {
        body += `\n\nrefused=${res.refused} · ${res.hits.length} مقطعًا\n\n` + table(['#', 'المعرّف', 'الكتاب', 'الجزء', 'الصفحة', 'العنوان', 'أوّل ١٢٠ حرفًا'],
          res.hits.map((x, i) => [i + 1, x.id, x.book, x.volume, x.page, x.title, x.head]));
      } else if (Array.isArray(res.results)) {
        body += `\n\n${res.results.length} نتيجة (الكلّي ${res.total ?? '?'})\n\n` + table(['#', 'المعرّف', 'العنوان', 'العالم', 'أوّل ١٢٠ حرفًا'],
          res.results.map((x, i) => [i + 1, x.id, x.title, x.scholar, x.head]));
      } else if (d.res) body += `\n\n${j(d.res)}`;
      return body;
    }
    case 'encyclopedia':
      return `${h}\n\nالاستعلام: «${d.query}» · المطابق ${d.matched} · المأخوذ ${d.cap}\n\n` + table(['الرتبة', 'المعرّف', 'العنوان', 'الجزء', 'الدرجة', 'أُخذ'],
        (d.top || []).map((x) => [x.rank, x.id, x.title, x.part, typeof x.score === 'number' ? x.score.toFixed(3) : x.score, x.taken ? '✓' : '']));
    case 'judge':
      return `${h}\n\nالسقوط: ${d.fallback || '—'} · أُبقي ${JSON.stringify(d.kept)} · طُرد ${JSON.stringify(d.dropped)}\n\n`
        + (Array.isArray(d.shown) ? d.shown.map((x) => `- [${x.n}] \`${x.id}\` (${x.kind}${x.madhhab ? ' · ' + x.madhhab : ''})\n\n${fence(x.line)}`).join('\n') : j(d))
        + `\n\n**الردُّ الخامّ:**\n\n${fence(d.raw)}`;
    case 'pinned-table':
      return `${h}\n\n` + table(['الرقم', 'النوع', 'المذهب', 'المصدر', 'الجزء', 'الصفحة', 'المعرّف'],
        (d.rows || []).map((x) => [x.ref, x.kind, x.madhhab, x.title, x.volume, x.page, x.id || x.url])) + `\n\n${j(d.record)}`;
    case 'call':
      return `${h} — **${d.phase}**\n\n${j({ n: d.n, model: d.model, stop: d.stop, ms: d.ms, outTokens: d.outTokens, inTokens: d.inTokens, cacheReadTokens: d.cacheReadTokens, cacheWriteTokens: d.cacheWriteTokens, shape: d.shape, toolInputs: d.toolInputs })}\n\n${fence(d.text)}`;
    case 'draft':
      return `${h} — المسوّدةُ كاملةً قبلَ أيِّ باب (${d.chars} حرفًا)\n\n${fence(d.draft)}`;
    case 'phrase-filter':
      return `${h} — ${d.stage} · ${d.changed ? 'غيّرت' : 'لم تغيّر'}${d.notes && d.notes.length ? ' · ' + d.notes.join(' ، ') : ''}`
        + (d.changed ? `\n\n**قبلُ:**\n\n${fence(d.before)}\n\n**بعدُ:**\n\n${fence(d.after)}` : '');
    case 'sentence-door':
      return `${h} — المتحقّق: ${d.verifier}\n\n` + table(['#', 'الجملة', 'النوع', 'الحكم', 'الاقتباس', 'الإحالة', 'ما حلّ محلّها'],
        (d.claims || []).map((c, i) => [i + 1, c.sentence, (c.kinds || []).join('+'), c.verdict, c.quote, c.row != null ? `${c.row}${c.rowSource ? ' · ' + (c.rowSource.title || '') + ' ' + (c.rowSource.volume ?? '') + '/' + (c.rowSource.page ?? '') : ''}` : '', c.replacedBy]));
    case 'finalizer':
      return `${h} — ${d.outcome || (d.ok ? 'ok' : 'replaced')}\n\n${j({ problems: d.problems, degraded: d.degraded, drops: d.drops })}`
        + (d.before !== d.after ? `\n\n**قبلُ:**\n\n${fence(d.before)}\n\n**بعدُ:**\n\n${fence(d.after)}` : '\n\n(لم يتغيّر النصّ)');
    case 'delivered':
      return `${h} — **النصُّ كما وصلَ القارئ** (HTTP ${d.status}، ${d.frames} إطارًا، ${d.sseBytes} بايتًا، ${d.elapsedMs} ms)\n\n${fence(d.readerText)}${d.other ? `\n\n${fence(d.other)}` : ''}`;
    case 'marker':
      return `${h} — \`${typeof d === 'string' ? d : JSON.stringify(d)}\``;
    default:
      return `${h}\n\n${j(d)}`;
  }
}

fs.mkdirSync(OUT, { recursive: true });
const written = [];
for (const t of turns) {
  const recs = t.records.slice().sort((a, b) => a.seq - b.seq);
  const start = recs.find((r) => r.stage === 'trace-start');
  const route = recs.find((r) => r.stage === 'route');
  const integrity = {
    turn: t.turn, complete: t.complete, ended: t.ended, missingLines: t.missingLines, badShaLines: t.badShaLines,
    brokenRecords: t.brokenRecords, overflow: t.overflow, records: recs.length, streamBytes: t.streamBytes, streamSha: t.streamSha,
  };
  const timers = recs.map((r) => ({ seq: r.seq, t: r.t, stage: r.stage, phase: r.data && r.data.phase }));
  fs.writeFileSync(path.join(OUT, `${t.turn}.json`), JSON.stringify({ integrity, timers, records: recs }, null, 2));
  const md = [
    `# الدور ${t.turn}`,
    '',
    t.complete ? '**السجلّ كاملٌ:** كلُّ الأسطرِ حاضرة، وبصمةُ كلِّ سطرٍ وبصمةُ المجرى كلِّه مطابقة.'
      : `**السجلّ ناقص:** ${JSON.stringify({ ended: t.ended, missingLines: t.missingLines, badShaLines: t.badShaLines, overflow: t.overflow })}`,
    '',
    table(['', ''], [
      ['النشر', start && start.data && start.data.deployment], ['الإيداع', start && start.data && start.data.commit],
      ['السؤال', route && route.data && route.data.question], ['السجلّات', recs.length], ['بايتات المجرى', t.streamBytes],
    ]),
    '',
    '## مؤقّتاتُ المراحل',
    '',
    table(['#', 't (ث)', 'المرحلة', 'الطور'], timers.map((x) => [x.seq, (x.t / 1000).toFixed(2), x.stage, x.phase || ''])),
    '',
    '## المراحل بالترتيب',
    '',
    ...recs.map((r) => render(r) + '\n'),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, `${t.turn}.md`), md);
  written.push({ turn: t.turn, complete: t.complete, records: recs.length, question: route && route.data ? String(route.data.question || '').slice(0, 60) : '' });
}
console.log(JSON.stringify({ rows: rows.length, traceLines: lines.length, turns: written, out: OUT }, null, 2));
