import { openSync, readSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

let archive;
function articleText(id) {
  if (!/^F\d{5}$/.test(id)) return '';
  try {
    archive ??= openSync(new URL('./data/fiqh-articles.bin', import.meta.url), 'r');
    const offsets = Buffer.alloc(8);
    if (readSync(archive, offsets, 0, 8, Number(id.slice(1)) * 4) !== 8) return '';
    const start = offsets.readUInt32LE(0), length = offsets.readUInt32LE(4) - start;
    if (length <= 0 || length > 4_000_000) return '';
    const compressed = Buffer.allocUnsafe(length);
    if (readSync(archive, compressed, 0, length, start) !== length) return '';
    return inflateSync(compressed).toString('utf8');
  } catch { return ''; }
}

// A judge decision selects the source. Locate the passage the judge actually read in the
// authentic text, then widen both sides without scoring sections by question vocabulary.
const WINDOW = 12000;
const fold = value => value.replace(/[\u064b-\u0652\u0670\u0640]/gu, '')
  .replace(/[\u0623\u0625\u0622\u0671]/gu, '\u0627').replace(/\u0629/gu, '\u0647')
  .replace(/\u0649/gu, '\u064a').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function authenticWindow(row, window) {
  const original = row.kind === 'encyclopedia' ? articleText(row.recordId || row.id) : row.fullText;
  if (!original || !window) return '';
  if (original.length <= WINDOW) return original;
  const needle = fold(window).split(/\s+/u);
  const words = [], offsets = [];
  for (const match of original.matchAll(/[^\s]+/gu)) {
    for (const word of fold(match[0]).split(' ').filter(Boolean)) {
      words.push(word);
      offsets.push(match.index);
    }
  }
  const haystack = ' ' + words.join(' ') + ' ';
  // Match verbatim groups only. The retrieval window can contain ellipses or disjoint atoms.
  // Try its middle first, then its edges. An unlocatable passage must keep its original citation.
  for (const at of [Math.floor(needle.length / 2), 0, Math.max(0, needle.length - 9)]) {
    const group = needle.slice(at, at + 9);
    if (group.length < 4) continue;
    const hit = haystack.indexOf(' ' + group.join(' ') + ' ');
    if (hit < 0) continue;
    const index = hit === 0 ? 0 : haystack.slice(1, hit).split(' ').length;
    const start = Math.max(0, Math.min(original.length - WINDOW, offsets[index] - WINDOW / 2));
    const lo = start ? original.indexOf(' ', start) + 1 || start : 0;
    const end = lo + WINDOW;
    const hi = end < original.length ? Math.max(lo, original.lastIndexOf(' ', end)) : original.length;
    return original.slice(lo, hi);
  }
  return '';
}

export function expandKeptSource(candidates, decided) {
  const included = new Set(decided.keep);
  const ordered = [...new Set([...(decided.direct || []), ...decided.keep])];
  for (const n of ordered) {
    const item = candidates[n - 1];
    if (!included.has(n) || !item || item.row.kind !== 'encyclopedia') continue;
    const selected = authenticWindow(item.row, item.window);
    if (!selected) continue;
    item.row.caseExcerpt = selected;
    return;
  }
}

export function withCaseExcerpt(previous, selected) {
  if (!selected || previous.includes(selected)) return previous;
  if (!previous || selected.includes(previous)) return selected;
  return selected + '\n\n' + previous;
}
