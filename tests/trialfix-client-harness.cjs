// Reuse the existing offline linkedom device harness; never mount or drive a browser.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const file = path.resolve(__dirname, '../guards/sync-client-guard.cjs');
const source = fs.readFileSync(file, 'utf8');
const cut = source.indexOf('\nasync function main()');
if (cut < 0) throw Error('sync harness boundary missing');
const harness = new Module(file, module);
harness.filename = file; harness.paths = Module._nodeModulePaths(path.dirname(file));
harness._compile(source.slice(0, cut) + '\nmodule.exports = { makeDevice, vm };', file);
module.exports = harness.exports;
