// Shared mechanics for output-reviewer guards. Mutants live only under os.tmpdir().
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

async function fresh(file, label = 'base') {
  return import(pathToFileURL(file).href + '?' + encodeURIComponent(label) + '=' + Date.now() + '-' + Math.random());
}

async function runMutant({ sourceFile, name, transform, survives }) {
  const original = fs.readFileSync(sourceFile, 'utf8');
  const changed = transform(original);
  if (changed === original) return { changed: false, loaded: false, survived: null, error: 'mutation seam moved' };

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ustaz-output-reviewer-mutant-'));
  const twin = path.join(temp, name.replace(/[^a-z0-9_-]/giu, '_') + '.mjs');
  fs.writeFileSync(twin, changed, 'utf8');
  try {
    const module = await fresh(twin, name);
    return { changed: true, loaded: true, survived: Boolean(await survives(module)), error: null };
  } catch (error) {
    return { changed: true, loaded: false, survived: null, error: error?.stack || String(error) };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function harness(title) {
  let pass = 0;
  let fail = 0;
  const ok = (label, condition, detail = '') => {
    if (condition) { pass++; console.log('  PASS  ' + label); return true; }
    fail++; console.log('  FAIL  ' + label + (detail ? ' | ' + detail : '')); return false;
  };
  const finish = () => {
    console.log(`SUMMARY ${title} PASS=${pass} FAIL=${fail}`);
    return fail === 0 ? 0 : 1;
  };
  return { ok, finish };
}

module.exports = { fresh, runMutant, harness };
