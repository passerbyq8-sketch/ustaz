'use strict';
// DEFECT 13 -- the greeting that ended on a vocative particle with nobody after it.
const fs = require('fs');
const P = 'C:/Users/passe/projects/ustaz-fix88/app.jsx';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
function one(find, replace, label) {
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error('anchor ' + label + ' occurs ' + c + ' times');
  s = s.replace(find, replace);
  n += 1;
}

// -- 1. THE WHOLE GREETING, for a reader the app has no name for -------------
// It sits beside home.hello and is written in the same escaped form, because the
// block it joins is ASCII on purpose: «مرحباً بك» -- a complete sentence with no
// vocative in it, not «مرحباً يا» with the name lopped off.
one(
  "    'home.hello': '\\u{0645}\\u{0631}\\u{062D}\\u{0628}\\u{0627}\\u{064B} \\u{064A}\\u{0627}',\n",
  "    'home.hello': '\\u{0645}\\u{0631}\\u{062D}\\u{0628}\\u{0627}\\u{064B} \\u{064A}\\u{0627}',\n"
  + "    'home.helloNoName': '\\u{0645}\\u{0631}\\u{062D}\\u{0628}\\u{0627}\\u{064B} \\u{0628}\\u{0643}',\n",
  'ar-home.hello');

one(
  "    'home.hello': 'Welcome,',\n",
  "    'home.hello': 'Welcome,',\n"
  + "    'home.helloNoName': 'Welcome',\n",
  'en-home.hello');

// -- 2. THE IDENTIFIER, beside its sister and re-bound with it ---------------
one(
  'let EZH_HELLO = ezT("home.hello");                            // "welcome, O"\n',
  'let EZH_HELLO = ezT("home.hello");                            // "welcome, O"\n'
  + '// DEFECT 13 (item 88): the whole greeting, for a reader with no stored name. EZH_HELLO ends\n'
  + '// on a VOCATIVE PARTICLE and is only ever half a sentence: it needs a name after it, and a\n'
  + '// guest has none. Measured on the shelf: the line read «مرحباً يا» and the tail after it was\n'
  + '// empty -- the app addressing somebody and then not saying who. This one stands alone.\n'
  + 'let EZH_HELLO_NO_NAME = ezT("home.helloNoName");              // "welcome" -- no vocative\n',
  'let-EZH_HELLO');

one(
  '    EZH_HELLO = ezT("home.hello");\n',
  '    EZH_HELLO = ezT("home.hello");\n'
  + '    EZH_HELLO_NO_NAME = ezT("home.helloNoName");\n',
  'relabel');

// -- 3. AND THE LINE ITSELF ---------------------------------------------------
one(
  '        <h1 style={s.ezistName}>{EZH_HELLO} {name}</h1>',
  '        {/* DEFECT 13 (item 88): a vocative is never drawn bare. With a name the greeting is\n'
  + '            what it always was, character for character; without one it is the whole-sentence\n'
  + '            key beside it rather than a half sentence with a space where a person should be. */}\n'
  + '        <h1 style={s.ezistName}>{name ? <>{EZH_HELLO} {name}</> : EZH_HELLO_NO_NAME}</h1>',
  'jsx-line');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
