'use strict';
// DEFECT 4 -- the complaint door that carried the reader off the screen without
// telling him what became of his message.
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

// -- 1. THE REFUSAL SPEAKS, AND THE HAND-OFF IS A SEPARATE ACT ---------------
one(
`  const divertToSignIn = () => {
    writeFbDraft({ type, text, contact, wants: EZIK_FB_WANTS_SIGNIN });
    setBusy(false);
    setErr(ezT('feedback.signInRequired'));
    if (typeof onSignIn === 'function') onSignIn();
  };`,
`  // DEFECT 4 (item 88) -- THE LINE IS SAID, AND THE SCREEN DOES NOT MOVE.
  //
  // WHAT WAS MEASURED. Seventy-six characters were typed into the one visible field and
  // «إرسال» was pressed. The panel set feedback.signInRequired on the line above and then
  // called onSignIn() ON THE SAME TICK -- which pops this panel's history entry and opens
  // الإعدادات. React never painted a frame carrying the sentence: the reader watched his
  // complaint screen turn into a settings screen and was told nothing at all about his
  // message. Not one of the six outcome lines this panel owns reached the glass, and the
  // draft it had just saved was invisible from where he now stood.
  //
  // SO THE TWO ACTS ARE SPLIT. This one is the REFUSAL: it keeps what he wrote, says why
  // it was refused, and leaves him looking at his own words. The «تسجيل الدخول» button
  // below -- which this panel already draws the moment "err" is set -- is the HAND-OFF, and
  // it is his press and not ours. Nothing about the draft changes: both routes write it
  // through the same function, so either way the text survives the trip.
  const refuseForSignIn = () => {
    writeFbDraft({ type, text, contact, wants: EZIK_FB_WANTS_SIGNIN });
    setBusy(false);
    setErr(ezT('feedback.signInRequired'));
  };

  // THE HAND-OFF, and the only thing in this file that leaves the panel. It is wired to the
  // button the reader presses after reading the line above, and to nothing else.
  const divertToSignIn = () => {
    writeFbDraft({ type, text, contact, wants: EZIK_FB_WANTS_SIGNIN });
    setBusy(false);
    if (typeof onSignIn === 'function') onSignIn();
  };`,
  'divert');

// -- 2. THE TWO REFUSAL PATHS TAKE THE SPEAKING ONE --------------------------
one(
    "    if (!held || typeof held.session !== 'string' || !held.session) { divertToSignIn(); return; }",
    "    if (!held || typeof held.session !== 'string' || !held.session) { refuseForSignIn(); return; }",
  'client-check');

one(
    "    if (res && res.status === 401) { divertToSignIn(); return; }",
    "    if (res && res.status === 401) { refuseForSignIn(); return; }",
  'server-401');

// -- 3. AND THE SENT MESSAGE IS ANNOUNCED WHERE HE IS LOOKING ----------------
// `done` already replaces the form with feedback.thanks, so the success path had a line;
// what it did not have was a live region a reader who cannot see the screen would be told
// about. artNote carries role="status" already -- verified at its other call sites -- so
// this is left exactly as it is rather than changed for the sake of changing something.

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
