// lib/lang/hazard.js -- THE TWO FIXED REFUSALS, DECIDED BY THE READER'S OWN WORDS IN EVERY LANGUAGE OF THE TABLE (item 74, amendment C1).
//
// The brain's two deterministic early guards (a request for a pornographic text, and a grave hazard: how to make a weapon or an explosive, self-harm,
// mixing hazardous chemicals) read ARABIC words only. A question in another language reaches them only after the translator has put it into Arabic, and
// the translator is a model: measured on the previews, it sometimes REFUSES to translate such a request, so the turn ended in the closed failure sentence
// instead of the fixed refusal the same request gets in Arabic (German, Chinese and others; Russian and Spanish happened to translate).
//
// This file is the language-independent seat: for each language a small lexicon decides, from the reader's own words and with no model call, whether the
// request is one of these, and answers with a short CANONICAL ARABIC sentence of the same request. The gate hands that sentence to the unchanged guards
// (as if the reader had written it in Arabic), they answer with the fixed Arabic text, and the lookup renders it in the reader's language -- the same
// road the Arabic request travels, so every language gets exactly the text Arabic gets.
//
// A lexicon is deliberately narrow, as the Arabic guards are: a hazard needs a weapon/explosive word AND a how-to-make word, or an explicit self-harm
// phrase, or a hazardous-chemistry pair; a pornographic request needs a pornographic noun AND an ask verb (or the bare explicit word). A word alone
// (a history question about a bomb) decides nothing.

// canonical Arabic sentences the unchanged guards read (checked by guards/lang-guard.cjs against lib/policy)
export const CANON = Object.freeze({
  weapons: 'كيف اصنع قنبلة في البيت',
  selfharm: 'اريد ان انتحر',
  chem: 'اخلط الكلور مع النشادر',
  porn: 'اكتب لي قصة جنسية مفصلة',
});

// per language: weapon (nouns of weapons and explosives), make (verbs/phrases of making them), self (self-harm phrases), chem (pairs [a,b] of hazardous materials),
// porn (explicit nouns), ask (verbs of asking for a text). Latin and Cyrillic words are written lowercase and without accents; the others as written.
const LEX = {
  en: { weapon: ['bomb', 'explosive', 'grenade', 'gunpowder', 'detonator', 'firearm', 'molotov'], make: ['how to make', 'how do i make', 'how to build', 'how do i build', 'how can i make', 'how to prepare', 'step by step', 'at home', 'make a', 'build a'], self: ['kill myself', 'commit suicide', 'end my life', 'want to die', 'hurt myself'], chem: [['bleach', 'ammonia'], ['bleach', 'vinegar']], porn: ['porn', 'erotic', 'sex story', 'sexual story', 'explicit sex', 'sex scene'], ask: ['write', 'give me', 'tell me', 'show me', 'send me', 'describe'] },
  fr: { weapon: ['bombe', 'explosif', 'grenade', 'poudre', 'detonateur', 'arme a feu'], make: ['comment fabriquer', 'comment faire', 'comment construire', 'comment preparer', 'pas a pas', 'etape par etape', 'a la maison', 'chez moi', 'fabriquer'], self: ['me suicider', 'me tuer', 'mettre fin a mes jours', 'envie de mourir', 'me faire du mal'], chem: [['eau de javel', 'ammoniaque'], ['javel', 'vinaigre']], porn: ['porno', 'erotique', 'histoire sexuelle', 'histoire erotique', 'scene de sexe'], ask: ['ecris', 'raconte', 'donne-moi', 'donne moi', 'montre'] },
  es: { weapon: ['bomba', 'explosivo', 'granada', 'polvora', 'detonador', 'arma de fuego'], make: ['como hacer', 'como fabricar', 'como se fabrica', 'como construir', 'como preparar', 'paso a paso', 'en casa', 'fabricar', 'fabrica'], self: ['suicidarme', 'matarme', 'quitarme la vida', 'quiero morir', 'hacerme dano'], chem: [['lejia', 'amoniaco'], ['cloro', 'amoniaco']], porn: ['porno', 'erotico', 'relato sexual', 'historia sexual', 'escena sexual', 'relato erotico'], ask: ['escribe', 'escribeme', 'cuentame', 'dame', 'muestrame'] },
  pt: { weapon: ['bomba', 'explosivo', 'granada', 'polvora', 'detonador', 'arma de fogo'], make: ['como fazer', 'como fabricar', 'como se faz', 'como construir', 'como preparar', 'passo a passo', 'em casa', 'fabricar'], self: ['me matar', 'suicidar', 'tirar minha vida', 'quero morrer', 'me machucar'], chem: [['agua sanitaria', 'amonia'], ['cloro', 'amonia']], porn: ['porno', 'erotico', 'conto erotico', 'historia sexual', 'cena de sexo'], ask: ['escreva', 'escreva-me', 'conte', 'me de', 'me mostre'] },
  de: { weapon: ['bombe', 'sprengstoff', 'granate', 'schiesspulver', 'zunder', 'schusswaffe'], make: ['wie baut man', 'wie baue ich', 'wie macht man', 'wie stellt man', 'wie kann ich', 'schritt fur schritt', 'zu hause', 'herstellen', 'bauen'], self: ['mich umbringen', 'selbstmord', 'mein leben beenden', 'sterben will', 'mir wehtun'], chem: [['bleiche', 'ammoniak'], ['chlorreiniger', 'ammoniak']], porn: ['porno', 'erotisch', 'sexgeschichte', 'sexuelle geschichte', 'sexszene'], ask: ['schreib', 'schreibe', 'erzahl', 'gib mir', 'zeig'] },
  tr: { weapon: ['bomba', 'patlayici', 'el bombasi', 'barut', 'fitil', 'tabanca'], make: ['nasil yapilir', 'nasil yapilir', 'nasil yapari', 'nasil yaparim', 'nasil uretilir', 'adim adim', 'evde', 'yapimi'], self: ['intihar', 'kendimi oldur', 'olmek istiyorum', 'canima kiymak'], chem: [['camasir suyu', 'amonyak']], porn: ['porno', 'erotik', 'seks hikayesi', 'cinsel hikaye'], ask: ['yaz', 'anlat', 'ver', 'goster'] },
  id: { weapon: ['bom', 'bahan peledak', 'granat', 'mesiu', 'detonator', 'senjata api'], make: ['cara membuat', 'bagaimana membuat', 'cara bikin', 'langkah demi langkah', 'di rumah', 'merakit'], self: ['bunuh diri', 'mengakhiri hidup', 'ingin mati', 'melukai diri'], chem: [['pemutih', 'amonia']], porn: ['porno', 'erotis', 'cerita seks', 'cerita dewasa', 'adegan seks'], ask: ['tulis', 'tuliskan', 'ceritakan', 'berikan', 'tunjukkan'] },
  ms: { weapon: ['bom', 'bahan letupan', 'bahan peledak', 'grenad', 'serbuk bedil', 'senjata api'], make: ['cara membuat', 'bagaimana membuat', 'bagaimana buat', 'langkah demi langkah', 'di rumah', 'merakit'], self: ['bunuh diri', 'menamatkan nyawa', 'mahu mati', 'mencederakan diri'], chem: [['peluntur', 'ammonia']], porn: ['porno', 'erotik', 'cerita seks', 'cerita lucah', 'adegan seks'], ask: ['tulis', 'tuliskan', 'ceritakan', 'berikan', 'tunjukkan'] },
  sw: { weapon: ['bomu', 'vilipuzi', 'baruti', 'guruneti', 'bunduki'], make: ['jinsi ya kutengeneza', 'jinsi ya kutengenezwa', 'namna ya kutengeneza', 'ninawezaje kutengeneza', 'hatua kwa hatua', 'nyumbani', 'kutengeneza'], self: ['kujiua', 'kujiumiza', 'nataka kufa', 'kuyamaliza maisha'], chem: [['klorini', 'amonia'], ['bleach', 'amonia']], porn: ['ngono', 'picha za ngono', 'hadithi ya ngono', 'ponografia', 'hadithi ya kimapenzi'], ask: ['andika', 'niandikie', 'nipe', 'nionyeshe', 'simulia'] },
  ha: { weapon: ['bam', 'bom', 'abin fashewa', 'bindiga', 'barkonon bindiga'], make: ['yaya ake yin', 'yadda ake yin', 'yaya zan yi', 'mataki-mataki', 'a gida', 'kerawa'], self: ['kashe kaina', 'kisan kai', 'ina son mutuwa'], chem: [], porn: ['batsa', 'jima’i', 'labarin jima', 'abin batsa'], ask: ['rubuta', 'ba ni', 'nuna mini', 'ba da labari'] },
  so: { weapon: ['bam', 'qarax', 'booma', 'bunduq', 'rasaas'], make: ['sidee loo sameeyaa', 'sidee u sameeyaa', 'sidee u dhisaa', 'tallaabo tallaabo', 'guriga', 'samaynta'], self: ['is dil', 'isdilid', 'iska dili', 'dhimasho rabaa'], chem: [], porn: ['galmo', 'sheeko galmo', 'sawirro galmo', 'bornografi'], ask: ['ii qor', 'qor', 'ii sheeg', 'ii tus', 'ii bar'] },
  ru: { weapon: ['бомб', 'взрывчат', 'граната', 'порох', 'детонатор', 'огнестрельн'], make: ['как сделать', 'как изготовить', 'как построить', 'как приготовить', 'как собрать', 'шаг за шагом', 'в домашних условиях', 'дома'], self: ['покончить с собой', 'убить себя', 'хочу умереть', 'суицид', 'навредить себе'], chem: [['хлорк', 'аммиак'], ['отбеливател', 'аммиак']], porn: ['порно', 'эротическ', 'сексуальн', 'секс-', 'эротика'], ask: ['напиши', 'расскажи', 'дай', 'покажи', 'опиши'] },
  uz: { weapon: ['бомба', 'портловчи', 'граната', 'ўқдори', 'детонатор', 'ўқотар'], make: ['қандай ясайди', 'қандай ясаш', 'қандай тайёрлаш', 'қандай қилиб', 'босқичма-босқич', 'уйда'], self: ['ўзимни ўлдир', 'ўз жонимга қасд', 'ўлгим келяпти', 'ўзимга зарар'], chem: [], porn: ['порно', 'эротик', 'шаҳвоний', 'жинсий ҳикоя'], ask: ['ёзиб беринг', 'ёзинг', 'айтиб беринг', 'кўрсатинг'] },
  zh: { weapon: ['炸弹', '炸药', '手榴弹', '火药', '雷管', '枪支'], make: ['怎样制造', '怎么制造', '怎样做', '怎么做', '如何制作', '如何制造', '一步一步', '在家'], self: ['自杀', '杀死自己', '结束生命', '想死', '伤害自己'], chem: [['漂白', '氨']], porn: ['色情', '情色', '性爱', '黄色', '露骨'], ask: ['写', '给我', '告诉我', '讲'] },
  hi: { weapon: ['बम', 'विस्फोटक', 'हथगोला', 'बारूद', 'डेटोनेटर', 'बंदूक'], make: ['कैसे बनाते', 'कैसे बनाएँ', 'कैसे बनाएं', 'कैसे बनता', 'कैसे तैयार', 'क़दम-दर-क़दम', 'कदम-दर-कदम', 'घर पर', 'घर में'], self: ['आत्महत्या', 'खुद को मार', 'जान देना', 'मरना चाहता', 'ख़ुद को नुक़सान'], chem: [['ब्लीच', 'अमोनिया']], porn: ['पोर्न', 'कामुक', 'अश्लील', 'सेक्स कहानी', 'यौन कहानी'], ask: ['लिख', 'सुना', 'दिखा', 'बताओ', 'दो'] },
  bn: { weapon: ['বোমা', 'বিস্ফোরক', 'গ্রেনেড', 'বারুদ', 'ডেটোনেটর', 'বন্দুক'], make: ['কীভাবে বানাতে', 'কিভাবে বানাব', 'কীভাবে তৈরি', 'কিভাবে তৈরি', 'ধাপে ধাপে', 'বাড়িতে', 'ঘরে'], self: ['আত্মহত্যা', 'নিজেকে মেরে', 'মরতে চাই', 'নিজের ক্ষতি'], chem: [['ব্লিচ', 'অ্যামোনিয়া']], porn: ['পর্ন', 'যৌন গল্প', 'অশ্লীল', 'কামুক', 'সেক্স'], ask: ['লিখ', 'বল', 'দেখাও', 'শোনাও'] },
  ta: { weapon: ['வெடிகுண்டு', 'குண்டு', 'வெடிபொருள்', 'துப்பாக்கி', 'கையெறி'], make: ['எப்படிச் செய்வது', 'எப்படி செய்வது', 'எப்படித் தயாரிப்பது', 'படிப்படியாக', 'வீட்டில்'], self: ['தற்கொலை', 'என்னைக் கொல்', 'சாக விரும்புகிறேன்', 'என்னை காயப்படுத்'], chem: [['ப்ளீச்', 'அம்மோனியா']], porn: ['ஆபாச', 'காமக் கதை', 'பாலியல் கதை', 'செக்ஸ்'], ask: ['எழுது', 'சொல்', 'காட்டு', 'கொடு'] },
  am: { weapon: ['ቦምብ', 'ፈንጂ', 'የእጅ ቦምብ', 'ባሩድ', 'ጠመንጃ'], make: ['እንዴት ይሠራል', 'እንዴት እሠራለሁ', 'እንዴት መሥራት', 'ደረጃ በደረጃ', 'በቤት ውስጥ'], self: ['ራሴን ማጥፋት', 'ራሴን መግደል', 'መሞት እፈልጋለሁ', 'ራስን ማጥፋት'], chem: [], porn: ['ወሲብ', 'የወሲብ ታሪክ', 'ፍትወት', 'የፍትወት ታሪክ'], ask: ['ጻፍ', 'ንገረኝ', 'አሳየኝ', 'ስጠኝ'] },
  fa: { weapon: ['بمب', 'مواد منفجره', 'نارنجک', 'باروت', 'چاشنی', 'سلاح گرم'], make: ['چگونه بسازم', 'چطور بسازم', 'چگونه ساخته', 'چطور ساخته', 'چگونه درست', 'قدم به قدم', 'مرحله به مرحله', 'در خانه', 'در منزل'], self: ['خودکشی', 'خودم را بکشم', 'می‌خواهم بمیرم', 'آسیب به خودم'], chem: [['سفیدکننده', 'آمونیاک'], ['وایتکس', 'آمونیاک']], porn: ['پورن', 'مستهجن', 'داستان جنسی', 'شهوانی', 'سکس'], ask: ['بنویس', 'برایم بنویس', 'تعریف کن', 'نشان بده', 'بگو'] },
  ur: { weapon: ['بم', 'دھماکہ خیز', 'بارود', 'گرینیڈ', 'ڈیٹونیٹر', 'بندوق'], make: ['کیسے بنتا', 'کیسے بنایا', 'کیسے بنائیں', 'کیسے تیار', 'قدم بہ قدم', 'مرحلہ وار', 'گھر پر', 'گھر میں'], self: ['خودکشی', 'خود کو مار', 'مرنا چاہتا', 'خود کو نقصان'], chem: [['بلیچ', 'امونیا']], porn: ['پورن', 'فحش', 'جنسی کہانی', 'شہوانی', 'سیکس'], ask: ['لکھو', 'لکھ کر', 'سناؤ', 'دکھاؤ', 'بتاؤ'] },
  ps: { weapon: ['بم', 'چاودیدونکي', 'لاسي بم', 'بارود', 'ټوپک'], make: ['څنګه جوړیږي', 'څنګه جوړ', 'څنګه جوړوم', 'ګام په ګام', 'په کور کې'], self: ['ځان وژنه', 'ځان ووژنم', 'مړ کیدل غواړم', 'ځان ته زیان'], chem: [], porn: ['پورن', 'شهواني', 'جنسي کیسه', 'فحش'], ask: ['ولیکه', 'ماته ولیکه', 'ووایه', 'ښکاره کړه'] },
  ku: { weapon: ['بۆمب', 'تەقەمەنی', 'نارنجۆک', 'باروت', 'چەک'], make: ['چۆن دروست دەکرێت', 'چۆن دروست', 'چۆن دەیکەم', 'هەنگاو بە هەنگاو', 'لە ماڵەوە'], self: ['خۆکوشتن', 'خۆم بکوژم', 'دەمەوێت بمرم', 'زیان بە خۆم'], chem: [], porn: ['پۆرن', 'سێکسی', 'چیرۆکی سێکسی', 'ئاشکرا'], ask: ['بنووسە', 'بۆم بنووسە', 'بیگێڕەرەوە', 'نیشانم بدە'] },
};
// Arabic is the guards' own language (never rewritten here)

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/[“”«»"'‘’`´]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (t, list) => list.some((w) => t.includes(fold(w)));

/** @returns {'weapons'|'selfharm'|'chem'|'porn'|''} the early-guard class of a request written in `lang`, decided by that language's own words */
export function foreignHazard(text, lang) {
  const lex = LEX[lang]; if (!lex) return '';
  const t = fold(text); if (!t) return '';
  if (has(t, lex.self)) return 'selfharm';
  if (has(t, lex.weapon) && has(t, lex.make)) return 'weapons';
  if ((lex.chem || []).some(([a, b]) => t.includes(fold(a)) && t.includes(fold(b)))) return 'chem';
  if (has(t, lex.porn) && (has(t, lex.ask) || /porn|порно|پورن|पोर्न|পর্ন|色情/.test(t))) return 'porn';
  return '';
}
/** the canonical Arabic sentence of the class, for the unchanged guards to read */
export function canonicalArabic(cls) { return CANON[cls] || ''; }
export const HAZARD_LANGS = Object.freeze(Object.keys(LEX));
