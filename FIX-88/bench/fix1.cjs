'use strict';
// DEFECT 5 + 6 -- the two sections that told the reader the network had died
// while it was up. Splice by ASCII anchors; the Arabic is written here as the
// only place it is typed, and the file is written back as UTF-8 with LF.
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

// -- 1. THE TWO NEW LINES IN THE DICTIONARY, on the shape of their sisters ----
one(
  "    'articles.error': 'تعذَّر جلبُ ما في هذا القسم. تحقَّقْ من الاتصال ثمّ أعِدِ المحاولة.',\n",
  "    'articles.error': 'تعذَّر جلبُ ما في هذا القسم. تحقَّقْ من الاتصال ثمّ أعِدِ المحاولة.',\n"
  + "    'articles.throttled': 'تجاوزتَ حدَّ الطلبات. انتظرْ قليلاً ثمّ أعِدِ المحاولة.',\n",
  'ar-articles.error');

one(
  "    'articles.error': 'This section could not be loaded. Check the connection, then try again.',\n",
  "    'articles.error': 'This section could not be loaded. Check the connection, then try again.',\n"
  + "    'articles.throttled': 'Too many requests just now. Wait a moment, then try again.',\n",
  'en-articles.error');

// -- 2. THE FOURTH STATE ------------------------------------------------------
one(
  "const EZIK_ART_FAILED = 'failed';\n",
  "const EZIK_ART_FAILED = 'failed';\n"
  + "// DEFECT 5 + 6 (item 88) -- A FIFTH WORD, BECAUSE THERE ARE FIVE OUTCOMES AND NOT FOUR.\n"
  + "// MEASURED, on a bench that forces each answer in turn: /api/articles-list replied 429 to\n"
  + "// 48 of this round's requests, and every one of them reached the reader as «تعذَّر جلبُ ما في\n"
  + "// هذا القسم. تحقَّقْ من الاتصال» -- a sentence about his connection, printed while his\n"
  + "// connection was up. He then checked a network that was never the matter and pressed a\n"
  + "// retry that could only earn him another 429.\n"
  + "//\n"
  + "// A THROTTLE IS NOT AN OUTAGE AND IS NOT AN EMPTY SHELF. It is the server saying «not so\n"
  + "// fast», it passes on its own, and the only useful thing a reader can do about it is wait --\n"
  + "// which is a different instruction from «check your connection» and needs its own sentence.\n"
  + "// So the status code is carried out of the fetch instead of being flattened at the door,\n"
  + "// and no code is dressed as another one anywhere below.\n"
  + "const EZIK_ART_THROTTLED = 'throttled';\n",
  'state-const');

// -- 3. THE FETCH KEEPS THE REASON -------------------------------------------
one(
`async function ezikArticlesFetchList(section, signal) {
  try {
    const url = EZIK_ART_LIST_ROUTE + '?section=' + encodeURIComponent(section)
      + '&limit=' + EZIK_ART_LIMIT;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    if (response.status !== 200) return { ok: false, rows: [] };
    const payload = await response.json();
    if (!payload || payload.ok !== true) return { ok: false, rows: [] };
    return { ok: true, rows: ezikArticleRows(payload.items) };
  } catch (e) {
    return { ok: false, rows: [] };
  }
}`,
`async function ezikArticlesFetchList(section, signal) {
  try {
    const url = EZIK_ART_LIST_ROUTE + '?section=' + encodeURIComponent(section)
      + '&limit=' + EZIK_ART_LIMIT;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
    // DEFECT 5 + 6 (item 88): 429 IS CARRIED OUT UNDER ITS OWN NAME. It is the one status this
    // screen can say something USEFUL about that the outage line does not say, so it is the one
    // that is separated. Every other status, an unreadable body, a cut connection and the
    // timeout stay one bucket, because a reader has one thing to do about all of them.
    if (response.status === 429) return { ok: false, why: 'throttled', rows: [] };
    if (response.status !== 200) return { ok: false, why: 'failed', rows: [] };
    const payload = await response.json();
    if (!payload || payload.ok !== true) return { ok: false, why: 'failed', rows: [] };
    return { ok: true, why: '', rows: ezikArticleRows(payload.items) };
  } catch (e) {
    return { ok: false, why: 'failed', rows: [] };
  }
}`,
  'fetch-list');

// -- 4. THE SCREEN READS IT ---------------------------------------------------
one(
  "      if (!outcome.ok) { setRows([]); setState(EZIK_ART_FAILED); return; }",
  "      // DEFECT 5 + 6 (item 88): the reason chooses the sentence, and nothing else does.\n"
  + "      if (!outcome.ok) {\n"
  + "        setRows([]);\n"
  + "        setState(outcome.why === 'throttled' ? EZIK_ART_THROTTLED : EZIK_ART_FAILED);\n"
  + "        return;\n"
  + "      }",
  'load-branch');

// -- 5. AND SAYS IT -----------------------------------------------------------
one(
`      {/* STATE 4 of 4: the section has published writing in it. Newest first -- and that order is
          the STORE'S, read off a sorted index, never re-sorted here. */}`,
`      {/* DEFECT 5 + 6 (item 88) -- THE THROTTLE, IN ITS OWN WORDS. Not the outage line, which
          sends the reader to look at a connection that is working, and emphatically not the
          empty state, which would tell him the section holds nothing when nobody knows yet what
          it holds. The retry button stays, because waiting and pressing again IS the remedy
          here -- it is the only one of the three failure readings where it is. */}
      {state === EZIK_ART_THROTTLED ? (
        <div role="alert" style={s.artError}>
          <span>{ezT('articles.throttled')}</span>
          <button type="button" className="ezhome-focus" style={s.artRetry}
            onClick={load}>{ezT('common.retry')}</button>
        </div>
      ) : null}

      {/* STATE 4 of 4: the section has published writing in it. Newest first -- and that order is
          the STORE'S, read off a sorted index, never re-sorted here. */}`,
  'render-state');

fs.writeFileSync(P, s, 'utf8');
console.log('anchors applied:', n, 'bytes', before.length, '->', s.length);
if (s === before) { console.error('NO CHANGE'); process.exit(1); }
