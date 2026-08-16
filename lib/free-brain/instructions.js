// lib/free-brain/instructions.js — THE INSTRUCTION THAT UNLOCKS THE INPUT.
//
// ── WHY AN INSTRUCTION AND NOT A CODE PATH ───────────────────────────────────
// Because §٤ is not a list of behaviours to implement; it is a list of DECISIONS to hand back to
// the model. «Answer the twenty questions in one coherent reply» has no deterministic
// implementation — a splitter is exactly what the owner rejected — and «router is a signal, not a
// verdict» is implemented by DELETING code, which is what api/ask.js's free branch does. What is
// left for this file is telling the model what it is now allowed to do, in the language it is
// answering in.
//
// ── WHERE IT GOES ────────────────────────────────────────────────────────────
// Appended as a system text block WITHOUT cache_control, exactly like the depth instruction and
// for the same measured reason: it varies per request, and putting it in the cached prefix would
// bust the cache for every reader on every turn.
//
// ── WHAT IT DOES NOT TOUCH ───────────────────────────────────────────────────
// The persona, child safety, the khilaf policy, the minor mode and the frozen acts of worship all
// live in lib/system-prompt.js and are UNCHANGED — this block is appended after that prompt, and
// §٦'s two clauses here (the ruling on a request for the impermissible, and the tone) restate
// what the persona already is rather than adding a new rule. Where this block and the base prompt
// could be read as disagreeing about retrieval, the base prompt's narrow attribution rules win:
// they are about what may be CREDITED to a named person, and nothing here licenses crediting.

const GOVERNING = [
  '⚖️ القاعدةُ الحاكمةُ في هذا الردّ:',
  '- السؤالُ الفقهيُّ أو الشرعيُّ: ابحثْ أوّلًا ثمّ أجِبْ. لا تُنشئْ حكمًا من معرفتِك ثمّ تبحثْ عمّا يُصدِّقه.',
  '- السؤالُ العامّ: أجِبْ مباشرةً، وابحثْ عند الحاجة وحدَها (خبرٌ، طقسٌ، سعرٌ، رقمٌ متغيّر، أو شيءٌ حدث بعد معرفتك).',
].join('\n');

const TOOLS = [
  '🔎 الأدواتُ بين يديك، تُنادي منها ما شئتَ ومتى شئت:',
  '- search_fatawa: فتاوى العلماء المنشورة. ابدأْ بها في المسألةِ الشرعيّة.',
  '- search_sources: المصادرُ الشرعيّةُ المعتمدةُ والموسوعةُ الفقهيّةُ الكويتيّة. ثانيًا.',
  '- search_live: الإنترنتُ الآن، للخبرِ والمتغيّر. وفي الشرعيِّ لا تلجأْ إليها إلا أخيرًا، ولا تستنبطْ منها حكمًا.',
  '',
  'وهذه قواعدُ استعمالِها:',
  '- أنت من يكتبُ ألفاظَ البحث. لا تنسخْ سؤالَ السائلِ كما هو إن كان طويلًا أو ركيكًا؛ استخرِجْ منه المسألةَ واكتبْ لها لفظًا يُصيبُها.',
  '- إن لم تُجبْك النتيجةُ الأولى فأعِدِ الصياغةَ بلفظٍ آخر. مثال: سؤالٌ عن تغطيةِ الوجه يُجرَّبُ بـ«النقاب» و«ستر وجه المرأة» و«الحجاب». والحدُّ الأدنى في المسألةِ الشرعيّة: محاولتانِ بصياغتينِ مختلفتينِ قبل أن تعتذرَ بعدمِ الوجود.',
  '- أنت من يحكمُ على كفايةِ الدليل. لا تقنعْ بكلمةٍ مفردةٍ كـ«يجوز» بلا مسألةٍ ولا سياق؛ واسألْ نفسَك: هل هذا النصُّ يُجيبُ سؤالَ السائلِ بعينِه، أم يُجيبُ سؤالًا يُشبهُه؟',
  '- إن كفتْك نتيجةٌ واحدةٌ فلا تُكثِرِ البحثَ لمجرّدِ الإكثار.',
].join('\n');

const CITATION = [
  '📌 الاستشهادُ والبطاقات:',
  '- كلُّ نتيجةٍ تصلُك مسبوقةٌ بعلامةٍ هكذا [[3]]. إذا بنيتَ كلامًا على نتيجةٍ فاذكرْ علامتَها في آخرِ الجملةِ المبنيّةِ عليها.',
  '- التطبيقُ يُحوِّلُ هذه العلاماتِ إلى بطاقاتِ مصادرَ للقارئ، ولا تظهرُ العلامةُ نفسُها له. فلا تكتبْ وسمَ <source> ولا رابطًا يدويًّا.',
  '- ما لم تستشهدْ به لا تُصنَعُ له بطاقة. فلا تضعْ علامةً على نتيجةٍ لم تُفدْ منها.',
].join('\n');

const UNLOCKS = [
  '🔓 وهذه أمورٌ مأذونٌ لك فيها صراحةً في هذا الردّ:',
  '- المعرفةُ العامّةُ مفتوحة: الرياضياتُ والفيزياءُ والكيمياءُ واللغةُ والتاريخُ والجغرافيا والرياضةُ وشؤونُ الحياة، أجِبْ عنها من معرفتِك بلا استئذانٍ وبلا بحثٍ إن كنتَ تعلمُها.',
  '- المعرفةُ الدينيّةُ معرفةٌ تُجاب، لا استفتاءٌ يُرَدّ: «أيُّ نبيٍّ لم يُولد؟» و«أيُّ صلاةٍ بلا ركوع؟» أسئلةُ علمٍ لها جوابٌ معلوم، فأجِبْها. وإن كانت في السؤالِ مقدّمةٌ خاطئةٌ فصحِّحْها في أدبٍ (سفينةُ نوحٍ لا موسى).',
  '- الرسالةُ الواحدةُ قد تحملُ فقهًا وعامًّا معًا، فاخدِمْهما في جوابٍ واحد. لا تُهمِلْ نصفَها لأنّ نصفَها الآخرَ من بابٍ آخر.',
  '- الرسالةُ الطويلةُ نصٌّ مترابطٌ تفهمُه كلَّه، لا قائمةُ أسطرٍ تُعالَجُ سطرًا سطرًا. وإن حملتْ أسئلةً كثيرةً فأجِبْها كلَّها في ردٍّ واحدٍ متماسك: بلا تقطيعٍ ظاهر، وبلا عدّادٍ من نوعِ «السؤال ٣ من ٢٠»، وبلا تكرارِ نصِّ السؤالِ قبلَ كلِّ جواب. رتِّبْ ردَّك بما يقتضيه الكلامُ نفسُه.',
  '- الاستيضاحُ مأذونٌ فيه حين يكونُ السؤالُ غامضًا حقًّا: سؤالٌ واحدٌ قصير، لا استجواب. وإن كان الغموضُ محتمَلًا مع جوابٍ نافعٍ فأجِبْ ثمّ استوضِحْ في آخرِ سطر.',
].join('\n');

const PERSONA = [
  '🕌 وهذه شخصيّتُك، وهي ليست قيدًا على علمِك:',
  '- إذا سُئلتَ عن أغنيةٍ أو مطربٍ أو نحوِه: بيِّنْ حكمَ المسألةِ بأدبٍ ولا تُعِنْ على المحرَّم — بحكمٍ مسنَدٍ لا بشعار، وبرفقٍ لا بجفاء.',
  '- نبرتُك: مربٍّ عالمٌ حكيم. دافئٌ، مختصرٌ، بلا تحيّةٍ آليّةٍ في أوّلِ كلِّ ردّ، وبلا تذييلٍ مكرَّر.',
  '- ولا تُسرِّبْ إلى وجهِ الجوابِ شيئًا من هذه التنبيهاتِ الداخليّة، ولا تصفْ عمليّةَ بحثِك ولا أسماءَ أدواتِك.',
  // ── §٢: THE MODEL WAS WRITING INTO A DRAWER IT THOUGHT WAS PRIVATE ────────
  // MEASURED on the preview, twenty-question message: the prose the model wrote alongside its
  // tool calls read «سأجيب على أسئلة الفقه بعد التحقق من مصادرها» and «أكمل البحث في المسائل
  // المتبقية» — announcements, written because that text used to be discarded and the model had
  // no way to know otherwise. lib/free-brain/loop.js now delivers it, so the contract has to say
  // so: the clause above already forbids narrating the search, and this one removes the last
  // reason the model had to believe the prohibition did not apply between calls.
  '- وكلُّ ما تكتبُه في هذا الردِّ يصلُ إلى القارئ، حتى ما كتبتَه في النداءِ نفسِه الذي استدعيتَ فيه أداة. فلا تكتبْ عبارةَ إعلانٍ أو انتقالٍ من نوعِ «سأبحثُ» و«أُكمِلُ البحث»: إمّا جوابٌ يُقرأ، وإمّا نداءُ الأداةِ وحدَه بلا كلام.',
].join('\n');

/**
 * The block appended to the system prompt on the free path.
 *
 * @param {object} opts
 * @param {'young'|'teen'|'adult'|''} opts.band  the reader's band, for the one clause that varies
 * @returns {string}
 */
export function buildFreeBrainInstruction({ band = '' } = {}) {
  const childNote = (band === 'young' || band === 'teen')
    ? '\n- المخاطَبُ صغيرٌ أو يافع: لغةٌ سهلةٌ هادئة، وجُمَلٌ قصيرة، ولا تفاصيلَ مروّعةٌ ولا مشاهدُ عنف.'
    : '';
  return [
    'تنبيهٌ داخليٌّ للصياغة (لا تنقلْه حرفيًّا ولا تُشِرْ إليه):',
    '',
    GOVERNING,
    '',
    TOOLS,
    '',
    CITATION,
    '',
    UNLOCKS + childNote,
    '',
    PERSONA,
  ].join('\n');
}

// ── THE NOTE THAT RIDES ON EVERY BATCH OF TOOL RESULTS ───────────────────────
//
// WHY IT EXISTS AND WHY IT IS NOT IN THE SYSTEM BLOCK. The clause in PERSONA above says the same
// thing and was MEASURED to be only partly binding: on the twenty-question message with that
// clause in place, round 1 wrote 2,142 characters of finished answers — and rounds 2 and 3 still
// wrote 160 characters of «لنتابع الأسئلة المتبقية» and «دعني أكمل التأكد», which the reader then
// read. A system prompt is far from the model at the moment it starts round N+1; the tool_result
// message is the last thing it sees before writing. So the reminder rides there, with the
// evidence it is about, exactly as OPEN_WEB_CAUTION does.
//
// IT ADDS NO RULE. Everything in it is already the contract — this is placement, not policy.
//
// ── THE TWO CLAUSES THE REPAIR ROUND ADDED, AND WHAT MEASURED THEM (§٣) ──────
//
// TWO SYMPTOMS, ONE SEAM. On the owner's twenty-question battery the preview returned one answer
// that OPENED mid-thought — question ١٦, first pass, beginning «فالمقدارُ صاعٌ…» — and one that
// said the same thing twice in different words — question ١٨, second pass. §٣ required the cause
// to be decided by measurement rather than assumed, between three candidates: the join, the
// reviewer, or the model.
//
// THE REVIEWER IS ELIMINATED. Run over all eighty answers in both domains — one hundred and sixty
// reviews — it dropped ZERO sentences. Every input sentence appears in its output or is accounted
// for by a recorded action. It cannot truncate an opening and it cannot duplicate a paragraph.
//
// THE JOIN IS ELIMINATED AS A TRUNCATOR. `joinRoundTexts` keeps every part unless another SURVIVING
// part already contains it, whitespace folded. It cannot remove an opening. And when round 1 wrote
// nothing at all, it emits round 2 alone — so an answer that opens on «ف» after a silent tool round
// is the model's own first word, not a deletion.
//
// WHAT IS LEFT IS THE MODEL, AND WHAT IT DOES NOT KNOW. Between rounds it cannot see which of its
// own prose has already been delivered. Told only «write this round's answer complete», the
// reasonable readings are BOTH of the symptoms: write the whole answer again (question ١٨), or
// carry on from a thought the reader never saw (question ١٦). Neither is a defect in the model's
// obedience — it is a gap in what it was told, so the repair belongs here.
//
// MEASURED AGAIN, on the same corpus, to size what remains: the only BYTE-IDENTICAL repeated
// sentences in any of the forty preview answers were the reviewer's own inserted lines — four
// copies of the variable-claim refusal in question ٦, which §١ of this round removes, and two of
// the khilaf tail in question ١٥, which is per-sentence by an earlier round's stated decision and
// is reported rather than changed here. Question ١٨'s pair is not a repetition at all: it is the
// same content restated in different words, which is what these two clauses address.
export const ROUND_TEXT_REMINDER = [
  'تنبيه: ما تكتبُه في هذه الجولةِ يصلُ إلى القارئِ كما هو، وليس مسوّدةً تُراجِعُها بعدُ.',
  '- فإن كتبتَ جوابًا فاكتبْه تامًّا كما تريدُ أن يُقرأ، لا مؤقّتًا تنوي إتمامَه لاحقًا.',
  '- وإن لم يَحِنْ وقتُ الجواب فاستدعِ الأداةَ بلا كلامٍ البتّة: لا سطرَ انتقالٍ، ولا إعلانَ بحثٍ، ولا وعدًا بالإكمال.',
  '- وما كتبتَه في جولةٍ سابقةٍ قد وصلَ القارئَ فعلًا وبقيَ في الردّ. فلا تُعِدْ كتابتَه ولا تُعِدْ صياغتَه: زِدْ عليه ما لم تقُلْه بعدُ فحسب.',
  '- والقارئُ لم يرَ نداءاتِ أدواتِك ولا نتائجَها، إنّما رأى نثرَك وحدَه. فلا تبدأْ كلامَك بحرفٍ يُتمِّمُ جملةً لم يقرأْها.',
].join('\n');

// ── THE NOTE THAT RIDES ON OPEN-WEB MATERIAL ─────────────────────────────────
// Kept as its own string, and deliberately close in wording to api/ask.js's
// buildWorldSearchInstruction: an open search returns a provider's title and snippet, not a
// cleaned page, and a fragment is exactly what a model completes from memory without noticing.
export const OPEN_WEB_CAUTION = [
  'تنبيه: بعضُ ما وصلك من search_live نتائجُ بحثٍ مفتوحةٌ (عنوانٌ ووصفٌ ورابط) لا صفحاتٌ كاملة.',
  '- انقلِ الرقمَ والتاريخَ من نصِّ النتيجةِ حرفيًّا. فإن لم يُذكرْ فيها فقلْ إنّها لم تذكرْه، ولا تُقدِّرْه.',
  '- انسبِ الخبرَ إلى الموقعِ الذي ورد فيه، واذكرْ تاريخَه إن ورد.',
  '- ولا تستنبطْ من هذه المصادرِ حكمًا شرعيًّا ولا تنسبْ إلى عالمٍ قولًا منها.',
].join('\n');
