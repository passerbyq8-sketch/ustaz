'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.join(__dirname, '..');
const LOOP_FILE = path.join(REPO, 'lib', 'free-brain', 'loop.js');
const ASK_FILE = path.join(REPO, 'api', 'ask.js');

const MAX_LOOP_BYTES = 2 * 1024 * 1024;
const MAX_ASK_BYTES = 2 * 1024 * 1024;
const MAX_LITERAL_MATCHES = 4096;
const MAX_FUNCTION_HEADER_CHARS = 512;
const MAX_BUILD_LESSON_TAG_BODY_CHARS = 8192;
const MAX_READER_SUFFIX_STATEMENT_CHARS = 2048;
const MAX_TAG_EXPRESSION_CHARS = 1024;

function ascii(value) {
  return String(value).replace(/[^\x20-\x7e]/g, '?');
}

function readUtf8Bounded(file, maxBytes) {
  const size = fs.statSync(file).size;
  if (size > maxBytes) {
    throw new Error(path.relative(REPO, file) + ' is ' + size + ' bytes; ceiling=' + maxBytes);
  }
  return fs.readFileSync(file, 'utf8');
}

function lineOf(source, index) {
  const boundedIndex = Math.max(0, Math.min(source.length, Number.isInteger(index) ? index : 0));
  let line = 1;
  for (let i = 0; i < boundedIndex; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function literalIndexes(source, literal) {
  const indexes = [];
  let cursor = 0;
  while (cursor <= source.length - literal.length) {
    const index = source.indexOf(literal, cursor);
    if (index < 0) break;
    if (indexes.length >= MAX_LITERAL_MATCHES) {
      throw new Error('literal match ceiling exceeded for ' + literal);
    }
    indexes.push(index);
    cursor = index + Math.max(1, literal.length);
  }
  return indexes;
}

function maskNonCode(source) {
  const out = source.split('');
  let state = 'code';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        state = 'line-comment';
      } else if (ch === '/' && next === '*') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        state = 'block-comment';
      } else if (ch === "'") {
        out[i] = ' ';
        state = 'single-quote';
      } else if (ch === '"') {
        out[i] = ' ';
        state = 'double-quote';
      } else if (ch === '`') {
        out[i] = ' ';
        state = 'template';
      }
      continue;
    }

    if (state === 'line-comment') {
      if (ch === '\r' || ch === '\n') state = 'code';
      else out[i] = ' ';
      continue;
    }

    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        state = 'code';
      } else if (ch !== '\r' && ch !== '\n') {
        out[i] = ' ';
      }
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      state = 'code';
      continue;
    }
    out[i] = ' ';
    if (ch === '\\') {
      if (i + 1 < source.length && source[i + 1] !== '\r' && source[i + 1] !== '\n') {
        out[i + 1] = ' ';
        i++;
      }
      continue;
    }
    if ((state === 'single-quote' && ch === "'")
      || (state === 'double-quote' && ch === '"')
      || (state === 'template' && ch === '`')) {
      state = 'code';
    }
  }
  return out.join('');
}

function identifierCount(source, identifier) {
  const indexes = literalIndexes(source, identifier);
  return indexes.filter((index) => {
    const before = index > 0 ? source[index - 1] : '';
    const after = index + identifier.length < source.length ? source[index + identifier.length] : '';
    return !/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after);
  }).length;
}

function boundedBody(source, masked, anchor) {
  const anchors = literalIndexes(masked, anchor);
  if (anchors.length !== 1) return { found: false, anchorIndex: anchors[0] ?? 0 };
  const anchorIndex = anchors[0];
  const headerEnd = Math.min(masked.length, anchorIndex + MAX_FUNCTION_HEADER_CHARS);
  const open = masked.indexOf('{', anchorIndex + anchor.length);
  if (open < 0 || open >= headerEnd) return { found: false, anchorIndex };

  const scanEnd = Math.min(masked.length, open + MAX_BUILD_LESSON_TAG_BODY_CHARS);
  let depth = 0;
  for (let i = open; i < scanEnd; i++) {
    if (masked[i] === '{') depth++;
    if (masked[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          found: true,
          anchorIndex,
          start: open,
          end: i + 1,
          raw: source.slice(open, i + 1),
          masked: masked.slice(open, i + 1),
        };
      }
    }
  }
  return { found: false, anchorIndex };
}

function boundedStatement(source, masked, anchor) {
  const anchors = literalIndexes(masked, anchor);
  if (anchors.length !== 1) {
    return { found: false, count: anchors.length, anchorIndex: anchors[0] ?? 0 };
  }
  const anchorIndex = anchors[0];
  const ceiling = Math.min(masked.length, anchorIndex + MAX_READER_SUFFIX_STATEMENT_CHARS);
  const end = masked.indexOf(';', anchorIndex + anchor.length);
  if (end < 0 || end >= ceiling) {
    return { found: false, count: 1, anchorIndex };
  }
  return {
    found: true,
    count: 1,
    anchorIndex,
    raw: source.slice(anchorIndex, end + 1),
    masked: masked.slice(anchorIndex, end + 1),
  };
}

function check(name, pass, line, measured, expected) {
  return { name, pass: Boolean(pass), line, measured, expected };
}

function evaluateAskContract(source) {
  const masked = maskNonCode(source);
  const pageNeedle = 'pickReaderCards(citedSplit.pages,';
  const legacyNeedle = 'pickReaderCards(out.cited';
  const splitNeedle = 'splitCitedLessons(out.cited)';
  const pageHits = literalIndexes(masked, pageNeedle);
  const legacyHits = literalIndexes(masked, legacyNeedle);
  const splitHits = literalIndexes(masked, splitNeedle);
  const fallbackIndex = masked.indexOf('const citedSplit');

  const checks = [];
  checks.push(check(
    'reader-card-page-selection',
    pageHits.length === 1 && legacyHits.length === 0,
    lineOf(source, legacyHits[0] ?? pageHits[0] ?? fallbackIndex),
    'pages_call=' + pageHits.length + ' out_cited_call=' + legacyHits.length,
    'pages_call=1 out_cited_call=0',
  ));

  const ordered = splitHits.length === 1 && pageHits.length === 1 && splitHits[0] < pageHits[0];
  checks.push(check(
    'split-before-page-selection',
    splitHits.length === 1 && ordered,
    lineOf(source, splitHits[0] ?? pageHits[0] ?? fallbackIndex),
    'split_call=' + splitHits.length + ' page_call=' + pageHits.length + ' ordered=' + Number(ordered),
    'split_call=1 page_call=1 ordered=1',
  ));

  const builder = boundedBody(source, masked, 'const buildLessonTag =');
  const gateCalls = builder.found ? literalIndexes(builder.masked, 'buildSourceTag(').length : 0;
  checks.push(check(
    'lesson-builder-url-gate',
    builder.found && gateCalls >= 1,
    lineOf(source, builder.anchorIndex),
    'body_found=' + Number(builder.found) + ' buildSourceTag_call=' + gateCalls,
    'body_found=1 buildSourceTag_call>=1',
  ));

  const suffix = boundedStatement(source, masked, 'finalizerContext.readerSuffix =');
  const encTailCount = suffix.found ? identifierCount(suffix.masked, 'encTail') : 0;
  const lessonSuffixCount = suffix.found ? identifierCount(suffix.masked, 'lessonSuffix') : 0;
  checks.push(check(
    'reader-suffix-composition',
    suffix.count === 1 && suffix.found && encTailCount >= 1 && lessonSuffixCount >= 1,
    lineOf(source, suffix.anchorIndex),
    'assignment=' + suffix.count + ' bounded=' + Number(suffix.found)
      + ' encTail=' + encTailCount + ' lessonSuffix=' + lessonSuffixCount,
    'assignment=1 bounded=1 encTail>=1 lessonSuffix>=1',
  ));

  let tagExpression = '';
  let tagPropertyCount = 0;
  if (builder.found) {
    const tagHits = literalIndexes(builder.masked, 'tag:');
    tagPropertyCount = tagHits.length;
    if (tagHits.length === 1) {
      const tagStart = builder.start + tagHits[0];
      const ceiling = Math.min(source.length, tagStart + MAX_TAG_EXPRESSION_CHARS);
      const tagEnd = masked.indexOf(';', tagStart + 4);
      if (tagEnd >= 0 && tagEnd < ceiling) tagExpression = source.slice(tagStart, tagEnd + 1);
    }
  }
  const openTagCount = tagExpression ? literalIndexes(tagExpression, '<lesson scholar="').length : 0;
  const closeTagCount = tagExpression ? literalIndexes(tagExpression, '</lesson>').length : 0;
  checks.push(check(
    'lesson-tag-shape',
    tagPropertyCount === 1 && openTagCount >= 1 && closeTagCount >= 1,
    lineOf(source, builder.anchorIndex),
    'tag_property=' + tagPropertyCount + ' open=' + openTagCount + ' close=' + closeTagCount,
    'tag_property=1 open>=1 close>=1',
  ));

  return checks;
}

function sameReferences(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((item, index) => item === expected[index]);
}

function runtimeChecks(loop, loopSource) {
  const checks = [];
  const kindLine = lineOf(loopSource, loopSource.indexOf('export const LESSON_KIND'));
  const splitLine = lineOf(loopSource, loopSource.indexOf('export function splitCitedLessons'));
  const pickLine = lineOf(loopSource, loopSource.indexOf('export function pickLessonCards'));

  checks.push(check(
    'lesson-kind-export',
    loop.LESSON_KIND === 'lesson',
    kindLine,
    'value=' + ascii(JSON.stringify(loop.LESSON_KIND)),
    'value="lesson"',
  ));

  const pageA = { id: 'page-a', kind: 'page' };
  const lessonA = { id: 'lesson-a', kind: 'lesson' };
  const pageB = { id: 'page-b', kind: 'other' };
  const lessonB = { id: 'lesson-b', kind: 'lesson' };
  let split;
  try {
    split = typeof loop.splitCitedLessons === 'function'
      ? loop.splitCitedLessons([pageA, lessonA, pageB, lessonB])
      : null;
  } catch (error) {
    split = { error: ascii(error && error.message) };
  }
  const pageOrder = split && sameReferences(split.pages, [pageA, pageB]);
  const lessonOrder = split && sameReferences(split.lessons, [lessonA, lessonB]);
  checks.push(check(
    'split-partition-order',
    pageOrder && lessonOrder,
    splitLine,
    'pages=' + Number(Boolean(pageOrder)) + ' lessons=' + Number(Boolean(lessonOrder)),
    'pages=1 lessons=1',
  ));

  let nonArrayEmpty = typeof loop.splitCitedLessons === 'function';
  if (nonArrayEmpty) {
    for (const input of [null, {}, 'not-an-array']) {
      try {
        const value = loop.splitCitedLessons(input);
        nonArrayEmpty = nonArrayEmpty && Array.isArray(value.pages) && value.pages.length === 0
          && Array.isArray(value.lessons) && value.lessons.length === 0;
      } catch {
        nonArrayEmpty = false;
      }
    }
  }
  checks.push(check(
    'split-non-array-empty',
    nonArrayEmpty,
    splitLine,
    'all_cases_empty=' + Number(Boolean(nonArrayEmpty)),
    'all_cases_empty=1',
  ));

  let capOut = [];
  let capCalls = 0;
  try {
    capOut = typeof loop.pickLessonCards === 'function'
      ? loop.pickLessonCards(
        [{ id: 'a', url: 'u-a' }, { id: 'b', url: 'u-b' }, { id: 'c', url: 'u-c' }],
        2,
        (row) => { capCalls++; return { tag: 'tag-' + row.id }; },
      )
      : [];
  } catch {
    capOut = [];
  }
  const capTags = Array.isArray(capOut) ? capOut.map((item) => item.tag).join(',') : '';
  checks.push(check(
    'lesson-card-cap',
    capTags === 'tag-a,tag-b' && capCalls === 2,
    pickLine,
    'tags=' + ascii(capTags) + ' builder_calls=' + capCalls,
    'tags=tag-a,tag-b builder_calls=2',
  ));

  let dedupeOut = [];
  try {
    dedupeOut = typeof loop.pickLessonCards === 'function'
      ? loop.pickLessonCards(
        [{ url: 'u-a', group: 'same' }, { url: 'u-b', group: 'same' }, { url: 'u-c', group: 'other' }],
        3,
        (row) => ({ tag: row.group }),
      )
      : [];
  } catch {
    dedupeOut = [];
  }
  const dedupeTags = Array.isArray(dedupeOut) ? dedupeOut.map((item) => item.tag).join(',') : '';
  checks.push(check(
    'lesson-card-tag-deduplication',
    dedupeTags === 'same,other',
    pickLine,
    'tags=' + ascii(dedupeTags),
    'tags=same,other',
  ));

  let noUrlOut = [];
  let noUrlCalls = 0;
  try {
    noUrlOut = typeof loop.pickLessonCards === 'function'
      ? loop.pickLessonCards([{ id: 'missing-url' }], 3, () => { noUrlCalls++; return { tag: 'bad' }; })
      : [];
  } catch {
    noUrlOut = [];
  }
  checks.push(check(
    'lesson-card-requires-url',
    Array.isArray(noUrlOut) && noUrlOut.length === 0 && noUrlCalls === 0,
    pickLine,
    'cards=' + (Array.isArray(noUrlOut) ? noUrlOut.length : -1) + ' builder_calls=' + noUrlCalls,
    'cards=0 builder_calls=0',
  ));

  let nullBuilderOut = [];
  try {
    nullBuilderOut = typeof loop.pickLessonCards === 'function'
      ? loop.pickLessonCards([{ id: 'rejected', url: 'u-rejected' }], 3, () => null)
      : [];
  } catch {
    nullBuilderOut = [];
  }
  checks.push(check(
    'lesson-card-rejects-null-builder',
    Array.isArray(nullBuilderOut) && nullBuilderOut.length === 0,
    pickLine,
    'cards=' + (Array.isArray(nullBuilderOut) ? nullBuilderOut.length : -1),
    'cards=0',
  ));

  return checks;
}

function mirrorMutant(source) {
  const masked = maskNonCode(source);
  const call = 'pickReaderCards(citedSplit.pages,';
  const hits = literalIndexes(masked, call);
  if (hits.length !== 1) return { applied: false, source };
  const NEEDLE = 'citedSplit.pages';
  const needleAt = hits[0] + 'pickReaderCards('.length;
  return {
    applied: true,
    source: source.slice(0, needleAt) + 'out.cited' + source.slice(needleAt + NEEDLE.length),
  };
}

function inducedFailureMutant(source) {
  const masked = maskNonCode(source);
  const suffix = boundedStatement(source, masked, 'finalizerContext.readerSuffix =');
  if (!suffix.found) return { applied: false, source };
  const relative = suffix.masked.indexOf('lessonSuffix');
  if (relative < 0) return { applied: false, source };
  const index = suffix.anchorIndex + relative;
  return {
    applied: true,
    source: source.slice(0, index) + 'missingTail' + source.slice(index + 'lessonSuffix'.length),
  };
}

function printFailure(item, prefix = 'FAIL') {
  console.log(prefix + ' contract=' + ascii(item.name)
    + ' line=' + item.line
    + ' measured=' + ascii(JSON.stringify(item.measured))
    + ' expected=' + ascii(JSON.stringify(item.expected)));
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--selftest', '--induced-failure']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  const useSelftest = args.includes('--selftest');
  const useInducedFailure = args.includes('--induced-failure');
  const checks = [];

  if (unknown.length || (useSelftest && useInducedFailure)) {
    checks.push(check(
      'arguments',
      false,
      1,
      'args=' + ascii(args.join(',')),
      'args empty, --selftest, or --induced-failure',
    ));
  }

  const loopSource = readUtf8Bounded(LOOP_FILE, MAX_LOOP_BYTES);
  let askSource = readUtf8Bounded(ASK_FILE, MAX_ASK_BYTES);

  if (useInducedFailure) {
    const mutant = inducedFailureMutant(askSource);
    askSource = mutant.source;
    if (!mutant.applied) {
      checks.push(check(
        'induced-failure-setup',
        false,
        lineOf(askSource, askSource.indexOf('finalizerContext.readerSuffix =')),
        'mutation_applied=0',
        'mutation_applied=1',
      ));
    }
  }

  checks.push(...evaluateAskContract(askSource));

  try {
    const loop = await import(pathToFileURL(LOOP_FILE).href);
    checks.push(...runtimeChecks(loop, loopSource));
  } catch (error) {
    checks.push(check(
      'runtime-import',
      false,
      lineOf(loopSource, loopSource.indexOf('export const LESSON_KIND')),
      'error=' + ascii(error && error.message),
      'ESM import succeeds',
    ));
  }

  let selftestPass = true;
  if (useSelftest) {
    const mutant = mirrorMutant(askSource);
    const mutantChecks = mutant.applied ? evaluateAskContract(mutant.source) : [];
    const failed = mutantChecks.filter((item) => !item.pass);
    const expectedNames = new Set(['reader-card-page-selection', 'split-before-page-selection']);
    selftestPass = mutant.applied
      && failed.length === expectedNames.size
      && failed.every((item) => expectedNames.has(item.name));

    for (const item of failed) printFailure(item, 'SELFTEST_CAUGHT');
    if (!selftestPass) {
      checks.push(check(
        'selftest-mirror',
        false,
        lineOf(askSource, askSource.indexOf('pickReaderCards(citedSplit.pages,')),
        'mutation_applied=' + Number(mutant.applied) + ' caught=' + failed.map((item) => item.name).join(','),
        'reader-card-page-selection and split-before-page-selection rejected',
      ));
    } else {
      checks.push(check('selftest-mirror', true, 1, 'mutant_rejected=1', 'mutant_rejected=1'));
    }
    console.log('SELFTEST=' + (selftestPass ? 'PASS' : 'FAIL'));
  }

  const failures = checks.filter((item) => !item.pass);
  for (const item of failures) printFailure(item);
  console.log('RESULT=' + (failures.length ? 'FAIL' : 'PASS'));
  console.log('CHECKS=' + checks.filter((item) => item.pass).length);
  if (failures.length) {
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.log('FAIL contract=guard-runtime line=1 measured='
    + ascii(JSON.stringify(error && error.message)) + ' expected="guard completes"');
  console.log('RESULT=FAIL');
  console.log('CHECKS=0');
  process.exitCode = 1;
});
