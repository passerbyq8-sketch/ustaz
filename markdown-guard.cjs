// markdown-guard.cjs — S93, the display-only Markdown gate.
//
// The bubble used to print the model's Markdown characters at the child: **, ##, ---, |. This
// gate proves they became layout, that nothing else moved, and that no reply can put HTML on the
// page. It does it by RENDERING: the text/babel block is extracted from index.html, transformed
// with the page's own pinned Babel major, evaluated in a linkedom window, and the real
// EzikMarkdown component is mounted with ReactDOM — so what is asserted is the DOM a child sees.
//
// Four parts:
//   A. THE SYMBOLS  — the ones in the report: **bold**, ## headings, ---, | tables, and lists.
//                     Each must produce an element and must NOT leave its markers in the text.
//   B. STREAMING    — the half-written tail of a live reply: an unclosed **, a table whose
//                     delimiter row has not arrived, a fence still open, a lone #. Nothing may be
//                     swallowed, nothing may crash, and every character must still be readable.
//   C. HOSTILE HTML — a reply carrying <script>, an <img onerror>, an <iframe>, a javascript:
//                     URL. None may become an element or an attribute; all stay text.
//   D. THE WIRING   — read off index.html: no dangerouslySetInnerHTML anywhere, the renderer is
//                     applied to prose ONLY (after the cards are separated), and the raw text is
//                     still what the clipboard, the voice and the store receive.
//
// Usage: node markdown-guard.cjs [htmlFile]   (default: index.html)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const { parseHTML } = require('linkedom');

const htmlFile = process.argv[2] || 'index.html';
const html = fs.readFileSync(htmlFile, 'utf8');

let failures = 0;
let checks = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) { console.log('  PASS  ' + name); return true; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return ok(name, a === e, 'expected ' + e + '\n        actual   ' + a);
}

function markdownModuleSlice(source) {
  const start = source.indexOf('function ezMdInline(');
  const end = source.indexOf('function ezikRenderSegments(', start);
  return {
    start,
    end,
    code: start !== -1 && end > start ? source.slice(start, end) : '',
  };
}

// ---------------------------------------------------------------------------
// Extract + transform, exactly as runtime-gate does (same pinned-major rule).
// ---------------------------------------------------------------------------
const openRe = /<script[^>]*type=["']text\/babel["'][^>]*>/i;
const m = openRe.exec(html);
if (!m) { console.error('No text/babel script block found in ' + htmlFile); process.exit(2); }
const rawCode = html.slice(m.index + m[0].length, html.indexOf('</script>', m.index + m[0].length));

const babelSrc = (html.match(/<script[^>]*src=["']([^"']*@babel\/standalone[^"']*)["']/i) || [])[1] || '';
const verMatch = babelSrc.match(/@babel\/standalone@(\d+)\./);
const jsxRuntime = (verMatch ? parseInt(verMatch[1], 10) : 8) >= 8 ? 'automatic' : 'classic';

let transformed;
try {
  transformed = babel.transformSync(rawCode, {
    presets: [['@babel/preset-react', { runtime: jsxRuntime }]],
    filename: 'babel-block.jsx',
    sourceType: 'script',
    retainLines: true,
  }).code;
} catch (e) {
  console.log('TRANSFORM ERROR (should have been caught by babel-gate):\n' + e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// One window, one React, one mount point for the component under test. The app
// itself is not mounted (its root is stubbed) — this gate is about one renderer.
// ---------------------------------------------------------------------------
const { window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div><div id="md"></div></body></html>');
window.self = window.self || window;
window.window = window.window || window;
window.globalThis = window.globalThis || window;
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
};
window.scrollTo = window.scrollTo || function () {};
const EP = window.Element && window.Element.prototype;
if (EP && !EP.scrollIntoView) EP.scrollIntoView = function () {};
{
  const store = {};
  window.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}
global.navigator = window.navigator;
global.window = window;
global.document = window.document;

const ctx = vm.createContext(window);
const loadUMD = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8'), ctx, { filename: f });
loadUMD('react.umd.js');
loadUMD('react-dom.umd.js');
if (!window.React || !window.ReactDOM) { console.log('FAIL: React/ReactDOM globals did not load.'); process.exit(1); }
const realCreateRoot = window.ReactDOM.createRoot;
vm.runInContext('ReactDOM.createRoot = function () { return { render: function () {}, unmount: function () {} }; };', ctx);
try {
  vm.runInContext(transformed, ctx, { filename: 'babel-block.jsx' });
} catch (e) {
  console.log('RUNTIME ERROR evaluating the app block:\n' + String(e && e.stack ? e.stack : e));
  process.exit(1);
}
window.ReactDOM.createRoot = realCreateRoot;

// Reach the shipped component and helpers through the context's global lexical scope.
const api = vm.runInContext(
  '({ Markdown: EzikMarkdown, blocks: ezMdBlocks, inline: ezMdInline,' +
  '   parseRich: parseRichMessage, streamPreview: formatForStreamPreview, serialize: serializeReply })',
  ctx, { filename: 'markdown-guard-api' });

// RENDER IT FOR REAL. flushSync so the DOM is settled the moment render() returns — every
// assertion below reads the actual tree, never a description of it.
const host = window.document.getElementById('md');
const mdRoot = window.ReactDOM.createRoot(host);
function render(text) {
  vm.runInContext('(function (el) { ReactDOM.flushSync(function () { el.__r.render(React.createElement(el.__c, { text: el.__t })); }); })', ctx)
    (Object.assign(host, { __r: mdRoot, __c: api.Markdown, __t: text }));
  return host;
}
const tags = () => Array.prototype.slice.call(host.querySelectorAll('*')).map((n) => String(n.localName || '').toLowerCase());
const textOf = () => String(host.textContent || '');
const first = (sel) => host.querySelector(sel);

// ===========================================================================
// PART A — the symbols from the report
// ===========================================================================
console.log('\n=== A. THE SYMBOLS (rendered, then read back out of the DOM) ===');

// The whole reply shape the screenshots showed, in one go.
const REPORTED = [
  '## آدابُ طلبِ العلم',
  '',
  'طلبُ العلمِ **فريضةٌ** على كلِّ مسلم، وأوّلُ ذلك *الإخلاص*.',
  '',
  '### الآداب',
  '',
  '- إخلاصُ النيّة لله',
  '- الصبرُ على المُعلِّم',
  '- العملُ بما تعلَّمت',
  '',
  '1. اسأل عمّا لا تعرف',
  '2. راجعْ ما تعلَّمت',
  '',
  '---',
  '',
  '| الأدب | الدليل |',
  '| --- | --- |',
  '| الإخلاص | حديثُ النيّة |',
  '| الصبر | قصّةُ موسى والخضر |',
].join('\n');

render(REPORTED);
{
  const t = textOf();
  const el = tags();
  ok('a ## heading becomes a heading element', el.indexOf('div') !== -1 && !!first('[role="heading"]'));
  eq('...at the level the hashes asked for', first('[role="heading"]').getAttribute('aria-level'), '2');
  ok('...and a ### heading is level 3',
    Array.prototype.slice.call(host.querySelectorAll('[role="heading"]')).some((n) => n.getAttribute('aria-level') === '3'));
  ok('**bold** becomes <strong>', el.indexOf('strong') !== -1);
  eq('...carrying the words and NOT the asterisks', first('strong').textContent, 'فريضةٌ');
  ok('*italic* becomes <em>', el.indexOf('em') !== -1);
  eq('...carrying the word and NOT the asterisks', first('em').textContent, 'الإخلاص');
  ok('- items become a <ul> of <li>', el.indexOf('ul') !== -1 && host.querySelectorAll('ul li').length === 3);
  eq('...with the bullet character gone', host.querySelectorAll('ul li')[1].textContent, 'الصبرُ على المُعلِّم');
  ok('1. items become an <ol> of <li>', el.indexOf('ol') !== -1 && host.querySelectorAll('ol li').length === 2);
  eq('...with the numbering left to the list', host.querySelectorAll('ol li')[0].textContent, 'اسأل عمّا لا تعرف');
  ok('--- becomes an <hr>', el.indexOf('hr') !== -1);
  ok('a | table becomes a <table>', el.indexOf('table') !== -1);
  eq('...with the header row in <th>',
    Array.prototype.slice.call(host.querySelectorAll('th')).map((n) => n.textContent), ['الأدب', 'الدليل']);
  eq('...and the body rows in <td>',
    Array.prototype.slice.call(host.querySelectorAll('tbody tr')).map((r) =>
      Array.prototype.slice.call(r.querySelectorAll('td')).map((c) => c.textContent)),
    [['الإخلاص', 'حديثُ النيّة'], ['الصبر', 'قصّةُ موسى والخضر']]);

  // THE POINT OF THE WHOLE CHANGE: none of the markers survive as visible text.
  ok('no ** is left on screen', t.indexOf('**') === -1, t);
  ok('no ## is left on screen', t.indexOf('##') === -1, t);
  ok('no --- is left on screen', t.indexOf('---') === -1, t);
  ok('no | is left on screen', t.indexOf('|') === -1, t);
  ok('no leading "- " bullet is left on screen', t.indexOf('- ') === -1, t);
  // ...and nothing the child was meant to read went missing with them.
  ['آدابُ طلبِ العلم', 'فريضةٌ', 'الإخلاص', 'الصبرُ على المُعلِّم', 'راجعْ ما تعلَّمت', 'قصّةُ موسى والخضر']
    .forEach((w) => ok('the words survive: ' + w, t.indexOf(w) !== -1));
}

// The smaller rules, one at a time.
render('نصٌّ فيه `شيفرة` سطريّة و~~محذوف~~ و__عريض__.');
{
  eq('`code` becomes <code>', first('code').textContent, 'شيفرة');
  eq('~~strike~~ becomes <del>', first('del').textContent, 'محذوف');
  eq('__bold__ becomes <strong>', first('strong').textContent, 'عريض');
  ok('...and none of their markers is left', !/[`~_]/.test(textOf()), textOf());
}
render('اكتب `**هذا**` كما هو');
{
  eq('a code span is LITERAL — nothing inside it is a rule', first('code').textContent, '**هذا**');
  ok('...so no element is created inside it', first('code').querySelectorAll('*').length === 0);
  ok('...and the code span is still styled as code', !!first('code').style.background);
}
render('```\nconst x = 1;\n```');
{
  ok('a fenced block becomes <pre><code>', tags().indexOf('pre') !== -1 && tags().indexOf('code') !== -1);
  eq('...with its body literal', first('pre').textContent, 'const x = 1;');
  ok('...and no backticks on screen', textOf().indexOf('`') === -1);
}
render('> اقتباسٌ من كلام أهل العلم');
ok('a > line becomes a quote block, without its marker',
  textOf().indexOf('>') === -1 && textOf().indexOf('اقتباسٌ من كلام أهل العلم') !== -1, textOf());
render('| ط | د |\n| :-- | --: |\n| ١ | ٢ |');
// Logical alignment: the page is RTL, so a leading colon means "starts at the reading edge".
eq('a table\'s alignment row is honoured, not printed',
  [first('th').style.textAlign, host.querySelectorAll('th')[1].style.textAlign], ['start', 'end']);
eq('...and an undecorated column starts where the language does',
  (render('| أ | ب |\n| --- | --- |\n| ١ | ٢ |'), first('th').style.textAlign), 'start');
render('سطرٌ أوّل\nسطرٌ ثانٍ');
ok('a single newline inside a paragraph stays a line break', tags().indexOf('br') !== -1);
render('نجمة * وحدها لا تعني شيئاً');
ok('a lone asterisk is left alone', textOf().indexOf('*') !== -1 && tags().indexOf('em') === -1, textOf());
render('٥ * ٣ = ١٥ و٢ * ٤ = ٨');
ok('...even when two of them appear in one line', tags().indexOf('em') === -1, textOf());

// ===========================================================================
// PART B — a reply that is still streaming
// ===========================================================================
console.log('\n=== B. STREAMING (the tail is always half-written) ===');
{
  // Every prefix of the reported reply must render without throwing and without losing a word.
  let worst = null;
  for (let n = 1; n <= REPORTED.length; n++) {
    const partial = REPORTED.slice(0, n);
    try { render(partial); } catch (e) { worst = { n: n, e: e }; break; }
  }
  ok('every one of the ' + REPORTED.length + ' prefixes of a streaming reply renders without throwing',
    !worst, worst ? 'broke at character ' + worst.n + ': ' + worst.e.message : '');

  render('العنوانُ **غيرُ مكتمل');
  ok('an unclosed ** stays literal instead of swallowing the rest',
    textOf().indexOf('**غيرُ مكتمل') !== -1 && tags().indexOf('strong') === -1, textOf());
  render('نصٌّ `شيفرةٌ لم تُغلق');
  ok('an unclosed ` stays literal', textOf().indexOf('`') !== -1 && tags().indexOf('code') === -1, textOf());
  render('| الأدب | الدليل |');
  ok('a table header with no delimiter row yet is NOT a table',
    tags().indexOf('table') === -1 && textOf().indexOf('الدليل') !== -1, textOf());
  render('| الأدب | الدليل |\n| --');
  ok('...nor is it one while the delimiter row is half-typed', tags().indexOf('table') === -1, textOf());
  render('| الأدب | الدليل |\n| --- | --- |');
  ok('...and it becomes one the moment that row lands', tags().indexOf('table') !== -1);
  eq('...with a header and no body rows yet', host.querySelectorAll('tbody tr').length, 0);
  render('#');
  ok('a bare # is not a heading', !first('[role="heading"]') && textOf().indexOf('#') !== -1);
  render('## ');
  ok('a heading with no text yet renders nothing rather than an empty heading', !first('[role="heading"]'));
  render('```\nconst x = 1;');
  ok('an unclosed fence still shows what has arrived', first('pre') && first('pre').textContent.indexOf('const x = 1;') !== -1);
  render('');
  eq('an empty stream renders nothing at all', host.childNodes.length, 0);
  render('   \n  \n');
  eq('...and so does whitespace', host.childNodes.length, 0);

  // The live preview keeps the newlines the layout is built from — it used to flatten them.
  const preview = api.streamPreview('## عنوان\n\n- أوّل\n- ثانٍ');
  ok('the stream preview no longer flattens newlines away', preview.indexOf('\n') !== -1, JSON.stringify(preview));
  render(preview);
  ok('...so a streaming heading and list are already laid out',
    !!first('[role="heading"]') && host.querySelectorAll('li').length === 2);
  ok('the preview still hides the app\'s own tags',
    api.streamPreview('نص <verse surah="البقرة" ayah="1">شيء</verse> بعده').indexOf('<verse') === -1);
}

// ===========================================================================
// PART C — a hostile reply
// ===========================================================================
console.log('\n=== C. HOSTILE HTML (none of it may become an element) ===');
{
  const nasty = [
    '<script>window.__pwned = 1;</script>',
    '<img src=x onerror="window.__pwned = 2">',
    '<iframe src="https://evil.example"></iframe>',
    '<a href="javascript:window.__pwned=3">اضغط</a>',
    '<div style="position:fixed;inset:0">تغطية</div>',
    '**<b>عريضٌ داخلَ وسم</b>**',
    '<svg onload="window.__pwned=4"></svg>',
    '| <script>a</script> | ب |',
    '| --- | --- |',
    '| <img src=x onerror=alert(1)> | د |',
  ].join('\n');
  render(nasty);
  const el = tags();
  ['script', 'img', 'iframe', 'a', 'svg', 'b'].forEach((bad) => {
    ok('no <' + bad + '> element is created from the reply', el.indexOf(bad) === -1, JSON.stringify(el));
  });
  eq('nothing in the reply executed', vm.runInContext('typeof window.__pwned', ctx), 'undefined');
  ok('the markup is shown as the literal text it is',
    textOf().indexOf('<script>') !== -1 && textOf().indexOf('onerror') !== -1, textOf());
  ok('...including inside a table cell', host.querySelectorAll('td')[0].textContent.indexOf('<img') !== -1);
  ok('...and the bold around a tag still formats, with the tag still text',
    Array.prototype.slice.call(host.querySelectorAll('strong')).some((n) => n.textContent.indexOf('<b>') !== -1));
  // No element anywhere may carry an event handler or a javascript: URL.
  const attrs = [];
  Array.prototype.slice.call(host.querySelectorAll('*')).forEach((n) => {
    const na = n.attributes || [];
    for (let i = 0; i < na.length; i++) attrs.push(String(na[i].name).toLowerCase() + '=' + String(na[i].value));
  });
  ok('no on* handler attribute exists in the rendered tree', !attrs.some((a) => /^on[a-z]+=/.test(a)), JSON.stringify(attrs));
  ok('no javascript: URL exists in the rendered tree', !attrs.some((a) => /javascript:/i.test(a)), JSON.stringify(attrs));
  ok('no href or src attribute is emitted at all', !attrs.some((a) => /^(href|src)=/.test(a)), JSON.stringify(attrs));
}

// ===========================================================================
// PART D — the wiring, read off index.html
// ===========================================================================
console.log('\n=== D. THE WIRING (index.html) ===');
{
  const countIn = (hay, needle) => (hay.split(needle).length - 1);

  // THE NEW RENDERER PUTS NO HTML ON THE PAGE. Asserted against the module itself, so the claim
  // is about the code that was written rather than about the file as a whole.
  const markdownUnit = markdownModuleSlice(html);
  ok('the Markdown module is bounded by its stable declarations',
    markdownUnit.start !== -1 && markdownUnit.end > markdownUnit.start);
  const mod = markdownUnit.code;
  const fixtureBody = [
    'function ezMdInline(text) { return React.createElement("span", null, text); }',
    'const EzikMarkdown = React.memo(function EzikMarkdown({ text }) { return ezMdInline(text); });',
  ].join('\n');
  const fixtureBefore = '/* S93 old unrelated marker */\nconst outside = { innerHTML: "not the module" };\n';
  const fixtureAfter = '\nfunction ezikRenderSegments() {}\ndocument.write("outside");';
  const renamedCommentFixture = fixtureBefore.replace('S93 old unrelated marker', 'renamed comment')
    + fixtureBody + fixtureAfter;
  const oldCommentFixture = fixtureBefore + fixtureBody + fixtureAfter;
  eq('renaming the nearby comment does not change the structural Markdown unit',
    markdownModuleSlice(renamedCommentFixture).code,
    markdownModuleSlice(oldCommentFixture).code);
  eq('the structural unit excludes code before and after its declarations',
    markdownModuleSlice(renamedCommentFixture).code,
    fixtureBody + '\n');
  // Counted as USES, not as mentions: the module documents in prose that it does none of this,
  // and a bare substring count would have found its own comment and called it a violation.
  const uses = (hay, re) => (hay.match(re) || []).length;
  const DSI = /dangerouslySetInnerHTML\s*=\s*\{/g;
  const IHW = /\.\s*innerHTML\s*=/g;
  const IAH = /\.\s*insertAdjacentHTML\s*\(/g;
  eq('the Markdown module never USES dangerouslySetInnerHTML', uses(mod, DSI), 0);
  eq('...never writes innerHTML', uses(mod, IHW), 0);
  eq('...never calls insertAdjacentHTML', uses(mod, IAH), 0);
  eq('...and never calls document.write', uses(mod, /document\s*\.\s*write\s*\(/g), 0);
  ok('...it builds React elements and nothing else',
    /React\.createElement/.test(mod) && !/new Function|eval\(/.test(mod));

  // AND THE PAGE'S PRE-EXISTING HTML PATHS DID NOT GROW. There is exactly one
  // dangerouslySetInnerHTML in the page and it is NOT the prose path: it is the <document> CARD,
  // which has always rendered through docToHtml, whose every interpolation goes through
  // escapeHtml first (inlineFmt). This gate pins the count so a future prose change cannot
  // quietly route a reply into it, and pins the escaping so that card cannot start trusting HTML.
  eq('the page still has exactly one dangerouslySetInnerHTML (the pre-existing document card)',
    uses(html, DSI), 1);
  ok('...and it is the document card, not the prose bubble',
    /className="doc-rendered"[^>]*dangerouslySetInnerHTML=\{\{ __html: docToHtml\(content\) \}\}/.test(html));
  ok('...whose inline formatter still escapes before it builds any tag',
    /const inlineFmt = \(s\) => escapeHtml\(s\)\.replace\(/.test(html));
  // Three writes on two lines: the export fills #print-area, then clears it on both settle paths.
  eq('the only innerHTML writes are the three in the PDF export area', uses(html, IHW), 3);
  ok('...and all three are in that export, not in any message path',
    html.split(/\r?\n/).filter((l) => IHW.test(l) || /\.\s*innerHTML\s*=/.test(l))
      .every((l) => /print-area|area\.innerHTML/.test(l)));
  eq('...and there is still no insertAdjacentHTML anywhere', uses(html, IAH), 0);

  // APPLIED TO PROSE ONLY — after parseRichMessage has lifted every card out.
  ok('the renderer is applied to the text segment',
    /seg\.type === 'text'[\s\S]{0,900}?<EzikMarkdown text=\{tashkeel \? seg\.content : stripTashkeelOutsideQuran\(seg\.content\)\} \/>/.test(html));
  ok('...and to the live stream preview',
    /<EzikMarkdown text=\{formatForStreamPreview\(streamingText\)\} \/>/.test(html));
  eq('...and to NOTHING else — two display sites, no more', countIn(html, '<EzikMarkdown'), 2);
  // S97: the split is now MEMOISED (a keystroke used to re-parse every bubble in the thread), so
  // this pins the memoised form. It asserts strictly more than the bare call it replaced: the
  // split is still parseRichMessage's, still on (message.content, age) -- and the dependency list
  // is exactly those inputs, which is the condition that makes caching the descriptors sound. A
  // dep quietly dropped here would freeze a card's content, and this check is what would catch it.
  ok('the cards are separated BEFORE it runs (parseRichMessage still owns the split)',
    /const \{ segments, suggestions \} = React\.useMemo\(\s*\(\) => \(isUser \? \{ segments: \[\], suggestions: \[\] \} : parseRichMessage\(message\.content, age\)\),\s*\[isUser, message\.content, age\]\);/.test(html));
  ['VerseCard', 'SurahCard', 'HadithCard', 'SourceCard', 'DhikrCard', 'WorshipCard', 'StepsCard', 'BoardCard', 'DocumentCard']
    .forEach((card) => ok('the ' + card + ' body is not passed through the renderer',
      !new RegExp('<' + card + '[^>]*EzikMarkdown').test(html)));

  // THE RAW TEXT IS STILL THE RECORD.
  ok('the clipboard still serialises the RAW segments',
    /const buildCopyText = \(\) => serializeReply\(segments, /.test(html));
  ok('the copy button is still handed the raw reply',
    /<CopyReplyButton text=\{String\(message\.content \|\| ''\)\.trim\(\)\}/.test(html));
  ok('the voice is still handed the raw reply',
    /<MessageListenButton text=\{message\.content\}/.test(html));
  ok('the store still writes the raw messages array', /const cid = ezikSaveChat\(chatIdRef\.current, msgs,/.test(html));
  ok('the user\'s own bubble is NOT markdown-rendered',
    !/userBubble[\s\S]{0,200}?EzikMarkdown/.test(html));

  // THE THEME IS UNTOUCHED.
  // S95: counted per BLOCK rather than as a flat total of 24. The dark palette moved from
  // `.theme-dark` to `:root` and the mushaf sheet now opts back out through a scoped
  // re-declaration, so a single total no longer distinguishes "a variable was dropped" from
  // "a block was added". Per-block is what this check always meant.
  const THEME_NAMES = /--(?:red|ink|muted|line|tint|white|page|black|on-accent|accent-fill|red-deep|red-soft)\s*:/g;
  const themeCss = html.slice(html.indexOf('<style>'), html.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const blockMax = (re) => {
    let n = null;
    for (const m of themeCss.matchAll(re)) n = Math.max(n == null ? 0 : n, (m[1].match(THEME_NAMES) || []).length);
    return n;
  };
  eq('the light palette still declares all twelve theme names', blockMax(/:root\s*\{([^}]*)\}/g), 12);
  eq('...and so does the document-level dark palette', blockMax(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/g), 12);
  ok('every Markdown style uses existing variables — no literal colour',
    !/\bmd[A-Z][A-Za-z0-9]*: \{[^}]*(?:#[0-9a-fA-F]{3}|rgb\()/.test(html));
}

// ===========================================================================
// The record is unchanged: the same reply, parsed the same way, serialises the
// same. This is the "content did not change" assertion, made against the code.
// ===========================================================================
{
  console.log('\n=== E. THE ANSWER ITSELF IS UNCHANGED ===');
  const reply = '## عنوان\n\nنصٌّ **مهمّ**.\n\n<source site="binbaz" url="https://binbaz.org.sa/x">عنوان المصدر</source>\n\nخاتمة.';
  const parsed = api.parseRich(reply, 30);
  const kinds = parsed.segments.map((sg) => sg.type);
  eq('the cards are still split out of the reply, untouched by any of this', kinds, ['text', 'source', 'text']);
  ok('the prose segment still carries its RAW Markdown, markers and all',
    parsed.segments[0].content.indexOf('## عنوان') !== -1 && parsed.segments[0].content.indexOf('**مهمّ**') !== -1,
    parsed.segments[0].content);
  ok('the source card\'s own body is untouched by the renderer', parsed.segments[1].content === 'عنوان المصدر');
  const copied = api.serialize(parsed.segments, { tashkeel: true, band: 'adult' });
  ok('the clipboard still receives the raw Markdown, not the rendered shape',
    copied.indexOf('## عنوان') !== -1 && copied.indexOf('**مهمّ**') !== -1, copied);
  // And an OLD saved conversation formats, because formatting is computed at display from text
  // that was never rewritten — the stored string and the fresh string are the same string.
  render(parsed.segments[0].content);
  ok('a conversation saved before this change renders formatted when reopened',
    !!first('[role="heading"]') && !!first('strong') && textOf().indexOf('**') === -1, textOf());
}

// ===========================================================================
// F — XI-04: the review mark is a badge, and the clipboard has no brackets.
// ===========================================================================
// MEASURED on 17 August: in 10 browser rounds of 10 the final sheet carried «【فهم لا فتوى】 ما
// تقدم فهم…» as raw characters in the prose, one round carried a second mark INSIDE a paragraph,
// and the copy button put the 【】 brackets on the clipboard verbatim. Every ANGLE-bracket tag was
// drawn as a card in the same ten rounds; this was the one mark with no renderer, so it fell
// through as text. Asserted here because this is the file that renders a reply for real and reads
// the DOM back — a text scan over index.html could not tell a badge from a paragraph.
{
  console.log('\n=== F. THE REVIEW MARK IS DRAWN, NOT PRINTED (XI-04) ===');
  const OPEN = '【';
  const CLOSE = '】';
  const BRACKETS = /[【】]/u;
  // Both shapes lib/output-reviewer.js produces: the notice that OPENS its own line, and the
  // per-sentence mark that CLOSES a line of prose.
  const NOTICE = OPEN + 'فهمٌ لا فتوى' + CLOSE + ' ما تقدّم فهمٌ مبنيٌّ على ما بين يديّ في هذه الدورة.';
  const MARKED = 'وكذا الكبد والطحال لا تنقض عند الشيخ. ' + OPEN + 'فهمٌ لا نصٌّ منقول' + CLOSE;
  const reply = MARKED + '\n\n' + NOTICE
    + '\n\n<source site="binbaz.org.sa" url="https://binbaz.org.sa/x">فتوى</source>';
  const parsed = api.parseRich(reply, 30);
  const kinds = parsed.segments.map((sg) => sg.type);
  eq('the mark is lifted into its own segment beside the cards', kinds,
    ['text', 'notice', 'notice', 'source']);
  ok('no prose segment still carries a bracket',
    !parsed.segments.some((sg) => sg.type === 'text' && BRACKETS.test(sg.content)),
    JSON.stringify(parsed.segments.filter((sg) => sg.type === 'text').map((sg) => sg.content)));
  ok('the prose that carried the closing mark is delivered whole',
    parsed.segments[0].content.indexOf('وكذا الكبد والطحال لا تنقض عند الشيخ.') === 0,
    parsed.segments[0].content);
  ok('a mark that OPENS its line takes the server sentence with it',
    parsed.segments[2].label === 'فهمٌ لا فتوى'
      && parsed.segments[2].content.indexOf('ما تقدّم') === 0,
    JSON.stringify(parsed.segments[2]));
  ok('a mark that CLOSES a line takes no body from the prose around it',
    parsed.segments[1].content === '', JSON.stringify(parsed.segments[1]));

  const copied = api.serialize(parsed.segments, { tashkeel: true, band: 'adult' });
  ok('THE CLIPBOARD CARRIES NO BRACKET', !BRACKETS.test(copied), copied);
  ok('...and still carries what the mark said',
    copied.indexOf('فهمٌ لا فتوى') !== -1 && copied.indexOf('فهمٌ لا نصٌّ منقول') !== -1, copied);

  // RENDER THE WHOLE REPLY and read the tree, which is the only thing that can tell a badge from
  // a paragraph. `render()` above mounts one Markdown component; this mounts the segment list.
  const segHost = window.document.getElementById('md');
  vm.runInContext(
    '(function (host, text) {'
    + '  var p = parseRichMessage(text, 30);'
    + '  ReactDOM.flushSync(function () {'
    + '    host.__r.render(React.createElement(React.Fragment, null,'
    + '      ezikRenderSegments(p.segments, { tashkeel: true, age: 30 })));'
    + '  });'
    + '})', ctx, { filename: 'markdown-guard-segments' })(
    Object.assign(segHost, { __r: mdRoot }), reply);
  const shown = String(segHost.textContent || '');
  ok('RENDERED: no ornate bracket reaches the screen', !BRACKETS.test(shown), shown.slice(0, 240));
  ok('RENDERED: the mark is announced as a note, not as more of the answer',
    !!segHost.querySelector('[role="note"]'), segHost.innerHTML.slice(0, 300));
  ok('RENDERED: what the mark said is still on the screen',
    shown.indexOf('فهمٌ لا فتوى') !== -1, shown.slice(0, 240));
  ok('RENDERED: the answer prose and the source chip are untouched',
    shown.indexOf('لا تنقض عند الشيخ') !== -1 && shown.indexOf('binbaz.org.sa') !== -1,
    shown.slice(0, 320));
}

console.log('\n' + (failures ? 'FAIL' : 'OK') + ': ' + (checks - failures) + '/' + checks + ' checks passed.');
process.exit(failures ? 1 : 0);
