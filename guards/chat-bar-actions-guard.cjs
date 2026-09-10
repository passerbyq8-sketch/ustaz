#!/usr/bin/env node
'use strict';
// chat-bar-actions-guard.cjs -- gate `chatbaractions`, item 75 part B.
//
// MODELLED ON guards/retired-chat-endpoints-guard.cjs: the same ok/eq/read helpers, the same
// `require('../tools/babel-block.cjs').readShippedClient('index.html')` for the shipped client
// (index.html plus app.jsx since item 32 moved the JSX out of the page), and the same one-line
// summary and exit code at the end.
//
// WHAT IT IS FOR. Two things the composer bar gained on 2026-09-10, and one thing it must never
// lose:
//
//   THE FROZEN FIVE. The owner ruled on 2026-09-10 that the five quick actions under the newest
//   reply are tested and do not change -- not their keys, labels, prompts or order. Case A seals
//   them by DIGEST, cut from 6c5f3327426e488cc65a280f790de12c6ac8062e, so a single character
//   moving inside any of the five prompts is red here even though every other case still passes.
//
//   THE TWO BAR ACTIONS. Where they sit, what they call, what they do not call, and that they
//   bring no icon and no `ez-hit` into a row whose one `.ez-hit` is what part A's send-name
//   assertion in guards/i18n-ui-guard.cjs finds the composer by.
//
//   ASK ABOUT THE SELECTION. Where the bar sits, that its click composes rather than sends, and
//   that the words it quotes were captured in the selectionchange handler rather than read off
//   the document at tap time -- which is the whole reason the feature works on a phone.
//
// EVERY LINE THIS FILE PRINTS IS ASCII. An Arabic literal on a Windows terminal is a mojibake
// report, not evidence: expected values are built from code points below and diagnostics escape.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
let checks = 0;
let failures = 0;

function ok(label, value, detail = '') {
  checks++;
  if (value) { console.log('  PASS  ' + label); return true; }
  failures++;
  console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
  return false;
}
function eq(label, actual, expected) {
  return ok(label, JSON.stringify(actual) === JSON.stringify(expected),
    'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}
const esc = (v) => Array.from(String(v === undefined || v === null ? '' : v))
  .map((c) => (c.codePointAt(0) < 128 ? c : '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')))
  .join('');
const cp = (...codes) => String.fromCharCode.apply(null, codes);

// The shipped client, through the one reader every other guard in this directory uses.
const SRC = require('../tools/babel-block.cjs').readShippedClient('index.html').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------------------------
// The slices every case below reads. Each is cut by an anchor that is asserted to be there, so a
// case can never pass because its slice came back empty.
// ---------------------------------------------------------------------------------------------
const ROW_OPEN = '<div className="ez-hit" style={s.toolBar}>';
const ROW_CLOSE = '<div className="ezc-note">';
const rowAt = SRC.indexOf(ROW_OPEN);
const rowEnd = rowAt === -1 ? -1 : SRC.indexOf(ROW_CLOSE, rowAt);
const ROW = (rowAt !== -1 && rowEnd > rowAt) ? SRC.slice(rowAt, rowEnd) : '';

const DOCK_OPEN = '<div className="ezc-dock-inner">';
const dockAt = SRC.indexOf(DOCK_OPEN);
const DOCK = dockAt === -1 ? '' : SRC.slice(dockAt, rowEnd > dockAt ? rowEnd : dockAt);

function half(name) {
  const at = SRC.indexOf('\n  ' + name + ': {');
  if (at === -1) return '';
  const end = SRC.indexOf('\n  },', at);
  return end > at ? SRC.slice(at, end) : '';
}
const AR = half('ar');
const EN = half('en');

/** One JSX element, from the given anchor back to its `<button` and forward to `</button>`. */
function buttonAround(anchor) {
  const i = ROW.indexOf(anchor);
  if (i === -1) return '';
  const open = ROW.lastIndexOf('<button', i);
  const close = ROW.indexOf('</button>', i);
  return (open !== -1 && close > open) ? ROW.slice(open, close + 9) : '';
}

console.log('\n=== chat-bar-actions-guard ===');
ok('the composer control row was located before it was searched', ROW.length > 400,
  'rowAt=' + rowAt + ' rowEnd=' + rowEnd + ' len=' + ROW.length);
ok('...and the composer dock above it', DOCK.length > 400, 'dockAt=' + dockAt + ' len=' + DOCK.length);
ok('...and both dictionary halves', AR.length > 4000 && EN.length > 4000,
  'ar=' + AR.length + ' en=' + EN.length);

// ---------------------------------------------------------------------------------------------
// A. THE OWNER RULE OF 2026-09-10: the five quick actions are frozen.
//
// The digest is of the SOURCE TEXT of the five entries -- everything between the array's opening
// bracket and the line that closes it, LF-normalised -- measured on
// 6c5f3327426e488cc65a280f790de12c6ac8062e, which is the commit this block was cut from. It is
// written out here rather than re-derived from the tree, because a digest taken from the file it
// is checking would agree with any file, including one whose prompts had been rewritten.
// ---------------------------------------------------------------------------------------------
const QA_DIGEST = '83221ee15fe06abb02cd067b2fe34496bafd21897e05ec92b3940359d0bf35d1';
const QA_OPEN = 'let EZIK_QUICK_ACTIONS = [';
const qaAt = SRC.indexOf(QA_OPEN);
const qaOpenBracket = qaAt === -1 ? -1 : SRC.indexOf('[', qaAt);
const qaClose = qaOpenBracket === -1 ? -1 : SRC.indexOf('\n];', qaOpenBracket);
const QA_TEXT = (qaOpenBracket !== -1 && qaClose > qaOpenBracket) ? SRC.slice(qaOpenBracket + 1, qaClose + 1) : '';
ok('A: EZIK_QUICK_ACTIONS was located before it was measured', QA_TEXT.length > 400,
  'qaAt=' + qaAt + ' len=' + QA_TEXT.length);
eq('A: the five quick actions are exactly these keys, in this order',
  (QA_TEXT.match(/\{ key: '([a-z]+)'/g) || []).map((m) => m.slice(8, -1)),
  ['simplify', 'example', 'quiz', 'shorten', 'continue']);
const qaSha = crypto.createHash('sha256').update(Buffer.from(QA_TEXT, 'utf8')).digest('hex');
ok('A: ...and their source text is byte-for-byte the text sealed at 6c5f332 (owner rule 2026-09-10)',
  qaSha === QA_DIGEST,
  'expected ' + QA_DIGEST + '\n        got      ' + qaSha + '  (' + Buffer.byteLength(QA_TEXT, 'utf8') + ' bytes)');
eq('A: ...and nothing was added to the row that draws them',
  (SRC.match(/EZIK_QUICK_ACTIONS\.map\(/g) || []).length, 1);

// ---------------------------------------------------------------------------------------------
// B. WHERE THE TWO BAR ACTIONS SIT.
// ---------------------------------------------------------------------------------------------
const A_PILL = "aria-label={depthMode === 'brief' ?";
const A_SUM = 'onClick={() => runQuickAction(EZIK_BAR_SUMMARIZE_PROMPT)}';
const A_EXP = 'onClick={() => runQuickAction(EZIK_BAR_EXPAND_PROMPT)}';
const A_PLUS = '{caps.upload && (';
const iPill = ROW.indexOf(A_PILL);
const iSum = ROW.indexOf(A_SUM);
const iExp = ROW.indexOf(A_EXP);
const iPlus = ROW.indexOf(A_PLUS);
const iLeftGroup = ROW.lastIndexOf('<div style={s.toolGroup}>');
ok('B: both bar actions are in the control row at all', iSum !== -1 && iExp !== -1,
  'summarize@' + iSum + ' expand@' + iExp);
ok('B: ...after the brief pill and before the [+], summarize first',
  iPill !== -1 && iPlus !== -1 && iPill < iSum && iSum < iExp && iExp < iPlus,
  [iPill, iSum, iExp, iPlus].join(' < '));
ok('B: ...inside the LEFT cluster, the same toolGroup the pill and the [+] share',
  iLeftGroup !== -1 && iLeftGroup < iPill && iLeftGroup < iSum,
  'leftGroup@' + iLeftGroup);
ok('B: ...and each wears the mode pill own base object rather than a copy of its values',
  (ROW.match(/\{ \.\.\.s\.toolBtn, \.\.\.s\.barActionPill, opacity: quickActionsVisible \? 1 : 0\.4 \}/g) || []).length === 2,
  'sites=' + (ROW.match(/\.\.\.s\.barActionPill/g) || []).length);
ok('B: ...disabled by the SAME name the five are drawn under, never a second expression',
  (ROW.match(/disabled=\{!quickActionsVisible\}/g) || []).length === 2);

// ---------------------------------------------------------------------------------------------
// C. WHAT THEY CALL, AND WHAT THEY DO NOT.
// ---------------------------------------------------------------------------------------------
const BTN_SUM = buttonAround(A_SUM);
const BTN_EXP = buttonAround(A_EXP);
ok('C: each button element was located before it was searched',
  BTN_SUM.length > 80 && BTN_EXP.length > 80, 'sum=' + BTN_SUM.length + ' exp=' + BTN_EXP.length);
eq('C: summarize calls runQuickAction exactly once', (BTN_SUM.match(/runQuickAction\(/g) || []).length, 1);
eq('C: expand calls runQuickAction exactly once', (BTN_EXP.match(/runQuickAction\(/g) || []).length, 1);
ok('C: ...each with its OWN constant and no other argument',
  BTN_SUM.indexOf(A_SUM) !== -1 && BTN_SUM.indexOf('EZIK_BAR_EXPAND_PROMPT') === -1
    && BTN_EXP.indexOf(A_EXP) !== -1 && BTN_EXP.indexOf('EZIK_BAR_SUMMARIZE_PROMPT') === -1);
ok('C: ...and neither reaches sendMessage directly',
  BTN_SUM.indexOf('sendMessage') === -1 && BTN_EXP.indexOf('sendMessage') === -1);
ok('C: the two prompts are their own module constants, declared once each, outside the frozen array',
  (SRC.match(/const EZIK_BAR_SUMMARIZE_PROMPT = '/g) || []).length === 1
    && (SRC.match(/const EZIK_BAR_EXPAND_PROMPT = '/g) || []).length === 1
    && QA_TEXT.indexOf('EZIK_BAR_') === -1);

// ---------------------------------------------------------------------------------------------
// D. WHAT THEY MUST NOT BRING INTO THE ROW.
//
// `ez-hit` is not a style question here. guards/i18n-ui-guard.cjs finds the composer send button
// as the first button of the ONE `.ez-hit` inside `.ezc-dock`; a second one in this row would
// re-point that assertion at a different control while it went on passing.
// `<polygon>` is the same shape of trap: chat-ux-guard.cjs finds the send button as the first
// button on the page whose icon carries one.
// ---------------------------------------------------------------------------------------------
ok('D: neither bar action carries an icon with a polygon in it',
  BTN_SUM.indexOf('polygon') === -1 && BTN_EXP.indexOf('polygon') === -1);
ok('D: ...nor any svg at all', BTN_SUM.indexOf('<svg') === -1 && BTN_EXP.indexOf('<svg') === -1);
ok('D: ...and neither carries ez-hit',
  BTN_SUM.indexOf('ez-hit') === -1 && BTN_EXP.indexOf('ez-hit') === -1);
// COUNTED ON THE MARKUP, NOT ON THE WORDS. The dock carries a comment that quotes
// `className="ez-hit"` while explaining what the class is for, and a count of the string alone
// would be satisfied by that comment -- the same trap this repository has already been bitten by
// twice. Comments are stripped first, so what is counted is the row that really carries it.
const DOCK_CODE = DOCK.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
eq('D: the composer dock still holds exactly ONE ez-hit element',
  (DOCK_CODE.match(/className="ez-hit"/g) || []).length, 1);
ok('D: ...and that one is the control row itself',
  DOCK_CODE.indexOf(ROW_OPEN) !== -1 && ROW.indexOf(ROW_OPEN) === 0);
ok('D: ...and each carries the keyboard focus ring every other control in this row has',
  (ROW.match(/className="ezik-focus"/g) || []).length >= 2);

// ---------------------------------------------------------------------------------------------
// E. THE TWO KEYS, IN BOTH HALVES, WITH THE VALUES THE ORDER NAMES.
//
// The expected Arabic is built from code points so this file stays ASCII, and the SOURCE line is
// checked as well as the value: app.jsx writes these two as \u escapes, and a half that carried
// the right glyphs by a different spelling would still be a different file.
// ---------------------------------------------------------------------------------------------
const AR_SUM = cp(0x0644, 0x062e, 0x0651, 0x0635);
const AR_EXP = cp(0x0648, 0x0633, 0x0651, 0x0639);
const AR_SUM_SRC = "'chat.bar.summarize': '\\u0644\\u062e\\u0651\\u0635',";
const AR_EXP_SRC = "'chat.bar.expand': '\\u0648\\u0633\\u0651\\u0639',";
ok('E: chat.bar.summarize is in the ar half, written as the escapes the order names',
  AR.indexOf(AR_SUM_SRC) !== -1, 'looking for ' + AR_SUM_SRC);
ok('E: chat.bar.expand is in the ar half, written as the escapes the order names',
  AR.indexOf(AR_EXP_SRC) !== -1, 'looking for ' + AR_EXP_SRC);
ok('E: ...and those escapes are the two words themselves',
  JSON.parse('"' + AR_SUM_SRC.split("'")[3] + '"') === AR_SUM
    && JSON.parse('"' + AR_EXP_SRC.split("'")[3] + '"') === AR_EXP,
  esc(AR_SUM) + ' / ' + esc(AR_EXP));
ok('E: chat.bar.summarize is in the en half', EN.indexOf("'chat.bar.summarize': 'Summarize',") !== -1);
ok('E: chat.bar.expand is in the en half', EN.indexOf("'chat.bar.expand': 'Expand',") !== -1);
ok('E: ...and neither key is declared twice in either half',
  (AR.match(/'chat\.bar\.(summarize|expand)':/g) || []).length === 2
    && (EN.match(/'chat\.bar\.(summarize|expand)':/g) || []).length === 2);
ok('E: ...and each button is named by its key, visibly and to a screen reader',
  (BTN_SUM.match(/ezT\('chat\.bar\.summarize'\)/g) || []).length === 2
    && (BTN_EXP.match(/ezT\('chat\.bar\.expand'\)/g) || []).length === 2);

// ---------------------------------------------------------------------------------------------
// F. WHERE THE ASK-ABOUT-THE-SELECTION BAR SITS.
// ---------------------------------------------------------------------------------------------
const FIELD_ROW = '<div style={s.inputBar}>';
const BAR_MARK = 'data-ezik-asksel=""';
const iBar = DOCK.indexOf(BAR_MARK);
const iField = DOCK.indexOf(FIELD_ROW);
ok('F: the bar is inside the composer dock', iBar !== -1, 'bar@' + iBar);
ok('F: ...directly above the field row', iField !== -1 && iBar < iField, iBar + ' < ' + iField);
const RAIL_OPEN = '<div className="ezc-rail">';
const railAt = SRC.indexOf(RAIL_OPEN);
const railEnd = railAt === -1 ? -1 : SRC.indexOf('<div ref={messagesAreaRef}', railAt);
const RAIL = (railAt !== -1 && railEnd > railAt) ? SRC.slice(railAt, railEnd) : '';
ok('F: the chat rail was located before it was searched', RAIL.length > 200, 'len=' + RAIL.length);
ok('F: ...and the bar is not in it',
  RAIL.indexOf(BAR_MARK) === -1 && RAIL.indexOf('askSelBtn') === -1);
const BAR = (function () {
  const i = SRC.indexOf(BAR_MARK);
  if (i === -1) return '';
  const open = SRC.lastIndexOf('{askSelOpen && (', i);
  const close = SRC.indexOf('</div>', SRC.indexOf('</button>', i));
  return (open !== -1 && close > open) ? SRC.slice(open, close + 6) : '';
})();
ok('F: the bar element was located before it was searched', BAR.length > 120, 'len=' + BAR.length);
ok('F: ...and it carries no ez-hit and no polygon and no svg',
  BAR.indexOf('ez-hit') === -1 && BAR.indexOf('polygon') === -1 && BAR.indexOf('<svg') === -1);
ok('F: ...and its one control is named, focusable and prevents the press that would collapse it',
  (BAR.match(/<button/g) || []).length === 1
    && BAR.indexOf("aria-label={ezT('chat.askSelection')}") !== -1
    && BAR.indexOf('className="ezik-focus"') !== -1
    && BAR.indexOf('onPointerDown={(e) => e.preventDefault()}') !== -1
    && BAR.indexOf('onMouseDown={(e) => e.preventDefault()}') !== -1);

// ---------------------------------------------------------------------------------------------
// G. WHAT THE PRESS DOES, AND WHAT IT NEVER DOES.
//
// The path is three named steps and each is asserted where it lives: the bar calls
// askAboutSelection, askAboutSelection calls the SHIPPED quoteReply, and quoteReply is the one
// that composes. Following it rather than matching one regex over the file is what makes
// "never sendMessage" a statement about this control instead of about the whole page.
// ---------------------------------------------------------------------------------------------
function blockOf(start, end) {
  const a = SRC.indexOf(start);
  if (a === -1) return '';
  const b = SRC.indexOf(end, a);
  return b > a ? SRC.slice(a, b + end.length) : '';
}
const ASK_FN = blockOf('const askAboutSelection = () => {', '\n  };');
const QUOTE_FN = blockOf('const quoteReply = (clean) => {', '\n  };');
ok('G: both handlers were located before they were searched',
  ASK_FN.length > 80 && QUOTE_FN.length > 80, 'ask=' + ASK_FN.length + ' quote=' + QUOTE_FN.length);
ok('G: the bar press runs askAboutSelection', BAR.indexOf('onClick={askAboutSelection}') !== -1);
ok('G: ...which hands the words to the shipped quoteReply', ASK_FN.indexOf('quoteReply(text);') !== -1);
ok('G: ...and quoteReply is the one that composes, through the shipped composer',
  QUOTE_FN.indexOf('ezikBuildQuote(clean)') !== -1
    && QUOTE_FN.indexOf('setInput((prev) => ezikComposeWithQuote(prev, block))') !== -1);
ok('G: ...and NOTHING on that path sends',
  ASK_FN.indexOf('sendMessage') === -1 && QUOTE_FN.indexOf('sendMessage') === -1
    && BAR.indexOf('sendMessage') === -1);
ok('G: ...and the press puts the screen back: the selection dropped, the ref emptied, the bar gone',
  ASK_FN.indexOf('removeAllRanges') !== -1
    && ASK_FN.indexOf("askSelRef.current = '';") !== -1
    && ASK_FN.indexOf('setAskSelOpen(false);') !== -1);

// ---------------------------------------------------------------------------------------------
// H. THE WORDS ARE CAPTURED WHEN THEY ARE SELECTED, NOT WHEN THE BUTTON IS PRESSED.
//
// This is the one that matters on a phone: a press outside a selection collapses it, so a handler
// reading getSelection() at tap time would read an empty selection. The listener writes a REF and
// the press reads it -- and the press is asserted to read that ref BEFORE it touches the document
// at all, so a later edit that reached for the live selection first would be red here.
// ---------------------------------------------------------------------------------------------
const SEL_FX = blockOf('const onSelectionChange = () => {', "removeEventListener('selectionchange'");
ok('H: the selectionchange effect was located before it was searched', SEL_FX.length > 200, 'len=' + SEL_FX.length);
eq('H: exactly one selectionchange listener is added in the whole client',
  (SRC.match(/addEventListener\('selectionchange'/g) || []).length, 1);
eq('H: ...and it is removed again on unmount',
  (SRC.match(/removeEventListener\('selectionchange'/g) || []).length, 1);
ok('H: the handler stores the text in the ref rather than in state',
  SEL_FX.indexOf('askSelRef.current = text;') !== -1);
ok('H: ...only when both ends of the selection are in the SAME assistant reply body',
  SEL_FX.indexOf('ezikAnswerBodyOf(sel.anchorNode)') !== -1
    && SEL_FX.indexOf('ezikAnswerBodyOf(sel.focusNode)') !== -1
    && SEL_FX.indexOf('if (a && a === f) text = t;') !== -1
    && SRC.indexOf("closest('.ezc-ans')") !== -1);
ok('H: ...and an empty or cross-reply selection hides the bar and clears the ref',
  SEL_FX.indexOf('setAskSelOpen(!!text);') !== -1);
ok('H: the press reads the ref, and reads it BEFORE it touches the document',
  ASK_FN.indexOf('const text = askSelRef.current;') !== -1
    && ASK_FN.indexOf('askSelRef.current') < ASK_FN.indexOf('getSelection'));

// ---------------------------------------------------------------------------------------------
// I. THE KEY, IN BOTH HALVES.
// ---------------------------------------------------------------------------------------------
const AR_ASK = cp(0x0627, 0x0633, 0x0623, 0x0644, 0x0020, 0x0639, 0x0646, 0x0020,
  0x0627, 0x0644, 0x0645, 0x062d, 0x062f, 0x0651, 0x062f);
const AR_ASK_SRC = "'chat.askSelection': '\\u0627\\u0633\\u0623\\u0644 \\u0639\\u0646 \\u0627\\u0644\\u0645\\u062d\\u062f\\u0651\\u062f',";
ok('I: chat.askSelection is in the ar half, written as the escapes the order names',
  AR.indexOf(AR_ASK_SRC) !== -1, 'looking for ' + AR_ASK_SRC);
ok('I: ...and those escapes are the words themselves',
  JSON.parse('"' + AR_ASK_SRC.split("'")[3] + '"') === AR_ASK, esc(AR_ASK));
ok('I: chat.askSelection is in the en half',
  EN.indexOf("'chat.askSelection': 'Ask about the selection',") !== -1);
ok('I: ...and it is declared once in each half',
  (AR.match(/'chat\.askSelection':/g) || []).length === 1
    && (EN.match(/'chat\.askSelection':/g) || []).length === 1);

console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL ===' : '  PASS ==='));
process.exit(failures ? 1 : 0);
