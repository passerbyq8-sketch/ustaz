'use strict';
// D3B F5 (BEFORE_WRITING_V1) — an honest disclosure of what is missing is kept.
// The deliverableText filter no longer deletes, on a before-writing fiqh turn, a sentence saying «لم أقف …
// على/فيه/عليه» (witnesses Q14 «العدد», Q40 «أقل المدة»), whatever mechanism phrase it carries; every
// other turn filters exactly as before. And the one «لم أقف» line does not repeat an item the answer
// already discloses in place. Replays the recorded drafts (guards/fixtures/fix-d3b-witnesses.json).
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const rootAt = process.argv.indexOf('--root');
const ROOT = rootAt < 0 ? path.join(__dirname, '..') : process.argv[rootAt + 1];
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/fix-d3b-witnesses.json'), 'utf8'));
const turn = (q) => W.turns.find((t) => t.q === q);
let checks = 0, failed = 0;
const ok = (name, pass, info) => { checks++; if (!pass) failed++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || info === undefined ? '' : ' :: ' + info)); };
(async () => {
  const L = await import(pathToFileURL(path.join(ROOT, 'lib/free-brain/loop.js')));
  const RR = await import(pathToFileURL(path.join(ROOT, 'lib/ruling-review.js')));
  const bw = { beforeWritingFiqh: true };
  // Q14 — the number-of-worshippers paragraph and the khutba-conditions item.
  const d14 = turn(14).draft;
  const kept14 = L.deliverableText(d14, [], bw);
  ok('F5 Q14 «العددُ الذي تنعقدُ به الجمعة — لم أقفْ…» is kept on a before-writing fiqh turn',
    kept14.includes('لم أقفْ في المادّةِ المتاحةِ على نصٍّ في مقدارِ العددِ عند المذاهبِ الأربعةِ'), kept14.slice(-900));
  ok('F5 Q14 «شروطُ الخطبةِ عند بقيّةِ المذاهب — لم أقفْ على نصٍّ فيها» is kept', kept14.includes('شروطُ الخطبةِ عند بقيّةِ المذاهب'));
  ok('F5 Q14 its section heading «ما لم أقفْ عليه» is kept with it', kept14.includes('ما لم أقفْ عليه في المادّةِ المتاحة'));
  // Q40 — the minimum-duration disclosure and the preference line.
  const d40 = turn(40).draft;
  const kept40 = L.deliverableText(d40, [], bw);
  ok('F5 Q40 «وأمّا الشافعيّةُ والحنابلةُ فلم أقفْ … على تحديدٍ صريحٍ لأقلِّ المدّةِ» is kept', kept40.includes('على تحديدٍ صريحٍ لأقلِّ المدّةِ عندَهم'));
  ok('F5 Q40 «ولم أقفْ … على ترجيحٍ صريحٍ منسوبٍ في مسألةِ أقلِّ المدّة» is kept', kept40.includes('على ترجيحٍ صريحٍ منسوبٍ في مسألةِ أقلِّ المدّة'));
  ok('F5 Q40 mechanism talk that discloses nothing still goes («وما وقفتُ عليه في النصوصِ المتاحةِ هو:»)', !kept40.includes('وما وقفتُ عليه في النصوصِ المتاحةِ هو'));
  // Scope: any other turn filters exactly as before.
  ok('F5 scope: without the before-writing fiqh flag the Q14 and Q40 drafts filter byte-identically to before',
    !L.deliverableText(d14, []).includes('لم أقفْ في المادّةِ المتاحةِ على نصٍّ في مقدارِ العددِ') && !L.deliverableText(d40, []).includes('على تحديدٍ صريحٍ لأقلِّ المدّةِ عندَهم'));
  ok('F5 scope: the owner\'s b37 witness («لم أجد في المصادر المتاحة إجابة…») still goes on every turn',
    !L.deliverableText('لم أجد في المصادر المتاحة إجابة خاصة بهذا السؤال بالضبط، فأحيلك إلى المختصين.', [], bw).includes('المصادر المتاحة'));
  // The line does not repeat what is disclosed in place.
  const body = 'وأما الشافعية والحنابلة فلم أقف على تحديد صريح لأقل المدة عندهم.\nوالاعتكاف سنة.';
  const line = RR.terminalNotFound(body, ['ولم أقفْ على تحديدٍ صريحٍ لأقلِّ المدّة عند الشافعية والحنابلة.', 'ولم أقفْ على نصٍّ في حكمِ اعتكافِ الصبيّ.']);
  ok('F5 the one line names what is not already disclosed, and does not repeat what is', !/لأقلِّ المدّة عند الشافعية/u.test(line.split('\n').at(-1)) && /اعتكافِ الصبيّ/u.test(line.split('\n').at(-1)), line);
  ok('F5 the in-place disclosure itself stays where it was, whole', line.startsWith('وأما الشافعية والحنابلة فلم أقف على تحديد صريح لأقل المدة عندهم.'));
  console.log('D3B-F5 ' + (checks - failed) + '/' + checks); process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
