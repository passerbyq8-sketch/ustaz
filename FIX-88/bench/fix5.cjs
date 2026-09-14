'use strict';
// DEFECT 14 -- a refresh in the middle of a section throws the reader into the chat.
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

// -- 1. THE RECORD ------------------------------------------------------------
one(
  'const EZIK_ART_LIST_ROUTE = ',
`// ============================================================
// DEFECT 14 (item 88) -- A REFRESH COMES BACK TO THE SECTION, AND THE FIRST OPENING
// STILL LANDS ON THE CHAT
// ============================================================
// WHAT WAS MEASURED. A section was opened from the shelf, the page was refreshed, and the
// reader landed on the CHAT -- in 16 of the check round's 24 readings, and again here on a
// local bench in all six sections tried (المقالات، الأذكار، الفتاوى، الدروس، المصحف، ركن
// النساء). Item 87 lost its open phase the same way. The boot effect answers setScreen('chat')
// for every returning profile, and nothing anywhere remembered that the reader was standing
// somewhere else when the page went away.
//
// WHY sessionStorage AND NOT localStorage, AND IT IS THE WHOLE DESIGN. The owner's ruling is
// that the chat REMAINS the first thing the app opens on, and that only a refresh restores the
// place. Those are exactly the two halves of a session store: it survives a reload of the same
// tab and it does not exist in a new one. So «فتحٌ أوّل» and «تحديث» are told apart by the
// browser itself rather than by a flag this file would have to set, clear and get right.
// A locked or full store degrades to «no memory», which is the behaviour that shipped.
//
// WHAT IS RECORDED IS A SHELF ID AND NOTHING ELSE. Not a screen name -- several of these
// sections are LAYERS and own no "screen" value, which is why the check round found the defect
// in الأسماء and «من الاستيقاظ إلى النوم» as well as in the routed ones. The id is the one the
// shelf array already carries, so the twelve tiles are covered by construction and a thirteenth
// is covered the day it is added. Nothing about scroll position, nothing about what was open
// INSIDE the section, and nothing that could name the reader.
const EZIK_RESUME_KEY = 'ezik_resume_section_v1';

// THE THREE TABLES ARE THE WHOLE ROUTING, and an id in none of them is not recorded at all.
// رحلة الكنوز is deliberately absent: it is a page navigation to /quest.html, and a refresh
// there is the browser reloading quest.html -- there is nothing for this file to restore, and
// recording it would send a reader who had merely walked back to the shelf somewhere he was
// not standing.
const EZIK_RESUME_SCREENS = {
  memorize: 'memorize', adhkar: 'adhkar', arbaeen: 'arbaeen',
  mushaf: 'mushaf', fatwa: 'fatwa', lessons: 'lessons',
};
const EZIK_RESUME_APP_LAYERS = { asmaa: 1, 'sunan-day': 1 };
const EZIK_RESUME_HOME_LAYERS = { articles: 1, women: 1, prayer: 1 };
function ezikResumeKnown(id) {
  return !!(EZIK_RESUME_SCREENS[id] || EZIK_RESUME_APP_LAYERS[id] || EZIK_RESUME_HOME_LAYERS[id]);
}
function ezikWriteResume(id) {
  if (!ezikResumeKnown(id)) return;
  try { sessionStorage.setItem(EZIK_RESUME_KEY, String(id)); } catch (e) {}
}
function ezikReadResume() {
  try {
    const v = sessionStorage.getItem(EZIK_RESUME_KEY);
    return (typeof v === 'string' && ezikResumeKnown(v)) ? v : '';
  } catch (e) { return ''; }
}
function ezikClearResume() {
  try { sessionStorage.removeItem(EZIK_RESUME_KEY); } catch (e) {}
}
// WHERE THE BOOT SHOULD LAND. '' means nothing was recorded, and the answer is the chat --
// byte for byte the destination that shipped.
function ezikResumeScreen() {
  const id = ezikReadResume();
  if (!id) return 'chat';
  if (EZIK_RESUME_SCREENS[id]) return EZIK_RESUME_SCREENS[id];
  return 'home';   // a layer: whoever owns it opens it on its own first render
}

const EZIK_ART_LIST_ROUTE = `,
  'record');

// -- 2. THE ONE WRITER: the shelf tile ---------------------------------------
one(
`    <button type="button" className={'ezhome-focus ezist-' + (feature ? 'feature' : 'mod ezist-mod-' + m.id)}
      onClick={m.onClick} data-ezik-home-module={m.id}`,
`    <button type="button" className={'ezhome-focus ezist-' + (feature ? 'feature' : 'mod ezist-mod-' + m.id)}
      /* DEFECT 14 (item 88): THE ONE PLACE THE READER'S PLACE IS RECORDED. It is here and not
         in the twelve handlers because here there is one press, one id and one line -- and
         because a tile added tomorrow is recorded without anybody remembering to. The tile's
         own handler is called exactly as before, on the same press, and nothing about what it
         does changed. */
      onClick={() => { ezikWriteResume(m.id); if (m.onClick) m.onClick(); }} data-ezik-home-module={m.id}`,
  'writer');

// -- 3. THE APP: the boot destination, and its own two layers ----------------
one(
  "        setScreen('chat');   // D85: a returning profile also lands on the chat",
  "        // DEFECT 14 (item 88): 'chat' unless THIS TAB was standing somewhere when it\n"
  + "        // reloaded. A new tab has no session record, so the first opening of the app is\n"
  + "        // the chat exactly as D85 wrote it; ezikResumeScreen() answers 'chat' for it.\n"
  + "        setScreen(ezikResumeScreen());   // D85: a returning profile also lands on the chat",
  'boot');

one(
  '  const [asmaaOpen, setAsmaaOpen] = useState(false);',
  "  // DEFECT 14 (item 88): the two layers App owns that are shelf sections read the resume\n"
  + "  // record in their LAZY INITIALISER rather than from an effect, so the layer is open on the\n"
  + "  // very first render and no frame of the home is painted underneath it on the way.\n"
  + "  const [asmaaOpen, setAsmaaOpen] = useState(() => ezikReadResume() === 'asmaa');",
  'asmaa');

one(
  '  const [sunanOpen, setSunanOpen] = useState(false);',
  "  const [sunanOpen, setSunanOpen] = useState(() => ezikReadResume() === 'sunan-day');",
  'sunan');

// -- 4. THE HOME OWNER: its own three, and the one place the record is forgotten
one(
  '  const [artSection, setArtSection] = useState(null);',
  "  // DEFECT 14 (item 88): restored in the lazy initialiser, for the reason written beside the\n"
  + "  // two App layers -- the section is open on the first render, not one paint later.\n"
  + "  const [artSection, setArtSection] = useState(() => {\n"
  + "    const id = ezikReadResume();\n"
  + "    return (id === 'articles' || id === 'women') ? id : null;\n"
  + "  });",
  'artSection');

one(
  '  const [prayerOpen, setPrayerOpen] = useState(false);',
  "  const [prayerOpen, setPrayerOpen] = useState(() => ezikReadResume() === 'prayer');",
  'prayerOpen');

// -- 5. AND THE ONE PLACE IT IS FORGOTTEN -------------------------------------
// The bare shelf is the only screen in the application on which the reader is standing
// nowhere in particular, and this component is the only thing that draws it. So the record
// dies exactly there and nowhere else: no closer has to remember to clear it, and no closer
// can clear it early. Every layer App owns returns BEFORE <Home>, so this effect does not run
// at all while الأسماء or «من الاستيقاظ إلى النوم» is open -- which is what keeps a second
// refresh inside them working.

one(
  '  useEzikBackLayer(calcOpen, () => setCalcOpen(false));',
  "  useEzikBackLayer(calcOpen, () => setCalcOpen(false));\n"
  + "  // DEFECT 14 (item 88) -- WHERE THE RECORD DIES, and it is one place.\n"
  + "  // The reader is standing nowhere in particular exactly when this component has no layer of\n"
  + "  // its own open, which is when it draws the bare shelf; every layer App owns returns before\n"
  + "  // <Home> is reached, so this effect does not run at all while one of those is up and a\n"
  + "  // second refresh inside الأسماء still comes back to it. On the first commit after a\n"
  + "  // restore the layer is ALREADY open -- it was set in a lazy initialiser, not an effect --\n"
  + "  // so this cannot clear the record out from under the very restore that just happened.\n"
  + "  useEffect(() => {\n"
  + "    if (artSection || prayerOpen || compassOpen || tasbihOpen || tasbihLogOpen || calcOpen || wirdPickOpen) return;\n"
  + "    ezikClearResume();\n"
  + "  }, [artSection, prayerOpen, compassOpen, tasbihOpen, tasbihLogOpen, calcOpen, wirdPickOpen]);",
  'clear');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'chars', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
