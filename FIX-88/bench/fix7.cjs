'use strict';
// CORRECTING fix6 AGAINST THE HOUSE'S OWN CONVENTION.
//  * app.jsx reaches the session store as `window.sessionStorage` everywhere -- both existing
//    session keys do -- and tools/delete-truth-measure.cjs lifts resetAll with `window` faked
//    and nothing else, so a BARE `sessionStorage` is a name its harness cannot supply.
//  * a session key is not rostered in MUST_GO_*; those lists are about the DEVICE store, and a
//    key that never reaches localStorage would pass them vacuously. Its two siblings are excused
//    in NOT_A_STORAGE_KEY, in writing, with the sweep named. This one joins them.
const fs = require('fs');
const REPO = 'C:/Users/passe/projects/ustaz-fix88/';
let n = 0;
function edit(file, find, replace, label, times) {
  const p = REPO + file;
  const s = fs.readFileSync(p, 'utf8');
  const c = s.split(find).length - 1;
  if (c !== (times || 1)) throw new Error(label + ': anchor occurs ' + c + ' times in ' + file);
  fs.writeFileSync(p, s.split(find).join(replace), 'utf8');
  n += 1;
}

// -- 1. THE HOUSE'S SPELLING --------------------------------------------------
edit('app.jsx',
  '  try { sessionStorage.setItem(EZIK_RESUME_KEY, String(id)); } catch (e) {}',
  '  try { window.sessionStorage.setItem(EZIK_RESUME_KEY, String(id)); } catch (e) {}',
  'setItem');
edit('app.jsx',
  '    const v = sessionStorage.getItem(EZIK_RESUME_KEY);',
  '    const v = window.sessionStorage.getItem(EZIK_RESUME_KEY);',
  'getItem');
edit('app.jsx',
  '  try { sessionStorage.removeItem(EZIK_RESUME_KEY); } catch (e) {}',
  '  try { window.sessionStorage.removeItem(EZIK_RESUME_KEY); } catch (e) {}',
  'removeItem');

// -- 2. THE ROSTER ENTRY BECOMES AN EXCUSE, WHICH IS WHAT IT ALWAYS WAS -------
edit('tools/delete-truth-measure.cjs',
  "  // ITEM 88, DEFECT 14 -- THE PLACE THIS TAB WAS STANDING IN. It is entered HERE and not in\n"
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
  '',
  'unroster');

edit('tools/delete-truth-measure.cjs',
  "  EZIK_FB_DRAFT_KEY: 'a key into sessionStorage",
  "  // ITEM 88, DEFECT 14. THE THIRD KEY IN THIS STORE, EXCUSED ON THE SAME TERMS AS THE TWO ABOVE\n"
  + "  // IT, AND THE CASE BELOW HOLDS THIS SENTENCE TO ACCOUNT THE SAME WAY: it fails the moment\n"
  + "  // this literal is handed to localStorage anywhere in app.jsx.\n"
  + "  //\n"
  + "  // WHAT IT HOLDS. One shelf id -- 'fatwa', 'adhkar', 'articles' and nine others -- so that a\n"
  + "  // reader who refreshes the page in the middle of a section comes back to that section\n"
  + "  // instead of being thrown into the chat. Nothing about the reader is in it, nothing about\n"
  + "  // what he read there, and no position inside it.\n"
  + "  //\n"
  + "  // WHY sessionStorage IS NOT A CONVENIENCE HERE BUT THE WHOLE MECHANISM. The owner's ruling\n"
  + "  // has two halves: a refresh restores the place, and the FIRST opening of the app still lands\n"
  + "  // on the chat. Those are exactly the two properties of a session store -- it survives a\n"
  + "  // reload of the same tab and does not exist in a new one -- so the browser tells the two\n"
  + "  // cases apart and app.jsx never has to set, clear and get right a flag of its own. In\n"
  + "  // localStorage the second half of the ruling would be silently false.\n"
  + "  //\n"
  + "  // AND resetAll() SWEEPS IT, beside the two above: a device whose data has been deleted must\n"
  + "  // not walk whoever has it next into the section the last reader was in.\n"
  + "  EZIK_RESUME_KEY: 'a key into sessionStorage -- one browser tab, gone when the tab closes --'\n"
  + "    + ' and never handed to localStorage. It holds one shelf id so that a refresh comes back to'\n"
  + "    + ' the section, the store\\u2019s own lifetime is what keeps a FIRST opening on the chat, and'\n"
  + "    + ' resetAll() sweeps it from sessionStorage too',\n"
  + "  EZIK_FB_DRAFT_KEY: 'a key into sessionStorage",
  'excuse');

// -- 3. AND THE GUARD PINS THE HOUSE'S SPELLING ------------------------------
edit('theme-coverage-guard.cjs',
  "  /sessionStorage\\.setItem\\(EZIK_RESUME_KEY,/.test(html)\n"
  + "  && /sessionStorage\\.getItem\\(EZIK_RESUME_KEY\\)/.test(html)",
  "  /window\\.sessionStorage\\.setItem\\(EZIK_RESUME_KEY,/.test(html)\n"
  + "  && /window\\.sessionStorage\\.getItem\\(EZIK_RESUME_KEY\\)/.test(html)",
  'guard-spelling');

console.log('edits applied:', n);
