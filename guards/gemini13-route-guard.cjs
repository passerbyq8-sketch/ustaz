// guards/gemini13-route-guard.cjs — offline routing replay for the 17-row Gemini 1.3 matrix.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const fixtureArg = process.argv.slice(2).find((arg) => !String(arg).startsWith('--'));
const MATRIX = fixtureArg
  ? path.resolve(process.cwd(), fixtureArg)
  : path.join(ROOT, 'fixtures', 'gemini13-matrix.json');
const REQUIRED_REASON = 'إلزاميّ منذ جولة الدمج الدلاليّة ١٥ أغسطس ٢٠٢٦ بعد هبوط فرعي أ وب';
const SPECIAL_ROWS = Object.freeze([6, 9, 10]);
const ROUTE_SEAL = '320284d9d600a11beb35bbdea52b448412812e056a7fdaddc1eb2f6d505a96b1';
const UNCHANGED_ROWS_SEAL = 'bb4de9e87b78b424d3f29a6fcf2096e0e19f731da1dfdd974f29fbd0465dc606';

const esm = (relative) => import(pathToFileURL(path.join(ROOT, relative)).href);

function requireStructure(condition, message) {
  if (!condition) throw new Error(message);
}

const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function validReviewShape(row) {
  const review = row?.review;
  return row?.note === 'correct-tagged-answer'
    && review && typeof review === 'object' && !Array.isArray(review)
    && typeof review.rawAnswer === 'string' && review.rawAnswer.trim().length > 0
    && review.domain === 'fiqh'
    && typeof review.mode === 'string' && review.mode.length > 0
    && review.expectedAction === 'tagged-fiqh-understanding'
    && Array.isArray(review.expectedContains) && review.expectedContains.length >= 3;
}

function reviewTargetPass(row, reviewer) {
  if (!validReviewShape(row)) return false;
  const result = reviewer.reviewAnswer({
    text: row.review.rawAnswer,
    evidence: [],
    domain: row.review.domain,
    mode: row.review.mode,
  });
  return typeof result.text === 'string' && result.text.trim().length > 0
    && result.annotations.length === 1
    && result.annotations[0].action === row.review.expectedAction
    && row.review.expectedContains.every((needle) => result.text.includes(needle))
    && result.text !== reviewer.REVIEW_LAST_RESORT;
}

function readMatrix() {
  let raw;
  try {
    raw = fs.readFileSync(MATRIX, 'utf8');
  } catch (error) {
    throw new Error(`matrix unreadable: ${error.message}`);
  }
  let matrix;
  try {
    matrix = JSON.parse(raw);
  } catch (error) {
    throw new Error(`matrix JSON invalid: ${error.message}`);
  }
  requireStructure(matrix && typeof matrix === 'object' && !Array.isArray(matrix),
    'matrix root must be an object');
  requireStructure(typeof matrix.enforce === 'boolean', 'matrix.enforce must be boolean');
  requireStructure(matrix.enforceReason === REQUIRED_REASON, 'matrix enforceReason is missing or changed');
  requireStructure(Array.isArray(matrix.rows) && matrix.rows.length === 17,
    'matrix.rows must contain exactly 17 rows');
  for (const [index, row] of matrix.rows.entries()) {
    requireStructure(row && typeof row === 'object' && !Array.isArray(row),
      `row ${index + 1} must be an object`);
    requireStructure(row.id === index + 1, `row id ${row.id} is not sequential at ${index + 1}`);
    requireStructure(typeof row.question === 'string' && row.question.length > 0,
      `row ${row.id} has no question`);
    requireStructure(row.target && typeof row.target === 'object' && !Array.isArray(row.target),
      `row ${row.id} has no target object`);
    requireStructure(['GEN', 'DEEN'].includes(row.target.lexical),
      `row ${row.id} has invalid lexical target`);
    requireStructure(typeof row.target.surface === 'string' && row.target.surface.length > 0,
      `row ${row.id} has invalid surface target`);
    requireStructure(typeof row.note === 'string' && row.note.length > 0,
      `row ${row.id} has no note`);
    if (SPECIAL_ROWS.includes(row.id)) {
      requireStructure(validReviewShape(row), `row ${row.id} has no correct tagged-answer target`);
    } else {
      requireStructure(!Object.hasOwn(row, 'review'), `unchanged row ${row.id} gained a review override`);
    }
  }
  requireStructure(sha256(matrix.rows.map(({ id, question, target }) => ({ id, question, target }))) === ROUTE_SEAL,
    'one of the 17 route rows changed question or target');
  requireStructure(sha256(matrix.rows.filter((row) => !SPECIAL_ROWS.includes(row.id))) === UNCHANGED_ROWS_SEAL,
    'one of the fourteen non-flipped rows changed');
  return matrix;
}

(async () => {
  try {
    const matrix = readMatrix();
    let wireCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      wireCalls += 1;
      throw new Error('gemini13 guard forbids network');
    };
    let ROUTE;
    let STORED;
    let ASK_PLAN;
    let REVIEWER;
    try {
      [ROUTE, STORED, ASK_PLAN, REVIEWER] = await Promise.all([
        esm('lib/route-classify.js'), esm('lib/stored-deen.js'), esm('lib/ask-plan.js'),
        esm('lib/output-reviewer.js'),
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
    requireStructure(typeof ROUTE.classifyRoute === 'function', 'classifyRoute import missing');
    requireStructure(typeof STORED.classifyReligiousRuntime === 'function',
      'classifyReligiousRuntime import missing');
    requireStructure(typeof ASK_PLAN.planAsk === 'function', 'planAsk import missing');
    requireStructure(typeof REVIEWER.reviewAnswer === 'function', 'reviewAnswer import missing');
    requireStructure(wireCalls === 0, `classifier imports attempted ${wireCalls} network call(s)`);

    // RED witness for the pre-directive state: all three rows had only deferred metadata and no
    // output target. The new validator must reject that exact shape before the green replay below.
    const legacyRows = matrix.rows.filter((row) => SPECIAL_ROWS.includes(row.id)).map((row) => {
      const old = { ...row, note: 'deferred-owner-decision' };
      delete old.review;
      return old;
    });
    requireStructure(legacyRows.every((row) => !validReviewShape(row)),
      'legacy deferred rows unexpectedly satisfy the new output contract');
    console.log('FLIP RED: rows 6/9/10 with deferred-owner-decision fail the tagged-answer contract');

    let passes = 0;
    let warnings = 0;
    let failures = 0;
    console.log(`=== gemini13 route matrix — enforce=${matrix.enforce} — offline ===`);
    console.log('ID  STATE  MEASURED                  TARGET                    NOTE  | QUESTION');
    for (const row of matrix.rows) {
      const messages = [{ role: 'user', content: row.question }];
      const lexical = ROUTE.classifyRoute(messages);
      const plan = ASK_PLAN.planAsk(messages, { policyEnabled: true });
      const surface = STORED.classifyReligiousRuntime(row.question, plan, lexical);
      const answerMatches = SPECIAL_ROWS.includes(row.id) ? reviewTargetPass(row, REVIEWER) : true;
      const matches = lexical === row.target.lexical && surface === row.target.surface && answerMatches;
      const state = matches ? 'PASS' : (matrix.enforce ? 'FAIL' : 'WARN');
      if (state === 'PASS') passes += 1;
      else if (state === 'WARN') warnings += 1;
      else failures += 1;
      const measured = `${lexical}/${surface}`.padEnd(25);
      const target = `${row.target.lexical}/${row.target.surface}`.padEnd(25);
      console.log(`${String(row.id).padStart(2, '0')}  ${state.padEnd(5)}  ${measured} ${target} ${row.note} | ${row.question}`);
    }
    const refusalMutants = matrix.rows.filter((row) => SPECIAL_ROWS.includes(row.id)).map((row) => ({
      ...row,
      review: { ...row.review, rawAnswer: 'لم يصلني نصٌّ يجيب عن هذا السؤال.' },
    }));
    requireStructure(refusalMutants.every((row) => !reviewTargetPass(row, REVIEWER)),
      'tagged-answer mutation survived on a flipped row');
    console.log('MUTANT KILLED: rows 6/9/10 cannot return a tagged refusal instead of the correct answer');
    console.log(`SUMMARY PASS=${passes} WARN=${warnings} FAIL=${failures} WIRE=${wireCalls}`);
    process.exit(failures ? 1 : 0);
  } catch (error) {
    console.error('FAIL STRUCTURE: ' + (error && error.message ? error.message : error));
    process.exit(1);
  }
})();
