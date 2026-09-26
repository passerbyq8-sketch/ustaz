'use strict';
// D3B F4 (BEFORE_WRITING_V1) — E7 and the one «لم أقف» line.
// F4a the span is the whole line/sentence from its start, never from where «لم أقف» matched inside it
//     (witnesses Q14 «وأقفُ عند ما», Q23 «مع بيان ما» / «ثامنًا: ما» / «كما», Q29 «الحنابلة:», Q39);
// F4b the scope «من كتبهم أنفسهم» is kept, never widened into «nothing found» (Q23, Q37);
// F4c the line names exactly what was not found; F4d it never negates a sentence that stays
//     (Q2, Q11, Q26, Q27, Q28, Q32, Q37, Q38); and on every replayed answer R1–R4 hold.
// E7 witnesses go through terminalNotFound as the DIAG replayed them; the door witnesses go through the
// door with the sentences 5f0dbec struck forced to not_found, so the line is exercised on real strikes.
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const rootAt = process.argv.indexOf('--root');
const ROOT = rootAt < 0 ? path.join(__dirname, '..') : process.argv[rootAt + 1];
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d3b-witnesses.json'), 'utf8'));
const turn = (q) => W.turns.find((t) => t.q === q);
const rowsOf = (t) => t.rows.map((r) => ({ ...r, text: r.fullText }));
let checks = 0, failed = 0;
const ok = (name, pass, info) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || info === undefined ? '' : ' :: ' + info)); };
const MARKS = /[ً-ٰٟـ]/gu;
const plain = (s) => String(s || '').replace(MARKS, '');
const OPENS = /^(?:[-*•#>]+\s*|[0-9٠-٩]+\s*[.)]\s*|\*\*\s*)*(?:[وف]?(?:كما|لكن|لكني|لكنني|كذلك)\s+)?[وف]?لم\s+[أاإ]قف(?=\s|$|[.،:؛])/u;
const proseLines = (text) => String(text).replace(/<suggestions>[\s\S]*?<\/suggestions>/gu, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
// A «لم أقف» LINE is a prose line EVERY sentence of which opens with «لم أقف»; a paragraph that opens with
// one and goes on with content leaning on it is an in-place disclosure, kept whole (R2), not a second line.
const sentencesOf = (line) => (plain(line).match(/[^.!؟?]+[.!؟?]*/gu) || []).map((s) => s.trim()).filter(Boolean);
const absenceLines = (text) => proseLines(text).filter((l) => { const ss = sentencesOf(l); return ss.length > 0 && ss.every((s) => OPENS.test(s)); });
(async () => {
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const RC = await import(pathToFileURL(path.join(ROOT, 'lib/route-classify.js')));
  const key = (s) => RC.normalizeArabic(String(s || '').replace(/\[\[\s*[0-9\s،,و]+?\s*\]\]/gu, ' ')).replace(/\s+/gu, ' ').trim();
  const perSentence = (t, notFound = []) => {
    const json = JSON.parse(t.raw.slice(t.raw.indexOf('{'), t.raw.lastIndexOf('}') + 1));
    const items = new Map(json.claims.map((c) => [Number(c.id), notFound.includes(Number(c.id)) ? { id: c.id, verdict: 'not_found' } : c]));
    const idOf = new Map(t.recordedDoor.claims.map((c, i) => [key(c.sentence), i + 1]));
    return async (system, user) => {
      const claims = [];
      for (const [, n, s] of (user.split('\nالجمل:\n')[1] || '').matchAll(/^\((\d+)\) (.*)$/gmu)) {
        const item = items.get(idOf.get(key(s)));
        if (item) claims.push({ ...item, id: Number(n) });
      }
      return JSON.stringify({ claims, khilaf: json.khilaf || { exists: false } });
    };
  };
  const R1to4 = (label, text) => {
    const lines = proseLines(text);
    const abs = absenceLines(text);
    const last = abs.length ? lines.lastIndexOf(abs.at(-1)) : -1;
    const tailOk = last < 0 || lines.slice(last + 1).every((l) => l.startsWith('- ') || /لظهور الخلاف/u.test(l));
    const parts = abs.length ? plain(abs[0]).replace(/^لم\s+[أاإ]قف\s+/u, '').split(/،\s+ولا\s+/u).map(key) : [];
    ok(`R1 ${label}: at most one «لم أقف» line, last, not opening with «و», nothing repeated`,
      abs.length <= 1 && tailOk && !(abs[0] || '').startsWith('و') && new Set(parts).size === parts.length, abs.join(' || '));
    ok(`R4 ${label}: never «هذا الجواب لم يكتمل»`, !/هذا\s+الجواب\s+لم\s+يكتمل/u.test(plain(text)));
  };

  // F4a/F4b — E7 witnesses, the recorded door input through terminalNotFound (as the DIAG replayed them).
  const q14 = RR.terminalNotFound(turn(14).text, [], { question: turn(14).question });
  ok('F4a Q14 «فسأعرضُ ما تسندُه، وأقفُ عند ما لم أقفْ عليه» stays whole', q14.includes('وأقفُ عند ما لم أقفْ عليه') && !/وأقفُ عند ما\s*$/mu.test(q14));
  ok('F4a Q14 the Shafi\'i pillars line keeps its own disclosure, uncut', q14.includes('فلم أقفْ في المادّةِ على تمامِ الركنِ الرابعِ والخامس'));
  R1to4('Q14', q14);
  const q23 = RR.terminalNotFound(turn(23).text, [], { question: turn(23).question });
  ok('F4a Q23 «مع تنبيهٍ في آخرِ الجوابِ على ما لم أقفْ فيه على نصّ» stays whole', q23.includes('على ما لم أقفْ فيه على نصّ'));
  ok('F4a Q23 no «ثامنًا: ما» and no lone «كما» left', !/^ثامنًا: ما\s*$/mu.test(q23) && !/^كما\s*$/mu.test(q23));
  ok('F4b Q23 «من كتبِ المالكيّةِ ولا من كتبِ الحنابلة» keeps its scope in the line', /على نصٍّ من كتبِ المالكيّةِ ولا من كتبِ الحنابلةِ/u.test(absenceLines(q23)[0] || ''), absenceLines(q23)[0]);
  R1to4('Q23', q23);
  const q29 = RR.terminalNotFound(turn(29).text, [], { question: turn(29).question });
  ok('F4a Q29 «الحنابلة:» is never left an empty heading', !/^الحنابلة:\s*$/mu.test(q29) && q29.includes('الحنابلة: لم أقف في النصوصِ المجموعةِ على تمامِ قولِهم'));
  ok('F4a Q29 no bare list marks left', !/^-\s*$/mu.test(q29));
  R1to4('Q29', q29);
  const q37 = RR.terminalNotFound(turn(37).text, [], { question: turn(37).question });
  ok('F4b Q37 no four-school denial; the qualified own-books sentence stays whole in place', !/ولا على نصٍّ للحنفية ولا للمالكية ولا للشافعية ولا للحنابلة/u.test(q37)
    && q37.includes('أمّا الشافعيّةُ فنُقِلَ عنهم من «المجموع شرح المهذّب» للنوويّ مباشرةً'));
  R1to4('Q37', q37);
  const q39 = RR.terminalNotFound(turn(39).text, [], { question: turn(39).question });
  ok('F4a Q39 «مع بيانِ ما لم أقفْ فيه على نصّ» stays whole; the ruling section keeps its explanation', q39.includes('مع بيانِ ما لم أقفْ فيه على نصّ')
    && q39.includes('غير أنّ في نصِّ الكاسانيِّ إشارةً'));
  R1to4('Q39', q39);

  // F4c/F4d — the door witnesses on the sentences 5f0dbec struck.
  const baseStruck = (t) => t.recordedDoor.claims.map((c, i) => (c.replacedBy === '' ? i + 1 : 0)).filter(Boolean);
  for (const q of [2, 11, 26, 27, 28, 32, 38]) {
    const t = turn(q);
    const out = await RR.reviewRulings({ text: t.text, rows: rowsOf(t), ask: perSentence(t, baseStruck(t)), question: t.question });
    const line = RR.terminalNotFound(out.text, [], { question: t.question });
    const abs = absenceLines(line)[0] || '';
    const prose = proseLines(line).filter((l) => l !== abs).join('\n');
    // Unnamed: a part that ENDS on the old wording; a named part goes on «في: «…»».
    const generic = key(abs).split(/ ولا /u).some((p) => /(يسند هذا الحكم بعينه|يسند هذا القول الي قايله|يحكي الاجماع او الاتفاق في هذا|ينسب هذا القول الي الجمهور)$/u.test(p.trim()));
    const schoolsDenied = ['للحنفية', 'للمالكية', 'للشافعية', 'للحنابلة'].filter((w) => abs.includes(w));
    const names = { 'للحنفية': 'الحنفي', 'للمالكية': 'المالكي', 'للشافعية': 'الشافعي', 'للحنابلة': 'الحناب' };
    const negated = schoolsDenied.filter((w) => plain(prose).includes(names[w]));
    ok(`F4c/d Q${q}: no unnamed «هذا الحكم بعينه / في هذا» beside kept sentences; no kept school denied`, !generic && !negated.length, abs);
    R1to4('Q' + q, line);
  }
  console.log('D3B-F4 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
