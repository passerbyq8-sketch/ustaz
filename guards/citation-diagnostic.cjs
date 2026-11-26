'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function citationDiagnostic() {
  const url = pathToFileURL(path.resolve(__dirname, '../lib/bw2-diagnostic.js'));
  const { createBw2Diagnostic } = await import(url.href);
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'preview';
    return createBw2Diagnostic({ headers: { 'x-ezik-diag': '1' } });
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
}

function sawLicence(diagnostic, rule) {
  return diagnostic.capture.units.some(unit => unit.checks.some(check =>
    check.rule === rule && check.result === 'observed' && check.detail.found === false && check.detail.licensedBy.length > 0));
}

module.exports = { citationDiagnostic, sawLicence };
