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
//   PART B, 2026-09-10: WHAT THE SHELLS SHARE IS NOW THE SMART LINK. https://ezik.app IS the app,
//   not a way to install it, so handing it to somebody who is being given the app lands them on a
//   page they cannot install from. The shells share https://ezik.app/download.html instead -- one
//   address that sends an iPhone or iPad to the App Store, an Android device to Google Play, and
//   everybody else to a page showing both official badges as links. Section H measures that page
//   and RUNS its script against six devices. The deciding reads navigator.userAgent, which is
//   allowed THERE and nowhere else: it is a public web page, not the app. Case D and H5 still
//   assert that no path of the app itself reads one.
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
// RE-POINTED BY PART B, 2026-09-10. This read EZIK_APP_URL until the owner ruled, and what it
// asserted is exactly what was wrong: a reader handed https://ezik.app lands on the app itself,
// not on a way to install it. The shell now hands over the smart link. EZIK_APP_URL is still
// declared and still asserted in section A to be the app's own address; what changed is which of
// the two the share button gives away, and the second conjunct is what makes the old one fail.
ok('D: in a shell it hands over exactly the smart link -- NOT the app\'s own address',
  HANDLER.indexOf('ezikShareLinks({ url: EZIK_SMART_LINK_URL }, say);') !== -1
    && HANDLER.indexOf('EZIK_APP_URL') === -1);
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

// ---------------------------------------------------------------------------------------------
// H. ITEM 92 PART B -- THE SMART LINK: THE LANDING PAGE, ITS SCRIPT, AND WHAT THE SHELL SHARES.
//
// The page and its script are read NORMALISED TO LF. Neither is pinned in .gitattributes, and
// neither needs to be: nothing seals their bytes, and every anchor below is matched against LF
// text, so a clone with core.autocrlf=true cannot make one of these assertions stop finding the
// code it exists to measure. That is the discipline .gitattributes already records for
// lib/free-brain/tools.js and guards/lessons-brain-guard.cjs, stated there in full.
// ---------------------------------------------------------------------------------------------
const DL_HTML_REL = 'download.html';
const DL_JS_REL = 'download.js';
const SMART_LINK = 'https://ezik.app/download.html';
// about.html's own font stack, character for character: one local stack, no webfont, so neither
// page causes a request to leave this origin. H1 asserts it against about.html as well as the new
// page, so "the same head basics as about.html" is measured and not merely claimed.
const ABOUT_FONTS = 'font-family:"Segoe UI","Noto Naskh Arabic","Noto Sans Arabic",Tahoma,system-ui,-apple-system,sans-serif;';
const readLF = (rel) => {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); }
  catch (e) { return ''; }
};
const DL_HTML = readLF(DL_HTML_REL);
const DL_JS = readLF(DL_JS_REL);

ok('H0: ' + DL_HTML_REL + ' is in the tree', DL_HTML.length > 500, 'length ' + DL_HTML.length);
ok('H0: ' + DL_JS_REL + ' is in the tree', DL_JS.length > 200, 'length ' + DL_JS.length);
// The script is ASCII, because the order says so and because a page that redirects before it
// paints cannot afford an open question about the encoding of the only bytes that decide where
// the visitor goes.
ok('H0: the script is ASCII only',
  DL_JS.length > 200
    && Array.from(DL_JS).every((c) => c.codePointAt(0) <= 126),
  Array.from(DL_JS).filter((c) => c.codePointAt(0) > 126)
    .map((c) => '\\u' + c.codePointAt(0).toString(16)).join(' '));
// No dependency: one IIFE read off the disk, nothing to resolve, no build step, and nothing that
// could reach the network from a page whose whole job is to leave.
ok('H0: the script requires, imports and fetches nothing',
  DL_JS.indexOf('(function () {') !== -1
    && !/\brequire\s*\(/.test(DL_JS) && !/\bimport\b/.test(DL_JS)
    && !/\bfetch\s*\(/.test(DL_JS) && !/XMLHttpRequest/.test(DL_JS));

// --- H1. THE PAGE ---------------------------------------------------------------------------
ok('H1: the page is Arabic and right to left, like every other public page of this site',
  DL_HTML.indexOf('<html lang="ar" dir="rtl">') !== -1);
ok('H1: it carries the head basics about.html carries -- charset, viewport, theme colour, a font stack',
  DL_HTML.indexOf('<meta charset="utf-8">') !== -1
    && DL_HTML.indexOf('<meta name="viewport" content="width=device-width, initial-scale=1">') !== -1
    && DL_HTML.indexOf('<meta name="theme-color" content="#1D4ED8">') !== -1
    && DL_HTML.indexOf(ABOUT_FONTS) !== -1);
ok('H1: ...and that font stack is about.html\'s own, so no webfont is fetched by either page',
  ABOUT.indexOf(ABOUT_FONTS) !== -1 && ABOUT_FONTS.length > 60);
// The heading is the app's name and nothing else. Built from code points above, so a mangled
// paste cannot pass this by matching itself.
ok('H1: the heading is the app\'s own name', DL_HTML.indexOf('<h1>' + AYN + '</h1>') !== -1,
  'looking for <h1>' + esc(AYN) + '</h1>');
// LOADED IN THE HEAD, AS A NORMAL SAME-ORIGIN SCRIPT. In the head so it runs before the body is
// shown; src and not inline so a `script-src 'self'` policy would serve it; no defer and no
// async, because either one lets the page paint first and then yanks the visitor away from what
// they have already started reading.
const DL_SCRIPT_AT = DL_HTML.indexOf('<script src="/download.js"></script>');
const DL_HEAD_END = DL_HTML.indexOf('</head>');
const DL_BODY_AT = DL_HTML.indexOf('<body>');
ok('H1: it loads download.js by src, with no defer and no async',
  DL_SCRIPT_AT !== -1, 'at ' + DL_SCRIPT_AT);
ok('H1: ...in the HEAD, before the body is shown',
  DL_SCRIPT_AT !== -1 && DL_HEAD_END > DL_SCRIPT_AT && DL_BODY_AT > DL_HEAD_END,
  [DL_SCRIPT_AT, DL_HEAD_END, DL_BODY_AT].join(' < '));
ok('H1: ...and that is the page\'s ONLY script, and nothing of it is inline',
  DL_HTML.indexOf('<script') === DL_SCRIPT_AT && DL_SCRIPT_AT !== -1
    && DL_HTML.lastIndexOf('<script') === DL_SCRIPT_AT);
// EVERY SUBRESOURCE IS THIS ORIGIN'S OWN. Three of them, named: the script and the two badges.
// The two store addresses are <a> targets, which a visitor follows deliberately; nothing on this
// page causes a request to leave the origin on its own.
eq('H1: it loads exactly three files, all of them this origin\'s',
  (DL_HTML.match(/\ssrc="([^"]*)"/g) || []).map((m) => m.slice(6, -1)).sort(),
  ['/assets/store-badges/app-store-badge.svg', '/assets/store-badges/google-play-badge.svg',
    '/download.js']);
ok('H1: ...and it fetches nothing from another origin, webfonts included',
  DL_HTML.length > 500
    && (DL_HTML.match(/@import|fonts\.googleapis|fonts\.gstatic|cdnjs|unpkg|jsdelivr|googletagmanager/g) || []).length === 0,
  JSON.stringify(DL_HTML.match(/@import|fonts\.googleapis|fonts\.gstatic|cdnjs|unpkg|jsdelivr|googletagmanager/g) || []));

// --- H2. THE TWO ADDRESSES, AND APPLE FIRST -------------------------------------------------
// The page carries both as hrefs. Google's has an & in its query string, so the page must escape
// it -- and the UNESCAPED form must appear nowhere, or a browser reads `&hl=ar` as an entity.
const PLAY_HTML = PLAY_STORE.replace(/&/g, '&amp;');
const hApple = DL_HTML.indexOf('href="' + APP_STORE + '"');
const hGoogle = DL_HTML.indexOf('href="' + PLAY_HTML + '"');
ok('H2: the page links the exact App Store address', hApple !== -1, 'at ' + hApple);
ok('H2: the page links the exact Google Play address, with & escaped', hGoogle !== -1, 'at ' + hGoogle);
ok('H2: ...and the unescaped Google address appears nowhere in it',
  hGoogle !== -1
    && (DL_HTML.match(/details\?id=app\.almurabbi\.tutor&(?!amp;)/g) || []).length === 0);
ok('H2: the App Store badge is FIRST -- Apple\'s own badge rule, not a preference',
  hApple !== -1 && hGoogle > hApple, hApple + ' < ' + hGoogle);
eq('H2: exactly two links to a store, and no third',
  (DL_HTML.match(/apps\.apple\.com|play\.google\.com/g) || []).length, 2);
// THE BADGE FILES, UNMODIFIED, out of the directory section B seals by SHA-256 -- so this page
// cannot show a redrawn badge without B going red on the bytes.
ok('H2: each link wraps the vendor\'s own badge file, from the directory B seals',
  DL_HTML.indexOf('<a class="badge" href="' + APP_STORE + '">\n<img src="/' + BADGE_APPLE + '" alt="App Store">\n</a>') !== -1
    && DL_HTML.indexOf('<a class="badge" href="' + PLAY_HTML + '">\n<img src="/' + BADGE_GOOGLE + '" alt="Google Play">\n</a>') !== -1);
eq('H2: ...and it shows no other image at all', (DL_HTML.match(/<img/g) || []).length, 2);
eq('H2: ...and names no badge asset but those two',
  (DL_HTML.match(/assets\/store-badges\//g) || []).length, 2);
// The vendors' sizes, which are the same two numbers the client renders the chooser's badges at:
// 40px tall -- the stricter of Apple's 40 and Google's 28 -- and one quarter of that clear.
ok('H2: both badges are 40px tall, at ONE height, with 10px clear space',
  DL_HTML.indexOf('.badge{display:block;padding:10px}') !== -1
    && DL_HTML.indexOf('.badge img{height:40px;width:auto;display:block;margin:0 auto}') !== -1
    && (DL_HTML.match(/height:40px/g) || []).length === 1
    && 10 === 40 / 4);
ok('H2: ...the same two numbers the client\'s own chooser uses',
  SRC.indexOf('const EZIK_BADGE_HEIGHT = 40;') !== -1
    && SRC.indexOf('const EZIK_BADGE_CLEAR = 10;') !== -1);
// APPLE'S CREDIT LINE, verbatim, and it is the client's own share.appleCredit string -- the same
// literal section C pins in both dictionary halves, so there is one wording and not two.
ok('H2: Apple\'s credit line is on the page, verbatim -- the client\'s own share.appleCredit',
  DL_HTML.indexOf('<p class="credit">' + CREDIT + '</p>') !== -1
    && AR.indexOf("'share.appleCredit': '" + CREDIT + "',") !== -1);
ok('H2: ...and Google is given no credit line, because Google\'s badge guideline asks for none',
  DL_HTML.indexOf('credit') !== -1
    && DL_HTML.indexOf('Google Inc') === -1 && DL_HTML.indexOf('trademarks of Google') === -1);
ok('H2: and a link back to the app, whose text is ezik.app',
  DL_HTML.indexOf('<a class="home" href="' + APP_URL + '">ezik.app</a>') !== -1);
// WITHOUT JAVASCRIPT THE PAGE STILL SHOWS BOTH BADGES -- true because both <a><img> pairs are in
// the served markup (above) and because the script writes no markup at all (here).
ok('H2: the script writes no markup, so the served page is what a visitor without JS reads',
  DL_JS.indexOf('location.replace') !== -1
    && !/document\s*\./.test(DL_JS) && !/innerHTML|createElement/.test(DL_JS));
// AND NO TEXT IS INVENTED. The whole body, tags and comments stripped, is exactly four things:
// the app's name, Apple's credit line, and the link whose text is ezik.app. A word added to this
// page -- a slogan, a "choose your store", a platform name -- fails here and nowhere else.
eq('H2: the page states only the name, the credit line and the link -- no invented text',
  DL_HTML.slice(DL_BODY_AT)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
  AYN + ' ' + CREDIT + ' ezik.app');

// --- H3. THE SCRIPT, RUN. Six user agents, and the navigation each one asks for. -------------
// EXECUTED in a vm sandbox rather than read for its shape, because what matters is the navigation
// it asks for and not the branch it took to get there. Every route a page has to a navigation is
// instrumented -- location.replace, location.assign, and assigning location.href -- so a rewrite
// that switches from one to another is still measured, and a second navigation is still counted.
// Nothing leaves the machine: the sandbox has no fetch, no XMLHttpRequest and no document, and
// the only globals it can see are the two named here.
const vm = require('vm');
function runSmartLink(ua, maxTouchPoints) {
  const went = [];
  const loc = { replace: (u) => went.push(String(u)), assign: (u) => went.push(String(u)) };
  Object.defineProperty(loc, 'href', {
    get: () => SMART_LINK,
    set: (u) => { went.push(String(u)); },
    enumerable: true,
  });
  if (DL_JS.length < 200) return ['NO SCRIPT: ' + DL_JS_REL + ' is absent or empty'];
  const sandbox = { navigator: { userAgent: ua, maxTouchPoints }, location: loc };
  sandbox.window = sandbox;
  vm.runInNewContext(DL_JS, sandbox, { timeout: 4000, filename: DL_JS_REL });
  return went;
}
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SMART_CASES = [
  ['an iPhone', UA_IPHONE, 5, [APP_STORE]],
  ['an iPad', UA_IPAD, 5, [APP_STORE]],
  // The iPad asking for the desktop site: it reports Macintosh and no iPad at all, and the only
  // thing left that separates it from a Mac is that it has a touch screen.
  ['an iPad asking for the desktop site -- Macintosh, maxTouchPoints 5', UA_MAC, 5, [APP_STORE]],
  // A REAL MAC IS SENT NOWHERE. This is the assertion that stops the Macintosh clause above from
  // quietly becoming "every Apple computer goes to the iOS App Store".
  ['a real Mac -- Macintosh, maxTouchPoints 0', UA_MAC, 0, []],
  ['an Android phone', UA_ANDROID, 5, [PLAY_STORE]],
  ['a Windows desktop', UA_WINDOWS, 0, []],
];
for (const [who, ua, touch, expected] of SMART_CASES) {
  let went;
  try { went = runSmartLink(ua, touch); } catch (e) { went = ['THREW: ' + (e && e.message)]; }
  const where = expected.length === 0 ? 'NO redirect, the page stays'
    : (expected[0] === APP_STORE ? 'the App Store' : 'Google Play');
  eq('H3: ' + who + ' -> ' + where, went, expected);
}
// And the six were six different runs of the real file, not one answer counted six times.
ok('H3: the script was executed six times, against six distinct devices',
  SMART_CASES.length === 6 && new Set(SMART_CASES.map((c) => c[1] + '#' + c[2])).size === 6);

// --- H4. ONE SET OF LINKS, IN FOUR PLACES ---------------------------------------------------
// download.js, download.html, the client and about.html must carry the SAME two addresses. Four
// copies is four chances to drift, and this is what makes drift fail instead of ship.
const jsLit = (name) => {
  const m = DL_JS.match(new RegExp('var ' + name + " = '([^']*)';"));
  return m ? m[1] : '';
};
eq('H4: the App Store address in download.js is the one the client declares', jsLit('APP_STORE'), APP_STORE);
eq('H4: the Google Play address in download.js is the one the client declares', jsLit('PLAY_STORE'), PLAY_STORE);
eq('H4: the App Store address in download.html is the same again',
  (DL_HTML.match(/href="(https:\/\/apps\.apple\.com[^"]*)"/) || [, ''])[1], APP_STORE);
eq('H4: the Google Play address in download.html is the same again, its & decoded',
  (DL_HTML.match(/href="(https:\/\/play\.google\.com[^"]*)"/) || [, ''])[1].replace(/&amp;/g, '&'), PLAY_STORE);
ok('H4: ...and about.html, which has carried both since the app was published, agrees',
  ABOUT.indexOf('href="' + decodeURIComponent(APP_STORE) + '"') !== -1
    && ABOUT.indexOf('href="' + PLAY_HTML + '"') !== -1);
eq('H4: download.js names exactly two addresses and no third',
  (DL_JS.match(/https?:\/\/[^'"\s]+/g) || []).sort(), [APP_STORE, PLAY_STORE].sort());

// --- H5. WHAT THE SHELL SHARES, AND WHAT IT STILL DOES NOT SHOW -----------------------------
ok('H5: the client declares the smart link exactly once, and it is the page measured above',
  (SRC.match(/const EZIK_SMART_LINK_URL = '[^']*';/g) || []).length === 1
    && SRC.indexOf("const EZIK_SMART_LINK_URL = '" + SMART_LINK + "';") !== -1);
eq('H5: ...and that address is the app\'s own origin plus the page that exists in this tree',
  SMART_LINK, APP_URL + '/' + DL_HTML_REL);
// `.html` AND NOT `/download`: vercel.json declares no cleanUrls, so an extensionless address
// would 404 on the deployment, and every public page of this site is linked with its extension.
const VERCEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
ok('H5: vercel.json declares no cleanUrls and no trailingSlash, which is WHY it carries .html',
  !('cleanUrls' in VERCEL) && !('trailingSlash' in VERCEL) && !('redirects' in VERCEL));
eq('H5: ...and no rewrite touches the new page',
  (VERCEL.rewrites || []).filter((r) => String(r.source).indexOf('download') !== -1), []);
ok('H5: ...as about.html links the other public pages, with the extension',
  ABOUT.indexOf('href="/delete.html"') !== -1 && ABOUT.indexOf('href="/privacy.html"') !== -1);
// THE DEPLOYMENT MUST CONTAIN BOTH FILES, or the share button hands over a 404.
const VI = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8');
eq('H5: neither new file is excluded from the deployment',
  [DL_HTML_REL, DL_JS_REL].filter((f) => new RegExp('^' + f.replace(/\./g, '\\.') + '\\s*$', 'm').test(VI)), []);
// AND THE SERVICE WORKER MUST NOT ANSWER IT WITH THE CACHED APP. sw.js is network-FIRST for every
// navigation: `req.mode === 'navigate'` goes to fetch(req), and the cache is only the offline
// fallback. That is already how about.html is served, which is why the new page needs no entry of
// its own -- and these are the assertions that would notice if that branch were turned around.
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').replace(/\r\n/g, '\n');
ok('H5: the worker is network-FIRST for navigations, so the server answers the new page',
  /if \(req\.mode === 'navigate' \|\|[\s\S]{0,260}?event\.respondWith\(\s*\n\s*fetch\(req\)/.test(SW));
eq('H5: ...and no branch of the worker names the new page, exactly as none names about.html',
  (SW.match(/download\.html|download\.js|about\.html/g) || []), []);
// AND THE SHELL STILL SHOWS NO STORE, NO PLATFORM AND NO CHOOSER. Case D asserts each of those
// over the handler; these re-assert them against the address that replaced EZIK_APP_URL, because
// a constant whose NAME is innocent could still carry a store name in its VALUE.
eq('H5: the smart link itself names no store and no platform',
  ['App Store', 'Google Play', 'Apple', 'apple', 'Android', 'android', 'Google', 'google', 'play']
    .filter((w) => SMART_LINK.indexOf(w) !== -1), []);
ok('H5: the shell path still returns before the chooser, which is therefore never built there',
  HANDLER.indexOf('ezikShareLinks({ url: EZIK_SMART_LINK_URL }, say);') !== -1
    && HANDLER.indexOf('return;') < HANDLER.indexOf('setShareOpen(true);'));
ok('H5: ...and the constant is used on the shell path and nowhere else in the client',
  (SRC.match(/EZIK_SMART_LINK_URL/g) || []).length === 2
    && (HANDLER.match(/EZIK_SMART_LINK_URL/g) || []).length === 1
    && CHOOSER.length > 600 && CHOOSER.indexOf('EZIK_SMART_LINK_URL') === -1);
// THE BROWSER CHOOSER DID NOT CHANGE. Part A's three payloads are the two store addresses and
// both together; none of them is the smart link, because a visitor who can already read a web
// page is offered the stores directly. That is the owner's ruling, and this is its assertion.
ok('H5: the browser chooser is untouched -- still the two store links and both together',
  CHOOSER.indexOf('pick({ url: EZIK_APP_STORE_URL })') !== -1
    && CHOOSER.indexOf('pick({ url: EZIK_PLAY_STORE_URL })') !== -1
    && CHOOSER.indexOf("pick({ text: EZIK_APP_STORE_URL + '\\n' + EZIK_PLAY_STORE_URL })") !== -1);
// AND THE APP'S OWN DETECTION IS UNCHANGED -- rule 7 of the order. The smart link moved the
// deciding OUT of the app and onto a public web page; download.js is the one place a user agent
// is read in this repository's client-facing code, and it is not part of the bundle.
ok('H5: no path of the client reads navigator.userAgent -- not the handler, chooser or share path',
  HANDLER.length > 100 && CHOOSER.length > 600 && SHARE_FN.length > 200
    && (HANDLER.match(/userAgent/g) || []).concat((CHOOSER.match(/userAgent/g) || []))
      .concat((SHARE_FN.match(/userAgent/g) || [])).length === 0);
ok('H5: ...and the landing page\'s script is where it IS read, deliberately and only there',
  DL_JS.indexOf('nav.userAgent') !== -1 && DL_JS.indexOf('maxTouchPoints') !== -1);

console.log('\n=== ' + (checks - failures) + '/' + checks + (failures ? '  FAIL ===' : '  PASS ==='));
process.exit(failures ? 1 : 0);
