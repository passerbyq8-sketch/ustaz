'use strict';
// DEFECT 14, THE TWO GUARDS IT OWES. The record the repair adds is a key this
// application writes, so "delete all my data" must take it and the roster that
// holds that button to account must name it; and the boot's destination is pinned
// by theme-coverage-guard N10, whose CLAIM is untouched but whose spelling is not.
const fs = require('fs');
const REPO = 'C:/Users/passe/projects/ustaz-fix88/';
let n = 0;
function edit(file, find, replace, label) {
  const p = REPO + file;
  let s = fs.readFileSync(p, 'utf8');
  const c = s.split(find).length - 1;
  if (c !== 1) throw new Error(label + ': anchor occurs ' + c + ' times in ' + file);
  fs.writeFileSync(p, s.replace(find, replace), 'utf8');
  n += 1;
}

// -- 1. THE BUTTON TAKES IT ---------------------------------------------------
edit('app.jsx',
  "      try { localStorage.removeItem(EZC_GOLD_PRICE_KEY); } catch (e) {}\n",
  "      try { localStorage.removeItem(EZC_GOLD_PRICE_KEY); } catch (e) {}\n"
  + "      // DEFECT 14 (item 88) -- AND THE PLACE THIS TAB WAS STANDING IN, on the owner's standing\n"
  + "      // rule that every key this app writes is erased by «delete all my data». It is the only\n"
  + "      // one of these that lives in sessionStorage rather than localStorage, and it holds one\n"
  + "      // shelf id for the life of one tab -- but leaving it would return the device to half a\n"
  + "      // first open: no profile, no session, and then a refresh that walks the next reader\n"
  + "      // straight into the section the last one was reading. It is entered in\n"
  + "      // tools/delete-truth-measure.cjs in this same commit, which is the roster that holds\n"
  + "      // this line to account.\n"
  + "      ezikClearResume();\n",
  'resetAll');

// -- 2. THE ROSTER NAMES IT ---------------------------------------------------
edit('tools/delete-truth-measure.cjs',
  "  { lit: 'directConvoLocked' },\n",
  "  { lit: 'directConvoLocked' },\n"
  + "  // ITEM 88, DEFECT 14 -- THE PLACE THIS TAB WAS STANDING IN. It is entered HERE and not in\n"
  + "  // MUST_GO_NEW by that list's own rule, exactly as the tasbih's two keys are: MUST_GO_NEW\n"
  + "  // maps an erasure to a CLAUSE of delete.html, and that page names this in neither language,\n"
  + "  // so an entry there would be a false citation. What makes it lawful here is that the button\n"
  + "  // erases it and is asserted to keep erasing it.\n"
  + "  //\n"
  + "  // IT IS THE ONLY KEY ON EITHER LIST THAT LIVES IN sessionStorage, and it holds one shelf id\n"
  + "  // for the life of one tab. It goes anyway, on the owner's standing rule that every device\n"
  + "  // key this app writes is erased -- and for the reason ENTRY_CHOICE_KEY goes: left behind, a\n"
  + "  // refresh after the button would walk whoever has the device next straight into the section\n"
  + "  // the last reader was in, which is half a first open rather than a fresh one.\n"
  + "  { c: 'EZIK_RESUME_KEY' },\n",
  'roster');

// -- 3. THE BOOT GUARD, SAME CLAIM, CURRENT SPELLING --------------------------
edit('theme-coverage-guard.cjs',
  `ok('N10: the boot lands on an EMPTY thread and opens no saved conversation',
  /chatIdRef\\.current = null;\\s*\\r?\\n\\s*setChatId\\(null\\);\\s*\\r?\\n\\s*setMessages\\(\\[\\]\\);\\s*\\r?\\n\\s*setChatList\\(ezikListChats\\(ezikProfileKey\\(p\\)\\)\\);\\s*\\r?\\n\\s*setScreen\\('chat'\\);/.test(html));`,
  `// ITEM 88, DEFECT 14 -- THE CLAIM IS UNCHANGED AND THE SPELLING IS NOT. The four statements
// this line exists to protect -- no chat id, no chat id in state, an EMPTY message list, and the
// saved index loaded WITHOUT opening anything out of it -- are asserted exactly as before, in the
// same order, with nothing between them. What moved is the fifth line, the DESTINATION, and it
// moved on the owner's own ruling: a refresh in the middle of a section must come back to the
// section. So the destination is now an expression, and this asserts the expression BY NAME --
// ezikResumeScreen() and nothing else -- rather than accepting any expression at all. The two
// halves of that ruling are held by the case below, which is what keeps this one honest: a first
// opening still lands on the chat, and ezikResumeScreen is the only thing that decides.
ok('N10: the boot lands on an EMPTY thread and opens no saved conversation',
  /chatIdRef\\.current = null;\\s*\\r?\\n\\s*setChatId\\(null\\);\\s*\\r?\\n\\s*setMessages\\(\\[\\]\\);\\s*\\r?\\n\\s*setChatList\\(ezikListChats\\(ezikProfileKey\\(p\\)\\)\\);(?:\\s*\\r?\\n\\s*\\/\\/[^\\n]*)*\\s*\\r?\\n\\s*setScreen\\(ezikResumeScreen\\(\\)\\);/.test(html));
// ITEM 88, DEFECT 14 -- AND THE CHAT IS STILL WHERE THE APP OPENS. The destination above is an
// expression now, so the thing worth pinning is what that expression answers when this tab has
// never been used: 'chat', by a branch that is the FIRST thing in the function and takes no
// other path. A session store is what tells a first opening from a refresh, so a record read
// out of localStorage -- which outlives the tab -- would break the ruling silently; that is
// pinned too. And the record is a shelf id, never a screen name pulled from the reader.
ok('N10: ...and a tab that has never been used still opens on the chat',
  /function ezikResumeScreen\\(\\) \\{\\s*\\r?\\n\\s*const id = ezikReadResume\\(\\);\\s*\\r?\\n\\s*if \\(!id\\) return 'chat';/.test(html));
ok('N10: ...and the place is remembered for the TAB, never for the device',
  /sessionStorage\\.setItem\\(EZIK_RESUME_KEY,/.test(html)
  && /sessionStorage\\.getItem\\(EZIK_RESUME_KEY\\)/.test(html)
  && html.indexOf('localStorage.getItem(EZIK_RESUME_KEY') === -1
  && html.indexOf('localStorage.setItem(EZIK_RESUME_KEY') === -1);`,
  'N10');

console.log('edits applied:', n);
