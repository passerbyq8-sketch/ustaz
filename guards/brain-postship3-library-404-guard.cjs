'use strict';
const fs = require('fs');
const html = fs.readFileSync('library.html', 'utf8');
let failures = 0;
let checks = 0;
function ok(name, cond) {
  checks += 1;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures += 1;
  console.log('  FAIL  ' + name);
  return false;
}
ok('book_not_found has an Arabic UI string', /"book_not_found"\s*:\s*\[\s*"\\u[0-9a-f]{4}/i.test(html));
ok('errorView accepts a message key and defaults to load_error',
  /function errorView\(target, retry, messageKey\)\s*\{[\s\S]{0,500}T\(messageKey \|\| 'load_error'\)/.test(html));
ok('book view maps HTTP 404 to book_not_found and other failures to load_error',
  /\.catch\(function \(e\) \{\s*errorView\(stage, function \(\) \{ route\(\); \}, e && e\.status === 404 \? 'book_not_found' : 'load_error'\);\s*\}\);/.test(html));
ok('category list failures keep the generic retryable error view',
  /loadPage\(0\)\.catch\(function \(\) \{ errorView\(list, function \(\) \{ route\(\); \}\); \}\);/.test(html));
console.log('\n' + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
