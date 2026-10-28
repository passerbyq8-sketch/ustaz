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
const A = (hex) => String.fromCodePoint(...hex.trim().split(/\s+/).map((x) => parseInt(x, 16)));
const expected = A('647 630 627 20 627 644 643 62a 627 628 20 63a 64a 631 20 645 648 62c 648 62f 20 641 64a 20 627 644 645 643 62a 628 629 2e');
const rowAt = html.indexOf(String.fromCharCode(34) + 'book_not_found' + String.fromCharCode(34));
const row = rowAt >= 0 ? html.slice(rowAt).split(String.fromCharCode(10), 1)[0] : '';
const bookViewAt = html.indexOf('function viewBook(bookId) {');
const bookViewEnd = html.indexOf('function viewReader(', bookViewAt);
const bookView = bookViewAt >= 0 && bookViewEnd > bookViewAt ? html.slice(bookViewAt, bookViewEnd) : '';
ok('book_not_found is literal UTF-8 Arabic', row.includes(expected) && !row.includes(String.fromCharCode(92) + 'u'));
ok('errorView reads and clears the target key with load_error fallback', html.includes('function errorView(target, retry) {') && html.includes('target.getAttribute(' + String.fromCharCode(39) + 'data-error-key' + String.fromCharCode(39) + ') || ' + String.fromCharCode(39) + 'load_error' + String.fromCharCode(39) + ';') && html.includes('target.removeAttribute(' + String.fromCharCode(39) + 'data-error-key' + String.fromCharCode(39) + ');'));
ok('book details page maps HTTP 404 and calls the retryable renderer', bookView.includes('body.setAttribute(' + String.fromCharCode(39) + 'data-error-key' + String.fromCharCode(39) + ', e && e.status === 404 ? ' + String.fromCharCode(39) + 'book_not_found' + String.fromCharCode(39) + ' : ' + String.fromCharCode(39) + 'load_error' + String.fromCharCode(39) + ');') && bookView.includes('errorView(body, load);'));
ok('reader page maps HTTP 404 and calls the two-argument renderer', html.includes('stage.setAttribute(' + String.fromCharCode(39) + 'data-error-key' + String.fromCharCode(39) + ', e && e.status === 404 ? ' + String.fromCharCode(39) + 'book_not_found' + String.fromCharCode(39) + ' : ' + String.fromCharCode(39) + 'load_error' + String.fromCharCode(39) + ');') && html.includes('errorView(stage, function () { openAt(seq, anchor); });'));
ok('book route maps HTTP 404 and calls the two-argument renderer', html.includes('errorView(stage, function () { route(); });') && html.includes('stage.setAttribute(' + String.fromCharCode(39) + 'data-error-key' + String.fromCharCode(39) + ', e && e.status === 404 ? ' + String.fromCharCode(39) + 'book_not_found' + String.fromCharCode(39) + ' : ' + String.fromCharCode(39) + 'load_error' + String.fromCharCode(39) + ');'));
ok('category list failures keep the generic retryable error view', html.includes('loadPage(0).catch(function () { errorView(list, function () { route(); }); });'));
ok('the old third message-key argument is gone', !html.includes('errorView(stage, function () { route(); }, e &&'));
console.log(String.fromCharCode(10) + (checks - failures) + '/' + checks + ' checks passed');
process.exit(failures ? 1 : 0);
