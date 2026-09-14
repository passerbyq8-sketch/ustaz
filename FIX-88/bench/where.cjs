'use strict';
// WHICH SCREEN AM I ON? Named by a thing only that screen carries, so a section
// that happens to mention another section's name cannot be mistaken for it.
//
// MEASURED TRAP: the CHAT draws suggestion cards that carry every module's name
// AND its subtitle (`module.*.sub`). A "is the shelf on screen" test built from
// module names alone answers yes on the chat -- which is exactly the screen the
// refresh defect lands on, so that test would have called the defect fixed.
// The shelf draws names with NO subtitles; the chat draws the subtitles and a
// composer placeholder. So: the composer names the chat, and the shelf is named
// by module names WITHOUT the subtitle beside them.
function whereAmI(text, AR) {
  const t = String(text || '');
  const hasComposer = AR['chat.placeholder'] && t.indexOf(AR['chat.placeholder']) >= 0;
  const subs = ['module.fatwa.sub', 'module.mushaf.sub', 'module.treasure.sub']
    .filter((k) => AR[k] && t.indexOf(AR[k]) >= 0).length;
  const names = ['module.fatwa', 'module.mushaf', 'module.lessons', 'module.adhkar']
    .filter((k) => AR[k] && t.indexOf(AR[k]) >= 0).length;
  if (subs >= 2) return 'chat';
  if (hasComposer) return 'chat';
  if (names >= 3) return 'shelf';
  return 'other';
}
module.exports = { whereAmI };
