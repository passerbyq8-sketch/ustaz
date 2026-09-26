// D4: terminal repairs to the assistant's prose. Quoted material and cards are opaque.
const MARKS = /[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/u;
const PROTECTED = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|<(hadith|verse|surah|source|book|dhikr|worship|blockquote|quote|pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]*>|«[^»]*»|“[^”]*”|"[^"\n]*"|‘[^’]*’/giu;

export const MISSING_ASKED_HADITH = 'لم أقف على نص الحديث المسؤول عنه كاملا في كتب السنة المسندة، وليس في ذلك نفي لوجوده.';

function foldedMap(text) {
  let folded = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    if (MARKS.test(text[i])) continue;
    map.push(i);
    folded += text[i].replace(/[أإآٱ]/u, 'ا');
  }
  map.push(text.length);
  return { folded, map };
}

function outsideQuoted(text, transform) {
  let out = '', from = 0;
  for (const match of text.matchAll(PROTECTED)) {
    out += transform(text.slice(from, match.index)) + match[0];
    from = match.index + match[0].length;
  }
  return out + transform(text.slice(from));
}

export function protectReaderQuotes(text) {
  const kept = [];
  const masked = String(text ?? '').replace(PROTECTED, value => {
    const id = kept.push(value) - 1;
    return '\uE200' + id + '\uE201';
  });
  return { text: masked, restore: value => value.replace(/\uE200(\d+)\uE201/gu, (_, id) => kept[+id]) };
}

function replaceFolded(text, pattern, replacement = '') {
  const { folded, map } = foldedMap(text);
  for (const m of [...folded.matchAll(pattern)].reverse()) {
    text = text.slice(0, map[m.index]) + replacement + text.slice(map[m.index + m[0].length]);
  }
  return text;
}

const HOLDINGS = '(?:هذه النصوص|النصوص التي بين يدي|ما بين يدي|(?:النصوص|الماده|المادة) (?:المتاحه|المتاحة|المسترجعه|المسترجعة))';
const ADJUNCT = new RegExp('(?:\\s+|^)(?:في|من|ضمن)\\s+' + HOLDINGS + '(?:\\s+(?:لدي|عندي))?(?=[\\s،؛.؟!]|$)', 'gu');

/** Remove retrieval talk without removing the proposition or an honest absence disclosure. */
export function cleanRetrievalProse(text) {
  const source = String(text ?? '');
  return outsideQuoted(source, chunk => {
    let out = replaceFolded(chunk, ADJUNCT);
    // The older W4 cutoff precedes a genuine disclosure: keep the disclosure, not the cutoff.
    out = replaceFolded(out, /[وف]?نص المادة المتاحة انقطع(?: عند هذا الحد)?\s*/gu);
    // Q29: retain the missing madhhab detail, remove only the explanation of the retrieval cutoff.
    out = replaceFolded(out, /(?:فقد\s+)?انقطع النص(?:\s+(?:عندي|لدي))?(?:\s+قبل بيانه)?[،؛]?\s*/gu);
    out = replaceFolded(out, /لم يجمع لي منه نص/gu, 'لم أقف على نص');
    out = replaceFolded(out, /لم يجمع لي نص/gu, 'لم أقف على نص');
    out = replaceFolded(out, /لم يجمع لي(?: منه)?/gu, 'لم أقف على');
    // As a subject, retain "the texts" and its actual predicate, dropping the availability qualifier.
    out = replaceFolded(out, /النصوص التي بين يدي/gu, 'النصوص');
    out = replaceFolded(out, /النصوص المتاحة|النصوص المتاحه/gu, 'النصوص');
    out = replaceFolded(out, /المادة المتاحة|الماده المتاحه/gu, 'المادة');
    if (out === chunk) return chunk;
    // A standalone sentence whose only predicate is a retrieval cutoff has no remaining content.
    out = out.replace(/(^|\n)[ \t]*[وف]?[،؛.][ \t]*(?=\n|$)/gu, '$1');
    return out.replace(/[ \t]{2,}/gu, ' ').replace(/ +([،؛.؟!])/gu, '$1');
  });
}

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const FEMALE = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];
const fold = text => foldedMap(text).folded;
const ordinalPattern = new RegExp('^([ \\t]*(?:#{1,6}\\s*|[-*•]\\s+)?(?:\\*\\*)?(اللفظ|القول|الوجه|الحالة|المسالة)\\s+)('
  + [...ORDINALS, ...FEMALE].map(fold).join('|') + ')(?=[\\s:*،.\\-]|$)', 'gmu');

/** Renumber surviving labelled items after any whole-block deletion, without touching their bodies. */
export function repairOrdinalLabels(text) {
  const source = String(text ?? '');
  const masked = source.replace(PROTECTED, value => value.replace(/[^\n]/g, ' '));
  const { folded, map } = foldedMap(masked);
  const runs = new Map(), edits = [];
  for (const m of folded.matchAll(ordinalPattern)) {
    const female = FEMALE.map(fold).includes(m[3]);
    const labels = female ? FEMALE : ORDINALS;
    const ordinal = labels.map(fold).indexOf(m[3]) + 1;
    let run = runs.get(m[2]);
    if (!run || ordinal <= run.previous) run = { previous: 0, count: 0 };
    run.previous = ordinal;
    run.count++;
    runs.set(m[2], run);
    if (ordinal === run.count) continue;
    const start = m.index + m[1].length;
    edits.push({ start: map[start], end: map[start + m[3].length], text: labels[run.count - 1] });
  }
  let out = source;
  for (const e of edits.reverse()) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** C2f stays a single terminal prose line, ahead of trailing UI cards. */
export function terminalMissingHadith(text) {
  const source = String(text ?? '');
  const visible = source.replace(PROTECTED, value => value.replace(/[^\n]/g, ' '));
  const positions = [];
  for (let at = visible.indexOf(MISSING_ASKED_HADITH); at >= 0; at = visible.indexOf(MISSING_ASKED_HADITH, at + 1)) positions.push(at);
  if (!positions.length) return source;
  let body = source;
  for (const at of positions.reverse()) body = body.slice(0, at) + body.slice(at + MISSING_ASKED_HADITH.length);
  body = body.trim();
  const tail = /(?:\s*<(?:suggestions|source|book)\b[^>]*>[\s\S]*?<\/(?:suggestions|source|book)>)+\s*$/iu.exec(body);
  const at = tail ? tail.index : body.length;
  const head = body.slice(0, at).trimEnd();
  return (head ? head + '\n\n' : '') + MISSING_ASKED_HADITH + (tail ? '\n\n' + body.slice(at).trimStart() : '');
}

export function finishReaderProse(text) {
  return terminalMissingHadith(repairOrdinalLabels(cleanRetrievalProse(text)));
}
