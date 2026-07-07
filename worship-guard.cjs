'use strict';
/*
 * worship-guard.cjs — حارسُ انحدارِ نصوصِ العبادة (قراءةٌ فقط، لا يكتبُ في index.html)
 * ------------------------------------------------------------------------------
 * يلتقطُ النصَّ القانونيَّ لأعمدةِ العبادةِ كما هي الآن (مرجعٌ ذهبيّ)، ثم يكشفُ لاحقًا
 * إن أُعيدَ توليدُ عمودٍ أو انحرفَ نصُّه (تغيّرُ خطواتٍ أو حروف).
 *
 * بنيةُ الأعمدة في هذا المشروع: كلُّ عبادةٍ تفريعٌ حسبَ العمر داخلَ القالب:
 *     ${band === 'young' ? `<عمود الصغير>` : `<عمود البالغ>`}
 * فالبرنامجُ يلتقطُ الفرعين معًا لكلِّ عبادة، ويحرسُ كلًّا على حِدَة.
 * (يُلتقَطُ فقط ما يبدأُ فرعُه بلافتةِ ═══ — أي أعمدةُ العبادة، لا أيَّ تفريعٍ آخر.)
 *
 * الأطوار:
 *   node worship-guard.cjs --list        index.html
 *   node worship-guard.cjs --save-golden index.html worship-golden.json
 *   node worship-guard.cjs --compare     index.html worship-golden.json
 *
 * سلامة: لا يكتبُ في index.html أبدًا (قراءةٌ فقط منه). يكتبُ فقط worship-golden.json.
 * تطبيعُ المقارنة (دفتر الإدراج §٤): CRLF→LF · تجريدُ التشكيل · تسويةُ الهمزات.
 */

const fs = require('fs');
const crypto = require('crypto');
const BANNER = '\u2550\u2550\u2550';                 // ═══
const MARK = "${band === 'young' ? " + "`";           // بدايةُ تفريعِ العمر (يتبعُها فرعُ الصغير)

// ───────────── التطبيع ─────────────
function toLF(s){ return s.replace(/\r\n/g,'\n').replace(/\r/g,'\n'); }
function stripTashkeel(s){ return s.replace(/[\u064B-\u0652\u0670\u0640]/g,''); }
function normHamza(s){ return s.replace(/[\u0623\u0625\u0622\u0671]/g,'\u0627'); }
function bareForm(s){
  return normHamza(stripTashkeel(toLF(s))).split('\n')
    .map(l => l.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}
function rawForm(s){ return toLF(s).replace(/[ \t]+$/gm,'').trim(); }
function sha(s){ return crypto.createHash('sha256').update(s,'utf8').digest('hex').slice(0,16); }

function countSteps(block){
  let n = 0;
  for (const l of toLF(block).split('\n'))
    if (/^[\u0660-\u0669\d]+\s*[.\u066B]/.test(l.trim())) n++;
  return n;
}

// ───────────── استخراجُ أعمدةِ العبادة (تفريعُ العمر) ─────────────
function extractColumns(text){
  const src = toLF(text);
  const cols = [];
  let i = 0;
  while ((i = src.indexOf(MARK, i)) !== -1){
    const yStart = i + MARK.length;
    const yEnd = src.indexOf('`', yStart);
    if (yEnd === -1){ i = yStart; continue; }
    const young = src.slice(yStart, yEnd);
    const sep = src.slice(yEnd).match(/^`\s*:\s*`/);   // ` : `
    if (!sep){ i = yEnd + 1; continue; }               // ليس تفريعًا ثنائيًّا — تخطَّ
    const aStart = yEnd + sep[0].length;
    const aEnd = src.indexOf('`', aStart);
    if (aEnd === -1){ i = aStart; continue; }
    const adult = src.slice(aStart, aEnd);
    i = aEnd + 1;
    if (!young.trimStart().startsWith(BANNER)) continue; // أعمدةُ العبادةِ فقط (تبدأُ بلافتة)
    const titleOf = s => s.trimStart().split('\n')[0].split(BANNER).join('').trim();
    cols.push({ title: titleOf(young), band: 'young', body: young });
    cols.push({ title: titleOf(adult), band: 'adult', body: adult });
  }
  return cols;
}

function keyOf(c){ return `${c.title}  —  [${c.band}]`; }

function fingerprint(body){
  const raw = rawForm(body), bare = bareForm(body);
  return { steps: countSteps(body), lines: raw.split('\n').length,
           bareHash: sha(bare), rawHash: sha(raw), rawText: raw };
}

function lineDiff(oldRaw, newRaw){
  const A = bareForm(oldRaw).split('\n'), B = bareForm(newRaw).split('\n');
  const sA = new Set(A), sB = new Set(B);
  return { removed: A.filter(l=>!sB.has(l)), added: B.filter(l=>!sA.has(l)) };
}

function readOrDie(p){
  if (!fs.existsSync(p)){ console.error(`✗ الملفُّ غير موجود: ${p}`); process.exit(2); }
  return fs.readFileSync(p,'utf8');
}

// ───────────── الأطوار ─────────────
function cmdList(file){
  const cols = extractColumns(readOrDie(file));
  console.log(`\nوُجِدَ ${cols.length} فرعَ عبادةٍ (تفريعُ العمر) في ${file}:\n`);
  for (const c of cols){
    const fp = fingerprint(c.body);
    console.log(`  [${c.band.padEnd(5)}] خطوات=${String(fp.steps).padStart(2)} أسطر=${String(fp.lines).padStart(3)} ${fp.bareHash}  |  ${c.title.slice(0,52)}…`);
  }
  console.log('\nراجعِ الفروعَ بعينك ثم التقطها بـ --save-golden.\n');
}

function cmdSaveGolden(file, goldenPath){
  const cols = extractColumns(readOrDie(file));
  if (cols.length === 0){ console.error('✗ لم يُعثَرْ على أعمدةِ عبادةٍ (تفريعُ العمر ببدايةِ لافتة).'); process.exit(2); }
  const golden = { createdAt: new Date().toISOString(), source: file, blocks: {} };
  console.log(`\nالتُقِطَ ${cols.length} فرعَ عبادةٍ إلى المرجعِ الذهبيّ:\n`);
  for (const c of cols){
    const fp = fingerprint(c.body);
    golden.blocks[keyOf(c)] = { band: c.band, title: c.title, ...fp };
    console.log(`  ✓ [${c.band.padEnd(5)}] خطوات=${String(fp.steps).padStart(2)} ${fp.bareHash}  |  ${c.title.slice(0,48)}…`);
  }
  fs.writeFileSync(goldenPath, JSON.stringify(golden, null, 2), 'utf8');
  console.log(`\nحُفِظَ المرجعُ في: ${goldenPath}\n`);
}

function cmdCompare(file, goldenPath){
  const golden = JSON.parse(readOrDie(goldenPath));
  const cols = extractColumns(readOrDie(file));
  const cur = new Map(cols.map(c => [keyOf(c), c.body]));
  let hard = 0, soft = 0;
  console.log(`\nمقارنةُ ${file} بالمرجعِ ${goldenPath}:\n`);
  for (const [key, ref] of Object.entries(golden.blocks)){
    if (!cur.has(key)){ console.log(`  ✗ مفقود   | ${key}`); hard++; continue; }
    const fp = fingerprint(cur.get(key));
    if (fp.bareHash !== ref.bareHash){
      console.log(`  ✗ انحراف  | ${key}`);
      if (fp.steps !== ref.steps) console.log(`             عددُ الخطوات: ${ref.steps} ← أصبح ${fp.steps}`);
      const d = lineDiff(ref.rawText, cur.get(key));
      d.removed.forEach(l => console.log(`             − ${l}`));
      d.added.forEach(l   => console.log(`             + ${l}`));
      hard++;
    } else if (fp.rawHash !== ref.rawHash){
      console.log(`  ⚠ مراجعة  | تشكيلٌ/مسافاتٌ فقط: ${key}`); soft++;
    } else {
      console.log(`  ✓ سليم    | ${key}`);
    }
  }
  console.log(`\nالخلاصة: انحرافاتٌ صلبة=${hard} · مراجعاتٌ خفيفة=${soft}`);
  if (hard > 0){ console.log('النتيجة: فشل — انحرافٌ في عمودِ عبادة.\n'); process.exit(1); }
  console.log('النتيجة: نجاح — لا انحرافَ في الأعمدةِ المحروسة.\n');
}

function usage(){ console.log(`
worship-guard.cjs — حارسُ نصوصِ العبادة (قراءةٌ فقط)
  node worship-guard.cjs --list        index.html
  node worship-guard.cjs --save-golden index.html worship-golden.json
  node worship-guard.cjs --compare     index.html worship-golden.json
`); }

const a = process.argv.slice(2);
if (a[0]==='--list' && a[1]) cmdList(a[1]);
else if (a[0]==='--save-golden' && a[1] && a[2]) cmdSaveGolden(a[1], a[2]);
else if (a[0]==='--compare' && a[1] && a[2]) cmdCompare(a[1], a[2]);
else usage();
