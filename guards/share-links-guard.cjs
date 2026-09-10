#!/usr/bin/env node
'use strict';
// share-links-guard.cjs -- gate `sharelinks`, item 92.
//
// MODELLED ON guards/chat-bar-actions-guard.cjs: the same ok/eq/esc/cp helpers, the same
// `require('../tools/babel-block.cjs').readShippedClient('index.html')` for the shipped client
// (index.html plus app.jsx since item 32 moved the JSX out of the page), the same anchored
// slices whose emptiness is asserted before anything reads them, and the same one-line summary
// and exit code at the end.
//
// WHAT IT IS FOR. The owner ruled on 2026-09-10 that the menu gains a share button, and that
// what it hands over depends on where the reader is:
//
//   INSIDE THE MOBILE SHELLS it shares https://ezik.app and nothing else. No chooser, no badge,
//   no store name and no platform name anywhere in the page. That is App Store Review Guideline
//   2.3.10, and it is the assertion in this file that has legal weight rather than visual: an
//   iOS build that names Google Play is rejected. Case D pins that the shell path RETURNS before
//   the chooser can be opened, so the chooser is not merely hidden there but never constructed.
//
//   IN A PLAIN BROWSER it offers three choices in a fixed order: Apple's badge, Google's badge,
//   then both links as text. The order is Apple's rule, not a preference -- "Whenever one or more
//   badges for other app platforms appear in the layout, use the preferred black badge. Place the
//   App Store badge first in the lineup of badges."
//
//   THE TWO LINKS AND THE TWO BADGE FILES ARE SEALED. The links are pinned character for
//   character against about.html, which has carried them since the app was published. The badges
//   are pinned by SHA-256 over their bytes on disk, because the whole point of rule 6 of the
//   order is that vendor artwork is used byte for byte and never redrawn, recoloured or resized:
//   a hash is the only assertion that can tell a re-saved badge from the vendor's own file.
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
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// The shipped client, through the one reader every other guard in this directory uses.
const SRC = require('../tools/babel-block.cjs').readShippedClient('index.html').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------------------------
// THE SLICES. Each is cut by an anchor that is asserted to be there, and every absence check
// below carries a length precondition inside its OWN condition -- an `indexOf(x) === -1` over an
// empty slice is satisfied by the emptiness, and prints PASS at its loudest exactly when it has
// stopped reading anything.
// ---------------------------------------------------------------------------------------------

/** The pinned footer of the menu: the profile entry and the share button beside it. */
const PINNED_OPEN = '<div style={s.drawerPinned}>';
const PINNED = (function () {
  const at = SRC.indexOf(PINNED_OPEN);
  if (at === -1) return '';
  const end = SRC.indexOf('\n        </div>', at);
  return end > at ? SRC.slice(at, end) : '';
})();

/** The chooser component, from its declaration to its close. */
const CHOOSER_OPEN = 'function EzikShareChooser({ onClose }) {';
const CHOOSER = (function () {
  const at = SRC.indexOf(CHOOSER_OPEN);
  if (at === -1) return '';
  const end = SRC.indexOf('\n}', at);
  return end > at ? SRC.slice(at, end) : '';
})();

/** The one share path: navigator.share, then the file's one clipboard path. */
const SHARE_FN_OPEN = 'const ezikShareLinks = async (payload, say) => {';
const SHARE_FN = (function () {
  const at = SRC.indexOf(SHARE_FN_OPEN);
  if (at === -1) return '';
  const end = SRC.indexOf('\n};', at);
  return end > at ? SRC.slice(at, end) : '';
})();

/** The press handler that decides between the shell path and the chooser. */
const HANDLER_OPEN = 'const onMenuShare = () => {';
const HANDLER = (function () {
  const at = SRC.indexOf(HANDLER_OPEN);
  if (at === -1) return '';
  const end = SRC.indexOf('\n  };', at);
  return end > at ? SRC.slice(at, end) : '';
})();

function half(name) {
  const at = SRC.indexOf('\n  ' + name + ': {');
  if (at === -1) return '';
  const end = SRC.indexOf('\n  },', at);
  return end > at ? SRC.slice(at, end) : '';
}
const AR = half('ar');
const EN = half('en');

console.log('\n=== share-links-guard ===');

// ---------------------------------------------------------------------------------------------
// 0. THE SLICES WERE LOCATED BEFORE THEY WERE SEARCHED.
// ---------------------------------------------------------------------------------------------
ok('0: the shipped client was read', SRC.length > 500000, 'length ' + SRC.length);
ok('0: the menu\'s pinned footer was LOCATED', PINNED.length > 200, 'length ' + PINNED.length);
ok('0: EzikShareChooser was LOCATED', CHOOSER.length > 600, 'length ' + CHOOSER.length);
ok('0: ezikShareLinks was LOCATED', SHARE_FN.length > 200, 'length ' + SHARE_FN.length);
ok('0: the press handler was LOCATED', HANDLER.length > 100, 'length ' + HANDLER.length);
ok('0: both dictionary halves were LOCATED', AR.length > 5000 && EN.length > 5000,
  'ar ' + AR.length + ' en ' + EN.length);

// ---------------------------------------------------------------------------------------------
// A. THE TWO LINKS, CHARACTER FOR CHARACTER -- and they are about.html's own.
// ---------------------------------------------------------------------------------------------
const APP_URL = 'https://ezik.app';
const APP_STORE = 'https://apps.apple.com/gb/app/%D8%B9%D8%B2%D9%83/id6797100518';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=app.almurabbi.tutor&hl=ar';

ok('A: the App Store link is declared exactly once, exactly as the order names it',
  (SRC.match(/const EZIK_APP_STORE_URL = '[^']*';/g) || []).length === 1
    && SRC.indexOf("const EZIK_APP_STORE_URL = '" + APP_STORE + "';") !== -1);
ok('A: the Google Play link is declared exactly once, exactly as the order names it',
  (SRC.match(/const EZIK_PLAY_STORE_URL = '[^']*';/g) || []).length === 1
    && SRC.indexOf("const EZIK_PLAY_STORE_URL = '" + PLAY_STORE + "';") !== -1);
ok('A: the app\'s own link is declared exactly once',
  (SRC.match(/const EZIK_APP_URL = '[^']*';/g) || []).length === 1
    && SRC.indexOf("const EZIK_APP_URL = '" + APP_URL + "';") !== -1);

// about.html is the SOURCE OF TRUTH for both, and it predates this item. If the store listing
// ever moves, these two assertions are what notices that the app and the public page disagree.
const ABOUT = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
const AYN = cp(0x0639, 0x0632, 0x0643);                       // the app's name in the App Store path
ok('A: the App Store link, percent-decoded, is the href about.html carries',
  ABOUT.indexOf('href="' + decodeURIComponent(APP_STORE) + '"') !== -1,
  'looking for the decoded path ending ' + esc(AYN) + '/id6797100518');
ok('A: ...and re-encoding that path segment gives back the pinned literal',
  encodeURIComponent(AYN) === '%D8%B9%D8%B2%D9%83'
    && decodeURIComponent(APP_STORE).indexOf('/' + AYN + '/') !== -1);
ok('A: the Google Play link, with &amp; decoded, is the href about.html carries',
  ABOUT.indexOf('href="' + PLAY_STORE.replace(/&/g, '&amp;') + '"') !== -1);

// ---------------------------------------------------------------------------------------------
// B. THE TWO BADGE FILES, SEALED BY SHA-256 OVER THEIR BYTES.
//
// These are the vendors' own files, saved unmodified:
//   Apple  toolbox.marketingtools.apple.com/api/badges/download-on-the-app-store/black/en-us
//          (byte-identical to developer.apple.com/assets/elements/badges/download-on-the-app-store.svg)
//   Google the Arabic (Saudi Arabia) badge from Google's own badge bundle, reached from
//          play.google.com/intl/en_us/badges/, which 302s to Google's Partner Marketing Hub.
// A hash is the assertion, because rule 6 of the order forbids redrawing, tracing, recolouring,
// cropping or resizing the file -- and every one of those changes the bytes and nothing else
// this guard could look at.
// ---------------------------------------------------------------------------------------------
const BADGE_APPLE = 'assets/store-badges/app-store-badge.svg';
const BADGE_GOOGLE = 'assets/store-badges/google-play-badge.svg';
const SEALED = {
  [BADGE_APPLE]: { bytes: 10804, sha: 'a26fc5b38380272c92e9019a2eb8b45542a66814b3e2b203772db8904b9fb99f' },
  [BADGE_GOOGLE]: { bytes: 9053, sha: 'deb9a7e5471c77cd0f1ce8216aef7d603adf6f5820b8df3d6a9bdcfd667ed6b4' },
};
for (const rel of [BADGE_APPLE, BADGE_GOOGLE]) {
  const abs = path.join(ROOT, rel);
  const there = fs.existsSync(abs);
  if (!ok('B: ' + rel + ' is in the tree', there)) continue;
  const buf = fs.readFileSync(abs);
  eq('B: ' + rel + ' is the sealed byte count', buf.length, SEALED[rel].bytes);
  eq('B: ' + rel + ' is the sealed SHA-256', sha256(buf), SEALED[rel].sha);
  // Rule 6 again, from the other end: the artwork is the vendor's, so it must not have been
  // rewrapped by a line-ending conversion either. Both files ship LF, and .gitattributes pins
  // them `-text` so a clone with core.autocrlf=true cannot inject CR and break the seal above.
  const text = buf.toString('utf8');
  eq('B: ' + rel + ' carries no CR', (text.match(/\r/g) || []).length, 0);
  ok('B: ' + rel + ' is an SVG', text.indexOf('<svg') !== -1);
}
const GITATTR = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
ok('B: .gitattributes pins the badge artwork so no clone can convert it',
  GITATTR.indexOf('assets/store-badges/*.svg -text') !== -1);

// The page must reference exactly those two files and no third badge.
ok('B: the client names the two badge files and no other store-badge asset',
  SRC.indexOf("const EZIK_BADGE_APP_STORE = '" + BADGE_APPLE + "';") !== -1
    && SRC.indexOf("const EZIK_BADGE_GOOGLE_PLAY = '" + BADGE_GOOGLE + "';") !== -1
    && (SRC.match(/assets\/store-badges\//g) || []).length === 2);

// ---------------------------------------------------------------------------------------------
// C. THE CHOOSER: three options, and Apple is FIRST.
// ---------------------------------------------------------------------------------------------
const iApple = CHOOSER.indexOf("aria-label={ezT('share.appStore')}");
const iGoogle = CHOOSER.indexOf("aria-label={ezT('share.googlePlay')}");
const iBoth = CHOOSER.indexOf("aria-label={ezT('share.bothLinks')}");
ok('C: the chooser offers all three options', iApple !== -1 && iGoogle !== -1 && iBoth !== -1,
  [iApple, iGoogle, iBoth].join(' / '));
ok('C: App Store FIRST, then Google Play, then both links -- Apple\'s own badge rule',
  iApple !== -1 && iGoogle > iApple && iBoth > iGoogle,
  [iApple, iGoogle, iBoth].join(' < '));
ok('C: it is exactly three buttons, no more',
  (CHOOSER.match(/<button/g) || []).length === 3,
  'found ' + (CHOOSER.match(/<button/g) || []).length);
ok('C: it is a dialog, named by the same key the button is named by',
  CHOOSER.indexOf('role="dialog"') !== -1
    && CHOOSER.indexOf('aria-modal="true"') !== -1
    && CHOOSER.indexOf("aria-label={ezT('chat.share')}") !== -1);
ok('C: the App Store option shares the App Store link and nothing else',
  CHOOSER.indexOf('pick({ url: EZIK_APP_STORE_URL })') !== -1);
ok('C: the Google Play option shares the Google Play link and nothing else',
  CHOOSER.indexOf('pick({ url: EZIK_PLAY_STORE_URL })') !== -1);
ok('C: the both-links option shares the two links, newline separated, and no added words',
  CHOOSER.indexOf("pick({ text: EZIK_APP_STORE_URL + '\\n' + EZIK_PLAY_STORE_URL })") !== -1);
ok('C: the badges are shown at the vendors\' minimum height or larger (Apple 40px, Google 28px)',
  SRC.indexOf('const EZIK_BADGE_HEIGHT = 40;') !== -1
    && SRC.indexOf('height: EZIK_BADGE_HEIGHT') !== -1);
ok('C: ...at ONE height for both, so Google\'s badge is never smaller than Apple\'s',
  (SRC.match(/height: EZIK_BADGE_HEIGHT/g) || []).length === 1
    && (CHOOSER.match(/style=\{s\.shareChooserBadge\}/g) || []).length === 2);
ok('C: ...and with the clear space both vendors state: one quarter of the badge height',
  SRC.indexOf('const EZIK_BADGE_CLEAR = 10;') !== -1
    && SRC.indexOf('padding: EZIK_BADGE_CLEAR') !== -1
    && 10 === 40 / 4);
// Apple: "When the App Store badge is used, credit both Apple and the Apple Logo", in the
// international format "______ and ______ are trademarks of Apple Inc., registered in the U.S.
// and other countries." Google's badge guideline states no attribution requirement, and none is
// invented for it.
const CREDIT = 'Apple and the Apple Logo are trademarks of Apple Inc., registered in the U.S. and other countries.';
ok('C: Apple\'s credit line is shown with the badge, verbatim',
  CHOOSER.indexOf("{ezT('share.appleCredit')}") !== -1
    && AR.indexOf("'share.appleCredit': '" + CREDIT + "',") !== -1
    && EN.indexOf("'share.appleCredit': '" + CREDIT + "',") !== -1);
ok('C: the chooser closes by the back layer, by Escape and by a press outside',
  CHOOSER.indexOf('useEzikBackLayer(true, onClose)') !== -1
    && CHOOSER.indexOf("e.key === 'Escape'") !== -1
    && CHOOSER.indexOf('<div onClick={onClose}') !== -1);

// ---------------------------------------------------------------------------------------------
// D. THE SHELL PATH -- Apple guideline 2.3.10. THE ASSERTION WITH LEGAL WEIGHT.
// ---------------------------------------------------------------------------------------------
ok('D: the press tests the injected bridge, and nothing else',
  HANDLER.indexOf('if (ezikShellBridge()) {') !== -1);
ok('D: in a shell it hands over exactly https://ezik.app',
  HANDLER.indexOf('ezikShareLinks({ url: EZIK_APP_URL }, say);') !== -1);
ok('D: ...and RETURNS, so setShareOpen is never reached there',
  HANDLER.length > 100
    && HANDLER.indexOf('return;') !== -1
    && HANDLER.indexOf('return;') < HANDLER.indexOf('setShareOpen(true);'));
ok('D: the chooser is BUILT only when shareOpen is true, not merely hidden',
  SRC.indexOf('{shareOpen ? <EzikShareChooser onClose={() => setShareOpen(false)} /> : null}') !== -1);
ok('D: the press never consults navigator.userAgent',
  HANDLER.length > 100 && HANDLER.indexOf('userAgent') === -1);
// The five words, in the code that can reach a shell. The chooser is exempt because it cannot be
// built in one; the pinned row and the handler are NOT, because they render in both.
const FORBIDDEN = ['App Store', 'Google Play', 'Apple', 'Android'];
for (const word of FORBIDDEN) {
  ok('D: the menu\'s pinned row never renders the words "' + word + '"',
    PINNED.length > 200 && PINNED.indexOf(word) === -1);
}
ok('D: ...and the press handler names no store and no platform',
  HANDLER.length > 100
    && FORBIDDEN.every((w) => HANDLER.indexOf(w) === -1)
    && HANDLER.indexOf('Google') === -1);
ok('D: neither badge file is referenced outside the chooser',
  PINNED.length > 200 && PINNED.indexOf('store-badges') === -1
    && HANDLER.length > 100 && HANDLER.indexOf('store-badges') === -1);

// ---------------------------------------------------------------------------------------------
// E. THE BUTTON: named, not nested, and no bigger than the menu's other small icons.
// ---------------------------------------------------------------------------------------------
const SHARE_BTN = (function () {
  const i = PINNED.indexOf('onClick={onMenuShare}');
  if (i === -1) return '';
  const open = PINNED.lastIndexOf('<button', i);
  const close = PINNED.indexOf('</button>', i);
  return (open !== -1 && close > open) ? PINNED.slice(open, close + 9) : '';
})();
const PROFILE_BTN = (function () {
  const i = PINNED.indexOf('style={s.drawerProfile}');
  if (i === -1) return '';
  const open = PINNED.lastIndexOf('<button', i);
  const close = PINNED.indexOf('</button>', i);
  return (open !== -1 && close > open) ? PINNED.slice(open, close + 9) : '';
})();
ok('E: the share button was LOCATED in the pinned row', SHARE_BTN.length > 80, 'length ' + SHARE_BTN.length);
ok('E: the profile entry was LOCATED in the pinned row', PROFILE_BTN.length > 80, 'length ' + PROFILE_BTN.length);
ok('E: the row holds exactly two buttons -- the profile entry and the share button',
  (PINNED.match(/<button/g) || []).length === 2,
  'found ' + (PINNED.match(/<button/g) || []).length);
ok('E: the share button is NOT inside the profile button',
  PROFILE_BTN.length > 80 && PROFILE_BTN.indexOf('onMenuShare') === -1);
ok('E: ...and no button in this row contains another',
  SHARE_BTN.length > 80 && SHARE_BTN.indexOf('<button') === SHARE_BTN.lastIndexOf('<button')
    && PROFILE_BTN.length > 80 && PROFILE_BTN.indexOf('<button') === PROFILE_BTN.lastIndexOf('<button'));
ok('E: the share button carries the accessible name the order names',
  SHARE_BTN.indexOf("aria-label={ezT('chat.share')}") !== -1);
ok('E: the profile entry is unchanged -- same handler, same style key, same name',
  PROFILE_BTN.indexOf("onClick={() => closeDrawerWith(() => openEzikSheet('settings'))}") !== -1
    && PROFILE_BTN.indexOf('style={s.drawerProfile}') !== -1
    && PROFILE_BTN.indexOf("aria-label={ezT('navigation.settings2')}") !== -1);
ok('E: the share glyph is drawn at 19, the size the menu\'s other small icons use',
  SRC.indexOf('const EZIK_ICON_SHARE_DRAWER = (') !== -1
    && /const EZIK_ICON_SHARE_DRAWER = \(\s*\n\s*<svg width="19" height="19"/.test(SRC));
ok('E: ...and it is the drawing the adhkar reader already ships, circles and lines',
  SRC.indexOf('<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" />') !== -1
    && (SRC.match(/<circle cx="18" cy="5" r="3" \/>/g) || []).length === 2);
ok('E: the share glyph contains NO <polygon>',
  SRC.indexOf('const EZIK_ICON_SHARE_DRAWER = (') !== -1
    && SRC.slice(SRC.indexOf('const EZIK_ICON_SHARE_DRAWER = ('),
      SRC.indexOf('const EZIK_ICON_SHARE_DRAWER = (') + 600).indexOf('<polygon') === -1);
ok('E: ...nor does the chooser', CHOOSER.length > 600 && CHOOSER.indexOf('<polygon') === -1);
ok('E: the button keeps a 44px touch target',
  /drawerShare: \{ width: 44, height: 44/.test(SRC));
ok('E: ...and it sits at the end of the row opposite the profile entry',
  /drawerShare: \{[^}]*marginInlineStart: 'auto'/.test(SRC));

// ---------------------------------------------------------------------------------------------
// F. THE SHARE PATH: AbortError is not a failure, and the fallback is the file's ONE clipboard.
// ---------------------------------------------------------------------------------------------
ok('F: a single link goes as `url`, two links as `text`',
  SHARE_FN.indexOf('await navigator.share(payload);') !== -1
    && CHOOSER.indexOf('pick({ url:') !== -1
    && CHOOSER.indexOf('pick({ text:') !== -1);
ok('F: a cancelled share is NOT a failure',
  SHARE_FN.indexOf("if (e && e.name === 'AbortError') return;") !== -1);
ok('F: without navigator.share it falls back to the file\'s one clipboard path',
  SHARE_FN.indexOf('await ezikWriteClipboard(') !== -1
    && SHARE_FN.indexOf("say(await ezikWriteClipboard(fallback) ? 'copied' : 'fail');") !== -1);
ok('F: ...and it is the SAME clipboard path the reply\'s share button uses',
  (SRC.match(/ezikWriteClipboard\(/g) || []).length >= 2
    && SRC.indexOf('const ezikWriteClipboard = async (payload) => {') !== -1);
ok('F: the copied/failed words are the dictionary\'s existing two, not new ones',
  CHOOSER.indexOf('EZIK_SHARE_COPIED') !== -1 && CHOOSER.indexOf('EZIK_SHARE_FAIL') !== -1
    && SRC.indexOf('let EZIK_SHARE_COPIED = ezT("common.copied");') !== -1
    && SRC.indexOf('let EZIK_SHARE_FAIL = ezT("common.copyFailed");') !== -1);
ok('F: nothing but the links is shared -- the share path adds no words of its own',
  SHARE_FN.length > 200
    && SHARE_FN.indexOf('title:') === -1
    && SHARE_FN.indexOf('ezik.app') === -1
    && SHARE_FN.indexOf("+ '") === -1);

// ---------------------------------------------------------------------------------------------
// G. THE KEYS, IN BOTH HALVES.
// ---------------------------------------------------------------------------------------------
// The Arabic value of share.bothLinks, written as the order names it. The escapes are checked
// against the code points they claim to be, so a mangled paste cannot pass by matching itself.
const AR_BOTH = cp(0x0627, 0x0644, 0x0631, 0x0627, 0x0628, 0x0637, 0x0627, 0x0646, 0x0020,
  0x0645, 0x0639, 0x064b, 0x0627);
const AR_BOTH_SRC = "'share.bothLinks': '\\u0627\\u0644\\u0631\\u0627\\u0628\\u0637\\u0627\\u0646 \\u0645\\u0639\\u064b\\u0627',";
ok('G: share.bothLinks is in the ar half, written as the escapes the order names',
  AR.indexOf(AR_BOTH_SRC) !== -1, 'looking for ' + AR_BOTH_SRC);
ok('G: ...and those escapes are the words themselves',
  JSON.parse('"' + AR_BOTH_SRC.split("'")[3] + '"') === AR_BOTH, esc(AR_BOTH));
ok('G: share.bothLinks is in the en half', EN.indexOf("'share.bothLinks': 'Both links',") !== -1);
for (const [key, value] of [['share.appStore', 'App Store'], ['share.googlePlay', 'Google Play']]) {
  ok('G: ' + key + ' is in BOTH halves, and it is a store name, which is never translated',
    AR.indexOf("'" + key + "': '" + value + "',") !== -1
      && EN.indexOf("'" + key + "': '" + value + "',") !== -1);
}
for (const key of ['share.appStore', 'share.googlePlay', 'share.bothLinks', 'share.appleCredit']) {
  const re = new RegExp("'" + key.replace('.', '\\.') + "':", 'g');
  ok('G: ' + key + ' is declared exactly once in each half',
    (AR.match(re) || []).length === 1 && (EN.match(re) || []).length === 1,
    'ar ' + (AR.match(re) || []).length + ' en ' + (EN.match(re) || []).length);
}
ok('G: the button and the dialog are named by chat.share, which both halves already carried',
  AR.indexOf("'chat.share':") !== -1 && EN.indexOf("'chat.share': 'Share',") !== -1);

console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL ===' : '  PASS ==='));
process.exit(failures ? 1 : 0);
