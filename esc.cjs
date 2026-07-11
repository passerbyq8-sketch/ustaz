// esc.cjs — print index.html lines with every non-ASCII char escaped to \uXXXX.
// WHY: the terminal runs the Unicode bidi algorithm over Arabic inside a source line and
// silently REORDERS the visual position of the string literals themselves — not just their
// letters. A previous report printed a ternary with its two branches swapped, which would
// have caused a catastrophic "fix". \uXXXX output is the ONLY form whose left-to-right
// order equals the true order in the file. Use it for every Arabic-bearing line.
// USAGE: node esc.cjs 3389-3430 2031
'use strict';
const fs = require('fs');
const L = fs.readFileSync('index.html', 'utf8').split(/\r?\n/);
const esc = (s) => s.replace(/[^\x20-\x7E\t]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
for (const arg of process.argv.slice(2)) {
  const [a, b] = arg.split('-').map(Number);
  for (let n = a; n <= (b || a); n++) {
    if (L[n - 1] === undefined) continue;
    console.log(String(n).padStart(5) + ' | ' + esc(L[n - 1]));
  }
}
