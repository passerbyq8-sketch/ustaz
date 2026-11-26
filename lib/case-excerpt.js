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

// The outline is read by the existing relevance judge. Only a section it selects is added to a citation.
export function sourceSections(row) {
  let text;
  if (row.kind === 'encyclopedia') text = articleText(row.recordId || row.id);
  else text = row.fullText || row.passage || row.text;
  if (typeof text !== 'string' || text.length <= 3500) return [];
  if (row.articleSections?.length) return row.articleSections;
  const starts = [0];
  for (const m of text.matchAll(/^\s*\d{1,4}\s*[-–—]\s+/gmu)) {
    let at = m.index;
    const lastLine = text.slice(Math.max(0, at - 150), at).trimEnd().split('\n').pop()?.trim();
    if (lastLine && lastLine.length <= 95 && /[:\u061b]$/.test(lastLine)) {
      at = text.lastIndexOf(lastLine, at);
    }
    if (at > starts.at(-1) + 30) starts.push(at);
  }
  if (starts.length === 1) {
    // Unnumbered fatwas and book atoms still have stable paragraph or sentence boundaries.
    for (let at = 0; at + 1800 < text.length;) {
      const rest = text.slice(at + 900, at + 1800);
      const boundary = rest.search(/[\n.!?\u061f]/u);
      at += boundary < 0 ? 1800 : 901 + boundary;
      starts.push(at);
    }
  }
  return starts.map((at, n) => {
    const passage = text.slice(at, starts[n + 1] ?? text.length).trim();
    return { heading: passage.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ').slice(0, 130), text: passage };
  });
}

export function sectionMenu(sections) {
  return sections.map((s, i) => 'S' + (i + 1) + ' ' + s.heading.replace(/(?:^|\s)\d{1,4}\s*[-–—]\s+/u, ' ')).join('\n');
}

export function chooseCaseExcerpt(sections, number) {
  if (typeof number === 'string' && /^S?\d+$/.test(number)) number = Number(number.replace(/^S/, ''));
  if (!Number.isInteger(number) || number < 1 || number > sections.length) return '';
  return sections[number - 1].text.slice(0, 12000);
}

export function withCaseExcerpt(previous, selected) {
  if (!selected || previous.includes(selected)) return previous;
  if (!previous || selected.includes(previous)) return selected;
  return selected + '\n\n' + previous;
}
