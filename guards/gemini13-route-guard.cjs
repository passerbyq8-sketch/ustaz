// guards/gemini13-route-guard.cjs — offline routing replay for the 17-row Gemini 1.3 matrix.
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const fixtureArg = process.argv.slice(2).find((arg) => !String(arg).startsWith('--'));
const MATRIX = fixtureArg
  ? path.resolve(process.cwd(), fixtureArg)
  : path.join(ROOT, 'fixtures', 'gemini13-matrix.json');
const REQUIRED_REASON = 'التنفيذ الإلزامي يُقلب true في جولة الدمج بعد هبوط فرع أ';

const esm = (relative) => import(pathToFileURL(path.join(ROOT, relative)).href);

function requireStructure(condition, message) {
  if (!condition) throw new Error(message);
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
  }
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
    try {
      [ROUTE, STORED, ASK_PLAN] = await Promise.all([
        esm('lib/route-classify.js'), esm('lib/stored-deen.js'), esm('lib/ask-plan.js'),
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
    requireStructure(typeof ROUTE.classifyRoute === 'function', 'classifyRoute import missing');
    requireStructure(typeof STORED.classifyReligiousRuntime === 'function',
      'classifyReligiousRuntime import missing');
    requireStructure(typeof ASK_PLAN.planAsk === 'function', 'planAsk import missing');
    requireStructure(wireCalls === 0, `classifier imports attempted ${wireCalls} network call(s)`);

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
      const matches = lexical === row.target.lexical && surface === row.target.surface;
      const state = matches ? 'PASS' : (matrix.enforce ? 'FAIL' : 'WARN');
      if (state === 'PASS') passes += 1;
      else if (state === 'WARN') warnings += 1;
      else failures += 1;
      const measured = `${lexical}/${surface}`.padEnd(25);
      const target = `${row.target.lexical}/${row.target.surface}`.padEnd(25);
      console.log(`${String(row.id).padStart(2, '0')}  ${state.padEnd(5)}  ${measured} ${target} ${row.note} | ${row.question}`);
    }
    console.log(`SUMMARY PASS=${passes} WARN=${warnings} FAIL=${failures} WIRE=${wireCalls}`);
    process.exit(failures ? 1 : 0);
  } catch (error) {
    console.error('FAIL STRUCTURE: ' + (error && error.message ? error.message : error));
    process.exit(1);
  }
})();
