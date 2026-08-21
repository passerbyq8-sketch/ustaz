// GENERATED FILE -- DO NOT EDIT, AND DO NOT PATCH A BUG HERE.
// Source: the shipped JSX, located by tools/babel-block.cjs. Rebuild: npm run build.
// Verified by `npm run verify:build` and by the gate `babel`, which regenerate this file
// and fail on any difference. An edit made here is overwritten by the next build and is
// reported as a difference by the gate before that.
const{useState,useEffect,useRef}=React;// ============================================================
// S116 -- THE INTERFACE LANGUAGE (ar / en). READ THIS BEFORE ADDING A KEY.
//
// This is an INTERFACE translation layer and nothing else. It does not reach the model, the
// prompt, /api/ask, the retrieval path, the ledger, the sources, the voice tier, the Quran,
// the adhkar, the question bank, or one stored byte of a user's own conversations. Ezik still
// answers in the language it always answered in; that binding is a separate decision and is
// deliberately NOT made here.
//
// No dependency, no fetch, no bundle. Two dictionaries, one lookup, one persisted choice.
// A third language is added by declaring a third dictionary with the same keys and adding
// its tag to EZ_LANGS -- nothing else in this block is language-specific.
// ============================================================
const EZ_LANG_KEY='ezik_ui_lang_v1';// THE LANGUAGES THIS INTERFACE OFFERS. A list, not a pair of hardcoded buttons: a third
// language is one more row here plus one more dictionary, and nothing else in this file has to
// change. nativeName is what a speaker of that language calls it, so it does NOT get translated
// -- a language's own name is the same sentence in every interface. shortLabel is the two- or
// one-character badge the menu shows beside it. No flag anywhere: Arabic is not one country's
// language and neither is English.
const EZ_LANGUAGES=[{code:'ar',nativeName:'\u0627\u0644\u0639\u0631\u0628\u064a\u0629',shortLabel:'\u0639',dir:'rtl'},{code:'en',nativeName:'English',shortLabel:'EN',dir:'ltr'}];const EZ_LANGS=EZ_LANGUAGES.map(l=>l.code);function ezLangEntry(code){return EZ_LANGUAGES.filter(l=>l.code===code)[0]||EZ_LANGUAGES[0];}const EZ_LANG_FALLBACK='ar';// the first-run language, and the dictionary's fallback half
const EZ_LANG_DIR=EZ_LANGUAGES.reduce((m,l)=>{m[l.code]=l.dir;return m;},{});function ezLangValid(v){return EZ_LANGS.indexOf(v)!==-1;}// The stored choice. Anything that is not exactly 'ar' or 'en' -- a truncated write, a value
// from a future build, an object, a quota failure -- is not a choice and is ignored.
function ezLangStored(){try{const v=localStorage.getItem(EZ_LANG_KEY);return ezLangValid(v)?v:null;}catch(e){return null;}}// THE WHOLE DECISION. A stored choice, or Arabic. The device is not an input: this app is
// Arabic first, and a reader who wants otherwise says so on the first-run card or in Settings.
function ezLangResolve(){return ezLangStored()||EZ_LANG_FALLBACK;}let EZ_LANG=ezLangResolve();const EZ_LANG_SUBS=new Set();function ezLangApply(v){try{const d=document.documentElement;d.setAttribute('lang',v);d.setAttribute('dir',EZ_LANG_DIR[v]||'ltr');d.setAttribute('data-ez-lang',v);}catch(e){}}// The <head> boot script normally settles <html> before the first paint. This repeats it once at
// module load, because that script is a best-effort optimisation and this is the guarantee: a
// build that ever lost it, or an environment that refused to run it, must still get a document
// whose direction matches the language the app is about to draw in. It is idempotent -- when the
// boot script did run, every attribute below is already the value being written.
ezLangApply(EZ_LANG);// FIRST RUN IS WRITTEN DOWN, so the slot always holds one of the two languages the app offers.
// That is what lets the treasure journey agree with the app -- quest.html reads this same key and
// never decides anything itself -- and it repairs a corrupted value once instead of re-judging it
// on every launch. A reader's explicit choice is never overwritten: this runs only when nothing
// valid was stored.
if(!ezLangStored()){try{localStorage.setItem(EZ_LANG_KEY,EZ_LANG);}catch(e){}}// The one writer. It persists, repaints <html>, and tells every subscriber -- in that order,
// so a listener that reads the document sees the new direction and not the old one.
function ezLangSet(v){if(!ezLangValid(v)||v===EZ_LANG)return;EZ_LANG=v;try{localStorage.setItem(EZ_LANG_KEY,v);}catch(e){}ezLangApply(v);ezLangRelabel();EZ_LANG_SUBS.forEach(f=>{try{f(v);}catch(e){}});}function ezLangGet(){return EZ_LANG;}// S116 -- THE RE-BINDER. A handful of labels are read by the screens as bare identifiers,
// because guards pin them at their JSX sites in exactly that form. Those identifiers are
// therefore `let`, and this rebinds every one of them the moment the language changes --
// before React is told, so the re-render that follows already reads the new words. Nothing
// here touches a prompt, a store, a key, a handler or a screen.
function ezLangRelabel(){try{EZH_SALAM=ezT("home.salam");EZH_HELLO=ezT("home.hello");EZH_NAV_MENU=ezT("navigation.menu");EZH_MEMORIZE=ezT("module.memorize");EZH_ADHKAR=ezT("module.adhkar");EZH_MUSHAF=ezT("module.mushaf");EZH_TREASURE=ezT("module.treasure");EZH_FATWA=ezT("module.fatwa");EZIST_SUB_MEMORIZE=ezT("module.memorize.sub");EZIST_SUB_ADHKAR=ezT("module.adhkar.sub");EZIST_SUB_MUSHAF=ezT("module.mushaf.sub");EZIST_SUB_TREASURE=ezT("module.treasure.sub");EZIST_SUB_FATWA=ezT("module.fatwa.sub");EZIST_SUB={memorize:EZIST_SUB_MEMORIZE,adhkar:EZIST_SUB_ADHKAR,mushaf:EZIST_SUB_MUSHAF,treasure:EZIST_SUB_TREASURE,fatwa:EZIST_SUB_FATWA};A2_BACK=ezT("common.back");EZIK_FAV_TITLE=ezT("favorites.title");EZIK_FAV_HEADING=ezT("favorites.heading");EZIK_FAV_ADD=ezT("favorites.add");EZIK_FAV_DEL=ezT("favorites.remove");EZIK_FAV_REMOVE=ezT("common.remove");EZIK_FAV_OPEN_CHAT=ezT("favorites.openChat");EZIK_FAV_CHAT_GONE=ezT("favorites.chatGone");EZIK_BACK=ezT("common.backArrow");EZIK_SEARCH_PH=ezT("chat.searchPlaceholder");EZIK_SEARCH_ARIA=ezT("chat.searchAria");EZIK_SEARCH_RESULTS=ezT("chat.searchResults");EZIK_SEARCH_NONE=ezT("common.noMatches");EZIK_FAV_SEARCH_PH=ezT("favorites.searchPlaceholder");EZIK_FAV_SEARCH_ARIA=ezT("favorites.searchAria");EZIK_CHATS_EMPTY=ezT("chat.noConversations");EZIK_QUOTE_ARIA=ezT("chat.quoteAria");EZIK_SHARE_LABEL=ezT("chat.share");EZIK_SHARE_ARIA=ezT("chat.shareAria");EZIK_SHARE_COPIED=ezT("common.copied");EZIK_SHARE_FAIL=ezT("common.copyFailed");for(let i=0;i<EZIK_QUICK_ACTIONS.length;i++){EZIK_QUICK_ACTIONS[i]={...EZIK_QUICK_ACTIONS[i],label:ezT('chat.qa.'+EZIK_QUICK_ACTIONS[i].key)};}EZIK_A11Y_TITLE=ezT("a11y.title");EZIK_A11Y_FS_LABEL=ezT("a11y.fontSize");EZIK_A11Y_FS_NORMAL=ezT("a11y.fontNormal");EZIK_A11Y_FS_LARGE=ezT("a11y.fontLarge");EZIK_A11Y_FS_XLARGE=ezT("a11y.fontXLarge");EZIK_A11Y_READ=ezT("a11y.reading");EZIK_A11Y_READ_HINT=ezT("a11y.readingHint");EZIK_A11Y_MOTION=ezT("a11y.motion");EZIK_A11Y_MOTION_HINT=ezT("a11y.motionHint");EZIK_A11Y_RESET=ezT("a11y.reset");EZ_VT_TITLE=ezT("visualTheme.title");EZ_VT_ACTIVE=ezT("visualTheme.active");EZ_VT_SOON=ezT("visualTheme.soon");}catch(e){}}// Subscribing in App() is what makes the switch instant: App owns the whole tree, so one
// state change there redraws every screen without a reload and without a route change.
function useEzLang(){const[v,setV]=useState(EZ_LANG);useEffect(()=>{const f=n=>setV(n);EZ_LANG_SUBS.add(f);if(EZ_LANG!==v)setV(EZ_LANG);return()=>{EZ_LANG_SUBS.delete(f);};},[]);return v;}// ---- THE DICTIONARIES. Same keys, same order, in both. Plain text only: no markup lives in
// here and no translated string is ever handed to innerHTML. ---------------------------
const EZ_I18N={ar:{'common.close':'إغلاق','common.cancel':'إلغاء','common.confirm':'تأكيد','common.save':'حفظ','common.back':'رجوع','common.backArrow':'← رجوع','common.search':'بحث','common.noResults':'لا توجد نتائج','common.loading':'جارٍ التحميل…','common.retry':'إعادة المحاولة','common.delete':'حذف','common.copy':'نسخ','common.copied':'تم النسخ','common.copyFailed':'تعذّر النسخ','chat.share':'مشاركة','chat.shareAria':'مشاركة الرد','common.of':'{a} من {b}','navigation.home':'\u{0627}\u{0644}\u{0631}\u{0626}\u{064A}\u{0633}\u{064A}\u{0629}','navigation.settings':'\u{0627}\u{0644}\u{0625}\u{0639}\u{062F}\u{0627}\u{062F}\u{0627}\u{062A}','navigation.account':'\u{0627}\u{0644}\u{062D}\u{0633}\u{0627}\u{0628}','language.label':'اللغة','language.change':'تغيير لغة الواجهة','language.current':'اللغة الحالية: {lang}','language.chooseHint':'يُحفظ على هذا الجهاز','settings.language':'اللغة','settings.savedOnDevice':'يُحفظ على هذا الجهاز','settings.enter':'زر الإدخال','settings.enter.sends':'Enter يُرسل الرسالة','settings.enter.sendsHint':'Enter يُرسل، و Shift+Enter سطر جديد. ولا يُرسل أثناء تركيب الحروف.','settings.enter.newlineHint':'Enter سطر جديد، والإرسال بالزر. ولا يُرسل أثناء تركيب الحروف.','settings.watermark':'وضوح العلامة المائية','settings.watermark.none':'بلا','settings.watermark.light':'خفيفة','settings.watermark.medium':'متوسطة','settings.watermark.bold':'قوية','settings.watermark.fine':'ضبط دقيق','settings.watermark.quiet':'إخفاؤها أثناء ورود الرد','settings.watermark.quietHint':'تختفي العلامة ما دام الرد يُكتب، ثم تعود كما كانت.','chat.newConversation':'\u0645\u062d\u0627\u062f\u062b\u0629 \u062c\u062f\u064a\u062f\u0629','chat.send':'إرسال','chat.stop':'إيقاف','chat.placeholder':'اكتب سؤالك…',// XI-02: NEUTRAL BY MEASUREMENT. This hint is a CLIENT-SIDE TIMER, not a server signal —
// index.html's own note at `clearSearchingHint` says so. It fired in 10 rounds of 10 on
// 17 August, always at 4.0s, and three of those rounds ended with ZERO source cards: the
// shortest finished at 4,604ms, so a reader was told «searching the sources» for 548ms of
// an answer that showed no source at all. A timer cannot promise a search it cannot see.
// What it CAN say truthfully is that the answer is still being prepared, which is true of
// every turn it fires on. (The key keeps its historical name; the string is what a reader
// sees, and renaming the key would touch nine call sites for no reader-visible gain.)
'chat.searchingSources':'يُحضِّرُ الجوابَ…','chat.quickActions':'إجراءات سريعة على آخر رد','chat.removeImage':'إزالة الصورة','chat.listen':'استمع للرد','chat.stopAudio':'إيقاف الصوت','chat.report':'بلّغ عن هذا الردّ','chat.noConversations':'لا شيء محفوظٌ بعد — أول سؤالٍ تكتبه يُحفَظ هنا.','favorites.empty':'لا توجد ردود محفوظة بعد. اضغط النجمة تحت أي رد لتحفظه هنا.','errors.network':'تعذّر الاتصال','errors.timeout':'انتهت المهلة','errors.generic':'حدث خطأ، حاول مرة أخرى','errors.saveFailed':'تعذّر حفظ الإعداد','home.salam':'\u{0627}\u{0644}\u{0633}\u{0644}\u{0627}\u{0645} \u{0639}\u{0644}\u{064A}\u{0643}\u{0645}','home.hello':'\u{0645}\u{0631}\u{062D}\u{0628}\u{0627}\u{064B} \u{064A}\u{0627}','module.memorize':'\u{0627}\u{0644}\u{0645}\u{062D}\u{0641}\u{0651}\u{0638}','module.adhkar':'\u{0627}\u{0644}\u{0623}\u{0630}\u{0643}\u{0627}\u{0631}','module.mushaf':'\u{0627}\u{0644}\u{0645}\u{0635}\u{062D}\u{0641}','module.treasure':'\u{0631}\u{062D}\u{0644}\u{0629}\u{064F} \u{0627}\u{0644}\u{0643}\u{0646}\u{0648}\u{0632}','module.fatwa':'فتاوى','module.memorize.sub':'\u{0627}\u{062D}\u{0641}\u{0638} \u{0648}\u{0631}\u{0627}\u{062C}\u{0639}','module.adhkar.sub':'\u{0623}\u{0630}\u{0643}\u{0627}\u{0631} \u{0627}\u{0644}\u{0635}\u{0628}\u{0627}\u{062D} \u{0648}\u{0627}\u{0644}\u{0645}\u{0633}\u{0627}\u{0621}','module.mushaf.sub':'\u{0627}\u{0642}\u{0631}\u{0623} \u{0648}\u{062A}\u{0627}\u{0628}\u{0639} \u{0648}\u{0631}\u{062F}\u{0643}','module.treasure.sub':'\u{062A}\u{0639}\u{0644}\u{0651}\u{0645} \u{0628}\u{0627}\u{0644}\u{0644}\u{0639}\u{0628}','module.fatwa.sub':'بحث موثّق بالسؤال والجواب','fatwa.scholarLabel':'اسم الشيخ','fatwa.defaultScholar':'ابن باز','fatwa.allScholars':'كل الفتاوى','fatwa.browseLoading':'جارٍ فتح قائمة الفتاوى…','fatwa.browseSummary':'الفتاوى مرتبة أبجديًّا — {total} فتوى، الصفحة {page} من {pages}.','fatwa.browseEmpty':'لا توجد فتاوى في هذه الصفحة.','fatwa.browseAria':'قائمة الفتاوى مرتبة أبجديًّا','fatwa.openFatwa':'افتح الفتوى كاملة','fatwa.closeFatwa':'أغلق الفتوى','fatwa.backToBrowse':'العودة إلى تصفح الفتاوى','fatwa.searchPlaceholder':'ابحث في الفتاوى','fatwa.searchAria':'ابحث في نصوص الفتاوى الرسمية','fatwa.searchButton':'بحث','fatwa.loading':'جارٍ البحث في النصوص الرسمية…','fatwa.error':'تعذّر الاتصال بخادم الفتاوى. حاول مرة أخرى.','fatwa.none':'لم نجد نتيجة في النسخة الرسمية الحالية.','fatwa.summary':'وجدنا {total} نتيجة — الصفحة {page} من {pages}.','fatwa.question':'السؤال','fatwa.answer':'الجواب','fatwa.officialText':'النص المنشور في موقع الشيخ','fatwa.audioAvailable':'يتوفر صوت رسمي','fatwa.textOnly':'نص رسمي بلا صوت','fatwa.audioAria':'التسجيل الرسمي للفتوى','fatwa.transcriptTag':'تفريغ آلي من مقطع رسمي','fatwa.transcriptNotice':'هذا تفريغٌ آليٌّ من الصوت أو الفيديو الرسميِّ لقناة الشيخ، وليس نصًّا مكتوبًا راجعه الشيخ. والأصلُ هو المقطعُ المرئيُّ.','fatwa.transcriptBody':'نص التفريغ','fatwa.watchVideo':'فتح المقطع الرسمي','fatwa.source':'فتح المصدر الرسمي','fatwa.previous':'السابق','fatwa.next':'التالي','fatwa.page':'{page} / {pages}','fatwa.action.simplify':'بسّط','fatwa.action.example':'مثال','fatwa.action.explain':'اشرح لي','fatwa.action.quiz':'اختبرني','fatwa.action.disabled':'يتاح بعد تفعيل الشرح المحكوم بالنص الأصلي.','favorites.title':'المفضلة','favorites.heading':'الردود المفضلة','favorites.add':'أضف إلى المفضلة','favorites.remove':'إزالة من المفضلة','favorites.addFatwa':'احفظ الفتوى','favorites.addAyah':'احفظ الآية','favorites.saved':'محفوظة','favorites.kindAria':'نوع المحفوظات','favorites.kind.all':'الكل','favorites.kind.reply':'الردود','favorites.kind.fatwa':'الفتاوى','favorites.kind.ayah':'الآيات','common.remove':'إزالة','favorites.openChat':'افتح المحادثة الأصلية','favorites.chatGone':'المحادثة الأصلية محذوفة','chat.searchPlaceholder':'ابحث في محادثاتك','chat.searchAria':'ابحث في محادثاتك المحفوظة على هذا الجهاز','chat.searchResults':'نتائج البحث','common.noMatches':'لا توجد نتائج مطابقة','favorites.searchPlaceholder':'ابحث في المفضلة','favorites.searchAria':'ابحث في الردود المفضلة','chat.quoteAria':'اقتباس الرد في خانة الكتابة','chat.foldShow':'عرض بقية الرد','chat.foldHide':'إخفاء التفاصيل','chat.qa.simplify':'بسّط','chat.qa.example':'مثال','chat.qa.quiz':'اختبرني','chat.qa.shorten':'اختصر','chat.qa.continue':'كمّل',// §٢ (C) — تُقالُ صراحةً بجانبِ «كمّل»، ولا يُحذَفُ من الجوابِ حرف.
'chat.qa.incomplete':'هذا الجوابُ لم يكتملْ. اضغطْ «كمّل» ليُتِمَّه.','navigation.menu':'\u0627\u0644\u0642\u0627\u0626\u0645\u0629','navigation.openMenu':'\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062c\u0627\u0646\u0628\u064a\u0629','settings.control':'\u0627\u0644\u062A\u062D\u0643\u0645','settings.title':'\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a','settings.appearance':'\u0627\u0644\u0645\u0638\u0647\u0631','pin.mismatch':'\u0627\u0644\u0631\u0645\u0632\u0627\u0646 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u064A\u0646.','pin.changed':'\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0631\u0645\u0632.','settings.themeLight':'\u0641\u0627\u062a\u062d','settings.themeDark':'\u062f\u0627\u0643\u0646','pin.groupTitle':'\u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0641\u062A\u062D','pin.new':'\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u062C\u062F\u064A\u062F','pin.confirm':'\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0631\u0645\u0632','a11y.title':'سهولة الاستخدام','a11y.fontSize':'حجم الخط','a11y.fontNormal':'عادي','a11y.fontLarge':'كبير','a11y.fontXLarge':'كبير جدًّا','a11y.reading':'وضع القراءة','a11y.readingHint':'تباعد أوسع بين السطور وراحة أكبر في النصوص الطويلة.','a11y.motion':'تقليل الحركة','a11y.motionHint':'إيقاف الحركات الزخرفية والتمرير المتحرّك.','a11y.reset':'إعادة الإعدادات الافتراضية','visualTheme.title':'\u{0627}\u{0644}\u{0647}\u{0648}\u{064A}\u{0629} \u{0627}\u{0644}\u{0628}\u{0635}\u{0631}\u{064A}\u{0629}','visualTheme.active':'\u{0627}\u{0644}\u{062A}\u{0635}\u{0645}\u{064A}\u{0645} \u{0627}\u{0644}\u{062D}\u{0627}\u{0644}\u{064A}','visualTheme.soon':'\u{0642}\u{0631}\u{064A}\u{0628}\u{0627}\u{064B}','chat.attach':'\u0625\u0631\u0641\u0627\u0642 \u0645\u0644\u0641 \u0623\u0648 \u0635\u0648\u0631\u0629','chat.dictate':'\u0625\u0645\u0644\u0627\u0621 \u0635\u0648\u062a\u064a','chat.call':'\u0645\u0643\u0627\u0644\u0645\u0629 \u0635\u0648\u062a\u064a\u0629 \u0645\u0628\u0627\u0634\u0631\u0629','chat.attachImage':'\u0635\u0648\u0631\u0629','chat.attachFile':'\u0645\u0644\u0641','chat.depthHint':'\u0627\u0636\u063a\u0637 \u0644\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0639\u0645\u0642 \u0627\u0644\u0645\u0639\u0631\u0641\u064a','chat.depthBrief':'\u0645\u0648\u062c\u0632','chat.depthDetailed':'\u0645\u0641\u0635\u0651\u0644','chat.depthScholar':'\u0637\u0627\u0644\u0628 \u0627\u0644\u0639\u0644\u0645','chat.standingNotice':'عزك ذكاءٌ اصطناعيّ وقد يُخطئ — راجِعْ ما يهمُّك مع والديك أو مع أهل العلم.','chat.standingNoticeAdult':'عزك ذكاءٌ اصطناعيّ وقد يُخطئ — راجِعْ ما يهمُّك مع أهل العلم.','navigation.settings2':'\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a','home.hadithOfDay':'حديث اليوم','home.verseOfDay':'آية اليوم','home.hadithOfDay2':'\u062D\u062F\u064A\u062B \u0627\u0644\u064A\u0648\u0645','home.verseOfDay2':'\u0622\u064A\u0629 \u0627\u0644\u064A\u0648\u0645','home.greet.dhikr':'اذكرِ الله','home.greet.morning.1':'صباحك طاعة — هل قرأتَ أذكار الصباح؟','home.greet.morning.2':'بكّر بذكر الله، أذكار الصباح بانتظارك.','home.greet.morning.3':'افتتحْ يومك بأذكار الصباح.','home.greet.morning.4':'صباح الخير، هل بدأتَ بأذكار الصباح؟','home.greet.morning.5':'استقبلِ الصباح بذكر الله.','home.greet.morning.6':'أذكار الصباح تُعينك على يومك.','home.greet.morning.7':'طابَ صباحك — أذكار الصباح بانتظارك.','home.greet.morning.8':'ابدأ نهارك بحصنٍ من الأذكار.','home.greet.evening.1':'مساؤك ذكرٌ — هل قرأتَ أذكار المساء؟','home.greet.evening.2':'اختم نهارك بأذكار المساء.','home.greet.evening.3':'قبل أن يهدأ اليوم، أذكار المساء.','home.greet.evening.4':'مساء الخير، هل قرأتَ أذكار المساء؟','home.greet.evening.5':'استقبلِ المساء بذكر الله.','home.greet.evening.6':'أذكار المساء تحفظك في ليلتك.','home.greet.evening.7':'طابَ مساؤك — أذكار المساء بانتظارك.','home.greet.evening.8':'اختم يومك بحصنٍ من الأذكار.','onboarding.welcome':'أهلاً بك','onboarding.male':'ذكر','onboarding.female':'أنثى','onboarding.start':'ابدأ','onboarding.yearError':'اكتب سنةَ ميلادك بأربعة أرقام — مثل ٢٠١٥','onboarding.name':'الاسم','onboarding.birthYear':'سنة الميلاد — مثال ٢٠١٥'},en:{'common.close':'Close','common.cancel':'Cancel','common.confirm':'Confirm','common.save':'Save','common.back':'Back','common.backArrow':'Back','common.search':'Search','common.noResults':'No results','common.loading':'Loading…','common.retry':'Try again','common.delete':'Delete','common.copy':'Copy','common.copied':'Copied','common.copyFailed':'Could not copy','chat.share':'Share','chat.shareAria':'Share this reply','common.of':'{a} of {b}','navigation.home':'Home','navigation.settings':'Settings','navigation.account':'Account','language.label':'Language','language.change':'Change the interface language','language.current':'Current language: {lang}','language.chooseHint':'Saved on this device','settings.language':'Language','settings.savedOnDevice':'Saved on this device','settings.enter':'The Enter key','settings.enter.sends':'Enter sends the message','settings.enter.sendsHint':'Enter sends, Shift+Enter makes a new line. It never sends while a word is being composed.','settings.enter.newlineHint':'Enter makes a new line, the button sends. It never sends while a word is being composed.','settings.watermark':'Watermark strength','settings.watermark.none':'None','settings.watermark.light':'Light','settings.watermark.medium':'Medium','settings.watermark.bold':'Bold','settings.watermark.fine':'Fine adjustment','settings.watermark.quiet':'Hide it while a reply arrives','settings.watermark.quietHint':'The mark goes while the reply is being written, then comes back as it was.','chat.newConversation':'New conversation','chat.send':'Send','chat.stop':'Stop','chat.placeholder':'Type your question…','chat.searchingSources':'Preparing the answer…','chat.quickActions':'Quick actions on the latest reply','chat.removeImage':'Remove the image','chat.listen':'Listen to the reply','chat.stopAudio':'Stop the audio','chat.report':'Report this reply','chat.noConversations':'Nothing is saved yet — the first question you write is kept here.','favorites.empty':'Nothing is saved yet. Press the star under any reply to keep it here.','errors.network':'Could not connect','errors.timeout':'The request timed out','errors.generic':'Something went wrong, please try again','errors.saveFailed':'Could not save the setting','home.salam':'Peace be upon you','home.hello':'Welcome,','module.memorize':'Memoriser','module.adhkar':'Adhkar','module.mushaf':'Mushaf','module.treasure':'Treasure journey','module.fatwa':'Fatwas','module.memorize.sub':'Memorise and review','module.adhkar.sub':'Morning and evening adhkar','module.mushaf.sub':'Read, and keep your wird','module.treasure.sub':'Learn through play','module.fatwa.sub':'Verified questions and answers','fatwa.scholarLabel':'Scholar','fatwa.defaultScholar':'Ibn Baz','fatwa.allScholars':'All fatwas','fatwa.browseLoading':'Opening the list of fatwas…','fatwa.browseSummary':'Fatwas in alphabetical order — {total} of them, page {page} of {pages}.','fatwa.browseEmpty':'There are no fatwas on this page.','fatwa.browseAria':'The list of fatwas in alphabetical order','fatwa.openFatwa':'Open the whole fatwa','fatwa.closeFatwa':'Close the fatwa','fatwa.backToBrowse':'Back to browsing the fatwas','fatwa.searchPlaceholder':'Search fatwas','fatwa.searchAria':'Search the official fatwa texts','fatwa.searchButton':'Search','fatwa.loading':'Searching the official texts…','fatwa.error':'Could not reach the fatwa service. Please try again.','fatwa.none':'No result was found in the current official snapshot.','fatwa.summary':'Found {total} results — page {page} of {pages}.','fatwa.question':'Question','fatwa.answer':'Answer','fatwa.officialText':'Text published on the scholar’s website','fatwa.audioAvailable':'Official audio available','fatwa.textOnly':'Official text without audio','fatwa.audioAria':'Official fatwa recording','fatwa.transcriptTag':'Automatic transcript of an official clip','fatwa.transcriptNotice':'This is an automatic transcript of the official audio or video on the scholar’s channel. It is not text the scholar wrote or reviewed. The clip itself is the original.','fatwa.transcriptBody':'Transcript','fatwa.watchVideo':'Open the official clip','fatwa.source':'Open the official source','fatwa.previous':'Previous','fatwa.next':'Next','fatwa.page':'{page} / {pages}','fatwa.action.simplify':'Simplify','fatwa.action.example':'Example','fatwa.action.explain':'Explain','fatwa.action.quiz':'Quiz me','fatwa.action.disabled':'Available after the source-bound explanation layer is enabled.','favorites.title':'Favourites','favorites.heading':'Saved replies','favorites.add':'Add to favourites','favorites.remove':'Remove from favourites','favorites.addFatwa':'Save this fatwa','favorites.addAyah':'Save this verse','favorites.saved':'Saved','favorites.kindAria':'Kind of saved item','favorites.kind.all':'All','favorites.kind.reply':'Replies','favorites.kind.fatwa':'Fatwas','favorites.kind.ayah':'Verses','common.remove':'Remove','favorites.openChat':'Open the original conversation','favorites.chatGone':'The original conversation was deleted','chat.searchPlaceholder':'Search your conversations','chat.searchAria':'Search the conversations saved on this device','chat.searchResults':'Search results','common.noMatches':'No matching results','favorites.searchPlaceholder':'Search the favourites','favorites.searchAria':'Search the saved replies','chat.quoteAria':'Quote the reply in the composer','chat.foldShow':'Show the rest of the reply','chat.foldHide':'Hide the details','chat.qa.simplify':'Simplify','chat.qa.example':'Example','chat.qa.quiz':'Quiz me','chat.qa.shorten':'Shorten','chat.qa.continue':'Continue','chat.qa.incomplete':'This answer did not finish. Press “Continue” to complete it.','navigation.menu':'Menu','navigation.openMenu':'Open the side menu','settings.control':'Parental controls','settings.title':'Settings','settings.appearance':'Appearance','pin.mismatch':'The two codes do not match.','pin.changed':'The code was changed.','settings.themeLight':'Light','settings.themeDark':'Dark','pin.groupTitle':'Change the unlock code','pin.new':'The new code','pin.confirm':'Confirm the code','a11y.title':'Ease of use','a11y.fontSize':'Text size','a11y.fontNormal':'Normal','a11y.fontLarge':'Large','a11y.fontXLarge':'Very large','a11y.reading':'Reading mode','a11y.readingHint':'Wider line spacing, and an easier read on long passages.','a11y.motion':'Reduce motion','a11y.motionHint':'Turns off decorative animation and animated scrolling.','a11y.reset':'Restore the default settings','visualTheme.title':'Visual identity','visualTheme.active':'The current design','visualTheme.soon':'Coming soon','chat.attach':'Attach a file or an image','chat.dictate':'Voice dictation','chat.call':'Live voice call','chat.attachImage':'Image','chat.attachFile':'File','chat.depthHint':'Press to change the depth of the answer','chat.depthBrief':'Brief','chat.depthDetailed':'Detailed','chat.depthScholar':'Student of knowledge','chat.standingNotice':'Ezik is an artificial intelligence and can be wrong — check what matters to you with your parents or with people of knowledge.','chat.standingNoticeAdult':'Ezik is an artificial intelligence and can be wrong — check what matters to you with people of knowledge.','navigation.settings2':'Settings','home.hadithOfDay':'Hadith of the day','home.verseOfDay':'Verse of the day','home.hadithOfDay2':'Hadith of the day','home.verseOfDay2':'Verse of the day','home.greet.dhikr':'Remember God','home.greet.morning.1':'A morning of worship — have you read the morning adhkar?','home.greet.morning.2':'Start early with the remembrance of God; the morning adhkar are waiting.','home.greet.morning.3':'Open your day with the morning adhkar.','home.greet.morning.4':'Good morning — have you begun with the morning adhkar?','home.greet.morning.5':'Meet the morning with the remembrance of God.','home.greet.morning.6':'The morning adhkar will carry you through your day.','home.greet.morning.7':'A good morning to you — the morning adhkar are waiting.','home.greet.morning.8':'Begin your day with a fortress of adhkar.','home.greet.evening.1':'An evening of remembrance — have you read the evening adhkar?','home.greet.evening.2':'Close your day with the evening adhkar.','home.greet.evening.3':'Before the day settles, the evening adhkar.','home.greet.evening.4':'Good evening — have you read the evening adhkar?','home.greet.evening.5':'Meet the evening with the remembrance of God.','home.greet.evening.6':'The evening adhkar will keep you through your night.','home.greet.evening.7':'A good evening to you — the evening adhkar are waiting.','home.greet.evening.8':'Seal your day with a fortress of adhkar.','onboarding.welcome':'Welcome','onboarding.male':'Boy','onboarding.female':'Girl','onboarding.start':'Start','onboarding.yearError':'Write your birth year as four digits — for example 2015','onboarding.name':'Name','onboarding.birthYear':'Year of birth — for example 2015'}};// THE LOOKUP. {name} placeholders are substituted from the vars argument; one with no matching
// variable is left exactly as authored rather than becoming the string "undefined". A key that
// is missing from the active dictionary falls back to Arabic, and a key missing from BOTH
// returns empty -- a raw key is a developer's problem and must never reach a reader's screen.
function ezT(key,vars){const k=String(key);const active=EZ_I18N[EZ_LANG];let out=active&&Object.prototype.hasOwnProperty.call(active,k)?active[k]:null;if(out==null){const base=EZ_I18N[EZ_LANG_FALLBACK];out=base&&Object.prototype.hasOwnProperty.call(base,k)?base[k]:null;}if(typeof out!=='string')return'';if(!vars)return out;return out.replace(/\{([A-Za-z0-9_]+)\}/g,(m,name)=>Object.prototype.hasOwnProperty.call(vars,name)&&vars[name]!=null?String(vars[name]):m);}// The globe. One bounded glyph, no text inside it, and it is decorative -- the button carries
// the accessible name.
const EZ_LANG_GLOBE=/*#__PURE__*/React.createElement("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",focusable:"false"},/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"12",r:"9"}),/*#__PURE__*/React.createElement("path",{d:"M3 12h18"}),/*#__PURE__*/React.createElement("path",{d:"M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"}));// THE LANGUAGE CONTROL. It lives in exactly two places, and the guard fails if a third
// appears: the FIRST-RUN card, where a reader who has not made a profile yet can choose before
// they type anything, and Settings, which is the permanent home of the choice afterwards. It is
// deliberately NOT on the chat, the home, the drawer or any rail -- a returning reader is not
// asked to pick a language every time they open the app.
//
// A button and a menu built from EZ_LANGUAGES -- not a modal, not a dialog, and it traps nothing:
// Tab keeps walking the page, Escape closes and returns focus, a press outside closes, and every
// item is a real button so Enter and Space already work. type="button" is load-bearing on the
// first-run card, because that card submits.
function EzLangControl({variant}){const lang=useEzLang();const[open,setOpen]=useState(false);const wrapRef=useRef(null);const btnRef=useRef(null);useEffect(()=>{if(!open)return undefined;const onKey=e=>{if(e.key==='Escape'){setOpen(false);try{if(btnRef.current)btnRef.current.focus();}catch(err){}}};const onDown=e=>{const w=wrapRef.current;if(w&&e.target&&typeof w.contains==='function'&&!w.contains(e.target))setOpen(false);};try{document.addEventListener('keydown',onKey);document.addEventListener('mousedown',onDown);}catch(err){}return()=>{try{document.removeEventListener('keydown',onKey);document.removeEventListener('mousedown',onDown);}catch(err){}};},[open]);const pick=code=>{ezLangSet(code);setOpen(false);};const here=ezLangEntry(lang);const onb=variant==='onboarding';return/*#__PURE__*/React.createElement("div",{className:onb?'ezlang-wrap is-onb':'ezlang-wrap',ref:wrapRef},/*#__PURE__*/React.createElement("button",{type:"button",ref:btnRef,className:onb?'ezlang-btn is-onb':'ezlang-btn is-row',"data-ez-lang-toggle":"1","aria-haspopup":"listbox","aria-expanded":open?'true':'false',"aria-label":ezT('language.change'),onClick:()=>setOpen(o=>!o)},onb?EZ_LANG_GLOBE:null,/*#__PURE__*/React.createElement("span",null,here.nativeName),onb?null:/*#__PURE__*/React.createElement("span",{className:"ezlang-caret","aria-hidden":"true"},'\u25BE')),open&&/*#__PURE__*/React.createElement("div",{className:"ezlang-menu",role:"listbox","aria-label":ezT('language.label')},EZ_LANGUAGES.map(l=>/*#__PURE__*/React.createElement("button",{key:l.code,type:"button",role:"option","aria-selected":lang===l.code?'true':'false',className:"ezlang-item",onClick:()=>pick(l.code)},/*#__PURE__*/React.createElement("span",{className:"ezlang-code","aria-hidden":"true"},l.shortLabel),/*#__PURE__*/React.createElement("span",{className:"ezlang-name"},l.nativeName),/*#__PURE__*/React.createElement("span",{className:"ezlang-tick","aria-hidden":"true"},lang===l.code?'\u2713':'')))));}// ============================================================
// رمز لوحة الأهل — الحكمُ في الخادم (D12). لا يبقى في المتصفّح سرٌّ قابلٌ للمقارنة.
// ============================================================
// قبلَ D12 كان الرمزُ يُتحقَّقُ هنا: بصمةُ SHA-256 في localStorage تُقارَنُ ببصمةِ المُدخَل.
// ورمزٌ من أربعةِ أرقامٍ له عشرةُ آلافِ احتمالٍ فحسب، فبصمتُه جدولُ بحثٍ لا تعمية — ومن فتحَ
// devtools قرأها، بل ومن بدّلَ القيمةَ بدّلَ الرمز. الحكمُ الآنَ في api/parent-code.js وحدَه:
// scrypt بملحٍ عشوائيّ + timingSafeEqual، وبُعدا محاولاتٍ (جهاز + عنوان) لا يملكُ العميلُ تصفيرَهما.
// المعنى لم يتغيّر: الرمزُ لجهازٍ واحدٍ كما كان يومَ كان في localStorage ذلك الجهاز — تغيّرَ
// مكانُ الحكمِ لا معناه.
//
// المفتاحُ القديم لا يُكتَبُ بعدَ اليوم أبدًا: يُقرَأُ مرّةً واحدةً بذرةً لهجرةٍ صامتةٍ يحكمُ
// عليها الخادم، ثمّ يُمحى. لا سطرَ في هذا الملفِّ يقارنُه بشيء.
const LEGACY_PIN_HASH_KEY='parent_pin_hash';const readLegacyParentHash=()=>{try{const v=localStorage.getItem(LEGACY_PIN_HASH_KEY);return /^[0-9a-f]{64}$/.test(v||'')?v:null;}catch(e){return null;}};const clearLegacyParentHash=()=>{try{localStorage.removeItem(LEGACY_PIN_HASH_KEY);}catch(e){}};// نداءٌ واحدٌ للخادم، ومعرّفُ الجهازِ يُضافُ هنا لا في كلِّ موضعِ نداء.
const parentCodeCall=payload=>fetch('/api/parent-code',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(Object.assign({},payload,{deviceId:getDeviceId()}))});// يبقى لقفلِ الإنفاقِ وحدَه (SPEND_GATE_SHA256) — قرارُ مالكٍ منفصلٌ ومعطَّلٌ بمفتاحِه الموثَّق.
// لا يمسُّ رمزَ لوحةِ الأهلِ في شيء.
async function hashPin(pin){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(pin)));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}// ============================================================
// قفل الإنفاق — جهة العميل فقط (بقرار المالك؛ devtools يتجاوزه وهذا مقبول).
// يحرس ما يُنفق الرصيد: المحادثة (chat/ask/chat-fast) والنطق (tashkeel/tts) والمكالمة.
// SPEND_GATE_SHA256 = بصمة SHA-256 (٦٤ خانة hex) لرمز الدخول — لا يُخزَّن الرمز نفسه، تُقارَن البصمات فقط.
// ٦٤ صفراً = القفل مُعطَّل تماماً: يعمل التطبيق كما هو اليوم بلا أي مطالبة في أي مكان.
// لتفعيله: ضع بصمة رمزٍ حقيقي مكان الأصفار. نشرُ هذا الكوميت بالأصفار لا يقفل أحداً، ولا المالك.
const SPEND_GATE_SHA256='0000000000000000000000000000000000000000000000000000000000000000';// D86: disabled by its own documented kill switch -- no PIN wall at boot. The CALL stays walled by UnlockSheet + founder token; item 84 lifted the client wall from the two deep tiers, which api/ask.js still judges server-side; the day cap still counts server-side.
const SPEND_GATE_KEY='spend_gate_unlock';const SPEND_GATE_DISABLED=SPEND_GATE_SHA256==='0'.repeat(64);function spendGateOpen(){if(SPEND_GATE_DISABLED)return true;// القفل مُعطَّل ⇐ مفتوح دائماً (فشلٌ آمن للفتح)
try{return localStorage.getItem(SPEND_GATE_KEY)===SPEND_GATE_SHA256;}catch(e){return false;}}// ============================================================
// D88 -- theme. One stored value, 'light' or 'dark', nothing else accepted. applyTheme is the
// SAME code path the <head> boot script runs, so a toggle and a reload cannot disagree.
// ============================================================
// ============================================================
// THE WATERMARK'S OPACITY -- one number, per device, and the same shape as the theme below it:
// one key, one reader that refuses anything it does not recognise, one writer that is the ONLY
// thing that touches the key. It holds a NUMBER between 0.05 and 1 and nothing else: no
// identifier, no text, nothing about the reader, nothing that could be sent anywhere -- and
// nothing in this file passes it to fetch, to a body, to a header or to a payload.
//
// THE DEFAULT LIVES IN THE STYLESHEET, not here: .ezwm reads var(--ezwm-o,0.5), so a device that
// has never chosen carries no inline property at all and the CSS answers. This module writes the
// property onto the document root ONLY when a real stored value exists, which is why clearing
// storage returns the page to the stylesheet's own 0.5 rather than to a remembered number.
const EZIK_WM_KEY='ezik_watermark_opacity_v1';const EZIK_WM_DEFAULT=0.5;// light / medium / bold, as the brief names them. The slider is the same number, finer.
const EZIK_WM_PRESETS=[0.2,0.5,0.8];const EZIK_WM_MIN=0.05;// ZERO IS A CHOICE, and it was not one. `0` fell into the `n < EZIK_WM_MIN` arm with every
// other out-of-range number and came back as the DEFAULT -- measured: applyWatermarkOpacity(0)
// returned 0.5 and wrote "0.5" to the key, so asking for no watermark set it to medium. It is
// now legal, and it is the ONLY value below EZIK_WM_MIN that is: a hand-edited 0.03 is still
// not a strength this app offers and still resolves to the default.
const ezikWmClamp=v=>{const n=typeof v==='number'?v:parseFloat(v);if(!Number.isFinite(n))return EZIK_WM_DEFAULT;if(n===0)return 0;if(n<EZIK_WM_MIN||n>1)return EZIK_WM_DEFAULT;return Math.round(n*100)/100;};const readWatermarkOpacity=()=>{try{const raw=localStorage.getItem(EZIK_WM_KEY);return raw===null?EZIK_WM_DEFAULT:ezikWmClamp(raw);}catch(e){return EZIK_WM_DEFAULT;}};// LIVE, and live is the whole point: the property is on <html>, so a chat mounted behind the
// settings sheet re-paints the moment this runs, with no state threaded through any component
// and no remount. It returns the value it settled on so a caller never has to re-read the store.
const applyWatermarkOpacity=v=>{const n=ezikWmClamp(v);try{document.documentElement.style.setProperty('--ezwm-o',String(n));}catch(e){}// «إزالةٌ تامّة» has to mean removed, not invisible. An element at opacity 0 is still in the
// tree and still FETCHES its background image -- a 365KB PNG for a mark the reader has just
// said they do not want. The attribute drives a display:none rule, so at zero the mark is
// not painted, not composited and not downloaded.
try{document.documentElement.setAttribute('data-ezwm',n===0?'off':'on');}catch(e){}try{localStorage.setItem(EZIK_WM_KEY,String(n));}catch(e){}return n;};(function(){try{if(localStorage.getItem(EZIK_WM_KEY)===null)return;// never chosen -> the stylesheet answers
const n0=readWatermarkOpacity();document.documentElement.style.setProperty('--ezwm-o',String(n0));document.documentElement.setAttribute('data-ezwm',n0===0?'off':'on');}catch(e){}})();// WHAT `Enter` DOES, AND IT IS THE READER'S TO SET. Same shape as the watermark above: one
// key, one reader that refuses anything it does not recognise, one writer that is the only
// thing to touch the key. It holds one of three words and nothing else -- no identifier, no
// text, nothing about the reader -- and nothing in this file sends it anywhere.
//
// THE DEFAULT IS `auto`, AND `auto` IS TODAY'S RULE UNCHANGED: a touch composer writes a new
// line and sends with the button, a pointer composer sends on Enter. So a device that has
// never chosen behaves exactly as it did before this existed. The other two words are the
// reader overriding that guess in one direction or the other, which is what the toggle does.
//
// IT IS NOT A SECOND RULE ABOUT COMPOSITION. An Enter that an IME is using to accept a
// candidate never sends, in all three values -- that test sits above this one in the handler
// and this preference is not consulted until it has passed.
const EZIK_ENTER_KEY='ezik_enter_sends_v1';const EZIK_ENTER_AUTO='auto';const EZIK_ENTER_EVENT='ezik:enter-pref';const readEnterPref=()=>{try{const raw=localStorage.getItem(EZIK_ENTER_KEY);return raw==='send'||raw==='newline'?raw:EZIK_ENTER_AUTO;}catch(e){return EZIK_ENTER_AUTO;}};const writeEnterPref=v=>{const w=v==='send'||v==='newline'?v:EZIK_ENTER_AUTO;try{if(w===EZIK_ENTER_AUTO)localStorage.removeItem(EZIK_ENTER_KEY);else localStorage.setItem(EZIK_ENTER_KEY,w);}catch(e){}// ANNOUNCED, because the chat is NOT re-mounted when الإعدادات closes. That was measured on
// a real page: the switch wrote the key and the composer went on obeying the value it had
// read at mount. Every reader of this preference listens for this event, so what the switch
// says and what Enter does cannot drift apart for even one keystroke.
try{window.dispatchEvent(new CustomEvent(EZIK_ENTER_EVENT,{detail:w}));}catch(e){}return w;};// THE ONE RESOLVER, and every reader of this preference goes through it -- the handler, the
// keyboard hint and the settings switch alike -- so what the key says, what the composer does
// and what the corner key is labelled cannot disagree.
// The same question the composer asks, asked where there is no composer to ask it of: الإعدادات
// draws the switch before the chat is on screen. It is the media query ONLY -- never the window
// width -- so this screen and the composer's opening value are the same value.
const ezikComposerIsTouch=()=>{try{return!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches);}catch(e){return false;}};const ezikEnterSends=(pref,isTouch)=>{if(pref==='send')return true;if(pref==='newline')return false;return!isTouch;};// THE MARK STEPS BACK WHILE A REPLY IS ARRIVING -- AND ONLY IF ASKED. This is an OPTION and
// not a behaviour: the default is off, so a device that never opens الإعدادات sees exactly
// what it saw before. It is not a second opacity either -- the stored strength is untouched
// and comes back the moment the reply is finished.
const EZIK_WM_HIDE_KEY='ezik_watermark_autohide_v1';const EZIK_WM_HIDE_EVENT='ezik:watermark-autohide';const readWatermarkAutoHide=()=>{try{return localStorage.getItem(EZIK_WM_HIDE_KEY)==='on';}catch(e){return false;}};const writeWatermarkAutoHide=on=>{try{if(on)localStorage.setItem(EZIK_WM_HIDE_KEY,'on');else localStorage.removeItem(EZIK_WM_HIDE_KEY);}catch(e){}// Announced for the reason item 65 measured: الإعدادات does not unmount the chat, so a
// switch that only wrote the key would not change anything until a reload.
try{window.dispatchEvent(new CustomEvent(EZIK_WM_HIDE_EVENT,{detail:!!on}));}catch(e){}return!!on;};const THEME_KEY='murabbi_theme_v1';const readStoredTheme=()=>{try{const t=localStorage.getItem(THEME_KEY);return t==='dark'||t==='light'?t:'light';}catch(e){return'light';}};const applyTheme=t=>{const v=t==='dark'?'dark':'light';// anything unrecognised falls to light
try{document.documentElement.setAttribute('data-theme',v);}catch(e){}// S96: the boot script paints <html> INLINE to kill the cold-start white flash, and an inline
// style outranks the stylesheet. So a runtime switch has to move those two properties as well,
// or the root keeps the colour it booted with and shows through wherever body does not reach
// (overscroll, the area behind the system bars). Same two properties, same values, same order.
try{document.documentElement.style.colorScheme=v;}catch(e){}try{document.documentElement.style.background=v==='dark'?'#0E1116':'#FFFFFF';}catch(e){}// ITEM 95: the light value is #FFFFFF on both of the two lines above, and on the boot
// script at the top of the file. They are the ONE place the light background was not
// already white -- body reads var(--vt-page), which is #FFFFFF in both identities, and
// both screen roots measured rgb(255,255,255) before this change. Dark is untouched.
try{const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',v==='dark'?'#0E1116':'#1D4ED8');}catch(e){}try{localStorage.setItem(THEME_KEY,v);}catch(e){}return v;};// ============================================================
// تخزين المحادثة (Feature Flag)
// ============================================================
const PERSIST_CONVERSATION=true;// الإنتاج: يُحفَظ/يُحمَّل ملف الطفل والمحادثة عبر localStorage — لا يُمسح عند كل فتح.
// ============================================================
// غ‑٣ — حاجزُ صوتِ الأطفال (fail-closed)
// ============================================================
// كلُّ مسارِ صوتٍ خارجيّ (ميكروفون + إرسالُ نطقٍ لخدمة) مقفولٌ على ملفّات الأطفال
// (band==="young" ⇔ age<13) ما دام العلمُ مطفأً. تعذُّرُ تحديدِ العمر ⇒ مقفول.
// التلاوةُ الجاهزة (everyayah) خارجَ الحاجز: ملفّاتٌ ثابتةٌ بلا أيّ بياناتِ طفل.
const CHILD_VOICE_ENABLED=false;// غ‑٣: يُفتح بتحديثٍ مقيس بعد حسم الامتثال
const CHILD_VOICE_NOTICE='الميزةُ الصوتيةُ للأطفالِ قيدَ التجهيز، وستتوفّرُ بعدَ اكتمالِ اختباراتِ الأمانِ والخصوصيّة.';// مرآةٌ على مستوى الوحدة لملفّ المستخدم. App يكتبها في اللحظة نفسها التي يكتب فيها
// profileRef.current (تحميلُ التخزين + إنشاءُ الملفّ)، فيقرؤها الحاجزُ من App ومن
// MemorizeScreen معاً — وprofileRef داخلُ App فلا تراه المكوّناتُ الأخرى. تبدأ null ⇒ مقفولة.
const voiceProfileRef={current:null};// ============================================================
// قارئ المصحف — التلاوةُ الجاهزة (everyayah)
// ============================================================
// ثابتٌ واحد يبني كلَّ روابطِ MP3 لتلاوةِ القرآن. التعدّدُ (منتقي قرّاء) قرارٌ
// لاحق يبدّلُ هذا السطرَ وحدَه — لا منطقَ تشغيلٍ ولا تخزينَ تفضيلٍ هنا.
const QURAN_RECITER='Hudhaify_64kbps';// الحذيفي 64kbps
// ============================================================
// خريطة أسماء السور → أرقامها (لبناء رابط تلاوة everyayah)
// ============================================================
// الاسم للعرض، والرقم لبناء رابط MP3 (everyayah.com / القارئ 64kbps).
// إن أرسل النموذج surah_num استُخدم مباشرة؛ وإلا نرجع لهذه الخريطة بالاسم.
const SURAH_NUMBERS={'الفاتحة':1,'البقرة':2,'آل عمران':3,'النساء':4,'المائدة':5,'الأنعام':6,'الأعراف':7,'الأنفال':8,'التوبة':9,'يونس':10,'هود':11,'يوسف':12,'الرعد':13,'إبراهيم':14,'الحجر':15,'النحل':16,'الإسراء':17,'الكهف':18,'مريم':19,'طه':20,'الأنبياء':21,'الحج':22,'المؤمنون':23,'النور':24,'الفرقان':25,'الشعراء':26,'النمل':27,'القصص':28,'العنكبوت':29,'الروم':30,'لقمان':31,'السجدة':32,'الأحزاب':33,'سبأ':34,'فاطر':35,'يس':36,'الصافات':37,'ص':38,'الزمر':39,'غافر':40,'فصلت':41,'الشورى':42,'الزخرف':43,'الدخان':44,'الجاثية':45,'الأحقاف':46,'محمد':47,'الفتح':48,'الحجرات':49,'ق':50,'الذاريات':51,'الطور':52,'النجم':53,'القمر':54,'الرحمن':55,'الواقعة':56,'الحديد':57,'المجادلة':58,'الحشر':59,'الممتحنة':60,'الصف':61,'الجمعة':62,'المنافقون':63,'التغابن':64,'الطلاق':65,'التحريم':66,'الملك':67,'القلم':68,'الحاقة':69,'المعارج':70,'نوح':71,'الجن':72,'المزمل':73,'المدثر':74,'القيامة':75,'الإنسان':76,'المرسلات':77,'النبأ':78,'النازعات':79,'عبس':80,'التكوير':81,'الانفطار':82,'المطففين':83,'الانشقاق':84,'البروج':85,'الطارق':86,'الأعلى':87,'الغاشية':88,'الفجر':89,'البلد':90,'الشمس':91,'الليل':92,'الضحى':93,'الشرح':94,'التين':95,'العلق':96,'القدر':97,'البينة':98,'الزلزلة':99,'العاديات':100,'القارعة':101,'التكاثر':102,'العصر':103,'الهمزة':104,'الفيل':105,'قريش':106,'الماعون':107,'الكوثر':108,'الكافرون':109,'النصر':110,'المسد':111,'الإخلاص':112,'الفلق':113,'الناس':114,// أسماء بديلة شائعة (قد يستخدمها النموذج)
'براءة':9,'بني إسرائيل':17,'الملائكة':35,'المؤمن':40,'حم السجدة':41,'القتال':47,'الدهر':76,'الانشراح':94,'الزلزال':99,'اللهب':111,'تبت':111,'التوحيد':112};// تطبيع عربي خفيف: إزالة التشكيل + توحيد الألف بأنواعها + إزالة التطويل
// — يغطي معظم اختلافات الإملاء (الهمزات) دون الحاجة لإدراج كل صيغة يدوياً.
const normalizeArabic=str=>(str||'').replace(/[ً-ْٰـ]/g,'')// تشكيل + ألف خنجرية + تطويل
.replace(/[آأإٱ]/g,'ا')// آ أ إ ٱ → ا
.replace(/\s+/g,' ').trim();// ============================================================
// المحفّظ Layer B "سمِّعني" — recite-from-memory matching (pure, in-browser, no API).
// ============================================================
// A SEPARATE, broader normalizer than normalizeArabic (which resolveSurahNumber depends on —
// do not touch it). Strips every combining/annotation mark present in the Uthmani dataset so
// undiacritized ar-SA output can be compared fairly to the canonical text on WORD identity:
//   U+064B–U+065F harakat + maddah/hamza-above, U+0670 dagger alef,
//   U+06D6–U+06ED Quranic pause marks + small-high pronoun letters, U+0640 tatweel.
// Then folds orthographic variants: alef forms → ا, ة → ه, ى → ي. Word identity only — NOT
// tashkeel/tajweed.
const normalizeForRecite=str=>(str||'').replace(/[ً-ٰٟۖ-ۭـ]/g,'').replace(/[آأإٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();// Tokenize on whitespace AFTER normalizing — standalone pause-mark glyphs normalize to '' and
// are dropped by filter(Boolean), so they never count as words.
const tokenizeForRecite=str=>normalizeForRecite(str).split(/\s+/).filter(Boolean);const collapseRepeats=text=>{let words=(text||'').split(/\s+/).filter(Boolean);if(words.length<3)return text;let changed=true,guard=0;while(changed&&guard++<12){changed=false;for(let w=1;w<=4;w++){const out=[];let i=0;while(i<words.length){let reps=1;while(i+(reps+1)*w<=words.length){let same=true;for(let j=0;j<w;j++){if(words[i+j]!==words[i+reps*w+j]){same=false;break;}}if(!same)break;reps++;}if(reps>=3){for(let r=0;r<2;r++)for(let j=0;j<w;j++)out.push(words[i+j]);i+=reps*w;changed=true;}else{out.push(words[i]);i++;}}words=out;}}return words.join(' ');};// Lenient per-word similarity: a heard word this close to an expected word counts as correct.
// False red in the Quran is worse than a missed slip (Musaed), so the bar is forgiving.
const RECITE_LENIENT_THRESHOLD=0.8;// Normalized Levenshtein ratio (1 - dist/maxLen) on two already-normalized tokens. Cheap
// single-row DP; ayat are short.
const wordSim=(a,b)=>{if(a===b)return 1;if(!a||!b)return 0;const m=a.length,n=b.length;let prev=new Array(n+1);for(let j=0;j<=n;j++)prev[j]=j;for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++){const cost=a[i-1]===b[j-1]?0:1;cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);}prev=cur;}const maxLen=Math.max(m,n);return maxLen===0?1:1-prev[n]/maxLen;};// Word-level alignment of the child's heard tokens against the expected ayah tokens, via LCS
// with (wordSim >= threshold) as the equality predicate (tolerates near-misses, skips, extras,
// minor order wobble). Returns a per-expected-word state:
//   'matched'  — part of the alignment (child said a close-enough word) → black
//   'mismatch' — BEFORE the furthest matched index but not aligned (reached past it, got it
//                wrong/substituted/skipped) → red
//   'pending'  — at/after the furthest matched index (not reached yet) → dim, NEVER red
// "pending never red" biases hard against false reds: silence / slow pace shows dim, not wrong.
const alignRecite=(expected,heard)=>{const m=expected.length,n=heard.length;if(m===0)return[];const close=(e,h)=>wordSim(e,h)>=RECITE_LENIENT_THRESHOLD;// dp[i][j] = LCS length of expected[i..], heard[j..]
const dp=Array.from({length:m+1},()=>new Int32Array(n+1));for(let i=m-1;i>=0;i--){for(let j=n-1;j>=0;j--){dp[i][j]=close(expected[i],heard[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);}}const matched=new Array(m).fill(false);let i=0,j=0;while(i<m&&j<n){if(close(expected[i],heard[j])){matched[i]=true;i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}let furthest=-1;for(let k=0;k<m;k++)if(matched[k])furthest=k;const states=new Array(m);for(let k=0;k<m;k++)states[k]=matched[k]?'matched':k<furthest?'mismatch':'pending';return states;};// Reused verbatim from the chat/call mic's not-supported message (line ~1526) — not new copy.
const RECITE_NO_SR='🚫 متصفحك لا يدعم التعرف على الصوت. استخدم Chrome أو Safari.';// خريطة مطبَّعة تُبنى مرة واحدة من SURAH_NUMBERS للبحث المرن بالاسم
const SURAH_NUMBERS_NORM={};for(const _k in SURAH_NUMBERS){SURAH_NUMBERS_NORM[normalizeArabic(_k)]=SURAH_NUMBERS[_k];}// خريطة عكسية رقم→اسم (أول اسم لكل رقم = الاسم الأساسي) — لعنوان بطاقة الآية
// عندما يرسل النموذج surah_num فقط بلا اسم سورة.
const SURAH_NAMES={};for(const _name in SURAH_NUMBERS){const _n=SURAH_NUMBERS[_name];if(!SURAH_NAMES[_n])SURAH_NAMES[_n]=_name;}// Revelation place per the standard Egyptian (1924) mushaf header classification.
// These 28 surahs are Medinan (مدنية); all others are Meccan (مكية).
const MEDINAN_SURAHS=new Set([2,3,4,5,8,9,13,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,99,110]);const revelationLabel=n=>MEDINAN_SURAHS.has(n)?'مدنية':'مكية';// ============================================================
// المصحف الكنسي (Hafs/Uthmani) — يُحمَّل مرة واحدة من /quran-uthmani.json
// ============================================================
// مصدر موثوق (quran.com text_uthmani، مطابق لترقيم تلاوة القارئ في everyayah).
// نصّ الآية يُعرَض من هذا المصدر فقط — لا من مخرجات النموذج أبداً.
// مفتاح الوصول: `${surahNum}:${ayah}` بالأرقام الصحيحة (نفس مفاتيح رابط الصوت).
let __quranData=null;// الكائن المُحمَّل (مخزَّن في الذاكرة)
let __quranPromise=null;// وعدٌ جارٍ لمنع جلب مكرّر
const loadQuran=()=>{if(__quranData)return Promise.resolve(__quranData);if(!__quranPromise){// Promise.resolve().then(...) يضمن أنّ أيّ خطأ (حتى غياب fetch) يصبح رفضاً
// لا رميةً متزامنة — فلا ينكسر استدعاء loadQuran().catch(...) أبداً.
__quranPromise=Promise.resolve().then(()=>fetch('/quran-uthmani.json')).then(r=>{if(!r.ok)throw new Error('quran fetch '+r.status);return r.json();}).then(d=>{__quranData=d;return d;}).catch(e=>{__quranPromise=null;throw e;});// اسمح بإعادة المحاولة لاحقاً
}return __quranPromise;};// نصّ الآية الكنسي أو null (لا يقع أبداً على نصّ النموذج)
const getVerseText=(sNum,aNum)=>{if(!__quranData||!(sNum>=1)||!(aNum>=1))return null;return __quranData[`${sNum}:${aNum}`]||null;};// ============================================================
// أذكار حصن المسلم — تُحمَّل مرة واحدة (كنمط loadQuran). النصّ يأتي حصراً من
// adhkar.json المجلوب من حصن المسلم، لا من النموذج — كالآيات تماماً.
// ============================================================
let __adhkarData=null;// { byId: {id -> dhikr}, byCat: {catId -> [dhikr]} }
let __adhkarPromise=null;const loadAdhkar=()=>{if(__adhkarData)return Promise.resolve(__adhkarData);if(!__adhkarPromise){__adhkarPromise=Promise.resolve().then(()=>fetch('/adhkar.json')).then(r=>{if(!r.ok)throw new Error('adhkar fetch '+r.status);return r.json();}).then(raw=>{const byId={},byCat={};(raw.adhkar||[]).forEach(d=>{byId[d.id]=d;(byCat[d.categoryId]=byCat[d.categoryId]||[]).push(d);});__adhkarData={byId,byCat,categories:raw.categories||[]};return __adhkarData;}).catch(e=>{__adhkarPromise=null;throw e;});}return __adhkarPromise;};// worship-display.json — the CLIENT-rendered worship text. Loaded once (same shape as
// loadAdhkar). GENERATED from worship-golden.json by build-worship-display.cjs; never the model.
let __worshipData=null;// { cells: { "id:band" -> { rawHash, band, chars, text } } }
let __worshipPromise=null;const loadWorship=()=>{if(__worshipData)return Promise.resolve(__worshipData);if(!__worshipPromise){__worshipPromise=Promise.resolve().then(()=>fetch('/worship-display.json')).then(r=>{if(!r.ok)throw new Error('worship fetch '+r.status);return r.json();}).then(raw=>{__worshipData=raw;return __worshipData;}).catch(e=>{__worshipPromise=null;throw e;});}return __worshipPromise;};const resolveWorshipTags=async(text,band)=>{if(!text||text.indexOf('<worship')===-1)return text;let data=null;try{data=await loadWorship();}catch(e){data=null;}const arm=band==='adult'||band==='teen'?'adult':'young';return text.replace(/<worship([^>]*)>[\s\S]*?<\/worship>/g,(_w,attrs)=>{const m=attrs.match(/id=["']([^"']+)["']/);const cell=m&&data&&data.cells&&data.cells[m[1]+':'+arm];const canonical=cell&&typeof cell.text==='string'&&cell.text.trim()?cell.text:ezT('errors.generic');return' '+canonical+' ';});};// كل أذكار بابٍ بعددِ التكرار والصوت، أو [] (لا يقع أبداً على نصّ النموذج)
const getDhikrByCategory=catId=>{if(!__adhkarData)return[];return __adhkarData.byCat[parseInt(catId,10)]||[];};// عدد آيات سورة من المصحف المُحمَّل (عدّ المفاتيح ذات البادئة `${num}:`)؛ 0 إن لم يُحمَّل.
const getSurahAyahCount=sNum=>{if(!__quranData||!(sNum>=1))return 0;const prefix=`${sNum}:`;let c=0;for(const k in __quranData)if(k.startsWith(prefix))c++;return c;};// تحويل الأرقام إلى أرقام عربية-هندية (٠١٢…) لفواصل الآيات ۝ واللُّصوقات
const toArabicDigits=n=>String(n).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);// يُرجع رقم السورة (1..114) أو null. يفضّل surah_num الرقمي، ثم يبحث بالاسم.
const resolveSurahNumber=(surahName,surahNum)=>{const n=parseInt(surahNum,10);if(n>=1&&n<=114)return n;if(!surahName)return null;const raw=String(surahName).trim();if(SURAH_NUMBERS[raw])return SURAH_NUMBERS[raw];// إزالة بادئة "سورة" إن وُجدت ثم البحث في الخريطة المطبَّعة
const norm=normalizeArabic(raw).replace(/^سوره?\s+/,'').replace(/^سورة\s+/,'').trim();return SURAH_NUMBERS_NORM[norm]||null;};/* 14.2 */// ============================================================
// تخطيط مصحف المدينة — /mushaf-layout.json (٦٠٤ صفحة).
// ============================================================
// الملفّ لا يحمل حرفاً قرآنياً واحداً: مواقع كلماتٍ وحدود أسطرٍ فقط ("سورة:آية:كلمة").
// الرباط مبرهَن ومحروس بـ layout-guard.cjs (البوّابة الخامسة):
//   ٦٢٣٦/٦٢٣٦ آية  ·  ٧٧٤٢٩/٧٧٤٢٩ كلمة تنزل في خانتها.
// كلُّ حرفٍ يراه القارئ يأتي من __quranData وحده — كالآيات في المحادثة تماماً.
let __layoutData=null;let __layoutPromise=null;const loadLayout=()=>{if(__layoutData)return Promise.resolve(__layoutData);if(!__layoutPromise){__layoutPromise=Promise.resolve().then(()=>fetch('/mushaf-layout.json')).then(r=>{if(!r.ok)throw new Error('layout fetch '+r.status);return r.json();}).then(d=>{__layoutData=d;return d;}).catch(e=>{__layoutPromise=null;throw e;});// اسمح بإعادة المحاولة
}return __layoutPromise;};// "حرفٌ عربيّ" — لا علامة. هذه القاعدةُ بعينها هي التي بُرهن بها الرباط في
// layout-guard.cjs. لو اختلف تقطيعُ العارض عن عدّاد الحارس بحرفٍ واحد، نزلت
// الكلمةُ في الخانة الخطأ بصمت — والعدد يبقى صحيحاً. فلا تمسّها.
const __isArabicLetter=cp=>cp>=0x0621&&cp<=0x063A||// الهمزة .. الغين
cp>=0x0641&&cp<=0x064A||// الفاء .. الياء (التطويل 0x0640 مستبعَد)
cp>=0x0671&&cp<=0x06D3;// ألف الوصل والحروف الممتدّة
const __hasLetter=t=>{for(const ch of t)if(__isArabicLetter(ch.codePointAt(0)))return true;return false;};// الوصلات الأربع: خانةٌ واحدة في المصحف تبتلع كلمتين («بَعْدَ مَا» و«إِلْ يَاسِينَ»).
// ليست عطلاً — المصدر يقولها بنفسه. الرقم = رقم الخانة التي تبتلع التي بعدها.
const __LIGATURES={'2:181':3,'8:6':4,'13:37':8,'37:130':3};// تقطيع الآية إلى كلمات بحيث كلمة[i] == خانة[i+1] في التخطيط.
// العلاماتُ تلتصق في اتّجاهين — وهذا ليس تفصيلاً تجميلياً:
//   • علامة الوقف (ۖ ۗ ۚ ۛ) والسجدة (۩) تلتصق بما قبلها.
//   • ۞ (رأس الربع) تفتتح ١٩٩ آية ولا شيءَ قبلها — فتلتصق بما بعدها.
// لو التصقت ۞ بما قبلها (ولا شيءَ قبلها) لصارت كلمةً بذاتها، فانزاح كلُّ شيءٍ
// بعدها خانةً واحدة، وسقطت آخرُ كلمةٍ من ١٩٩ آية. مقيسٌ، لا مفترَض.
const __wordCache={};const wordsOfAyah=(sNum,aNum)=>{const key=sNum+':'+aNum;if(__wordCache[key])return __wordCache[key];const text=getVerseText(sNum,aNum);if(!text)return[];const out=[];let lead='';for(const tok of text.split(/\s+/)){if(!tok)continue;if(__hasLetter(tok)){out.push(lead?lead+' '+tok:tok);lead='';}else if(out.length)out[out.length-1]+=' '+tok;// وقف/سجدة → إلى الخلف
else lead=lead?lead+' '+tok:tok;// ۞ → إلى الأمام
}if(key in __LIGATURES){const i=__LIGATURES[key]-1;out.splice(i,2,out[i]+' '+out[i+1]);}__wordCache[key]=out;return out;};// فهرسٌ يُبنى مرّةً واحدة من التخطيط:
//   startPage[سورة]  = أوّل صفحةٍ تبدأ فيها.
//   headerSurah["صفحة:سطر"] = السورة التي يُعلنها سطرُ الرأس.
// كلاهما مشتقٌّ من المواقع، لا من لافتات المصدر — لافتاتُ الرؤوس فيه مكسورةٌ في
// ١٨ موضعاً (تسمّي السورة التي انتهت لا التي تبدأ) وزائدةٌ في موضع. ولهذا لا
// يحمل mushaf-layout.json أيَّ لافتةٍ أصلاً: أرقامُ صفحاتٍ وأسطرٍ ومواقعُ كلماتٍ فقط.
// ورأسٌ لا تليه آيةٌ أولى = رأسٌ زائد → لا نرسم له اسماً كاذباً.
let __layoutIndex=null;const buildLayoutIndex=()=>{if(__layoutIndex)return __layoutIndex;const startPage={},headerSurah={};const flat=[];for(const pg of __layoutData.p)for(const ln of pg.l)flat.push({p:pg.n,ln});for(let i=0;i<flat.length;i++){const F=flat[i];if(F.ln.t==='t'){for(const loc of F.ln.w){const a=loc.split(':');if(a[1]==='1'&&a[2]==='1'){const sn=parseInt(a[0],10);if(!startPage[sn])startPage[sn]=F.p;}}}else if(F.ln.t==='h'){for(let j=i+1;j<flat.length;j++){const nx=flat[j].ln;if(nx.t!=='t'||!nx.w||!nx.w.length)continue;const a=nx.w[0].split(':');if(a[1]==='1'&&a[2]==='1')headerSurah[F.p+':'+F.ln.n]=parseInt(a[0],10);break;}}}/* 14.2f3 */// ماذا أسقط المصدر؟ نمشي من أوّل كلمةٍ في كلّ سورة إلى الوراء فوق أسطر الرأس
// والبسملة الملاصقة. مقيسٌ من البيانات نفسها، لا من قائمةٍ مكتوبةٍ بيدنا:
//   خمسُ سورٍ بلا رأس  : ١٠ · ٨١ · ٨٢ · ٨٥ · ٨٦
//   سورتان بلا بسملة  : ٨١ (التكوير) · ٨٥ (البروج)
// والفاتحة والتوبة استثناءان صحيحان: بسملةُ الفاتحة آيتُها الأولى، والتوبة بلا بسملة.
// عرضُ سورةٍ بلا بسملتها نقصٌ في المصحف لا في الشكل — فنحقنها من getVerseText(1,1)
// ومن SURAH_NAMES. ولا نكتب حرفاً قرآنياً بأيدينا، هنا ولا في أيّ موضع.
const firstLine={};for(let i=0;i<flat.length;i++){const F=flat[i];if(F.ln.t!=='t')continue;for(const loc of F.ln.w){const a=loc.split(':');if(a[1]==='1'&&a[2]==='1'){const sn=parseInt(a[0],10);if(firstLine[sn]===undefined)firstLine[sn]=i;}}}const needHeader={},needBasmala={};for(let sn=1;sn<=114;sn++){const i=firstLine[sn];if(i===undefined)continue;let hasH=false,hasB=false,j=i-1;while(j>=0&&(flat[j].ln.t==='h'||flat[j].ln.t==='b')){if(flat[j].ln.t==='h')hasH=true;if(flat[j].ln.t==='b')hasB=true;j--;}if(!hasH)needHeader[sn]=1;if(!hasB&&sn!==1&&sn!==9)needBasmala[sn]=1;}__layoutIndex={startPage,headerSurah,needHeader,needBasmala};return __layoutIndex;};/* 14.3 */// ============================================================
// فهرس المصحف — صفحةُ بدءٍ لكلّ سورة ولكلّ جزء.
// ============================================================
// أوّلُ آيةٍ في كلّ جزء هي الثابتُ الوحيد هنا. أمّا الصفحاتُ فلا تُكتب بيدٍ أبداً:
// تُستخرَج من مواقع الكلمات كما تُستخرَج رؤوسُ السور — صفحةُ السورة أوّلُ صفحةٍ
// تحمل «س:١:١»، وصفحةُ الجزء الصفحةُ التي تنزل فيها أوّلُ كلمةٍ من أوّلِ آياته.
// لو سقطت واحدةٌ أو لم تتصاعد الأجزاء رجعنا بـ null: فهرسٌ بلا أرقامٍ خيرٌ من
// فهرسٍ برقمٍ كاذب.
const JUZ_FIRST_AYAH={1:'1:1',2:'2:142',3:'2:253',4:'3:92',5:'4:24',6:'4:148',7:'5:82',8:'6:111',9:'7:88',10:'8:41',11:'9:93',12:'11:6',13:'12:53',14:'15:1',15:'17:1',16:'18:75',17:'21:1',18:'23:1',19:'25:21',20:'27:56',21:'29:46',22:'33:31',23:'36:28',24:'39:32',25:'41:47',26:'46:1',27:'51:31',28:'58:1',29:'67:1',30:'78:1'};// صفوفُ الفهرس مرتَّبةً: بالصفحة، ثمّ الجزءُ قبل السورة عند التساوي، ثمّ بالرقم.
// تُبنى مرّةً واحدة — لا في كلّ رسم.
let __mushafNav=null;const buildMushafNav=()=>{if(__mushafNav)return __mushafNav;const startPage=buildLayoutIndex().startPage;const wordPage={};for(const pg of __layoutData.p)for(const ln of pg.l){if(ln.t!=='t'||!ln.w)continue;for(const loc of ln.w)if(!(loc in wordPage))wordPage[loc]=pg.n;}const rows=[];for(let sn=1;sn<=114;sn++){const p=startPage[sn];if(!p)return null;rows.push({k:'s',n:sn,p});}let prev=0;for(let jz=1;jz<=30;jz++){const ref=JUZ_FIRST_AYAH[jz];const p=wordPage[ref+':1'];if(!p||p<=prev)return null;prev=p;rows.push({k:'j',n:jz,p,s:parseInt(ref.split(':')[0],10)});}if(rows.length!==144)return null;rows.sort((a,b)=>a.p-b.p||(a.k===b.k?a.n-b.n:a.k==='j'?-1:1));__mushafNav=rows;return rows;};// ما يُرسَم قبل وصول التخطيط: السورُ وحدها بلا رقمِ صفحة. خانةُ الرقم محجوزةٌ في
// النمط، فلا تقفز القائمةُ حين تصل الأرقام.
const MUSHAF_NAV_FALLBACK=Array.from({length:114},(_,i)=>({k:'s',n:i+1,p:0}));// ============================================================
// قصّ السجلّ قبل إرساله للـ API (Sliding Window)
// ============================================================
// نُرسل آخر ٦ جولات (= ١٢ رسالة) فقط للـ API:
// — يمنع 429 Rate Limit الذي حصل في الاختبار الميداني
// — يُقلّل استهلاك Tokens بشكل ملحوظ مع إبقاء السياق كافياً للحوار
// — كامل السجلّ يبقى محفوظاً في الواجهة وفي localStorage للأهل
const MAX_HISTORY_PAIRS=6;const sliceHistoryForAPI=messages=>{if(!messages||messages.length===0)return[];const maxMessages=MAX_HISTORY_PAIRS*2;let sliced=messages.slice(-maxMessages);// الـ Anthropic API يتطلب أن يبدأ السجلّ برسالة user — احذف أيّ assistant في البداية
while(sliced.length>0&&sliced[0].role!=='user'){sliced=sliced.slice(1);}return sliced;};// ============================================================
// Body-size budget — the client must measure what the server measures (item 1 / defects 44+45).
// ============================================================
// Mirror of the server's hard INPUT cap. MUST equal MAX_CHAT_BODY_BYTES in lib/ratelimit.js:239;
// recon-audit.cjs FAILs if the two ever drift. The server 413s any POST body whose
// Buffer.byteLength(JSON.stringify(body),'utf8') exceeds this, so the client sizes the body the
// SAME way and trims/refuses BEFORE sending — the child never sees a silent 413.
const SERVER_MAX_CHAT_BODY_BYTES=2*1024*1024;// The client stays strictly UNDER the server: 64 KB headroom absorbs re-stringify slack + headers,
// so a body the client accepts can never 413 the server. The client is never more permissive.
const CLIENT_BODY_HEADROOM=64*1024;const CLIENT_BUDGET=SERVER_MAX_CHAT_BODY_BYTES-CLIENT_BODY_HEADROOM;// Size a candidate outgoing body EXACTLY as the server does (api/chat.js:30, api/ask.js:150):
// Buffer.byteLength(JSON.stringify(body),'utf8'). TextEncoder yields identical UTF-8 byte counts.
const bodyByteSize=body=>new TextEncoder().encode(JSON.stringify(body)).length;// Byte-driven history fit. mkBody(msgs) assembles the REAL outgoing body; drop the OLDEST messages
// until it fits CLIENT_BUDGET, measured the server's way. Never touches the system prompt (not part
// of `messages`) nor the newest message (msgs[last], the current user turn).
// §٢ (C) — AND IT IS THE ONE PLACE THE OUTGOING HISTORY IS ASSEMBLED, so it is where the
// truncation marker comes back off. `<incomplete/>` is a fact about how a past turn was DELIVERED
// and no part of what was said; replayed to the model as its own prose it becomes an example, and
// the model starts writing the marker itself — the client's own bookkeeping fed back as vocabulary,
// and then the notice below is drawn on an answer that finished perfectly well. Assistant STRINGS
// only: a user turn's content may be an array of image/document blocks and is not ours to rewrite.
const fitMessagesToBudget=(mkBody,messages)=>{let msgs=messages.map(m=>m&&m.role==='assistant'&&typeof m.content==='string'?{...m,content:ezikStripIncomplete(m.content)}:m);while(msgs.length>1&&bodyByteSize(mkBody(msgs))>CLIENT_BUDGET){msgs=msgs.slice(1);// drop oldest turn; keep the system prompt + the newest user message
}return msgs;};// File gate, budget half (defect 45): the per-type cap is not the only ceiling. Once the ~111KB
// system prompt + history already fill CLIENT_BUDGET, even a small file 413s the server. Model the
// REAL /api/ask body this attachment would produce (base64 inflation lives inside attachBlock.data)
// and return an Arabic refusal naming the conversation-size bound + the real remaining room if it
// would not fit; null if it fits. Effective ceiling = min(per-type cap, this).
const attachOverBudget=(attachBlock,messages,profile)=>{const p=profile||{};const band=deriveCaps(p.age).band;// D02ب: the posted body no longer carries the ~50KB system prompt — the server builds it from
// the four reader fields sent in its place. What is modelled here must be the body that is
// ACTUALLY posted: keeping the prompt in the model would reserve ~50KB that is never spent and
// refuse attachments that fit comfortably.
const mk=msgs=>({max_tokens:4096,stream:true,name:p.name,age:p.age,gender:p.gender,mode:'chat',messages:msgs,band});const toApi=arr=>sliceHistoryForAPI(arr).map(m=>({role:m.role,content:m.content}));const userWith={role:'user',content:[attachBlock,{type:'text',text:'اشرح لي هذا'}]};const baseBytes=bodyByteSize(mk(toApi(messages||[])));const withBytes=bodyByteSize(mk(toApi([...(messages||[]),userWith])));if(withBytes<=CLIENT_BUDGET)return null;const room=Math.max(0,CLIENT_BUDGET-baseBytes);// bytes that were free for this attachment
const need=withBytes-baseBytes;// bytes this attachment actually adds
const kb=n=>Math.max(0,Math.round(n/1024));return'المحادثة طويلة ولم يبقَ متّسعٌ كافٍ لهذا الملف في هذه الرسالة (المتبقّي نحو '+kb(room)+' ك.ب، والملف يحتاج نحو '+kb(need)+' ك.ب). ابدأ محادثةً جديدة أو أرسل ملفًّا أصغر.';};// Item A: the largest RAW file of a base64-sent type that could ever fit CLIENT_BUDGET on an EMPTY
// conversation -- system prompt, JSON envelope, and base64 inflation (4 chars per 3 bytes) all
// counted. Derived here, never typed. Text types (txt/docx) are CLIPPED before sending, so their
// file size never inflates the body; their true ceiling is the product policy limit (theoretical
// = unbounded). Returns { ceilingBytes, bound } where bound names WHICH ceiling won: 'budget' (the
// live message capacity) or 'policy' (the type's product limit). ceilingBytes = min(policy, theoretical).
const deriveTypeCeiling=(kind,policyBytes,profile)=>{const BASE64_MEDIA={pdf:'application/pdf',image:'image/jpeg'};const media=BASE64_MEDIA[kind];if(!media)return{ceilingBytes:policyBytes,bound:'policy'};// clipped text: policy IS the true ceiling
const p=profile||{};const band=deriveCaps(p.age).band;const block={type:kind==='pdf'?'document':'image',source:{type:'base64',media_type:media,data:''}};// D02ب: same correction as attachOverBudget above — model the body that is posted, which no
// longer contains the system prompt.
const body={max_tokens:4096,stream:true,name:p.name,age:p.age,gender:p.gender,mode:'chat',band,messages:[{role:'user',content:[block,{type:'text',text:'اشرح لي هذا'}]}]};const overhead=bodyByteSize(body);// the whole empty-convo body minus the base64 data
const maxBase64Chars=Math.max(0,CLIENT_BUDGET-overhead);// base64 chars (== bytes) that still fit
const theoreticalRaw=Math.floor(maxBase64Chars/4)*3;// invert base64: 3 raw bytes per 4 chars
return theoreticalRaw<policyBytes?{ceilingBytes:theoreticalRaw,bound:'budget'}:{ceilingBytes:policyBytes,bound:'policy'};};// Item A: render a byte count as an Arabic size string (Arabic-Indic digits) -- computed at the
// moment it is shown, never a literal.
const humanBytesAr=n=>toArabicDigits(n>=1024*1024?(n/(1024*1024)).toFixed(1)+' ميغابايت':Math.max(1,Math.round(n/1024))+' كيلوبايت');// Item A: a per-type "too big" refusal naming the THREE things a trustworthy limit must state:
// (1) which bound refused it -- the live message capacity ('سعة الرسالة') or the type's product
// limit ('حدّ النوع') -- (2) the TRUE current ceiling, and (3) the file's own size. All computed.
const fileTooBigMsg=(typeLabel,fileSize,ceilingBytes,bound)=>{const why=bound==='budget'?'سعة الرسالة':'حدّ النوع';return typeLabel+' أكبر من المسموح به الآن. الحدّ الحاليّ نحو '+humanBytesAr(ceilingBytes)+' (السقف من: '+why+')، وحجم ملفك نحو '+humanBytesAr(fileSize)+'. الرجاء ملفًّا أصغر.';};// Plain-text view of a message's content (string, or [image,text] array) for logs.
const contentToText=content=>{if(typeof content==='string')return content;if(Array.isArray(content)){const t=content.find(b=>b&&b.type==='text');const img=content.some(b=>b&&b.type==='image');return(img?'📷 ':'')+(t?t.text:'');}return'';};// Read an image File → downscale to ≤1568px long edge, normalize to JPEG, return
// { media_type, data } (base64, no prefix). Keeps uploads well under the 5MB API limit.
const fileToImageBlock=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const MAX=1568;let w=img.width,h=img.height;if(w>MAX||h>MAX){const s=MAX/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);const out=canvas.toDataURL('image/jpeg',0.85);resolve({media_type:'image/jpeg',data:out.slice(out.indexOf(',')+1)});};img.onerror=reject;img.src=reader.result;};reader.onerror=reject;reader.readAsDataURL(file);});const fileToBase64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const s=String(reader.result);resolve(s.slice(s.indexOf(',')+1));// strip the "data:...;base64," prefix
};reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});// ============================================================
// رسائل الأخطاء اللطيفة (مكان رسائل الـ API التقنية)
// ============================================================
// أيّ خطأ تقني (429, 500, network) → نَعرض للطفل رسالة دافئة فقط
// — الخطأ الكامل يُسجَّل في console للأهل (devtools) لا في فقاعة الردّ
// — صيغة المؤنث والمذكر منفصلتان حتى لا يكسر الانطباع العام للتطبيق
const FRIENDLY_ERRORS={rateLimit:{male:'عُذْرًا، انْشَغَلْتُ قَلِيلًا. هَلْ تُعِيدُ مَا قُلْتَ بَعْدَ لَحْظَة؟',female:'عُذْرًا، انْشَغَلْتُ قَلِيلًا. هَلْ تُعِيدِينَ مَا قُلْتِ بَعْدَ لَحْظَة؟'},server:{male:'يَبْدُو أَنَّ الخَادِمَ مَشْغُولٌ الآن. حَاوِلْ مَرَّةً ثَانِيَة بَعْدَ قَلِيل.',female:'يَبْدُو أَنَّ الخَادِمَ مَشْغُولٌ الآن. حَاوِلِي مَرَّةً ثَانِيَة بَعْدَ قَلِيل.'},general:{male:'عُذْرًا، لَمْ أَفْهَمْ سُؤَالَكَ تَمَامًا. أَعِدْ كَلَامَكَ مِنْ فَضْلِك.',female:'عُذْرًا، لَمْ أَفْهَمْ سُؤَالَكِ تَمَامًا. أَعِيدِي كَلَامَكِ مِنْ فَضْلِكِ.'},// A NON-2xx answer from our own proxy. The request never became an answer, so nothing about
// the child's sentence was ever judged -- and telling them "I did not understand your
// question" for OUR 400/413/403 is a lie that sends them rephrasing a perfectly good
// question forever while a real outage stays invisible. Own the failure instead.
technical:{male:'حَدَثَ خَلَلٌ تِقْنِيٌّ عِنْدِي، لَا فِي سُؤَالِكَ. حَاوِلْ مَرَّةً ثَانِيَةً بَعْدَ قَلِيل.',female:'حَدَثَ خَلَلٌ تِقْنِيٌّ عِنْدِي، لَا فِي سُؤَالِكِ. حَاوِلِي مَرَّةً ثَانِيَةً بَعْدَ قَلِيل.'},network:{male:'يَبْدُو أَنَّ الاتِّصَالَ ضَعِيفٌ الآن. تَحَقَّقْ مِنَ الإِنْتَرْنِت وَحَاوِلْ ثَانِيَة.',female:'يَبْدُو أَنَّ الاتِّصَالَ ضَعِيفٌ الآن. تَحَقَّقِي مِنَ الإِنْتَرْنِت وَحَاوِلِي ثَانِيَة.'}};// ============================================================
// Daily question cap — client half (directive 78). NO IP anywhere in this feature.
// ============================================================
// One stable uuid per browser profile, minted on first use. It is HALF the identity: the
// server also sets an httpOnly cookie (mrb_did) that it can read and this script cannot.
// So clearing localStorage alone does NOT reset the day's allowance, and clearing cookies
// alone does not either — only clearing BOTH does. That is the declared ceiling of a
// no-IP design, not a defect.
const DEVICE_ID_KEY='mrb_device_v1';const FOUNDER_TOKEN_KEY='mrb_founder_v1';// Must satisfy the server's /^[A-Za-z0-9_-]{8,64}$/ (lib/daycap.js safeId) or the server
// treats it as ABSENT and leans on the cookie counter alone.
const DEVICE_ID_RE=/^[A-Za-z0-9_-]{8,64}$/;const getDeviceId=()=>{try{let id=localStorage.getItem(DEVICE_ID_KEY);if(!id||!DEVICE_ID_RE.test(id)){id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'d-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);localStorage.setItem(DEVICE_ID_KEY,id);}return id;}catch(e){// Private mode / storage blocked: send nothing and let the cookie counter carry the cap.
return null;}};// Extra headers for a capped request. The founder TOKEN may be present; the founder PIN
// never travels — the token is base64url(HMAC(FOUNDER_SECRET, deviceId)), minted elsewhere.
// Absent or invalid token = counted like anyone.
const capHeaders=()=>{const h={};const id=getDeviceId();if(id)h['x-murabbi-device']=id;// D06: رمزٌ ميّتٌ (منتهٍ أو من الإصدارِ الأوّل) لا يُرسَل. إرسالُه غيرُ ضارٍّ — الخادمُ يرفضُه —
// لكنّ الامتناعَ يبقي ما يقولُه العميلُ عن نفسِه مطابقًا لما يعرضُه: نفسُ المحكِّ في الموضعين.
try{const t=localStorage.getItem(FOUNDER_TOKEN_KEY);if(founderTokenAlive(t))h['x-murabbi-founder']=t;}catch(e){}return h;};// Unlock token (directive 82). Kept in the SAME key capHeaders() already reads
// x-murabbi-founder from, so one successful PIN lifts the daily cap, the deep tiers and the
// call together -- there is no second notion of "unlocked" to drift. The PIN itself is NEVER
// stored, logged or put in a URL; only this token is, and it is useless without the server's
// FOUNDER_SECRET. Every gate calls hasFounderToken() directly rather than reading a cached
// flag, so no guard can ever act on a stale value.
// D06: صار للرمزِ عمرٌ واسم. المتصفّحُ لا يملكُ FOUNDER_SECRET فلا يتحقّقُ من التوقيعِ ولا يدّعي
// ذلك — لكنّ الشكلَ والانتهاءَ يُقرآنِ بلا سرّ. وقراءتُهما هنا تعني أنّ حاملَ رمزٍ منتهٍ أو رمزٍ
// من الإصدارِ الأوّلِ (بلا نقاط) يرى شاشةَ الفتحِ فيُعيدُ إدخالَ الرقمِ السرّيّ مرّةً، بدلاً من أن
// يُساقَ في مسارٍ يرفضُه الخادمُ صامتًا فيظنُّ العطبَ في التطبيق. الحكمُ النهائيُّ للخادمِ وحدَه.
const founderTokenAlive=t=>{if(typeof t!=='string')return false;const p=t.split('.');if(p.length!==4||p[0]!=='v2')return false;const exp=Number.parseInt(p[1],10);return Number.isFinite(exp)&&exp*1000>Date.now();};const hasFounderToken=()=>{try{return founderTokenAlive(localStorage.getItem(FOUNDER_TOKEN_KEY));}catch(e){return false;}};const storeFounderToken=t=>{try{localStorage.setItem(FOUNDER_TOKEN_KEY,t);}catch(e){}};// ============================================================
// AI-CONSENT — الموافقةُ الصريحةُ على مشاركةِ البيانات مع خدماتِ الذكاءِ الاصطناعيّ
// ============================================================
// Apple 5.1.1(i) / 5.1.2(i): NOTHING may be sent to Anthropic, ElevenLabs or Brave before the
// reader has been told what travels and to whom, and has chosen. This module is the ONE place
// that answers "may we send?" -- every send path calls hasValidAIConsent() and no path keeps a
// cached copy, so a withdrawal in Settings is obeyed by an already-running screen.
//
// FAIL-CLOSED, everywhere: absent record, unreadable storage, corrupt JSON, a version that is
// not the current one, or any thrown exception all resolve to NO CONSENT. There is no default
// value and the OLD `disclosureAck` key is NOT consent -- it acknowledged that the tutor can be
// wrong, which is a different statement about a different thing.
const EZ_AI_CONSENT_KEY='ezik_ai_consent_v1';const EZ_AI_CONSENT_VERSION='2026-08-06-1';// The header every AI route re-checks server-side (lib/ai-consent.js). Hiding a button is not a
// gate; the server refuses 403 without this, so a hand-made POST reaches no vendor either.
const EZ_AI_CONSENT_HEADER='x-ezik-ai-consent';const EZ_AI_CONSENT_GRANTED='granted';const EZ_AI_CONSENT_DECLINED='declined';// The stored record, or null. Never throws.
const readAIConsent=()=>{try{const raw=localStorage.getItem(EZ_AI_CONSENT_KEY);if(!raw)return null;const v=JSON.parse(raw);if(!v||typeof v!=='object')return null;if(v.status!==EZ_AI_CONSENT_GRANTED&&v.status!==EZ_AI_CONSENT_DECLINED)return null;if(typeof v.version!=='string'||!v.version)return null;return v;}catch(e){return null;}};// THE ONE PREDICATE. Read at the moment of sending, never from a flag captured earlier.
const hasValidAIConsent=()=>{const c=readAIConsent();return!!c&&c.status===EZ_AI_CONSENT_GRANTED&&c.version===EZ_AI_CONSENT_VERSION;};// "Has this reader answered THIS version of the question?" A recorded refusal counts as an
// answer -- it is a real choice, not a postponement -- so the screen is not shown again. A record
// carrying an older version does not count: a changed disclosure has to be re-consented.
const aiConsentAnswered=()=>{const c=readAIConsent();return!!c&&c.version===EZ_AI_CONSENT_VERSION;};const aiConsentStatus=()=>{const c=readAIConsent();return c&&c.version===EZ_AI_CONSENT_VERSION?c.status:null;};const aiConsentGrantedBy=()=>{const c=readAIConsent();return c&&c.version===EZ_AI_CONSENT_VERSION?c.grantedBy||null:null;};// The only writer. `by` is 'user' (13+) or 'guardian' (under 13, after the adult barrier).
const writeAIConsent=(status,by)=>{const rec={status:status===EZ_AI_CONSENT_GRANTED?EZ_AI_CONSENT_GRANTED:EZ_AI_CONSENT_DECLINED,version:EZ_AI_CONSENT_VERSION,grantedBy:by==='guardian'?'guardian':'user',at:new Date().toISOString()};try{localStorage.setItem(EZ_AI_CONSENT_KEY,JSON.stringify(rec));}catch(e){}return rec;};// Headers carried by an AI request. Empty when there is no consent -- and aiFetch never gets
// that far, so an un-headed AI POST cannot be produced by this client at all.
const aiConsentHeaders=()=>hasValidAIConsent()?{[EZ_AI_CONSENT_HEADER]:EZ_AI_CONSENT_VERSION}:{};// Which POSTs are AI sends. /api/unlock and /api/report are NOT: no vendor sees them.
const EZ_AI_ENDPOINTS=['/api/ask','/api/chat','/api/chat-fast','/api/tashkeel','/api/tts','/api/stt'];// THE CHOKE POINT. Every send to an AI route goes through here and nothing else calls fetch()
// for those routes. No consent => fetch() is never invoked, so no name, age, gender, question,
// image, file or recording leaves the device; the caller sees a rejection it already handles as
// "no answer / no audio", exactly like a network failure.
class EzAIConsentError extends Error{constructor(){super('ai-consent-missing');this.name='EzAIConsentError';this.aiConsentMissing=true;}}const aiFetch=(url,opts)=>{if(!hasValidAIConsent())return Promise.reject(new EzAIConsentError());const o=opts||{};return fetch(url,{...o,headers:{...(o.headers||{}),...aiConsentHeaders()}});};// ============================================================
// THE SPEECH-RECOGNITION GATE — Web Speech is a THIRD-PARTY SEND
// ============================================================
// aiFetch above covers everything that leaves through OUR server. Web Speech does not: calling
// recognition.start() in Chrome ships the microphone audio to Google's servers, and in Safari to
// Apple's, without a single fetch() appearing anywhere in this file. It is the same act as
// POSTing to /api/stt -- a recording of the reader's voice reaching a company that is not us --
// so it is refused on exactly the same terms, and this is the choke point that refuses it.
//
// THREE recognizers exist in this app and every one goes through here: the chat dictation
// engine, the call engine, and the memorizer's «سمِّعني». There is no fourth, and the source
// census in tools/ai-consent-probe.cjs fails the build if one appears that does not.
//
// TWO checkpoints, not one, because they answer different questions at different moments:
//   * ezNewRecognition()   -- may this object EXIST? Refusing here means no engine is ever
//                             constructed, so no microphone permission is requested for it.
//   * ezStartRecognition() -- may it listen RIGHT NOW? Re-read at every start, including every
//                             onend auto-restart, so a consent withdrawn one second ago is
//                             obeyed by a loop that was armed before it.
// Both read the store directly. Neither trusts a React state value, which is by definition a
// snapshot of what was true when the component last rendered.
const EZ_LIVE_RECOGNIZERS=new Set();const ezSpeechEngine=()=>{try{return window.SpeechRecognition||window.webkitSpeechRecognition||null;}catch(e){return null;}};// "Does this browser have an engine at all?" -- a capability question, asked so the UI can show
// the honest "your browser cannot do this" message. It constructs nothing and sends nothing.
const ezSpeechAvailable=()=>!!ezSpeechEngine();// Detach every handler and stop the engine. Called on withdrawal and whenever a start is refused,
// so a recognizer can never be left holding a live onend that would re-arm it.
const ezKillRecognizer=rec=>{if(!rec)return;try{rec.onresult=null;}catch(e){}try{rec.onend=null;}catch(e){}// FIRST: an abort() fires onend, and a live onend restarts
try{rec.onerror=null;}catch(e){}try{rec.onstart=null;}catch(e){}try{if(typeof rec.abort==='function')rec.abort();}catch(e){}try{if(typeof rec.stop==='function')rec.stop();}catch(e){}try{EZ_LIVE_RECOGNIZERS.delete(rec);}catch(e){}};// THE ONLY CONSTRUCTOR. Returns null without consent -- and a null recognizer is exactly what
// every caller already handles as "this browser has no engine", so the refusal needs no new
// failure path anywhere.
const ezNewRecognition=()=>{if(!hasValidAIConsent())return null;const SR=ezSpeechEngine();if(!SR)return null;let rec=null;try{rec=new SR();}catch(e){return null;}try{EZ_LIVE_RECOGNIZERS.add(rec);}catch(e){}return rec;};// THE ONLY START. Every call site -- first start and every auto-restart -- goes through it.
// Returns true only if the engine actually began listening.
const ezStartRecognition=rec=>{if(!rec)return false;if(!hasValidAIConsent()){ezKillRecognizer(rec);return false;}try{rec.start();return true;}catch(e){return false;}};// Withdrawal, applied to speech. Every live engine is torn down handlers-first so nothing can
// re-arm, and the registry is emptied. Safe to call when nothing is running.
const ezStopAllRecognition=()=>{let n=0;try{for(const rec of Array.from(EZ_LIVE_RECOGNIZERS)){ezKillRecognizer(rec);n++;}EZ_LIVE_RECOGNIZERS.clear();}catch(e){}return n;};// The one line the memorizer shows instead of listening, when the voice has not been consented.
// «سمِّعني» is the only local-looking feature that is not local: it is a microphone feeding a
// third party, so it stops -- while the memorizing, the manual reveal and the mushaf do not.
const EZ_SPEECH_NO_CONSENT='التسميع الصوتي غير مفعّل لأن مشاركة الصوت مع خدمات التعرف على الكلام لم تتم الموافقة عليها.';const getFriendlyError=(type,gender)=>{const bucket=FRIENDLY_ERRORS[type]||FRIENDLY_ERRORS.general;return bucket[gender==='female'?'female':'male'];};// ============================================================
// أيقونات SVG
// ============================================================
const Icon=({children,size=20,color='currentColor'})=>/*#__PURE__*/React.createElement("svg",{width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:color,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},children);const SendIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("line",{x1:"22",y1:"2",x2:"11",y2:"13"}),/*#__PURE__*/React.createElement("polygon",{points:"22 2 15 22 11 13 2 9 22 2"}));const MicIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("path",{d:"M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"}),/*#__PURE__*/React.createElement("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),/*#__PURE__*/React.createElement("line",{x1:"12",y1:"19",x2:"12",y2:"23"}),/*#__PURE__*/React.createElement("line",{x1:"8",y1:"23",x2:"16",y2:"23"}));const MicOffIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("line",{x1:"1",y1:"1",x2:"23",y2:"23"}),/*#__PURE__*/React.createElement("path",{d:"M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"}),/*#__PURE__*/React.createElement("path",{d:"M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"}),/*#__PURE__*/React.createElement("line",{x1:"12",y1:"19",x2:"12",y2:"23"}),/*#__PURE__*/React.createElement("line",{x1:"8",y1:"23",x2:"16",y2:"23"}));const ResetIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("polyline",{points:"1 4 1 10 7 10"}),/*#__PURE__*/React.createElement("path",{d:"M3.51 15a9 9 0 1 0 2.13-9.36L1 10"}));const MoonStarsIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("path",{d:"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"}),/*#__PURE__*/React.createElement("circle",{cx:"17.5",cy:"6.5",r:"0.8",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"20",cy:"9.5",r:"0.6",fill:"currentColor"}));const PlayIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("polygon",{points:"6 4 20 12 6 20 6 4",fill:"currentColor"}));const PauseIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",fill:"currentColor"}),/*#__PURE__*/React.createElement("rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",fill:"currentColor"}));const ListCheckIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("path",{d:"M3 17l2 2 4-4"}),/*#__PURE__*/React.createElement("path",{d:"M3 7l2 2 4-4"}),/*#__PURE__*/React.createElement("line",{x1:"13",y1:"6",x2:"21",y2:"6"}),/*#__PURE__*/React.createElement("line",{x1:"13",y1:"12",x2:"21",y2:"12"}),/*#__PURE__*/React.createElement("line",{x1:"13",y1:"18",x2:"21",y2:"18"}));const PhoneCallIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("path",{d:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"}));const PhoneOffIcon=p=>/*#__PURE__*/React.createElement(Icon,p,/*#__PURE__*/React.createElement("path",{d:"M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"}),/*#__PURE__*/React.createElement("line",{x1:"23",y1:"1",x2:"1",y2:"23"}));// ============================================================
// آيات يومية — مولَّدة من المصحف المختوم (لا تُحرَّر باليد)
// ============================================================
// ITEM 120-A. GENERATED -- DO NOT EDIT BY HAND. Every ayah string below is COPIED verbatim out
// of quran-uthmani.json, the file sealed by sha256 in quest-bank-integrity-guard.cjs, at the
// reference on its own row. Nothing here is typed, and nothing here can be "corrected": the
// source of truth is assets/daily-verses.json, generated by reading the sealed file, and
// theme-coverage-guard.cjs asserts BOTH that this array is that file and that every ayah row
// is a verbatim substring of the sealed verse it names.
//
// WHY IT STOPPED BEING HAND-WRITTEN. All 30 rows were compared against the sealed file. Three
// did not match the verse they cited, and two of those were wrong text, not wrong spelling:
//
//   4:32  -- the card showed وَكَانَ اللَّهُ بِكُلِّ شَيْءٍ عَلِيمًا under the reference 4:32.
//            That wording is 33:40 and 48:26. 4:32 reads إِنَّ ٱللَّهَ كَانَ ... -- a different opening.
//   12:64 -- the card showed وَاللَّهُ خَيْرٌ حَافِظًا. The verse reads فَٱللَّهُ.
//   12:87 -- not an error: the Uthmani spelling تَا۟يْـَٔسُوا۟ transposes the alef, so the
//            excerpt could not be located inside it.
//
// In all three the WHOLE sealed verse at the owner's reference now stands. The reference is the
// owner's datum and the text is the sealed file's; picking a different reference to fit the
// text would be composing, which this item forbids. The other 26 rows changed ORTHOGRAPHY only,
// from imla'i to the sealed Uthmani, because the excerpt is now cut from the sealed bytes.
//
// THE 365-REFERENCE LIST IS THE OWNER'S AND IS NOT INVENTED HERE. What this item buys is that
// the file is now extensible by ONE LINE: add a reference, re-run the generator, and the text
// arrives from the sealed mushaf.
//
// The rotation below is unchanged: a local day index, no network and no model call.
const DAILY_VERSES=[{kind:'ayah',ref:'94:6',text:'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',surah:'الشرح',ayah:'٦'},{kind:'ayah',ref:'57:4',text:'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ',surah:'الحديد',ayah:'٤'},{kind:'ayah',ref:'2:153',text:'إِنَّ ٱللَّهَ مَعَ ٱلصَّـٰبِرِينَ',surah:'البقرة',ayah:'١٥٣'},{kind:'ayah',ref:'2:152',text:'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ',surah:'البقرة',ayah:'١٥٢'},{kind:'ayah',ref:'65:2',text:'وَمَن يَتَّقِ ٱللَّهَ يَجْعَل لَّهُۥ مَخْرَجًا',surah:'الطلاق',ayah:'٢'},{kind:'ayah',ref:'7:56',text:'إِنَّ رَحْمَتَ ٱللَّهِ قَرِيبٌ مِّنَ ٱلْمُحْسِنِينَ',surah:'الأعراف',ayah:'٥٦'},{kind:'ayah',ref:'2:186',text:'وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ',surah:'البقرة',ayah:'١٨٦'},{kind:'ayah',ref:'2:195',text:'إِنَّ ٱللَّهَ يُحِبُّ ٱلْمُحْسِنِينَ',surah:'البقرة',ayah:'١٩٥'},{kind:'ayah',ref:'12:87',text:'يَـٰبَنِىَّ ٱذْهَبُوا۟ فَتَحَسَّسُوا۟ مِن يُوسُفَ وَأَخِيهِ وَلَا تَا۟يْـَٔسُوا۟ مِن رَّوْحِ ٱللَّهِ ۖ إِنَّهُۥ لَا يَا۟يْـَٔسُ مِن رَّوْحِ ٱللَّهِ إِلَّا ٱلْقَوْمُ ٱلْكَـٰفِرُونَ',surah:'يوسف',ayah:'٨٧'},{kind:'ayah',ref:'2:155',text:'وَبَشِّرِ ٱلصَّـٰبِرِينَ',surah:'البقرة',ayah:'١٥٥'},{kind:'ayah',ref:'13:28',text:'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ',surah:'الرعد',ayah:'٢٨'},{kind:'ayah',ref:'11:88',text:'وَمَا تَوْفِيقِىٓ إِلَّا بِٱللَّهِ',surah:'هود',ayah:'٨٨'},{kind:'ayah',ref:'3:173',text:'حَسْبُنَا ٱللَّهُ وَنِعْمَ ٱلْوَكِيلُ',surah:'آل عمران',ayah:'١٧٣'},{kind:'ayah',ref:'2:20',text:'إِنَّ ٱللَّهَ عَلَىٰ كُلِّ شَىْءٍ قَدِيرٌ',surah:'البقرة',ayah:'٢٠'},{kind:'ayah',ref:'3:139',text:'وَلَا تَهِنُوا۟ وَلَا تَحْزَنُوا۟ وَأَنتُمُ ٱلْأَعْلَوْنَ',surah:'آل عمران',ayah:'١٣٩'},{kind:'other',text:'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',surah:'حديث',ayah:'البخاري'},{kind:'ayah',ref:'2:43',text:'وَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ',surah:'البقرة',ayah:'٤٣'},{kind:'ayah',ref:'20:114',text:'وَقُل رَّبِّ زِدْنِى عِلْمًا',surah:'طه',ayah:'١١٤'},{kind:'ayah',ref:'2:173',text:'إِنَّ ٱللَّهَ غَفُورٌ رَّحِيمٌ',surah:'البقرة',ayah:'١٧٣'},{kind:'ayah',ref:'2:45',text:'وَٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ',surah:'البقرة',ayah:'٤٥'},{kind:'ayah',ref:'2:201',text:'رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةً',surah:'البقرة',ayah:'٢٠١'},{kind:'ayah',ref:'9:120',text:'إِنَّ ٱللَّهَ لَا يُضِيعُ أَجْرَ ٱلْمُحْسِنِينَ',surah:'التوبة',ayah:'١٢٠'},{kind:'ayah',ref:'4:32',text:'وَلَا تَتَمَنَّوْا۟ مَا فَضَّلَ ٱللَّهُ بِهِۦ بَعْضَكُمْ عَلَىٰ بَعْضٍ ۚ لِّلرِّجَالِ نَصِيبٌ مِّمَّا ٱكْتَسَبُوا۟ ۖ وَلِلنِّسَآءِ نَصِيبٌ مِّمَّا ٱكْتَسَبْنَ ۚ وَسْـَٔلُوا۟ ٱللَّهَ مِن فَضْلِهِۦٓ ۗ إِنَّ ٱللَّهَ كَانَ بِكُلِّ شَىْءٍ عَلِيمًا',surah:'النساء',ayah:'٣٢'},{kind:'ayah',ref:'33:3',text:'وَتَوَكَّلْ عَلَى ٱللَّهِ ۚ وَكَفَىٰ بِٱللَّهِ وَكِيلًا',surah:'الأحزاب',ayah:'٣'},{kind:'ayah',ref:'53:39',text:'وَأَن لَّيْسَ لِلْإِنسَـٰنِ إِلَّا مَا سَعَىٰ',surah:'النجم',ayah:'٣٩'},{kind:'ayah',ref:'3:146',text:'وَٱللَّهُ يُحِبُّ ٱلصَّـٰبِرِينَ',surah:'آل عمران',ayah:'١٤٦'},{kind:'ayah',ref:'2:143',text:'إِنَّ ٱللَّهَ بِٱلنَّاسِ لَرَءُوفٌ رَّحِيمٌ',surah:'البقرة',ayah:'١٤٣'},{kind:'ayah',ref:'65:3',text:'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ',surah:'الطلاق',ayah:'٣'},{kind:'ayah',ref:'26:62',text:'إِنَّ مَعِىَ رَبِّى سَيَهْدِينِ',surah:'الشعراء',ayah:'٦٢'},{kind:'ayah',ref:'12:64',text:'قَالَ هَلْ ءَامَنُكُمْ عَلَيْهِ إِلَّا كَمَآ أَمِنتُكُمْ عَلَىٰٓ أَخِيهِ مِن قَبْلُ ۖ فَٱللَّهُ خَيْرٌ حَـٰفِظًا ۖ وَهُوَ أَرْحَمُ ٱلرَّٰحِمِينَ',surah:'يوسف',ayah:'٦٤'}];const getDailyVerse=()=>{const dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/86400000);return DAILY_VERSES[dayOfYear%DAILY_VERSES.length];};// ============================================================
// تحليل الرسائل ذات البطاقات (verse/hadith/steps/suggestions)
// ============================================================
// يحذف أي وسم معروف (<verse>/<hadith>/<steps>/<suggestions>) فُتِح ولم يُغلَق — يحدث
// عند اقتطاع الردّ منتصف الوسم — وأي بقايا "<...>" يتيمة في آخر النص، كي لا يتسرّب
// ترميز خام إلى الطفل (عرض) ولا إلى ElevenLabs (صوت). مستقلّ تماماً عن max_tokens.
const KNOWN_TAG_NAMES=Object.freeze(['verse','surah','hadith','steps','suggestions','board','document','source','dhikr','worship']);const KNOWN_TAGS=KNOWN_TAG_NAMES.join('|');// سجلُّ الإنقاذ: كلُّ مرّةٍ أفرغ فيها التنظيفُ نصًّا خادميًّا غيرَ فارغٍ فأُنقِذ بدلَ أن يُمحى.
// يبقى في الذاكرة للعميل وللحارس؛ لا يُرسَل إلى أيِّ خادم.
const EZIK_TAG_RESCUES=[];// ============================================================
// §٢ (C) — «هذا الجوابُ لم يكتملْ»: العلامةُ التي يرسلُها الخادم، والقراءةُ التي يقرؤها العميل
// ============================================================
// THE DEFECT THIS ANSWERS, MEASURED LIVE: a reply cut IN THE MIDDLE OF A WORD arrived wearing the
// closing review mark, so it read as finished. The client had no way to know otherwise — nothing on
// the wire said whether the model had stopped or been stopped — and so it said nothing.
//
// api/ask.js appends `<incomplete/>` and NOTHING ELSE when, and only when, the round that wrote the
// delivered text ended on something other than `end_turn`. It is deliberately not a sentence: the
// wording belongs to this file, in the reader's own language, beside the button that acts on it.
//
// IT IS NOT IN `KNOWN_TAG_NAMES`, and that is on purpose. `stripIncompleteTags` cuts from the first
// UNCLOSED known tag to the end of the text — a self-closing marker would look exactly like that to
// it, and the answer after it would be deleted to remove a marker whose whole contract is that
// nothing is deleted. So it is stripped by name, in the three readers that do not already strip
// every angle bracket (`toPlainText` and `formatForStreamPreview` do).
//
// TWO REGEXPS AND NOT ONE: `.test()` on a /g regexp carries `lastIndex` between calls, so the same
// constant used for both would answer TRUE and FALSE alternately on the identical string.
const EZIK_INCOMPLETE_STRIP=/<incomplete\s*\/?>/gi;const EZIK_INCOMPLETE_TEST=/<incomplete\s*\/?>/i;const ezikStripIncomplete=t=>String(t==null?'':t).replace(EZIK_INCOMPLETE_STRIP,'');const ezikAnswerIncomplete=t=>typeof t==='string'&&EZIK_INCOMPLETE_TEST.test(t);// تعقيمٌ آمنٌ للنصِّ الذي كان سيُمحى بالكامل: تُنزَع الأقواسُ الزاويّةُ وما بينها، ويبقى النثر.
//
// الحذفُ بمدى الوسمِ لا بذيلِ النصّ (أ-٦/١). كان سطرُ الآيةِ والسورةِ يحذفُ من الوسمِ إلى آخرِ
// النصِّ كلِّه، فجوابٌ من ١٣٠ حرفًا فيه ٥٥ حرفَ نثرٍ بعدَ آيةٍ مقطوعةٍ كان يصلُ صفرًا: العرضُ
// والصوتُ وسجلُّ الأهلِ كلُّها فارغة. ونحن لا نمنعُ إلا نصَّ التلاوةِ نفسَه — لأنّ التلاوةَ
// يتلوها القارئُ الحقيقيُّ بصوته ولا نخترعُ لها نصًّا من عندنا — أمّا النثرُ الذي يليها فليس
// تلاوةً ولا علاقةَ له بالوسم، فيعيش.
//
// فالمدى: من فتحِ الوسمِ إلى إغلاقِه المطابقِ إن وُجد؛ وإن كان الوسمُ مقطوعًا بلا إغلاق فإلى
// أوّلِ «<» أو أوّلِ سطرٍ جديد — أيُّهما أسبق. وهذا يُبقي كلَّ ما بعدَ السطرِ سليمًا.
const VERSE_TAG_EXTENT=/<(verse|surah)\b[^>]*>(?:[\s\S]*?<\/\1>|[^<\n]*)/g;const rescueTruncated=text=>String(text||'').replace(VERSE_TAG_EXTENT,' ').replace(/<[^>]*>/g,' ')// §٤ (D): the same correction as in `stripIncompleteTags` below, and for the same reason —
// this pass runs over the same text, and a cut that crosses a line loses the same answer.
.replace(/<\/?[A-Za-z][^>\n]*$/g,' ').replace(/[^\S\n]+/g,' ').replace(/ ?\n ?/g,'\n').trim();// opts.rescue — للقُرّاءِ الذين يقرأون النصَّ النهائيَّ وحدَهم (العرضُ والصوتُ وسجلُّ الأهل).
// المسارُ المتدفّقُ لا يمرّره: الوسمُ الناقصُ أثناءَ التدفّقِ حالةٌ طبيعيّةٌ والقصُّ فيه صواب.
const stripIncompleteTags=(text,opts)=>{if(!text||typeof text!=='string')return text||'';let t=text;// ٠. طَبِّع وسمَي الآية/السورة ذاتيَّي الإغلاق (<verse .../>، <surah .../>) إلى صيغةٍ
//    مُغلَقة حتى لا يَعدّهما كاشفُ الوسوم الناقصة وسماً مقطوعاً فيحذفهما. (كلاهما فارغ بلا نصّ.)
t=t.replace(/<(verse|surah)([^>]*?)\s*\/>/g,'<$1$2></$1>');// ١. أول وسم معروف مفتوح بلا إغلاق مطابق → احذف من بدايته حتى نهاية النص.
const openRe=new RegExp(`<(${KNOWN_TAGS})\\b`,'g');let m,cut=-1;while((m=openRe.exec(t))!==null){const closeRe=new RegExp(`</${m[1]}>`,'g');closeRe.lastIndex=m.index;if(!closeRe.test(t)){cut=m.index;break;}}if(cut>=0)t=t.slice(0,cut);// ٢. «<» مقطوعٌ في آخرِ النصِّ بلا «>» مطابق (مثل «<ver» أو «<verse surah=») → يُحذَف.
//
// ── §٤ (D): القصُّ لا يعبرُ سطرًا، والفتحةُ لا تكونُ وسمًا إلّا بحرف ─────────
//
// العطبُ مقيسٌ في جولةِ المتصفّحِ على شجرةٍ صحيحةِ الخادم: قارئٌ طلبَ دالّةَ زكاةٍ فوصلَه
// الجوابُ كاملًا من الخادم، ثمَّ قطعَه هذا السطرُ عند `if (amount ` ومحا ما بعدَه كلَّه —
// ثمانيةَ أسطرٍ من الكودِ وخاتمةَ الجوابِ العربيّة. لأنَّ `[^>]*` يبتلعُ الأسطر، و`$` بلا
// رايةِ `m` هو آخرُ النصِّ لا آخرُ السطر: فأوّلُ «<» لا «>» بعدَه في المتنِ كلِّه يمحو الباقي.
// وعلامةُ «أصغر من» في الكودِ هي هذا بعينِه.
//
// والتصحيحُ بنيويٌّ من وجهين، وكلاهما مأخوذٌ من نصِّ الغرضِ المكتوبِ أعلاه:
//   آخرُ السطر  — «في آخرِ النصّ» بعدَ قطعِ البثِّ يعني ألّا شيءَ بعدَه، فلا سطرَ بعدَه أصلًا
//   حرفٌ بعدَ «<» — «<ver» وسمٌ مقطوع، و«< nisab» مسافةٌ ثمَّ اسمٌ: ليست وسمًا في أيِّ لغة
//
// ولا يفوتُ هذا شيئًا ممّا كانَ يمسكُه: الوسمُ المعروفُ المفتوحُ — ولو تامَّ الاسمِ في وسطِ
// النصِّ — قد قصَّه البندُ ١ قبلَ الوصولِ إلى هنا؛ فالباقي لهذا البندِ اسمٌ مقطوعٌ لا يقعُ
// إلّا حيثُ انقطعَ البثُّ، أي في آخرِ سطرٍ من المتن.
t=t.replace(/<\/?[A-Za-z][^>\n]*$/,'');// ٣. الإنقاذ (X-014): إن كان الخادمُ قد سلّم نصًّا فيه كلامٌ حقيقيّ، وأفرغه التنظيفُ
//    بالكامل — وهذا يقع حين يكون الوسمُ المقطوعُ أوَّلَ النصِّ فيصيرُ موضعُ القصِّ صفرًا —
//    فالطفلُ يرى فقاعةً فارغةً ويسمعُ صمتًا، وهو أسوأُ من نصٍّ منقوصٍ مُعقَّم. نعرضُ النثرَ
//    الباقيَ بعد تعقيمٍ آمن، ونُسجِّلُ أنّ الجوابَ وصل منقوصًا.
const out=t;if(opts&&opts.rescue&&out.trim()===''&&text.trim()!==''){const tagMatch=new RegExp(`<(${KNOWN_TAGS})\\b`).exec(text);const rescued=rescueTruncated(text);// التسجيلُ دائمًا (أ-٦/٢). كان `if (rescued)` يحرسُ الدفعَ في السجلِّ كما يحرسُ العودة، فحين
// لم يبقَ نثرٌ يُنقَذ لم يُكتَبْ شيءٌ في أيِّ مكان: الفقاعةُ تفرغُ والسجلُّ يقولُ إنّ شيئًا لم
// يقع. أسوأُ الحالتينِ هي التي لا أثرَ لها. فالسجلُّ الآن يُكتَبُ في الحالتين، والفرقُ في
// `reason` وفي `chars`، وتبقى العودةُ مشروطةً بوجودِ نثرٍ فعلاً.
EZIK_TAG_RESCUES.push({tag:tagMatch?tagMatch[1]:'unknown',reason:rescued?'truncated-tag-emptied-reply':'truncated-tag-emptied-reply-unrescuable',chars:rescued.length,rescued:rescued.length>0});if(rescued)return rescued;}return out;};// ============================================================
// عنوانُ الخطوات — من الجواب، لا من قالبٍ ثابت
// ============================================================
// كان فوق كلِّ قائمةِ خطواتٍ عنوانٌ واحدٌ لا يتغيّر: «خُطُوَاتٌ تُسَاعِدُك». فحين كانت القائمةُ
// أعذارًا شرعيّةً لهجرِ الفراش، قرأ صاحبُ السؤال عنوانًا لا علاقةَ له بما تحته. قرارُ المالك:
// «ماله داعي الجمله هذي اصلا، لازم تكون كلمه بديله حسب الصياغ وتتماشى معاه، وليست جمله تظهر
// في كل مره». فالعنوانُ صار خاصّيّةً يزوِّدها النموذجُ من صلبِ الموضوع — وإن غابت فلا عنوانَ
// أصلًا. لا سقوطَ إلى عبارةٍ ثابتة: عبارةٌ ثابتةٌ خاطئةٌ أسوأُ من لا عبارة.
// أربعةُ مطابعَ تقرأ هذه الدالّةَ نفسَها: البطاقةُ المرئيّة (StepsCard)، والصوتُ (formatForTTS)،
// وسجلُّ الأهل (formatForLog)، والنسخُ إلى الحافظة (REPLY_SERIALIZERS.steps).
const readStepsTitle=attrsStr=>{const m=String(attrsStr||'').match(/title=["']([^"']*)["']/);return m?m[1].trim():'';};// ============================================================
// «رَوَى {المخرِّج}» — والمخرِّجُ مخرِّجٌ لا درجة
// ============================================================
// العطبُ المقيس: نموذجٌ ملأ narrator بالدرجةِ نفسِها، فطُبع «رَوَى متفق عليه» ثمّ «متفق عليه»
// درجةً تحته — الدرجةُ مرّتين، وإحداهما بصيغةٍ مكسورةٍ لا تُقرأ عربيّةً.
// هنا نصلحُ الطباعةَ فقط: إن كان narrator لفظَ درجةٍ لا اسمَ مخرِّج، أو ساوى ruling بعد
// التطبيع، فلا يُطبَعُ سطرُ «رَوَى …»، وتُطبَعُ الدرجةُ مرّةً واحدة (ونرفعُ اللفظَ إلى خانةِ
// الدرجةِ إن كانت خاليةً، كيلا تضيعَ الدرجةُ أصلًا). أمّا صدقُ التخريجِ نفسِه — نموذجٌ يضع
// «متفق عليه» على ما ليس في الصحيحين — فعطبُ توليدٍ خارجَ نطاقِ هذا المطبع.
const normalizeAttribution=s=>String(s||'').replace(/[ً-ْٰـ]/g,'')// تشكيل وتطويل
.replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^ء-ي\s]/g,' ').replace(/\s+/g,' ').trim();// ألفاظُ الدرجاتِ التي شوهدت — أو تُشبِهُ ما شوهد — في خانةِ المخرِّج. مطابقةٌ تامّةٌ بعد
// التطبيع لا احتواء: «الحسن البصريّ» مخرِّجٌ لا درجة، و«حسن» وحدَها درجة.
const RULING_PHRASES=new Set(['متفق عليه','متفق علي صحته','رواه الشيخان','اخرجه الشيخان','صحيح','حسن','ضعيف','حسن صحيح','صحيح لغيره','حسن لغيره','ضعيف جدا','موضوع','منكر','مرسل','متواتر','شاذ','اسناده صحيح','اسناده حسن','اسناده ضعيف'].map(normalizeAttribution));// «حسّنه الألباني» / «صحّحه ابن باز» / «ضعّفه الألباني» — درجةٌ منسوبةٌ لا مخرِّج.
const RULING_VERB_RE=/^(حسنه|صححه|ضعفه|حسن|صحح|ضعف)\s/;const isRulingPhrase=s=>{const n=normalizeAttribution(s);if(!n)return false;return RULING_PHRASES.has(n)||RULING_VERB_RE.test(n);};// ── «رَوَى رواه البخاري» (قرار ١١) ─────────────────────────────────────────
// البطاقةُ تطبعُ «رَوَى {المخرِّج}»، والنموذجُ يملأُ الخانةَ أحيانًا بالجملةِ كاملةً —
// «رواه البخاري» — فيخرجُ الفعلُ مرّتين. المطلوبُ الاسمُ وحدَه، فتُنزَعُ البادئةُ ويبقى.
//
// مُطبَّعةً لا حرفيّة: النموذجُ يكتبُ عربيّةً مشكولةً، فـ«رَوَاهُ» و«رواه» و«خرّجه» و«خرجه»
// و«أخرجه» و«اخرجه» حالةٌ واحدةٌ بعد التطبيع — وثلاثةُ مدخلاتٍ تكفي للستّة.
const NARRATION_VERBS=new Set(['رواه','أخرجه','خرّجه'].map(normalizeAttribution));// القرارُ يُتَّخَذُ على الصورةِ المطبَّعةِ والقصُّ يقعُ على الأصل، فيحتفظُ الاسمُ برسمِه
// وتشكيلِه كما ورد: «رواه البخاريُّ» ⟹ «البخاريُّ» لا «البخاري».
const stripNarrationVerb=s=>{const raw=String(s||'').trim();const sp=raw.search(/\s/);// كلمةٌ واحدةٌ لا تكونُ فعلًا واسمًا، فلا يُنزَعُ منها شيءٌ — وإلّا أفرغنا الخانةَ كلَّها.
if(sp===-1)return raw;if(!NARRATION_VERBS.has(normalizeAttribution(raw.slice(0,sp))))return raw;return raw.slice(sp+1).trim();};/**
 * تُرجِعُ ما يُطبَعُ فعلًا لبطاقةِ حديث: مخرِّجٌ (أو لا شيء) ودرجةٌ (أو لا شيء).
 * @param {string} narrator قيمةُ narrator كما وردت من النموذج
 * @param {string} ruling قيمةُ ruling كما وردت من النموذج
 * @returns {{narrator: string, ruling: string}}
 */const resolveHadithAttribution=(narrator,ruling)=>{let n=String(narrator||'').trim();let r=String(ruling||'').trim();if(n&&isRulingPhrase(n)){if(!r)r=n;n='';}else{// النزعُ بعدَ فحصِ الدرجةِ لا قبلَه، والترتيبُ مقصود: «رواه الشيخان» لفظُ درجةٍ مسجَّلٌ
// في RULING_PHRASES، ونزعُ بادئتِه أوّلًا كان يُحيلُه اسمًا «الشيخان» ويُبطِلُ قاعدةً قائمة.
n=stripNarrationVerb(n);if(n&&r&&normalizeAttribution(n)===normalizeAttribution(r)){n='';}}return{narrator:n,ruling:r};};// مفتاح تجريبي (A/B) — صحّحه إلى true لمقارنة النطق بلا تشكيل في المتصفح:
// عند true نُرسِل لـ ElevenLabs نصّاً مُجرَّداً من كل تشكيل (نطق MSA نثريّ فقط —
// القرآن يُتلى من القارئ لا من الذكاء الاصطناعي، فالتجريد آمن هنا). النصّ المعروض
// للطفل وللأهل يبقى مُشَكَّلاً بالكامل. السبب: عناقيد الشدّة (التَّشْرِيك = تّ+شْ)
// تُسبّب تأتأة في eleven_multilingual_v2. هذا تطبيع للمُدخَل الصوتي فقط.
const STRIP_TASHKEEL_FOR_TTS=false;const TTS_TASHKEEL_ENABLED=false;// false = skip Haiku tashkeel add-call for speech (pre-diacritized canonical text unaffected); flip true to restore original behavior
const CALL_STREAM_SPEECH=true;// false = classic (speak full reply after generation). true = stream complete prose sentences BEFORE the first tag as they arrive (first-audio latency win); tags + trailing prose still handled by buildAudioSequence at finish.
// Tashkeel is stripped from the tutor's prose by default (the owner's call), but NEVER from a
// Quranic span: anything between the ornate parentheses U+FD3F..U+FD3E is scripture and is left
// byte-for-byte as it came. Everything outside them loses the harakat marks only.
const QURAN_SPAN_RE=/\uFD3F[\s\S]*?\uFD3E/g;const HARAKAT_RE=/[\u064B-\u0652\u0670]/g;const stripTashkeelOutsideQuran=s=>{const src=s||'';let out='';let last=0;let m;QURAN_SPAN_RE.lastIndex=0;while((m=QURAN_SPAN_RE.exec(src))!==null){out+=src.slice(last,m.index).replace(HARAKAT_RE,'');out+=m[0];last=m.index+m[0].length;}return out+src.slice(last).replace(HARAKAT_RE,'');};const miniBtnStyle={display:'inline-flex',alignItems:'center',gap:5,background:'none',border:'1px solid var(--line)',borderRadius:8,padding:'4px 8px',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'inherit',opacity:0.7};// D91. Two live-browser failures the in-process harness could not see:
//
// (1) WHEN the text is built. It used to be built during MessageBubble's render. But the
//     canonical stores (quran / adhkar / worship) fill asynchronously AFTER the cards mount,
//     and each card holds its resolved text in its OWN state -- so the store landing re-renders
//     the CARD and never its parent. The render-time string therefore froze whatever had not
//     arrived at first paint: an ayah, a whole surah, the adhkar list, the salah card. A
//     worship-only reply froze to the empty string, and this button then hid itself entirely.
//     getText is now invoked on the TAP, seconds later, reading the very stores the cards read.
//
// (2) WHETHER the write actually happened. navigator.clipboard.writeText REJECTS in an Android
//     WebView, on an insecure origin, and without a user gesture. The old code treated the mere
//     PRESENCE of the API as success-or-nothing: on rejection it fell into catch(e){} and did
//     not try the legacy path, so the button did nothing at all and said nothing at all. And on
//     the legacy path it ignored execCommand's return value, so a REFUSED copy still flashed
//     "copied" -- indistinguishable, to the owner, from a broken serializer.
// ── ITEM 42-أ: THE ONE CLIPBOARD PATH, LIFTED OUT SO A SECOND ONE IS NEVER WRITTEN ─────────
// This is the body that was inside CopyReplyButton, moved out unchanged and given a name. It is
// lifted because the share button needs the SAME fallback: where `navigator.share` does not
// exist -- every desktop browser, and a WebView without the permission -- sharing degrades to
// copying, and it must degrade to THIS copy, with its legacy path and its honest return value,
// rather than to a second implementation that would drift from it.
//
// It returns whether the write ACTUALLY happened. navigator.clipboard.writeText rejects in an
// Android WebView, on an insecure origin, and without a user gesture; the legacy path is not a
// relic but the only path that works where the Clipboard API is present and refuses. A refused
// copy must never be reported as a copy.
const ezikLegacyCopy=payload=>{try{const ta=document.createElement('textarea');ta.value=payload;ta.setAttribute('readonly','');// keeps the mobile keyboard shut
ta.style.position='fixed';ta.style.top='0';ta.style.left='0';ta.style.width='1px';ta.style.height='1px';ta.style.padding='0';ta.style.border='none';ta.style.outline='none';ta.style.boxShadow='none';ta.style.background='transparent';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();try{ta.setSelectionRange(0,String(payload).length);}catch(e){}// iOS needs the range
const done=document.execCommand('copy')===true;document.body.removeChild(ta);return done;}catch(e){return false;}};const ezikWriteClipboard=async payload=>{if(!payload)return false;let wrote=false;try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(payload);wrote=true;}}catch(e){wrote=false;}// a refusal is not the end -- fall through
if(!wrote)wrote=ezikLegacyCopy(payload);return wrote;};const CopyReplyButton=({text,getText})=>{const[flash,setFlash]=useState('');// '' | 'ok' | 'fail'
if(!text)return null;const doCopy=async()=>{const payload=typeof getText==='function'?getText():text;if(!payload){setFlash('fail');setTimeout(()=>setFlash(''),1500);return;}const wrote=await ezikWriteClipboard(payload);setFlash(wrote?'ok':'fail');// never claim a write that did not happen
setTimeout(()=>setFlash(''),1500);};return/*#__PURE__*/React.createElement("button",{type:"button",onClick:doCopy,"aria-label":'نسخ',style:miniBtnStyle},flash==='ok'?'تم النسخ':flash==='fail'?'تعذّرَ النسخ':'نسخ');};// ── ITEM 42-أ: SHARE. THE ONLY BUTTON THIS ITEM ADDS, AND IT CALLS NOTHING ─────────────────
// It moves text that is ALREADY ON THE SCREEN. There is no request in it of any kind: no
// summary, no regeneration, no model, no endpoint. The brain freeze is not lifted by this item
// and nothing here needs it lifted.
//
// It hands over the SAME payload the clipboard gets -- `getText` is `buildCopyText`, the one
// serializer the copy button already uses, with the cards serialized and no raw tag in it -- so
// a shared reply carries exactly what a copied one does and no second serializer can drift.
//
// AND IT FALLS BACK TO COPYING. `navigator.share` does not exist on desktop browsers and is
// refused in some WebViews. A button that vanished there would be a button the reader cannot
// learn, so the control is always present and the fallback is the file's ONE clipboard path.
// A share the reader CANCELS is not a failure: AbortError leaves the label alone.
const ShareReplyButton=({getText})=>{const[flash,setFlash]=useState('');// '' | 'copied' | 'fail'
const say=v=>{setFlash(v);setTimeout(()=>setFlash(''),1500);};const doShare=async()=>{const payload=typeof getText==='function'?getText():'';if(!payload){say('fail');return;}try{if(navigator.share){await navigator.share({text:payload});return;// the platform sheet is its own feedback
}}catch(e){if(e&&e.name==='AbortError')return;// the reader changed their mind
// anything else -- refused, unsupported scheme -- falls through to the clipboard
}say((await ezikWriteClipboard(payload))?'copied':'fail');};return/*#__PURE__*/React.createElement("button",{type:"button",onClick:doShare,"aria-label":EZIK_SHARE_ARIA,className:"ezik-focus",style:miniBtnStyle},flash==='copied'?EZIK_SHARE_COPIED:flash==='fail'?EZIK_SHARE_FAIL:EZIK_SHARE_LABEL);};// The Web Speech engine ends a session on every pause and the next one starts a fresh
// transcript. Concatenating the two halves raw welded the last word of one onto the first
// word of the next. Every seam goes through this joiner instead.
const joinSpeech=(a,b)=>{const l=a||'';const r=b||'';if(!l)return r;if(!r)return l;return /\s$/.test(l)||/^\s/.test(r)?l+r:l+' '+r;};const stripAllTashkeel=s=>(s||'').replace(/[ً-ْٰ]/g,'');// تصدير محتوى HTML كملفّ Word (.doc): Word/Docs يعرضان العربيّة RTL بأنفسهما،
// فنتخطّى مشكلة تشكيل العربيّة في توليد PDF داخل المتصفّح. (نمط تنزيل قياسيّ عبر <a download>)
const downloadAsWord=(filename,title,bodyHtml)=>{const html='\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'+'<head><meta charset="utf-8"><title>'+title+'</title>'+'<style>@page{size:A4;margin:2cm} body{font-family:"Arial","Amiri",serif;direction:rtl;text-align:right;line-height:1.9;font-size:14pt;color:#222} h1{color:#12327A;font-size:20pt} h2{color:#12327A;font-size:15pt} h3{color:#12327A;font-size:13pt} h4{color:#12327A;font-size:12pt} ul,ol{margin-right:1em} strong{font-weight:bold} table{border-collapse:collapse;width:100%;margin:8pt 0} th,td{border:1px solid #999;padding:4pt 8pt;text-align:right} th{background:#EDF1FA;color:#12327A}</style>'+'</head><body dir="rtl" lang="ar">'+bodyHtml+'</body></html>';const blob=new Blob([html],{type:'application/msword'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=/\.doc$/.test(filename)?filename:filename+'.doc';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);};// يهرّب رموز HTML كي لا يُحقَن ترميزٌ من المحتوى (احتياطًا)
const escapeHtml=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const toPlainText=s=>String(s||'').replace(/<[^>]+>/g,' ')// any leftover angle tag
.replace(/^#{1,6}\s+/gm,'')// # .. ###### headings
.replace(/\*\*([^*]+)\*\*/g,'$1')// **bold**
.replace(/^\s*[-•*]\s+/gm,'')// bullet markers
.replace(/^\s*\|.*\|\s*$/gm,'')// markdown table rows
.replace(/[﴿﴾]/g,'')// Quran ornament brackets
.replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();const inlineFmt=s=>escapeHtml(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');const printAsPdf=async(title,bodyHtml)=>{const area=document.getElementById('print-area');if(!area)return;area.innerHTML='<h1>'+escapeHtml(title)+'</h1>'+bodyHtml;// S97: html2pdf is no longer a boot-blocking <script>; it is warmed on idle after the first
// paint. Awaiting the same promise here is what keeps this path's RESULT identical -- the only
// case that waits is a tap in the first second, and it still produces the same file.
if(window.__ezikVendor){try{await window.__ezikVendor('html2pdf');}catch(e){}}if(!window.html2pdf){document.title=title;window.print();return;}// fallback if CDN failed
const opt={margin:[12,12,12,12],filename:(title||'مستند')+'.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}};const target=area.cloneNode(true);target.style.display='block';target.style.direction='rtl';target.style.textAlign='right';target.style.padding='0';window.html2pdf().set(opt).from(target).save().then(()=>{area.innerHTML='';}).catch(()=>{area.innerHTML='';});};// يحوّل محتوى المستند (فقرات، عناوين بـ# أو ##، نقاط بـ- أو •) إلى HTML للتصدير
// ============================================================
// ITEM 42-ب — THE REPLY, AS A PDF
// ============================================================
// THE MACHINE WAS MEASURED BEFORE IT WAS USED, and it was already here twice over:
//   * printAsPdf() above -- the one PDF path in this app, which awaits window.__ezikVendor
//     ('html2pdf') and falls back to window.print() when that never lands;
//   * the lazy vendor map at the head of the document, where html2pdf.bundle (906KB) has sat
//     since S97 precisely so that a session which never exports a PDF never pays for it.
// So this item adds NO library, no <script> tag and not one byte to the boot path. What it adds
// is a fifth button on a rail that already had four.
//
// THE SOURCE IS THE CLIPBOARD'S SOURCE. getText is buildCopyText -- the same serializeReply()
// call the copy button and the share button hand over -- so there are not two serializers that
// can drift, and the ayah, the hadith, the dhikr, the steps and the source chips come out of it
// exactly as they go into the clipboard. docToHtml() is the SAME renderer the document card's
// «تصدير PDF» already feeds printAsPdf, so the two PDFs are made the same way.
//
// ARABIC READS THE RIGHT WAY BECAUSE THE BROWSER SHAPES IT. html2pdf rasterises the DOM through
// html2canvas, so the glyphs in the file are the glyphs the browser laid out -- joined, shaped
// and right-to-left -- rather than a font-substituted re-run inside a PDF writer. printAsPdf
// already sets direction rtl and textAlign right on the node it hands over; nothing here
// re-states them, so the two export paths cannot disagree.
//
// ZERO MODEL CALL, ZERO REQUEST OF THIS APP'S OWN. The vendor bundle arrives from the cache or
// from the lazy source it already had; the reply itself is text this device is holding.
//
// 44x44 BY AREA, NOT BY SHAPE (44-ج). It is a .ezc-acts button, and the sheet gives every one of
// them a 44x44 ::before. It states no width and no height of its own, so nothing moved by a pixel.
const EZIK_PDF_LABEL='PDF';const EZIK_PDF_ARIA='تصدير الردّ ملفَّ PDF';const EZIK_PDF_WAIT='...';const EZIK_PDF_FAIL='تعذّرَ التصدير';const EZIK_PDF_TITLE='ردُّ عزك';const ExportPdfReplyButton=({getText})=>{const[flash,setFlash]=useState('');// ONE PRESS, ONE FILE. State alone could not promise it: two taps dispatched inside one task
// both read the value from before React committed the first. The ref flips synchronously.
const busyRef=useRef(false);const doExport=async()=>{if(busyRef.current)return;const payload=typeof getText==='function'?getText():'';if(!payload){setFlash('fail');setTimeout(()=>setFlash(''),1500);return;}busyRef.current=true;setFlash('wait');try{await printAsPdf(EZIK_PDF_TITLE,docToHtml(payload));setFlash('');}catch(e){setFlash('fail');setTimeout(()=>setFlash(''),1500);}busyRef.current=false;};return/*#__PURE__*/React.createElement("button",{type:"button",onClick:doExport,"aria-label":EZIK_PDF_ARIA,className:"ezik-focus",style:miniBtnStyle},flash==='wait'?EZIK_PDF_WAIT:flash==='fail'?EZIK_PDF_FAIL:EZIK_PDF_LABEL);};// ============================================================
// ITEM 42-C. THE REPLY AS AN IMAGE — DRAWN, NOT RASTERISED.
// ============================================================
// ITEM 42-B MEASURED WHY THIS DID NOT EXIST: the only DOM rasteriser reachable from this tree is
// html2canvas, it lives inside the 906KB html2pdf bundle, and the offline store precaches no
// vendor JavaScript at all. A share card built on it would be a control that does not work
// offline and costs three quarters of a megabyte the first time it is pressed. That measurement
// still stands, and the Z5 checks in theme-coverage-guard.cjs still hold it in place.
//
// SO NOTHING IS RASTERISED. The card is DRAWN: the browser shapes and joins Arabic inside
// fillText by itself, which is the whole reason a library was thought to be needed. No new
// dependency, no CDN, no <script>, and nothing added to CORE.
//
// ZERO BYTES OF WORK AT BOOT. Everything below is a declaration; not one line executes until the
// button is pressed. There is no module to fetch, no font to load, no canvas allocated and no
// image decoded until then -- and because nothing is fetched, there is nothing for the offline
// store to hold, which is why CORE does not change.
//
// ZERO NETWORK AND ZERO MODEL CALL. The card draws WHAT IS ALREADY ON SCREEN. The watermark is
// DRAWN as the wordmark rather than fetched as icon-watermark.png, deliberately: an image would
// be a request, and this path is required to make none. The source line is whatever the reply
// already carries; if it carries none, none is drawn.
const EZIK_CARD_W=1080;const EZIK_CARD_H=1350;const EZIK_CARD_PAD=84;const EZIK_CARD_BODY_SIZE=40;const EZIK_CARD_LINE=62;// The card is a fixed size, so the text it can hold is a fixed number of lines. A longer reply
// is CUT, and the cut is SHOWN -- see EZIK_CARD_CUT and EZIK_CARD_CUT_NOTE. A silent truncation
// would hand the reader a card that looks like a whole answer and is not one.
const EZIK_CARD_BODY_LINES=13;const EZIK_CARD_CUT='…';const EZIK_CARD_CUT_NOTE='النَّصُّ مُقتطَعٌ — تَمَامُهُ في التطبيق';const EZIK_CARD_SITE='ezik.app';const EZIK_CARD_MARK='عزك';const EZIK_CARD_LABEL='صورة';const EZIK_CARD_ARIA='حفظ الردّ صورة';const EZIK_CARD_WAIT='...';const EZIK_CARD_FAIL='تعذَّرَ الحفظ';const EZIK_CARD_FILE='ezik-reply.png';// Greedy wrap against the REAL measured width of the REAL font, which is the only wrap that can
// be right: Arabic glyph widths depend on shaping and no character count approximates them.
const ezikCardWrap=(ctx,text,maxWidth)=>{const out=[];for(const para of String(text||'').replace(/\r\n?/g,'\n').split('\n')){const words=para.trim().split(/\s+/).filter(Boolean);if(!words.length)continue;let line='';for(const w of words){const next=line?line+' '+w:w;if(line&&ctx.measureText(next).width>maxWidth){out.push(line);line=w;}else line=next;}if(line)out.push(line);}return out;};// THE SEAM IS THE CANVAS, and it is the only one. A guard hands in a recording context so the
// card's geometry, its wrapping and its cut can be driven without a browser; the button below
// hands in nothing and takes document.createElement, which is asserted.
const ezikDrawReplyCard=opts=>{const o=opts||{};const canvas=o.canvas||document.createElement('canvas');canvas.width=EZIK_CARD_W;canvas.height=EZIK_CARD_H;const ctx=canvas.getContext('2d');const inner=EZIK_CARD_W-EZIK_CARD_PAD*2;ctx.fillStyle='#0E1512';ctx.fillRect(0,0,EZIK_CARD_W,EZIK_CARD_H);// The watermark: the wordmark, large, faint, behind everything. Drawn, never fetched.
ctx.save();ctx.globalAlpha=0.07;ctx.fillStyle='#EAF3EE';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 420px system-ui, sans-serif';ctx.fillText(EZIK_CARD_MARK,EZIK_CARD_W/2,EZIK_CARD_H/2);ctx.restore();// The reply, wrapped and right-aligned, because the card is Arabic.
ctx.fillStyle='#EAF3EE';ctx.textAlign='right';ctx.textBaseline='alphabetic';ctx.font='400 '+EZIK_CARD_BODY_SIZE+'px system-ui, sans-serif';const all=ezikCardWrap(ctx,o.text,inner);const cut=all.length>EZIK_CARD_BODY_LINES;const lines=cut?all.slice(0,EZIK_CARD_BODY_LINES):all;if(cut)lines[lines.length-1]=lines[lines.length-1]+' '+EZIK_CARD_CUT;let y=EZIK_CARD_PAD+EZIK_CARD_LINE;for(const line of lines){ctx.fillText(line,EZIK_CARD_W-EZIK_CARD_PAD,y);y+=EZIK_CARD_LINE;}// THE CUT IS SAID, not merely marked with an ellipsis a reader can mistake for the author's.
if(cut){ctx.save();ctx.globalAlpha=0.75;ctx.font='400 30px system-ui, sans-serif';ctx.fillText(EZIK_CARD_CUT_NOTE,EZIK_CARD_W-EZIK_CARD_PAD,y+14);ctx.restore();}// The source line, only if the reply carries one. Nothing is invented under a reply.
const foot=EZIK_CARD_H-EZIK_CARD_PAD;if(o.source){ctx.save();ctx.globalAlpha=0.8;ctx.font='400 28px system-ui, sans-serif';ctx.fillText(String(o.source),EZIK_CARD_W-EZIK_CARD_PAD,foot-46);ctx.restore();}ctx.font='600 30px system-ui, sans-serif';ctx.fillText(EZIK_CARD_SITE,EZIK_CARD_W-EZIK_CARD_PAD,foot);return{url:canvas.toDataURL('image/png'),cut:cut,lines:lines.length,w:EZIK_CARD_W,h:EZIK_CARD_H};};const SaveReplyImageButton=({getText,getSource})=>{const[flash,setFlash]=useState('');// ONE PRESS, ONE FILE -- the same ref latch the PDF control uses, and for the same reason.
const busyRef=useRef(false);const doSave=()=>{if(busyRef.current)return;const payload=typeof getText==='function'?getText():'';if(!payload){setFlash('fail');setTimeout(()=>setFlash(''),1500);return;}busyRef.current=true;try{const card=ezikDrawReplyCard({text:payload,source:typeof getSource==='function'?getSource():''});const a=document.createElement('a');a.href=card.url;a.download=EZIK_CARD_FILE;a.click();setFlash('');}catch(e){setFlash('fail');setTimeout(()=>setFlash(''),1500);}busyRef.current=false;};return/*#__PURE__*/React.createElement("button",{type:"button",onClick:doSave,"aria-label":EZIK_CARD_ARIA,className:"ezik-focus",style:miniBtnStyle},flash==='wait'?EZIK_CARD_WAIT:flash==='fail'?EZIK_CARD_FAIL:EZIK_CARD_LABEL);};const docToHtml=md=>{const lines=String(md||'').replace(/\r\n?/g,'\n').split('\n');const out=[];let i=0;const isSep=s=>/^[\s|:-]+$/.test(s.trim())&&s.includes('-')&&s.includes('|');const parseRow=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());while(i<lines.length){const t=lines[i].trim();if(!t){i++;continue;}if(t.includes('|')&&i+1<lines.length&&isSep(lines[i+1])){const headers=parseRow(t);i+=2;const rows=[];while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')){rows.push(parseRow(lines[i]));i++;}let tbl='<table><thead><tr>'+headers.map(h=>'<th>'+inlineFmt(h)+'</th>').join('')+'</tr></thead>';if(rows.length)tbl+='<tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+inlineFmt(c)+'</td>').join('')+'</tr>').join('')+'</tbody>';tbl+='</table>';out.push(tbl);continue;}let m;if(m=t.match(/^####\s+(.*)$/)){out.push('<h4>'+inlineFmt(m[1])+'</h4>');i++;continue;}if(m=t.match(/^###\s+(.*)$/)){out.push('<h3>'+inlineFmt(m[1])+'</h3>');i++;continue;}if(m=t.match(/^##\s+(.*)$/)){out.push('<h2>'+inlineFmt(m[1])+'</h2>');i++;continue;}if(m=t.match(/^#\s+(.*)$/)){out.push('<h1>'+inlineFmt(m[1])+'</h1>');i++;continue;}if(/^[-•*]\s+/.test(t)){const items=[];while(i<lines.length&&/^[-•*]\s+/.test(lines[i].trim())){items.push('<li>'+inlineFmt(lines[i].trim().replace(/^[-•*]\s+/,''))+'</li>');i++;}out.push('<ul>'+items.join('')+'</ul>');continue;}if(/^\d+[.)]\s+/.test(t)){const items=[];while(i<lines.length&&/^\d+[.)]\s+/.test(lines[i].trim())){items.push('<li>'+inlineFmt(lines[i].trim().replace(/^\d+[.)]\s+/,''))+'</li>');i++;}out.push('<ol>'+items.join('')+'</ol>');continue;}out.push('<p>'+inlineFmt(t)+'</p>');i++;}return out.join('\n');};// ============================================================
// deriveCaps — single source of truth for age-band capability gating.
// The band threshold is taken VERBATIM from the prompt builder, which now lives
// server-side in lib/system-prompt.js — same three bands (young 4–13 /
// teen 13–17 / adult 18+). Every UI gate reads a flag here instead of an inline
// age check. `call` is intentionally NOT a plain flag — it is band-AND-parent-gated
// and computed at the call site (see App: directConvoAllowed).
// ============================================================
function deriveCaps(age){const ageNum=parseInt(age,10)||0;const band=ageNum>=18?'adult':ageNum>=13?'teen':'young';return{band,memorize:true,recite:true,upload:band!=='young',// hidden for young by BAND (no parent override)
export:band!=='young'// preserves current >=11 behavior exactly
};}// ============================================================
// standingNoticeKey — أيُّ تنبيهٍ دائمٍ يراه هذا القارئ (§٥).
//
// الحالُ قبلَ اليوم: سطرٌ واحدٌ بلا شرطٍ البتّة، فكلُّ بالغٍ يقرأُ «راجِعْ ما يهمُّك مع
// والديك». والشرطُ هنا مبنيٌّ على ما يقيسُه التطبيقُ فعلًا — نطاقُ deriveCaps المشتقُّ من
// سنةِ الميلادِ المخزّنة — لا على حقلٍ جديدٍ يُخمَّن. البالغُ (١٨+) يرى الصيغةَ بلا
// «والديك»، والصغيرُ واليافعُ يريانِها كما هي بحرفِها، وهو الاختيارُ الذي يجري عليه هذا
// الملفُّ في كلِّ فرقٍ آخرَ من نوعِه (`band !== 'young'` في deriveCaps وتوأمُه في
// WorshipCard): مَن يعيشُ في بيتِ أبويهِ تُقالُ له.
//
// A PURE FUNCTION ON PURPOSE. guards/standing-notice-band-guard.cjs lifts it out of the shipped
// babel block and drives both arms, so the rule is asserted where it lives instead of being
// re-described in a regex over this file.
// ============================================================
function standingNoticeKey(band){return band==='adult'?'chat.standingNoticeAdult':'chat.standingNotice';}// ============================================================
// childVoiceBlocked — الحكمُ الوحيدُ لحاجزِ صوتِ الأطفال (غ‑٣). fail-closed:
// لا ملفّ / ملفٌّ تالف / رميةُ استثناء ⇒ مقفول. يقرأ المرآةَ لا حالةَ الرسم،
// كي لا يُفتحَ الميكروفونُ في دورةٍ يكون فيها profile ما يزال بائتاً.
// ============================================================
function childVoiceBlocked(){if(CHILD_VOICE_ENABLED)return false;try{const p=voiceProfileRef.current;if(!p)return true;// fail-closed
return deriveCaps(p.age).band==='young';}catch(e){return true;}// fail-closed
}// تنبيهُ الحاجز — يحتذي نمطَ التنبيهات القائم (رسالةٌ غيرُ معطِّلة تُمسح بعد ٦ ثوانٍ).
// لا يوحي بخطأ، ولا يطلب عمراً أكبر، ولا يذكر مزوّداً.
function showChildVoiceNotice(setMsg){try{setMsg(CHILD_VOICE_NOTICE);setTimeout(()=>{try{setMsg('');}catch(e){}},6000);}catch(e){}}// ============================================================
// XI-04 — الوسمُ شارةٌ لا محارفُ في المتن (the review mark is a badge)
// ============================================================
// WHAT WAS MEASURED. In 10 browser rounds of 10 on 17 August the final sheet carried, as raw
// characters in the prose, the line «【فهم لا فتوى】 ما تقدم فهم مبني على ما بين يدي في هذه
// الدورة، لا فتوى مسندة إلى مفت بعينه.», and one round carried a second mark INSIDE a paragraph
// («…وإن توضأ منها احتياطا فحسن لا واجب. 【فهم لا نص منقول】»). The copy button put the 【】
// brackets on the clipboard verbatim. Every ANGLE-bracket tag was drawn as a card in the same ten
// rounds; this was the one mark the client had no renderer for, so it fell through as text.
//
// THE MEANING STAYS, THE SHAPE CHANGES. The mark is lifted into its own segment and drawn as a
// badge beside the cards, and the clipboard receives its words without the brackets.
//
// TWO SHAPES, AND THEY ARE THE ONLY TWO lib/output-reviewer.js PRODUCES:
//   (a) `tag()` appends the bare mark AFTER the sentence it is about  -> the mark closes a line
//   (b) a NOTICE is `mark + ' ' + sentence` as its own output entry   -> the mark opens a line
// So the rest of the line is the badge's body ONLY when the mark OPENS the line. Anything else —
// a mark that turns up mid-sentence from some future writer — takes no body and the prose around
// it is left exactly where it was, rather than being swallowed into a badge.
const EZIK_NOTICE_RE=/【([^】\n]{1,80})】/u;const EZIK_NOTICE_ALL=/【([^】\n]{1,80})】/gu;const ezikLiftNotices=segments=>{const out=[];(segments||[]).forEach(seg=>{if(!seg||seg.type!=='text'||!EZIK_NOTICE_RE.test(seg.content||'')){out.push(seg);return;}const prose=[];const notices=[];String(seg.content).split('\n').forEach(line=>{if(!EZIK_NOTICE_RE.test(line)){prose.push(line);return;}const labels=[];const stripped=line.replace(EZIK_NOTICE_ALL,(all,label)=>{labels.push(label.trim());return'';}).replace(/[ \t]{2,}/g,' ').trim();const opensLine=/^\s*【/.test(line);labels.forEach((label,i)=>notices.push({type:'notice',label,content:opensLine&&i===0?stripped:''}));if(!opensLine&&stripped)prose.push(stripped);});const kept=prose.join('\n').replace(/\n{3,}/g,'\n\n').trim();if(kept)out.push({type:'text',content:kept});notices.forEach(notice=>out.push(notice));});return out;};const parseRichMessage=(text,viewerAge)=>{// Tolerate a <document> whose </document> never arrived (stream/token cutoff): close it so it still renders as a card.
{const _d=text.search(/<document\b[^>]*>/);if(_d!==-1&&text.indexOf('</document>',_d)===-1)text=text+'</document>';}if(!text||typeof text!=='string'){return{segments:[{type:'text',content:text||''}],suggestions:[]};}// §٢ (C): علامةُ «لم يكتمل» تُقرأ في شريطِ الإجراءات لا في فقاعةِ الجواب، فتُنزَع هنا أوّلاً —
// قبل `stripIncompleteTags`، لأنّها لو بقيت لبَدَت له وسماً مفتوحاً بلا إغلاق.
text=ezikStripIncomplete(text);// نُنظّف الترميز الناقص قبل التحليل كي لا يظهر "<verse surah=..." كنصّ خام للطفل
text=stripIncompleteTags(text,{rescue:true});const segments=[];let suggestions=[];let remaining=text;// أنماط الوسوم
const tagPattern=new RegExp(`<(${KNOWN_TAGS})([^>]*)>([\\s\\S]*?)</\\1>`,'g');let lastIndex=0;let match;while((match=tagPattern.exec(text))!==null){// إضافة النص العادي قبل الوسم
if(match.index>lastIndex){const plainText=text.slice(lastIndex,match.index).trim();if(plainText)segments.push({type:'text',content:plainText});}const tagName=match[1];const attrsStr=match[2]||'';const content=(match[3]||'').trim();if(tagName==='verse'){const surahMatch=attrsStr.match(/surah=["']([^"']+)["']/);const surahNumMatch=attrsStr.match(/surah_num=["']([^"']+)["']/);const ayahMatch=attrsStr.match(/ayah=["']([^"']+)["']/);segments.push({type:'verse',content,surah:surahMatch?surahMatch[1]:'',surahNum:surahNumMatch?surahNumMatch[1]:'',ayah:ayahMatch?ayahMatch[1]:''});}else if(tagName==='surah'){// سورة كاملة أو مدًى متّصل — بطاقة واحدة، نصّ متّصل، زرّ تلاوة واحد
const numMatch=attrsStr.match(/num=["']([^"']+)["']/);const fromMatch=attrsStr.match(/from=["']([^"']+)["']/);const toMatch=attrsStr.match(/to=["']([^"']+)["']/);segments.push({type:'surah',num:numMatch?numMatch[1]:'',from:fromMatch?fromMatch[1]:'',to:toMatch?toMatch[1]:''});}else if(tagName==='hadith'){const narratorMatch=attrsStr.match(/narrator=["']([^"']+)["']/);const rulingMatch=attrsStr.match(/ruling=["']([^"']+)["']/);segments.push({type:'hadith',content,narrator:narratorMatch?narratorMatch[1]:'',ruling:rulingMatch?rulingMatch[1]:''});}else if(tagName==='dhikr'){const dhikrIdMatch=attrsStr.match(/id=["']([^"']+)["']/);segments.push({type:'dhikr',catId:dhikrIdMatch?dhikrIdMatch[1]:''});}else if(tagName==='worship'){const worshipIdMatch=attrsStr.match(/id=["']([^"']+)["']/);segments.push({type:'worship',id:worshipIdMatch?worshipIdMatch[1]:''});}else if(tagName==='source'){const siteMatch=attrsStr.match(/site=["']([^"']+)["']/);const urlMatch=attrsStr.match(/url=["']([^"']+)["']/);segments.push({type:'source',content,site:siteMatch?siteMatch[1]:'',url:urlMatch?urlMatch[1]:''});}else if(tagName==='steps'){const items=content.split('\n').map(l=>l.trim()).filter(l=>l).map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(l=>l);segments.push({type:'steps',items,title:readStepsTitle(attrsStr)});}else if(tagName==='suggestions'){const items=content.split('\n').map(l=>l.trim()).filter(l=>l).map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(l=>l);suggestions=items;}else if(tagName==='board'){segments.push({type:'board',content});}else if(tagName==='document'){const titleMatch=attrsStr.match(/title=["']([^"']+)["']/);if(deriveCaps(viewerAge).export){segments.push({type:'document',title:titleMatch?titleMatch[1]:'مستند',content});}else{segments.push({type:'text',content:toPlainText((titleMatch?titleMatch[1]+'\n\n':'')+content)});}}lastIndex=match.index+match[0].length;}// ما بعد آخر وسم
if(lastIndex<text.length){const plainText=text.slice(lastIndex).trim();if(plainText)segments.push({type:'text',content:plainText});}// إن لم نجد وسوماً، النص كله نصّ عادي
if(segments.length===0&&!suggestions.length){segments.push({type:'text',content:text.trim()});}// XI-04: the review mark leaves the prose here, LAST — after every card has been separated, so
// a mark that landed inside a hadith or a source body is not lifted out of a card it belongs to.
return{segments:ezikLiftNotices(segments),suggestions};};// ============================================================
// تحضير النص للصوت (إزالة الوسوم، إنشاء سياق طبيعي)
// ============================================================
const formatForTTS=text=>{if(!text)return'';// §٢ (C): العلامةُ لا تُنطَق. هي شارةٌ عن الجواب لا جملةٌ منه، كوسمِ المراجعةِ سواءً بسواء.
// وقبلَ `stripIncompleteTags` لأنّها لو بقيت لعُدَّت وسماً مقطوعاً فحُذِف ما بعدها.
// نحذف أي وسم ناقص/بقايا "<...>" قبل أي معالجة كي لا يصل ترميز خام إلى ElevenLabs
let t=stripIncompleteTags(ezikStripIncomplete(text),{rescue:true});// إزالة وسم الاقتراحات بالكامل (UI فقط، لا يُنطق)
t=t.replace(/<suggestions[^>]*>[\s\S]*?<\/suggestions>/g,'');// إزالة بطاقة المصدر بالكامل (UI فقط: شريحة نقرٍ مرئيّة) — لا يُنطَق الرابطُ ولا العنوانُ أبداً، كالاقتراحات
t=t.replace(/<source[^>]*>[\s\S]*?<\/source>/g,' ');// إزالة الآيات بالكامل من نص الصوت — التلاوة يسمعها الطفل من قارئ حقيقي عبر زر "استمع للتلاوة"،
// ولا ينطقها صوت الذكاء الاصطناعي أبداً. نستبدلها بمسافة كي يبقى الكلام المحيط متّصلاً.
t=t.replace(/<verse[^>]*>[\s\S]*?<\/verse>/g,' ');// وكذلك السورة الكاملة: يتلوها القارئ الحقيقي عبر الزرّ، لا ينطقها المربّي
t=t.replace(/<surah[^>]*>[\s\S]*?<\/surah>/g,' ');// الذكر: يُقرأ من صوت حصن المسلم عبر زرّ البطاقة، لا يُنطَق من المربّي
t=t.replace(/<dhikr[^>]*>[\s\S]*?<\/dhikr>/g,' ');t=t.replace(/<dhikr[^>]*\/?>/g,' ');// اللوح: يُعرَض مكتوبًا ولا يُنطَق (كالآيات) — يبقى الشرحُ المنطوقُ كلماتٍ سهلة
t=t.replace(/<board[^>]*>[\s\S]*?<\/board>/g,' ');// المستند: يُقرأ ويُصدَّر مكتوبًا، فلا يُنطَق كاملًا — نستبدله بعبارةٍ قصيرة
t=t.replace(/<document[^>]*>[\s\S]*?<\/document>/g,' هذا مستندٌ مكتوبٌ، يمكن قراءتُه وتصديرُه. ');t=t.replace(/<document[^>]*>[\s\S]*$/g,' هذا مستندٌ مكتوبٌ، يمكن قراءتُه وتصديرُه. ');// تحويل الأحاديث إلى نص طبيعي للنطق — يجب أن يسبق تجريدَ الأقواس الزاويّة أدناه، وإلا فُقِد الوسم.
// متسامحٌ مع ترتيب الخصائص وغيابها: نستخرج narrator وruling كلاًّ على حدة، ولا نلفظ أسماء الوسوم نفسها.
t=t.replace(/<hadith([^>]*)>([\s\S]*?)<\/hadith>/g,(_,attrs,content)=>{const nm=attrs.match(/narrator=["']([^"']+)["']/);const rm=attrs.match(/ruling=["']([^"']+)["']/);// الدرجةُ لا تُنطَقُ مرّتين، ولا يُنطَقُ «رَوَى متفق عليه».
const att=resolveHadithAttribution(nm?nm[1]:'',rm?rm[1]:'');const body=content.trim();let out=att.narrator?` رَوَى ${att.narrator}: ${body}.`:` ${body}.`;if(att.ruling)out+=` ${att.ruling}.`;return out+' ';});// تحويل الخطوات إلى نص طبيعي للنطق — كذلك قبل تجريد الأقواس. نسمح بخصائص اختياريّة على الوسم المفتوح.
t=t.replace(/<steps([^>]*)>([\s\S]*?)<\/steps>/g,(_,attrs,content)=>{const items=content.split('\n').map(l=>l.trim()).filter(l=>l).map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(l=>l);if(!items.length)return'';// العنوانُ من الجواب إن وُجد، وإلّا فالخطواتُ تُنطَقُ بلا عنوانٍ أصلًا.
const title=readStepsTitle(attrs);return(title?' '+title+': ':' ')+items.join(' ثُمَّ ')+'. ';});// <worship> is resolved to the frozen cell text up-front (resolveWorshipTags).
// Any tag surviving to here -> a single space (silence): never the raw tag, never model text.
t=t.replace(/<worship[^>]*>[\s\S]*?<\/worship>/g,' ');t=t.replace(/<worship[^>]*\/?>/g,' ');// ── §٤ — الوسمُ لا يُنطَق (the review mark is a label, not a sentence) ──────
// K-5/XI-04 made 【…】 a badge on the SCREEN and took the brackets off the CLIPBOARD. The voice
// was outside that item's scope and was left as it was, so a listener still heard «فهمٌ لا فتوى»
// read out inside the answer — the one reader of the four still being handed the raw mark.
// It is a label ABOUT the answer, not a sentence OF it, and nothing else on this page speaks the
// name of a tag: every angle-bracket tag above is either rewritten to natural speech or silenced.
//
// THE INFORMATION IS NOT TAKEN FROM THE READER. The badge is still drawn (`ezikLiftNotices`),
// and the notice's own sentence — «ما تقدّم فهمٌ مبنيٌّ على ما بين يديّ في هذه الدورة، لا فتوى
// مسنَدةٌ إلى مفتٍ بعينِه.» — is prose, and is still spoken in full. Only the bracketed LABEL goes.
//
// A SPACE AND NOT AN EMPTY STRING. `tag()` appends the mark straight after the full stop
// («…لا واجبٌ.【فهمٌ لا نصٌّ منقول】»), so deleting it to nothing would weld the sentence that
// precedes it to the one that follows and ElevenLabs would read the two as a single word.
t=t.replace(EZIK_NOTICE_ALL,' ');t=t.replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/[﴿﴾«»""“”‹›\[\]<>]/g,' ').replace(/[ \t]{2,}/g,' ');// Keep links opaque while pronunciation-only math substitutions run. In particular, neither a
// trig name in a path nor any slash/query operator in a URL is spoken as mathematics.
const protectedUrls=[];t=t.replace(/\b(?:https?:\/\/|www\.)[^\s<>"'﴿﴾]+/gi,url=>{const token='\uE000'+String.fromCharCode(0xE100+protectedUrls.length)+'\uE001';protectedUrls.push({token,url});return token;});// رموزٌ ودوالُّ رياضيّةٌ خارج <board> → أسماؤها المتعارَف عليها (شبكة أمان للنطق)
const trigNames={cos:' كوساين ',sin:' ساين ',tan:' تانجنت '};t=t.replace(/(^|[^\p{L}\p{N}_])(cos|sin|tan)(?=$|[^\p{L}\p{N}_])/giu,(_all,left,name)=>left+trigNames[name.toLowerCase()]).replace(/π/g,' باي ').replace(/°/g,' درجة ').replace(/√/g,' الجذر التربيعيّ لـ ').replace(/×/g,' في ').replace(/÷/g,' على ').replace(/\//g,' على ').replace(/\+/g,' زائد ').replace(/−/g,' ناقص ').replace(/=/g,' يساوي ').replace(/≤/g,' أصغر أو يساوي ').replace(/≥/g,' أكبر أو يساوي ').replace(/≠/g,' لا يساوي ').replace(/²/g,' تربيع ').replace(/³/g,' تكعيب ').replace(/\^/g,' أُس ').replace(/%/g,' بالمئة ').replace(/½/g,' نصف ').replace(/⅓/g,' ثلث ').replace(/⅔/g,' ثلثين ').replace(/¼/g,' ربع ').replace(/¾/g,' ثلاثة أرباع ');// شبكة أمان أخيرة (دفاعٌ في العمق): أيّ اسمِ وسمٍ إنجليزيّ ناجٍ — بقايا وسمٍ مشوّهٍ فلَتَ من
// المحوّلات أعلاه — يُحذَف كي لا يُنطَق أبداً. نطابق كلماتِ ASCII وحدها عبر \b…\b، فلا يُمَسّ
// النصُّ العربيّ إطلاقاً (لا حدودَ كلماتٍ ASCII داخله).
/* tts-num-words */// الأعداد المكتوبة رقمًا في النثر المنطوق (خارج <board> المجرَّد أعلاه) → كلماتٍ عربيّةً كي
// ينطقها ElevenLabs صحيحةً بدل تلعثمٍ رقمًا-رقمًا. العرضُ المرئيُّ لا يتأثّر (نصُّ الصوت فقط)،
// وأرقامُ <board> لا تُقرأ أصلًا لأنّها حُذِفت قبل هذا السطر.
{const _ones=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];const _tens=['','عشرة','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];const _teens=['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];const _huns=['','مئة','مئتان','ثلاثمئة','أربعمئة','خمسمئة','ستمئة','سبعمئة','ثمانمئة','تسعمئة'];const _digitWord=['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];const _three=n=>{const out=[];const h=Math.floor(n/100),r=n%100;if(h)out.push(_huns[h]);if(r){if(r<10)out.push(_ones[r]);else if(r<20)out.push(_teens[r-10]);else{const u=r%10,tn=Math.floor(r/10);out.push(u?_ones[u]+' و'+_tens[tn]:_tens[tn]);}}return out.join(' و');};const _int=n=>{if(n===0)return'صفر';const out=[];const th=Math.floor(n/1000),r=n%1000;if(th)out.push(th===1?'ألف':th===2?'ألفان':_three(th)+' آلاف');if(r)out.push(_three(r));return out.join(' و');};const _dbd=s=>s.split('').map(d=>_digitWord[+d]).join(' ');const _norm=s=>s.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));t=t.replace(/[٠-٩0-9]+(?:[.٫‚][٠-٩0-9]+)?/g,tok=>{const m=tok.match(/^([٠-٩0-9]+)(?:[.٫‚]([٠-٩0-9]+))?$/);if(!m)return tok;const ip=_norm(m[1]),fp=m[2]?_norm(m[2]):null;const n=parseInt(ip,10);const iw=ip.length<=4&&n<=9999?_int(n):_dbd(ip);return' '+(fp===null?iw:iw+' فاصلة '+_dbd(fp))+' ';});}t=t.replace(/\b(steps|hadith|narrator|ruling|suggestions|source|verse|surah|board|document)\b/gi,' ');// تنظيف الفراغات
t=t.replace(/\s+/g,' ').trim();for(const{token,url}of protectedUrls)t=t.split(token).join(url);return t;};// ============================================================
// تجهيز النص لسجل الأهل (عرض فقط) — مثل formatForTTS لكنه يُبقي نصّ الآية مقروءاً
// ============================================================
// الصوت يحذف الآية (يسمعها الطفل من القارئ)، أما الأهل فيجب أن يَرَوا نصّها في السجلّ.
const formatForLog=text=>{if(!text)return'';// §٢ (C): والسجلُّ كذلك — الشارةُ للشاشةِ لا لِنصِّ السجلّ، ونزعُها هنا قبلَ التنظيفِ العامّ.
// نفس التنظيف: لا نُظهِر للأهل في السجلّ أيّ وسم ناقص أو بقايا "<...>" خام
let t=stripIncompleteTags(ezikStripIncomplete(text),{rescue:true});t=t.replace(/<suggestions[^>]*>[\s\S]*?<\/suggestions>/g,'');// المصدر: نُبقي عنوانه نصّاً مقروءاً في سجلّ الأهل (للتحقّق) ونُسقِط الرابط — لا نعرض URL خاماً
t=t.replace(/<source[^>]*>([\s\S]*?)<\/source>/g,(_,title)=>{const s=(title||'').trim();return s?` [المصدر: ${s}] `:' ';});// الآية: نصّها الكنسي من المصحف المُحمَّل (لا من النموذج). إن لم يكن مُحمَّلاً بعد،
// نعرض المرجع فقط. نتجاهل أيّ نصّ بداخل الوسم تماماً (قد يرسله النموذج خطأً).
t=t.replace(/<verse([^>]*)>([\s\S]*?)<\/verse>/g,(_,attrs)=>{const sNum=resolveSurahNumber((attrs.match(/surah=["']([^"']+)["']/)||[])[1],(attrs.match(/surah_num=["']([^"']+)["']/)||[])[1]);const aNum=parseInt((attrs.match(/ayah=["']([^"']+)["']/)||[])[1],10);const name=sNum?SURAH_NAMES[sNum]:'';const ref=[name&&`سورة ${name}`,aNum>=1&&`آية ${aNum}`].filter(Boolean).join('، ');const canon=sNum&&aNum>=1?getVerseText(sNum,aNum):null;return canon?` «${canon}»${ref?` (${ref})`:''} `:ref?` [${ref}] `:' ';});// السورة: مرجعٌ مختصرٌ للأهل (الاسم + المدى إن كان جزئياً) — لا نصّ خام
t=t.replace(/<surah([^>]*)>([\s\S]*?)<\/surah>/g,(_,attrs)=>{const sNum=resolveSurahNumber(undefined,(attrs.match(/num=["']([^"']+)["']/)||[])[1]);const name=sNum?SURAH_NAMES[sNum]:'';const from=parseInt((attrs.match(/from=["']([^"']+)["']/)||[])[1],10);const to=parseInt((attrs.match(/to=["']([^"']+)["']/)||[])[1],10);const rangePart=from>=1&&to>=1?`، الآيات ${from}–${to}`:'';return name?` [تلاوة سورة ${name}${rangePart}] `:' ';});// الحديث والخطوات: نفس تحويل الصوت كي يبقى السجلّ مقروءاً
// متسامحٌ مع ترتيبِ الخصائصِ وغيابِها كنظيرِه الصوتيّ: كان يشترطُ narrator ثمّ ruling بهذا
// الترتيبِ حصرًا، فحديثٌ بلا درجةٍ كان يتسرّبُ إلى سجلِّ الأهل وسمًا خامًا.
t=t.replace(/<hadith([^>]*)>([\s\S]*?)<\/hadith>/g,(_,attrs,content)=>{const nm=attrs.match(/narrator=["']([^"']+)["']/);const rm=attrs.match(/ruling=["']([^"']+)["']/);const att=resolveHadithAttribution(nm?nm[1]:'',rm?rm[1]:'');const body=content.trim();let out=att.narrator?` رَوَى ${att.narrator}: ${body}.`:` ${body}.`;if(att.ruling)out+=` ${att.ruling}.`;return out+' ';});// كان يطابقُ `<steps>` عاريةً فقط — فأيُّ خاصّيّةٍ عليها (وعنوانُ الخطواتِ خاصّيّةٌ الآن)
// كانت تُفلِتُ الوسمَ خامًا إلى سجلِّ الأهل.
t=t.replace(/<steps([^>]*)>([\s\S]*?)<\/steps>/g,(_,attrs,content)=>{const items=content.split('\n').map(l=>l.trim()).filter(l=>l).map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(l=>l);if(!items.length)return'';const title=readStepsTitle(attrs);return(title?' '+title+': ':' ')+items.join(' ثُمَّ ')+'. ';});// ── §٣ — الوسمُ شارةٌ في السجلِّ أيضًا، لا محارفُ خامّ (the mark is a badge here too) ──
//
// WHAT WAS STILL WRONG, AND WHY THIS SURFACE WAS THE ONE LEFT. K-5/XI-04 made 【…】 a badge on the
// SCREEN and took the ornate brackets off the CLIPBOARD; §٤ of the A-3 round took them out of the
// VOICE. The parents' log was the fourth reader and kept them verbatim, so the surface a parent
// opens in order to check what their child was told still showed the one defect the owner named
// about the mark: its shape, «بين قوسينِ غريبين».
//
// THE INFORMATION IS NOT TAKEN FROM THE PARENT — that is the whole difference between this and
// the voice. The voice DROPS the label because a label is not a sentence to be read aloud; the
// log KEEPS it, because a parent checking an answer needs to know it was understanding rather
// than a sourced fatwa. Only the shape changes.
//
// AND THE SHAPE IT CHANGES TO IS THIS SURFACE'S OWN BADGE, NOT A NEW INVENTION. §٣ allows «شارةٌ
// أو ما يقومُ مقامَها في سياقِ السجلّ», and the log is a plain-text surface — `formatForLog`
// returns a string that is rendered into one <div>, so there is no element to draw. What this
// function already does for every other label it emits is exactly the answer: the source becomes
// ` [المصدر: …] `, a verse reference becomes ` [سورة …، آية …] `, a recitation becomes
// ` [تلاوة سورة …] `. So the review mark becomes ` [فهمٌ لا فتوى] ` — set off as a label, in the
// idiom the parent is already reading on the same line, and without the ornate pair.
//
// MATCHED BY THE BRACKETS AND NOT BY THE LABEL TEXT, for the reason §٤ measured: the same label
// is written with two different mark orders inside lib/output-reviewer.js (shadda before damma at
// :9, after it at :669) — one NFC, one glyph, different code units — so any match on the label's
// text would miss one of them. EZIK_NOTICE_ALL is the same constant the screen badge and the
// voice both use, so all four readers agree on what a mark IS.
//
// SPACES ON BOTH SIDES, NOT NONE: `tag()` appends the mark straight after the full stop
// («…لا واجبٌ.【فهمٌ لا نصٌّ منقول】»), and the whitespace fold below collapses the pair to one.
t=t.replace(EZIK_NOTICE_ALL,(_all,label)=>' ['+String(label||'').trim()+'] ');t=t.replace(/\s+/g,' ').trim();return t;};// ============================================================
// Live stream preview: clean prose only — hides all known tags and any leftover "<...>"
// so no raw markup (<surah ...>/<verse ...>) flashes while streaming. Lightweight; display only.
// ============================================================
const formatForStreamPreview=text=>{if(!text)return'';let t=stripIncompleteTags(text);// drops the first unclosed known tag + any truncated trailing "<..."
t=t.replace(/<suggestions[^>]*>[\s\S]*?<\/suggestions>/g,'');t=t.replace(/<verse[^>]*>[\s\S]*?<\/verse>/g,' ');t=t.replace(/<surah[^>]*>[\s\S]*?<\/surah>/g,' ');t=t.replace(/<hadith[^>]*>[\s\S]*?<\/hadith>/g,' ');t=t.replace(/<steps[^>]*>[\s\S]*?<\/steps>/g,' ');t=t.replace(/<source[^>]*>[\s\S]*?<\/source>/g,' ');// hide the source chip (tag + inner title) while streaming
t=t.replace(/<\/?[a-z][^>]*>/gi,' ');// any remaining tag
// S93: horizontal whitespace collapses, NEWLINES SURVIVE. They used to be flattened with
// everything else, which was harmless while the preview was one run of plain text — but the
// preview is laid out now, and a heading, a list item and a table row are all defined by the
// line they sit on. Blank runs are still capped at one, so nothing gapes mid-stream.
t=t.replace(/[^\S\n]+/g,' ');// every whitespace EXCEPT the newline
t=t.replace(/[ \t]*\n[ \t]*/g,'\n');return t.replace(/\n{3,}/g,'\n\n').trim();};// ============================================================
// شخصية الأستاذ (System Prompt) — رحلتْ إلى الخادم (D02ب)
// ============================================================
// كانت تُبنى هنا وتُرسَل في جسدِ كلِّ طلب، فكان النصُّ الحاكمُ لما يُقالُ للطفلِ
// يأتي من العميلِ المحكوم. صارت في lib/system-prompt.js، والعميلُ يرسلُ
// {name, age, gender, mode} لا غير. بوّابةُ systemprompt تمنعُ عودةَ نسخةٍ ثانيةٍ هنا.
// ============================================================
const SUGGESTIONS=['أبغى أحكي لك عن يومي','علمني دعاء جميل','احكي لي قصة من السيرة','كيف أصلي صح؟','ساعدني أحفظ سورة قصيرة'];// ============================================================
// Mode dropdown (header) — dispatch table per the two-kinds-of-mode design.
// with zero structural change. `id` is both the <option> value and the select's value.
// ============================================================
// ============================================================
// التطبيق
// ============================================================
// ============================================================
// S100 -- THE VISUAL IDENTITY. A THIRD KEY, INDEPENDENT OF THE OTHER TWO.
//
// The app now stores three presentational choices, and they do not know about each other:
//   murabbi_theme_v1      light | dark          -- the colour MODE          (readStoredTheme)
//   ezik_ui_style_v1      journey | deck        -- the home/adhkar LAYOUT   (readEzikUiStyle)
//   ezik_visual_theme_v1  qibla_13 | istana_33  -- the visual IDENTITY      (below)
// Not one line in this block reads or writes either of the other two keys, and neither of
// them reads this one, so all eight combinations are reachable and none of them is a special
// case. A user who saved 'deck' last year still gets deck; a user who saved 'light' still
// gets light; both of them now also get an identity, and it is istana_33 until they say
// otherwise. Choosing an identity does not disturb either older choice.
//
// The reader is TOTAL in the same sense readEzikUiStyle is: an absent key, an unknown word, a
// value of the wrong type and a storage that throws all answer istana_33. Every localStorage
// touch has its own try/catch, so a locked or full storage can change what is SAVED and never
// what is SHOWN. There is no migration and nothing to migrate: this key has never existed.
//
// WHERE IT LANDS. The identity is one attribute on <html>, and the stylesheet does the rest
// (see the S100 block in <style>). It is set THREE times, deliberately: by the boot script
// before the first paint so there is no flash of the other identity; by the writer, before it
// saves, so the press repaints on the spot; and by the hook's effect, which is what makes a
// choice made in ANOTHER TAB arrive here -- the 'storage' event fires only in the other tab.
// Applying it is idempotent, so the three paths cannot fight.
// ============================================================
// S102 -- A PRE-RELEASE KEY BUMP, not a migration. ezik_visual_theme_v1 was never deployed:
// the only devices carrying it are the ones this session's own visual tests wrote qibla_13
// onto, which is exactly why the app opened green. v1 is therefore not read, not migrated
// and not honoured -- it is only DELETED, alongside v2, when a user erases their data.
const EZIK_VISUAL_THEME_KEY='ezik_visual_theme_v2';const EZIK_VISUAL_THEME_KEY_V1='ezik_visual_theme_v1';// read by nothing; removed on erase
const EZIK_UI_STYLE_KEY_DEAD='ezik_ui_style_v1';// read by nothing; removed on erase
// qibla_13 keeps its token groundwork in the stylesheet for the next batch, but it is NOT a
// reachable value here: the reader does not accept it, the writer normalises it away and
// Settings offers no control that can produce it.
const EZIK_VISUAL_THEME_ISTANA='istana_33';const EZIK_VISUAL_THEME_DEFAULT=EZIK_VISUAL_THEME_ISTANA;const EZIK_VISUAL_THEME_EVENT='ezik-visual-theme';const EZIK_VISUAL_THEME_ATTR='data-ezik-visual-theme';function readEzikVisualTheme(){let raw=null;try{raw=localStorage.getItem(EZIK_VISUAL_THEME_KEY);}catch(e){return EZIK_VISUAL_THEME_DEFAULT;}if(raw===EZIK_VISUAL_THEME_ISTANA)return raw;return EZIK_VISUAL_THEME_DEFAULT;}function applyEzikVisualTheme(v){const next=v===EZIK_VISUAL_THEME_ISTANA?v:EZIK_VISUAL_THEME_DEFAULT;try{document.documentElement.setAttribute(EZIK_VISUAL_THEME_ATTR,next);}catch(e){}return next;}function writeEzikVisualTheme(v){// paint first, save second: the attribute is what the user sees, and a storage that refuses
// the write must not also refuse the repaint.
const next=applyEzikVisualTheme(v);try{localStorage.setItem(EZIK_VISUAL_THEME_KEY,next);}catch(e){}try{window.dispatchEvent(new CustomEvent(EZIK_VISUAL_THEME_EVENT,{detail:next}));}catch(e){}return next;}function useEzikVisualTheme(){const[vtheme,setVtheme]=useState(readEzikVisualTheme);useEffect(()=>{// Both listeners re-READ rather than trust what they were handed, so an event carrying a
// value this build does not accept still lands on istana_33 instead of on that value.
const onLocal=()=>setVtheme(readEzikVisualTheme());const onStorage=e=>{if(!e||!e.key||e.key===EZIK_VISUAL_THEME_KEY)setVtheme(readEzikVisualTheme());};window.addEventListener(EZIK_VISUAL_THEME_EVENT,onLocal);window.addEventListener('storage',onStorage);return()=>{window.removeEventListener(EZIK_VISUAL_THEME_EVENT,onLocal);window.removeEventListener('storage',onStorage);};},[]);useEffect(()=>{applyEzikVisualTheme(vtheme);},[vtheme]);return vtheme;}// ITEM 97 -- HOME_GREETINGS_GENERAL STOOD HERE, sixteen keys deep, and the day branch below
// picked one of them by the day of the year. The owner’s reading of it: the two adhkar
// windows are «ممتاز» and the rest of the day is idle. So the rest of the day now says
// one thing and that thing LEADS SOMEWHERE, which a rotating pleasantry never did. The two
// window lists below are untouched, byte for byte, and so is the picker they use.
const HOME_GREETINGS_MORNING=['home.greet.morning.1','home.greet.morning.2','home.greet.morning.3','home.greet.morning.4','home.greet.morning.5','home.greet.morning.6','home.greet.morning.7','home.greet.morning.8'];const HOME_GREETINGS_EVENING=['home.greet.evening.1','home.greet.evening.2','home.greet.evening.3','home.greet.evening.4','home.greet.evening.5','home.greet.evening.6','home.greet.evening.7','home.greet.evening.8'];// ITEM 97 -- THE DHIKR ITSELF, AND THE CYCLE THAT ORDERS IT.
// The first reading of this item sent the press to the adhkar screen. THE OWNER REVOKED THAT:
// the press must not leave this screen at all -- it hides the label, puts one short dhikr in
// the same place, and puts the label back five seconds later. So the words have to be here.
//
// WHERE THE WORDS COME FROM. The owner named five and allowed more of the same kind FROM THE
// APP'S OWN ADHKAR TEXT. The two added ones are in adhkar.json, verbatim, with the bracketing
// and the repetition note the store carries around them removed and nothing else changed:
// entry 241 and entry 91. The owner's own five are written the way HE wrote them. Nothing
// devotional is composed, translated or re-ordered here.
//
// NOT A DICTIONARY KEY, deliberately. A dhikr is not interface text with an English
// translation -- it is the same words in every language, and EZ_I18N holds no key whose two
// halves are equal. The LABEL is interface text and stays a key with both halves.
const HOME_DHIKR=['\u0633\u0628\u062D\u0627\u0646 \u0627\u0644\u0644\u0647','\u0627\u0644\u062D\u0645\u062F \u0644\u0644\u0647','\u0623\u0633\u062A\u063A\u0641\u0631 \u0627\u0644\u0644\u0647','\u0644\u0627 \u0625\u0644\u0647 \u0625\u0644\u0627 \u0627\u0644\u0644\u0647','\u0633\u0628\u062D\u0627\u0646 \u0631\u0628\u064A \u0627\u0644\u0639\u0638\u064A\u0645','\u0627\u0644\u0644\u0647 \u0623\u0643\u0628\u0631','\u0633\u0628\u062D\u0627\u0646 \u0627\u0644\u0644\u0647 \u0648\u0628\u062D\u0645\u062F\u0647'];// The label comes back after five seconds. Said once, read twice: the timer and the guard.
const HOME_DHIKR_MS=5000;// A COUNTER, not a random pick. Random repeats, and two identical presses in a row is exactly
// the thing the owner named. It lives on the DEVICE and not in the component, so that leaving
// the home screen and coming back cannot hand a reader the same dhikr twice running -- which a
// counter that reset on mount would do.
const EZIK_DHIKR_CYCLE_KEY='ezik_dhikr_cycle_v1';const nextDhikrSeq=()=>{let n=0;try{const raw=parseInt(localStorage.getItem(EZIK_DHIKR_CYCLE_KEY),10);if(Number.isFinite(raw)&&raw>=0)n=raw;}catch(e){}// wraps well below Number.MAX_SAFE_INTEGER and stays a small string in storage.
try{localStorage.setItem(EZIK_DHIKR_CYCLE_KEY,String((n+1)%1000000));}catch(e){}return n;};const getHomeGreeting=()=>{const now=new Date();const day=Math.floor((Date.now()-new Date(now.getFullYear(),0,0))/86400000);const h=now.getHours();const pick=arr=>arr[day*5%arr.length];if(h>=5&&h<11)return{text:ezT(pick(HOME_GREETINGS_MORNING)),period:'morning',tappable:true};if(h>=16&&h<19)return{text:ezT(pick(HOME_GREETINGS_EVENING)),period:'evening',tappable:true};// Outside the two windows: one line, the dhikr label, and it is TAPPABLE -- but pressing it
// does not navigate: the masthead swaps a dhikr into this same place and back. `period`
// stays 'day' so nothing that branches on the period moves, and the two window branches
// above return exactly what they returned before.
return{text:ezT('home.greet.dhikr'),period:'day',tappable:true};};// ============================================================
// SESSION 86 -- THE APPLICATION HOME, IN TWO STYLES.
// ------------------------------------------------------------
// Home itself stays the OWNER. It holds the profile, it builds the greeting, it keeps every
// real navigation callback it was handed and it resolves the treasure entry to the same href;
// it then hands ONE view object to the one presentation component there now is. S102 removed
// the two legacy home components entirely -- see the S101 block below, which is the whole of
// what draws this screen; the owner is unchanged and still owns everything it owned.
//
// CHROME STRINGS, written as escapes so this block stays ASCII and no editor can reflow a
// bidirectional literal. Every one of them is a label the home screen ALREADY showed, code
// point for code point. No devotional text is authored, moved or read here. (S87 removed
// EZH_QUICK with the duplicated quick-access row it titled -- it has no other reader.)
let EZH_SALAM=ezT("home.salam");// "peace be upon you"
let EZH_HELLO=ezT("home.hello");// "welcome, O"
// S118: EZH_ACCOUNT, EZH_NAV_HOME, EZH_NAV_SET and EZH_BRAND stood here. The emptied top bar
// was the only thing in the file that read any of them, and a reference sweep run after the
// bar was rewritten found no second reader; they are removed rather than left behind as four
// names nothing calls. THE WORDS DID NOT GO ANYWHERE -- the account, the home entry, the
// settings entry and the app's own name are all still on screen, drawn by the menu the bar
// now opens, which reads its own labels. The dictionary keys are untouched: navigation.account,
// navigation.home and navigation.settings are still declared in both languages.
let EZH_NAV_MENU=ezT("navigation.menu");// "the menu"
let EZH_MEMORIZE=ezT("module.memorize");// "the memorizer"
let EZH_ADHKAR=ezT("module.adhkar");// "the adhkar"
let EZH_MUSHAF=ezT("module.mushaf");// "the mushaf"
let EZH_TREASURE=ezT("module.treasure");// "the treasure journey"
let EZH_FATWA=ezT("module.fatwa");// THE REAL MODULE ICONS. Every path below is the path the home screen already drew, moved here
// unchanged and re-stroked in currentColor so it can sit on a soft chip instead of inside a
// filled square. No new artwork, no image, no data URI, nothing fetched.
const EZH_ICON_MEMORIZE=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M4 19.5A2.5 2.5 0 0 1 6.5 17H20"}),/*#__PURE__*/React.createElement("path",{d:"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"}));const EZH_ICON_ADHKAR=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"12",r:"7"}),/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"5",r:"1.5",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"19",cy:"12",r:"1.5",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"19",r:"1.5",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"5",cy:"12",r:"1.5",fill:"currentColor"}));const EZH_ICON_MUSHAF=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M12 6.5C10.5 5 8 4.5 5 5v13c3-.5 5.5 0 7 1.5 1.5-1.5 4-2 7-1.5V5c-3-.5-5.5 0-7 1.5z"}),/*#__PURE__*/React.createElement("path",{d:"M12 6.5v13"}));const EZH_ICON_TREASURE=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"}),/*#__PURE__*/React.createElement("path",{d:"M9 4v14"}),/*#__PURE__*/React.createElement("path",{d:"M15 6v14"}));const EZH_ICON_FATWA=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M5 3h10l4 4v14H5z"}),/*#__PURE__*/React.createElement("path",{d:"M15 3v5h4"}),/*#__PURE__*/React.createElement("circle",{cx:"10",cy:"13",r:"3"}),/*#__PURE__*/React.createElement("path",{d:"M12.2 15.2L15 18"}));// The callout, the profile entry and the three navigation icons -- the same paths as before,
// drawn as LINE icons on white. There is no face and no avatar image in either style.
const EZH_ICON_SUN=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"12",r:"4"}),/*#__PURE__*/React.createElement("path",{d:"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"}));const EZH_ICON_MOON=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"}));// S118: EZH_ICON_PROFILE, EZH_ICON_NAV_HOME, EZH_ICON_NAV_CHAT_LINE and EZH_ICON_NAV_SET stood
// in this block. All four were drawn by the top bar and by nothing else; the menu that took
// over their four actions draws its own paths inline, as it already did before this batch.
// Removed rather than left as artwork nothing renders.
// S101: the card affordance. It is what stops a module card from being an icon and a title
// pushed against one edge with the rest of the card empty -- there is now always something at
// the far end: the real reading when the module has one, and this chevron when it does not.
const EZH_ICON_GO=/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M15 6l-6 6 6 6"}));// S118: the three bars. The SAME three lines the chat's own menu row already draws, at the
// same stroke and the same cap -- no new artwork, no image, no data URI.
// ITEM 108-أ: the qibla tile's mark. Same 24x24 box, same 1.8 stroke, same round caps as the
// five marks beside it — a compass rose reduced to a circle, a needle and its pivot. No new
// artwork file, no image, no data URI.
const EZH_PRAYER='الصلاة والقبلة';const EZH_ICON_PRAYER=/*#__PURE__*/React.createElement("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"12",r:"9"}),/*#__PURE__*/React.createElement("path",{d:"M15.5 8.5 L10.5 10.5 L8.5 15.5 L13.5 13.5 Z"}));const EZH_ICON_MENU=/*#__PURE__*/React.createElement("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("line",{x1:"3",y1:"6",x2:"21",y2:"6"}),/*#__PURE__*/React.createElement("line",{x1:"3",y1:"12",x2:"21",y2:"12"}),/*#__PURE__*/React.createElement("line",{x1:"3",y1:"18",x2:"21",y2:"18"}));// THE FIVE MODULES, preserving the existing order and appending the official fatwa search. S87:
// this builder is now
// called in EXACTLY ONE PLACE -- the Home owner below -- and the resulting array is handed to
// whichever style draws it as `v.modules`. A presentation component may not build, extend,
// reorder or re-render this list; it maps it once. Each descriptor carries the stable `id` that
// becomes data-ezik-home-module on the one element that renders it, so counting those elements
// counts the modules. `meta` is a genuine local reading or it is null.
function ezHomeModules(v){const wird=v.wird?toArabicDigits(v.wird.done)+' / '+toArabicDigits(v.wird.target):null;return[{id:'memorize',label:EZH_MEMORIZE,icon:EZH_ICON_MEMORIZE,onClick:v.onOpenMemorize,meta:null},{id:'adhkar',label:EZH_ADHKAR,icon:EZH_ICON_ADHKAR,onClick:v.onOpenAdhkar,meta:null},{id:'mushaf',label:EZH_MUSHAF,icon:EZH_ICON_MUSHAF,onClick:v.onOpenMushaf,meta:wird},{id:'treasure',label:EZH_TREASURE,icon:EZH_ICON_TREASURE,onClick:v.onOpenTreasure,meta:null},{id:'fatwa',label:EZH_FATWA,icon:EZH_ICON_FATWA,onClick:v.onOpenFatwa,meta:null},{id:'prayer',label:EZH_PRAYER,icon:EZH_ICON_PRAYER,onClick:v.onOpenPrayer,meta:null}];}// ---- S101 ISTANA HOME START --------------------------------------------------------------
// THE ISTANA_33 HOME. A DEDICATED STRUCTURE, not the journey/deck layout in other colours.
//
// What this is NOT: it is not a third value of ezik_ui_style_v1. That key keeps its two words,
// its default and every saved value byte for byte, and journey/deck still draw the home for
// qibla_13 exactly as they did. What changed is that the IDENTITY now decides the structure:
// under istana_33 the owner hands its one view object to this component instead. A device that
// saved "deck" years ago still has "deck" in storage, still gets the deck under qibla_13, and
// is not silently migrated -- it simply does not see a stacked deck while istana_33 is on.
//
// PRESENTATION ONLY, on the same terms as the two components above it: it reads no storage,
// owns no navigation state, routes nothing, builds no module list and invents no progress. It
// receives v.modules -- the owner's single array -- and maps it ONCE, in the array's own order,
// so the reading order, the tab order and the data order are one order. Every handler is the
// one it was handed: onOpenMenu, onOpenMemorize, onOpenAdhkar, onOpenMushaf, onOpenSettings,
// onOpenTreasure and onOpenFatwa are called, never re-derived, so no destination and no history
// behaviour moves. (S118: onOpenChat left this list with the bar that was its only caller --
// the chat is entered from the menu onOpenMenu opens.)
//
// THE FIVE STRINGS BELOW are the only module chrome: one short descriptive line per module, so no
// card is a large empty box with an icon in it. None of them is devotional text, none is read
// from adhkar.json or the mushaf, and not one of them claims a number about the reader.
let EZIST_SUB_MEMORIZE=ezT("module.memorize.sub");// "memorise and review"
let EZIST_SUB_ADHKAR=ezT("module.adhkar.sub");// "morning and evening adhkar"
let EZIST_SUB_MUSHAF=ezT("module.mushaf.sub");// "read, and follow your wird"
let EZIST_SUB_TREASURE=ezT("module.treasure.sub");// "learn through play"
let EZIST_SUB_FATWA=ezT("module.fatwa.sub");let EZIST_SUB_PRAYER='المواقيت والقبلة، محسوبةً على هذا الجهاز';let EZIST_SUB={memorize:EZIST_SUB_MEMORIZE,adhkar:EZIST_SUB_ADHKAR,mushaf:EZIST_SUB_MUSHAF,treasure:EZIST_SUB_TREASURE,fatwa:EZIST_SUB_FATWA,prayer:EZIST_SUB_PRAYER};// THE TOP NAVIGATION. TWO ELEMENTS AND NO THIRD -- the daily verse, and the menu button.
//
// WHAT WAS HERE, and where each piece went. The bar carried five things: a home button that was
// already on the screen it pointed at and so had no handler at all; a chat icon; the centred
// brand; a settings icon; and a profile icon whose onClick was CHARACTER FOR CHARACTER the
// settings icon's -- two controls, one destination. Not one of them is lost:
//   home     -> the menu's «القائمة» row, which is what it always was
//   chat     -> the menu's «محادثة جديدة» row, which now navigates as well as resets
//   settings -> the menu's pinned row, already labelled «الإعدادات»
//   profile  -> the SAME pinned row; it was the same destination before this batch
//   brand    -> the menu's own head, which draws the identical mark and word
// A function that disappears quietly is a defect, not a tidy-up, so each of the five was walked
// to its destination and driven there before this bar was emptied.
//
// THE MENU IT OPENS IS THE CHAT'S MENU. Not a second drawer built for the home: App owns
// drawerOpen, openDrawer and closeDrawerWith, and the panel is now rendered from one place that
// both screens draw. There is one history entry, one search box, one conversation list.
//
// THE VERSE IS A DISPLAY AND NOTHING ELSE. It is the same EzistQuranPanel, reading the same
// getDailyVerse() and printing the same text verbatim; it carries no handler, no role and no
// tabindex, and pressing it does nothing, deliberately.
//
// THE MENU BUTTON IS FIRST, and first is the RIGHT: the document lays out RTL (body carries
// direction:rtl in the sheet, which outranks any dir attribute), so the leading edge of this
// flex row is the right edge and the first child is what sits on it. The button used to be
// second and therefore on the left, which is the trailing edge and the wrong side of an Arabic
// bar. NOTHING ELSE MOVED: .ezist-nav-inner is the same space-between row, the verse still
// takes the width the button leaves (flex:1 1 auto, min-width:0), and the verse itself -- its
// component, its source, its text, its label and its rule -- is not touched by this.
//
// AND IT IS THE DOM ORDER, NOT `order` AND NOT `row-reverse`. Either of those would put the
// button on the right while leaving it second in the tree, so what a screen reader announces
// and what the tab ring visits would run against what the eye reads. The composition block
// states that no `order` property is used anywhere in it and that tab order follows what is on
// screen; moving the element is what keeps that true.
function EzistTopNav({onOpenMenu}){return/*#__PURE__*/React.createElement("div",{className:"ezist-nav"},/*#__PURE__*/React.createElement("div",{className:"ezist-nav-inner"},/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus",onClick:onOpenMenu,style:s.ezistNavBtn,"aria-label":EZH_NAV_MENU},EZH_ICON_MENU),/*#__PURE__*/React.createElement(EzistQuranPanel,null)));}// THE MASTHEAD. The arch is the approved signature radius and nothing else; the tulip is three
// bounded boxes inside a 34x40 span inside a clipped section, so it cannot become a page motif.
// The greeting and the daily line are the ones the app already picked -- getHomeGreeting() ran
// once in the owner, and this draws its text. The two adhkar windows stay buttons to the
// adhkar screen; the day line is a button too, and what it does is replace its own text.
function EzistMasthead({name,g,hijri,onOpenAdhkar}){const tap=!!(g&&g.tappable);// ITEM 97 -- THE PRESS STAYS ON THIS SCREEN. The morning and evening lines are untouched:
// same string, same onOpenAdhkar, same rect. Only the DAY line is different, and what it
// does is replace itself -- the label out, one dhikr in, and the label back after five
// seconds. It navigates nowhere, so nothing here is handed a second destination.
const isDay=!!(g&&g.period==='day');const[dhikr,setDhikr]=useState(null);// null = the line is showing its label
// ONE TIMER, NEVER TWO. A press while a dhikr is up clears the timer it finds before it
// starts the next one, so the five seconds always belong to the LAST press. The unmount
// does the same, so a reader who leaves mid-dhikr leaves no timer behind to set state on a
// component that is gone.
const dhikrTimer=useRef(null);useEffect(()=>()=>{if(dhikrTimer.current)clearTimeout(dhikrTimer.current);},[]);const showNextDhikr=()=>{if(dhikrTimer.current){clearTimeout(dhikrTimer.current);dhikrTimer.current=null;}setDhikr(HOME_DHIKR[nextDhikrSeq()%HOME_DHIKR.length]);dhikrTimer.current=setTimeout(()=>{dhikrTimer.current=null;setDhikr(null);},HOME_DHIKR_MS);};const go=isDay?showNextDhikr:onOpenAdhkar;// THE LINE ON SCREEN. One expression, so the button, its accessible name and its text can
// never disagree about what it is saying.
const line=isDay&&dhikr?dhikr:g?g.text:'';return/*#__PURE__*/React.createElement("section",{className:"ezist-masthead"},/*#__PURE__*/React.createElement("div",{className:"ezist-hello"},/*#__PURE__*/React.createElement("div",{style:s.ezistSalam},EZH_SALAM),/*#__PURE__*/React.createElement("h1",{style:s.ezistName},EZH_HELLO," ",name),hijri?/*#__PURE__*/React.createElement("div",{style:s.ezistHijri},hijri):null),/*#__PURE__*/React.createElement("span",{className:"ezist-rule-short","aria-hidden":"true"}),tap?/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus",onClick:go,style:isDay?{...s.ezistPrompt,...s.ezistPromptDay}:s.ezistPrompt,"aria-label":line},/*#__PURE__*/React.createElement("span",{style:s.ezistPromptIcon,"aria-hidden":"true"},g.period==='morning'?EZH_ICON_SUN:EZH_ICON_MOON),/*#__PURE__*/React.createElement("span",{style:s.ezistPromptText},line)):/*#__PURE__*/React.createElement("div",{style:s.ezistPromptFlat},/*#__PURE__*/React.createElement("span",{style:s.ezistPromptIcon,"aria-hidden":"true"},g.period==='morning'?EZH_ICON_SUN:EZH_ICON_MOON),/*#__PURE__*/React.createElement("span",{style:s.ezistPromptText},g.text)));}// ONE MODULE, drawn from the descriptor's own stable id, so the data decides the treatment and
// not a second list: the mushaf keeps its wide feature treatment and remains the
// wide feature and the only card that can carry a real reading, the adhkar card takes the coral
// highlight, the memorizer takes an Iznik rule and the treasure card sits on the tinted surface.
// Every card carries an icon, a title AND a line of text, which is what stops any of them from
// being a large empty box at a desktop width.
function EzistModuleCard({m}){const feature=m.id==='mushaf';return/*#__PURE__*/React.createElement("button",{type:"button",className:'ezhome-focus ezist-'+(feature?'feature':'mod ezist-mod-'+m.id),onClick:m.onClick,"data-ezik-home-module":m.id,style:feature?s.ezistFeature:{...s.ezistCard,...(s['ezistCard_'+m.id]||null)}},/*#__PURE__*/React.createElement("span",{style:feature?s.ezistFeatureIcon:s.ezistCardIcon,"aria-hidden":"true"},m.icon),/*#__PURE__*/React.createElement("span",{style:s.ezistCardBody},/*#__PURE__*/React.createElement("span",{style:feature?s.ezistFeatureTitle:s.ezistCardTitle},m.label),/*#__PURE__*/React.createElement("span",{style:s.ezistCardSub},EZIST_SUB[m.id])),m.meta?/*#__PURE__*/React.createElement("span",{style:s.ezistMeta},m.meta):/*#__PURE__*/React.createElement("span",{style:s.ezistGo,"aria-hidden":"true"},EZH_ICON_GO));}// THE CHAT ENTRY. There is still exactly ONE, and it is no longer on this screen's chrome at
// all: the bar's menu button opens the chat's own menu, and «محادثة جديدة» there is the entry.
// That row was already the app's single new-conversation control; S118 only made it navigate as
// well as reset, so it does from the home what it always did from the chat. The large "ask Ezik"
// panel that used to sit at the head of the mosaic went in S117, for the reason that still
// governs: two controls on one screen doing the identical thing is a choice the reader should
// not have to make.
// THE FEATURED QURAN PANEL. It reads getDailyVerse() -- the one source for the daily verse --
// and renders {v.text} verbatim -- no transform, no tashkeel pass, no truncation, no ellipsis.
// The two decorative marks are OUTSIDE the text block, in the head row beside the label, so
// nothing overlaps a letter of it. Nothing here touches mushaf page artwork.
// ITEM 98: the 1px hairline that used to sit between that head row and the verse is gone --
// «لا داعيَ له». It was .ezist-rule, one element and two rules in the sheet, and the
// element was its only reader, so all three went together. The OTHER separator on this
// screen, .ezist-rule-short -- the short vertical bar in the masthead -- is a different
// class on a different element and is deliberately untouched.
function EzistQuranPanel(){const v=getDailyVerse();const isHadith=v.surah==='\u062D\u062F\u064A\u062B';return/*#__PURE__*/React.createElement("section",{className:"ezist-quran",style:s.ezistQuran},/*#__PURE__*/React.createElement("div",{style:s.ezistQuranHead},/*#__PURE__*/React.createElement("span",{style:s.ezistQuranLabel},isHadith?ezT('home.hadithOfDay2'):ezT('home.verseOfDay2'))),/*#__PURE__*/React.createElement("div",{style:s.ezistQuranText},v.text),/*#__PURE__*/React.createElement("div",{style:s.ezistQuranMeta},isHadith?'\u0631\u0648\u0627\u0647 '+v.ayah:'\u0633\u0648\u0631\u0629 '+v.surah+'\u060C \u0622\u064A\u0629 '+v.ayah));}function EzikIstanaHome(v){const mods=v.modules||[];// the owner's one array, mapped once, in its own order
return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome",style:s.ezistContainer},/*#__PURE__*/React.createElement(EzistTopNav,{onOpenMenu:v.onOpenMenu}),/*#__PURE__*/React.createElement("div",{style:s.ezistScroll},/*#__PURE__*/React.createElement("div",{className:"ezist-wrap"},/*#__PURE__*/React.createElement(EzistMasthead,{name:v.name,g:v.greeting,hijri:v.hijri,onOpenAdhkar:v.onOpenAdhkar}),/*#__PURE__*/React.createElement("div",{className:"ezist-mosaic"},mods.map(m=>/*#__PURE__*/React.createElement(EzistModuleCard,{key:m.id,m:m}))))));}// ---- S101 ISTANA HOME END ----------------------------------------------------------------
function Home({profile,onOpenMenu,onOpenMemorize,onOpenAdhkar,onOpenMushaf,onOpenFatwa,onOpenSettings}){// THE OWNER. Every prop it was handed is handed straight on, and the treasure entry resolves
// to the same href it always did. There is no second router here and no duplicated navigation
// state -- the two components above receive these handlers and call them unchanged.
const g=getHomeGreeting();// GENUINE local progress, or nothing at all. These are the MUSHAF'S OWN helpers reading the
// mushaf's own keys, so the numbers are ones the reader itself wrote; when no real daily
// target is stored the line is absent rather than invented, and no other module on this
// screen claims progress of any kind. Nothing here writes, and nothing here transmits.
// ITEM 108-أ: the sheet's one piece of state. It is not a route: see PrayerSheet.
const[prayerOpen,setPrayerOpen]=useState(false);const wt=readWirdTarget();const wd=readWirdDay();const wird=wt&&wd&&Array.isArray(wd.pages)?{done:Math.min(wd.pages.length,wt),target:wt}:null;// ITEM 109: the same discipline as the wird above — the OWNER reads the device, the
// presentation components are handed the result. An empty string when the conversion could
// not be made, so the masthead draws nothing rather than a wrong day.
const hijri=hijriTodayLabel();const view={name:profile?.name,hijri:hijri,greeting:g,wird:wird,// S118: onOpenChat is gone from this object because the home no longer holds a chat
// control of its own. The chat is entered from the menu the bar opens, on the menu's own
// «محادثة جديدة» row, which is the app's ONE new-conversation entry and always was.
onOpenMenu:onOpenMenu,onOpenMemorize:onOpenMemorize,onOpenAdhkar:onOpenAdhkar,onOpenMushaf:onOpenMushaf,onOpenFatwa:onOpenFatwa,onOpenSettings:onOpenSettings,onOpenTreasure:()=>{window.location.href='/quest.html';},onOpenPrayer:()=>setPrayerOpen(true)};// S87 -- THE MODULE SET IS BUILT HERE, ONCE, AND NOWHERE ELSE. Both styles receive this exact
// array; neither may call ezHomeModules itself. One descriptor per module means one rendered
// element per module, whichever style is on -- there is no second collection to fall out of
// sync with this one, and no second callback bound to the same action.
const home={...view,modules:ezHomeModules(view)};// S102 -- ONE DESIGN. The journey/deck presentation system is gone from the file, not
// hidden behind a flag: its two home components, its three shared parts, its key, its
// reader, its writer, its hook, its event and its Settings control were all removed in the
// same commit as this line, and a reference sweep proved every one of them dead first. A
// stale ezik_ui_style_v1 value may still sit in a user's storage; nothing reads it, so it
// cannot make a legacy screen reachable. There is exactly one home now.
// S101 -- THE IDENTITY DECIDES THE STRUCTURE. istana_33 is a design, not a palette laid
// over the older one, so it gets its own component and neither legacy home is constructed
// for it. The layout key is still read above and still stored: a device that saved "deck"
// keeps "deck", is not migrated, and sees the deck again the moment it selects qibla_13.
// qibla_13 is untouched by this batch and still chooses between the two components below.
if(prayerOpen)return/*#__PURE__*/React.createElement(PrayerSheet,{onClose:()=>setPrayerOpen(false)});return/*#__PURE__*/React.createElement(EzikIstanaHome,home);}// ============================================================
// OFFICIAL FATWA SEARCH -- READ ONLY
// ============================================================
// The browser speaks only to Ezik's own /api/v1 contract. vercel.json rewrites that path to
// the fixed, bounded server-side proxy; the second service is never contacted by the client.
// Search still asks for the same complete official record and never calls a model.
const EZIK_FATWA_API_BASE='';async function ezikFatwaFetch(path,signal){const response=await fetch(EZIK_FATWA_API_BASE+path,{method:'GET',headers:{Accept:'application/json'},signal});let payload=null;try{payload=await response.json();}catch(e){}if(!response.ok||!payload||payload.ok!==true){const code=payload&&payload.error&&payload.error.code;throw new Error(code||'fatwa_http_'+response.status);}return payload;}const EZIK_FATWA_ACTIONS=[['simplify','fatwa.action.simplify'],['example','fatwa.action.example'],['explain','fatwa.action.explain'],['quiz','fatwa.action.quiz']];function ezikFatwaNumber(value){try{return Number(value).toLocaleString(ezLangGet()==='ar'?'ar':'en');}catch(e){return String(value);}}function ezikFatwaPublicUrl(value){try{const url=new URL(String(value||''));return url.protocol==='https:'||url.protocol==='http:'?url.href:'';}catch(e){return'';}}// Item 86: the card can now be SAVED. It writes through the module-level store rather than
// through the chat's state, because الفتاوى is not inside the chat and must not be handed the
// chat's setter. The store announces on write, so المفضلة and the chat both re-read.
function EzikFatwaResult({fatwa,favPk}){const content=fatwa&&fatwa.content||{};const question=content.question||'';const answer=content.answer||content.answerExcerpt||'';const audio=fatwa&&fatwa.audio||{};const scholar=fatwa&&fatwa.scholar||{};const source=fatwa&&fatwa.source||{};const sourceUrl=ezikFatwaPublicUrl(source.canonicalUrl||source.url);const audioUrl=ezikFatwaPublicUrl(audio.url);// A machine transcript of the scholar's own clip is neither a written fatwa nor
// a published text, so it is never shown as one: it is labelled, its notice is
// printed above the words, and the clip it came from is offered as the original.
const isTranscript=content.type==='auto_transcript_official_video';// WHAT IS SAVED IS WHAT IS SHOWN: the question and the answer as this card has them, so a
// saved fatwa stays readable if the service is unreachable later -- the same reason a saved
// reply carries its own copy of the text.
const favText=(question?question+'\n\n':'')+answer;const favRec=React.useMemo(()=>ezikMakeFavOf('fatwa',favPk,fatwa&&fatwa.uid,fatwa&&fatwa.title,favText),[favPk,fatwa,favText]);const[saved,setSaved]=useState(false);useEffect(()=>{const read=()=>{try{setSaved(ezikReadFavs().some(f=>f.id===favRec.id));}catch(e){}};read();try{window.addEventListener(EZIK_FAVS_EVENT,read);}catch(e){}return()=>{try{window.removeEventListener(EZIK_FAVS_EVENT,read);}catch(e){}};},[favRec.id]);return/*#__PURE__*/React.createElement("article",{className:"ezf-card"},/*#__PURE__*/React.createElement("header",{className:"ezf-card-head"},/*#__PURE__*/React.createElement("h2",{className:"ezf-title"},fatwa.title),/*#__PURE__*/React.createElement("div",{className:"ezf-meta"},/*#__PURE__*/React.createElement("span",{className:"ezf-tag"},scholar.shortName||scholar.name||ezT('fatwa.defaultScholar')),/*#__PURE__*/React.createElement("span",null,isTranscript?ezT('fatwa.transcriptTag'):audio.available?ezT('fatwa.audioAvailable'):ezT('fatwa.textOnly')))),isTranscript?/*#__PURE__*/React.createElement("p",{className:"ezf-notice"},ezT('fatwa.transcriptNotice')):null,isTranscript?/*#__PURE__*/React.createElement("h3",{className:"ezf-section-title"},ezT('fatwa.transcriptBody')):question?/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("h3",{className:"ezf-section-title"},ezT('fatwa.question')),/*#__PURE__*/React.createElement("p",{className:"ezf-copy"},question),/*#__PURE__*/React.createElement("h3",{className:"ezf-section-title"},ezT('fatwa.answer'))):/*#__PURE__*/React.createElement("h3",{className:"ezf-section-title"},ezT('fatwa.officialText')),/*#__PURE__*/React.createElement("p",{className:"ezf-copy"},answer),audio.available&&audioUrl?/*#__PURE__*/React.createElement("audio",{className:"ezf-audio",controls:true,preload:"none",src:audioUrl,"aria-label":ezT('fatwa.audioAria')}):null,sourceUrl?/*#__PURE__*/React.createElement("a",{className:"ezhome-focus ezf-source",href:sourceUrl,target:"_blank",rel:"noopener noreferrer"},isTranscript?ezT('fatwa.watchVideo'):ezT('fatwa.source')):null,/*#__PURE__*/React.createElement("div",{className:"ezf-actions"},favPk?/*#__PURE__*/React.createElement("button",{type:"button",className:"ezf-action ezik-focus","aria-pressed":saved?'true':'false',"aria-label":saved?ezT('favorites.remove'):ezT('favorites.addFatwa'),onClick:()=>setSaved(ezikToggleFavRecord(favRec))},saved?ezT('favorites.saved'):ezT('favorites.addFatwa')):null,EZIK_FATWA_ACTIONS.map(([id,key])=>/*#__PURE__*/React.createElement("button",{key:id,type:"button",className:"ezf-action",disabled:true,"aria-disabled":"true",title:ezT('fatwa.action.disabled')},ezT(key)))));}// THE WHOLE SHELF, NOT ONLY WHAT WAS SEARCHED FOR. Picking a scholar -- or "all fatwas",
// which is the selector's own first entry and not a scholar -- lists every fatwa there is,
// alphabetically, ten to a page. The search box never leaves: it stays above the list and
// works the same in either mode, and leaving a search puts the reader back on the page of
// the shelf they were standing on, because the browse state is never thrown away.
//
// Not one character of this list is authored here. Ordering, paging and totals are the
// service's answer; this screen renders it and calls no model, exactly as search does.
const EZIK_FATWA_ALL='all';const EZIK_FATWA_PAGE_SIZE='10';// THE SELECTOR REMEMBERS WHO IT LISTED LAST TIME. The registry answer is one network
// round trip away -- measured at ~1.2s warm and ~2.9s on a cold function -- and until it
// lands the selector can only offer its seed. So the last good list is kept the way the
// mushaf keeps its position, and drawn immediately on the next open while the live
// request revalidates behind it. Same refusal to guess as readMushafLastPage: no key,
// damaged JSON, a non-array, an empty array or a malformed entry all return null, and the
// screen falls back to the seed exactly as it did before this cache existed.
const EZIK_FATWA_SCHOLARS_KEY='ezik_fatwa_scholars_v1';function readCachedScholars(){let raw=null;try{raw=localStorage.getItem(EZIK_FATWA_SCHOLARS_KEY);}catch(e){return null;}if(!raw)return null;let o=null;try{o=JSON.parse(raw);}catch(e){return null;}if(!Array.isArray(o)||!o.length)return null;const list=[];for(const item of o){if(!item||typeof item!=='object')return null;if(typeof item.id!=='string'||!item.id)return null;if(typeof item.shortName!=='string'||!item.shortName)return null;list.push({id:item.id,shortName:item.shortName});}return list;}function writeCachedScholars(list){try{localStorage.setItem(EZIK_FATWA_SCHOLARS_KEY,JSON.stringify(list));}catch(e){}}function FatwaScreen({onBack,favPk}){const[scholars,setScholars]=useState(()=>readCachedScholars()||[{id:'binbaz',shortName:''}]);// THE SCREEN OPENS ON EVERYTHING. "All fatwas" is the opening selection, so the first thing
// a reader sees is page one of the whole alphabet rather than one scholar's shelf; narrowing
// to a single scholar is one choice away in the same selector. It is not a scholar, so it
// needs no registry entry and survives a registry that never answers -- and Ibn Baz stays
// first among the named scholars, exactly where he was.
const[scholar,setScholar]=useState(EZIK_FATWA_ALL);const[query,setQuery]=useState('');const[lastQuery,setLastQuery]=useState('');const[results,setResults]=useState([]);const[pagination,setPagination]=useState(null);const[searched,setSearched]=useState(false);const[loading,setLoading]=useState(false);const[failed,setFailed]=useState(false);const searchRequest=useRef(null);const[browsing,setBrowsing]=useState([]);const[browsePages,setBrowsePages]=useState(null);const[browseLoading,setBrowseLoading]=useState(false);const[browseFailed,setBrowseFailed]=useState(false);const[openUid,setOpenUid]=useState('');const browseRequest=useRef(null);// The selector is fed by the registry so Ibn Uthaymeen can be added server-side later. Until
// that first response arrives, Ibn Baz is already selectable; a registry failure adds no
// warning panel to the deliberately spare empty screen.
useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);ezikFatwaFetch('/api/v1/scholars',controller.signal).then(payload=>{const list=Array.isArray(payload.scholars)?payload.scholars.filter(item=>item&&item.id&&(item.shortName||item.name)):[];if(!list.length)return;const next=list.map(item=>({id:String(item.id),shortName:String(item.shortName||item.name)}));setScholars(next);writeCachedScholars(next);setScholar(current=>current===EZIK_FATWA_ALL||list.some(item=>String(item.id)===current)?current:String(list[0].id));}).catch(()=>{}).finally(()=>clearTimeout(timer));return()=>{clearTimeout(timer);controller.abort();};},[]);useEffect(()=>()=>{if(searchRequest.current)searchRequest.current.abort();if(browseRequest.current)browseRequest.current.abort();},[]);// The shelf is fetched for whatever is selected, including the moment the screen opens, so
// a reader who has typed nothing still has something to read. A failure here leaves the
// search box exactly as usable as it was.
const runBrowse=async page=>{if(browseRequest.current)browseRequest.current.abort();const controller=new AbortController();browseRequest.current=controller;const timer=setTimeout(()=>controller.abort(),60000);setBrowseLoading(true);setBrowseFailed(false);setOpenUid('');const params=new URLSearchParams({scholar,page:String(page||1),limit:EZIK_FATWA_PAGE_SIZE,view:'full'});try{const payload=await ezikFatwaFetch('/api/v1/fatwas/browse?'+params.toString(),controller.signal);if(browseRequest.current!==controller)return;setBrowsing(Array.isArray(payload.results)?payload.results:[]);setBrowsePages(payload.pagination||{page:1,total:0,totalPages:0,hasPrevious:false,hasNext:false});}catch(error){if(browseRequest.current!==controller)return;setBrowsing([]);setBrowsePages(null);setBrowseFailed(true);}finally{clearTimeout(timer);if(browseRequest.current===controller){browseRequest.current=null;setBrowseLoading(false);}}};useEffect(()=>{runBrowse(1);},[scholar]);const runSearch=async(page,fixedQuery)=>{const term=String(fixedQuery==null?query:fixedQuery).trim();if(!term||loading)return;if(searchRequest.current)searchRequest.current.abort();const controller=new AbortController();searchRequest.current=controller;const timer=setTimeout(()=>controller.abort(),60000);setLastQuery(term);setSearched(true);setLoading(true);setFailed(false);setResults([]);setPagination(null);const params=new URLSearchParams({q:term,scholar,page:String(page||1),limit:'10',view:'full'});try{const payload=await ezikFatwaFetch('/api/v1/fatwas/search?'+params.toString(),controller.signal);if(searchRequest.current!==controller)return;setResults(Array.isArray(payload.results)?payload.results:[]);setPagination(payload.pagination||{page:1,total:0,totalPages:0,hasPrevious:false,hasNext:false});}catch(error){if(searchRequest.current!==controller)return;setFailed(true);}finally{clearTimeout(timer);if(searchRequest.current===controller){searchRequest.current=null;setLoading(false);}}};const selectScholar=event=>{setScholar(event.target.value);setResults([]);setPagination(null);setSearched(false);setFailed(false);};// Leaving a search restores the shelf rather than reloading it: the page the reader was on
// is still in state, so the way back is instant and lands exactly where they left.
const backToBrowse=()=>{if(searchRequest.current)searchRequest.current.abort();searchRequest.current=null;setResults([]);setPagination(null);setSearched(false);setFailed(false);setLoading(false);};let status=null;let statusFailed=false;if(searched){if(loading)status=ezT('fatwa.loading');else if(failed){status=ezT('fatwa.error');statusFailed=true;}else if(pagination&&pagination.total===0)status=ezT('fatwa.none');else if(pagination&&pagination.total>0){status=ezT('fatwa.summary',{total:ezikFatwaNumber(pagination.total),page:ezikFatwaNumber(pagination.page),pages:ezikFatwaNumber(pagination.totalPages)});}}else if(browseLoading)status=ezT('fatwa.browseLoading');else if(browseFailed){status=ezT('fatwa.error');statusFailed=true;}else if(browsePages&&browsePages.total===0)status=ezT('fatwa.browseEmpty');else if(browsePages){status=ezT('fatwa.browseSummary',{total:ezikFatwaNumber(browsePages.total),page:ezikFatwaNumber(browsePages.page),pages:ezikFatwaNumber(browsePages.totalPages)});}return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezf",style:s.ezfContainer},/*#__PURE__*/React.createElement("div",{className:"ezsh-nav"},/*#__PURE__*/React.createElement("div",{className:"ezsh-nav-inner"},/*#__PURE__*/React.createElement("div",{className:"ezsh-nav-side"},/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus",onClick:onBack,style:s.ezshNavBtn,"aria-label":ezT('common.back')},A2_ICON_BACK)),/*#__PURE__*/React.createElement("span",{"aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{className:"ezsh-nav-side is-end"}))),/*#__PURE__*/React.createElement("div",{style:s.ezshScroll},/*#__PURE__*/React.createElement("main",{className:"ezf-wrap"},/*#__PURE__*/React.createElement("form",{className:"ezf-controls",role:"search",onSubmit:event=>{event.preventDefault();runSearch(1);}},/*#__PURE__*/React.createElement("label",{className:"ezf-field",htmlFor:"ezf-scholar"},/*#__PURE__*/React.createElement("span",{className:"ezf-label"},ezT('fatwa.scholarLabel')),/*#__PURE__*/React.createElement("select",{id:"ezf-scholar",className:"ezhome-focus ezf-select",value:scholar,onChange:selectScholar},/*#__PURE__*/React.createElement("option",{value:EZIK_FATWA_ALL},ezT('fatwa.allScholars')),scholars.map(item=>/*#__PURE__*/React.createElement("option",{key:item.id,value:item.id},item.shortName||ezT('fatwa.defaultScholar'))))),/*#__PURE__*/React.createElement("div",{className:"ezf-search"},/*#__PURE__*/React.createElement("input",{className:"ezhome-focus ezf-input",type:"search",dir:"auto",required:true,maxLength:"180",value:query,onChange:event=>setQuery(event.target.value),placeholder:ezT('fatwa.searchPlaceholder'),"aria-label":ezT('fatwa.searchAria')}),/*#__PURE__*/React.createElement("button",{type:"submit",className:"ezhome-focus ezf-submit",disabled:loading},ezT('fatwa.searchButton')))),status?/*#__PURE__*/React.createElement("div",{className:'ezf-status'+(statusFailed?' is-error':''),role:statusFailed?'alert':'status',"aria-live":"polite"},status):null,searched?/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus ezf-back",onClick:backToBrowse},ezT('fatwa.backToBrowse')),results.length?/*#__PURE__*/React.createElement("section",{className:"ezf-results","aria-label":ezT('fatwa.searchAria')},results.map(fatwa=>/*#__PURE__*/React.createElement(EzikFatwaResult,{key:fatwa.uid,fatwa:fatwa,favPk:favPk}))):null):browsing.length?/*#__PURE__*/React.createElement("section",{className:"ezf-list","aria-label":ezT('fatwa.browseAria')},browsing.map(fatwa=>{const isOpen=openUid===fatwa.uid;const named=fatwa.scholar&&(fatwa.scholar.shortName||fatwa.scholar.name)||'';return/*#__PURE__*/React.createElement(React.Fragment,{key:fatwa.uid},/*#__PURE__*/React.createElement("button",{type:"button","aria-expanded":isOpen,className:'ezhome-focus ezf-row'+(isOpen?' is-open':''),title:isOpen?ezT('fatwa.closeFatwa'):ezT('fatwa.openFatwa'),onClick:()=>setOpenUid(isOpen?'':fatwa.uid)},/*#__PURE__*/React.createElement("span",{className:"ezf-row-title"},fatwa.title),scholar===EZIK_FATWA_ALL&&named?/*#__PURE__*/React.createElement("span",{className:"ezf-row-mark"},named):null),isOpen?/*#__PURE__*/React.createElement("div",{className:"ezf-open"},/*#__PURE__*/React.createElement(EzikFatwaResult,{fatwa:fatwa,favPk:favPk})):null);})):null,searched&&pagination&&pagination.totalPages>1?/*#__PURE__*/React.createElement("nav",{className:"ezf-pager","aria-label":ezT('fatwa.page',{page:ezikFatwaNumber(pagination.page),pages:ezikFatwaNumber(pagination.totalPages)})},/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus ezf-page-btn",disabled:loading||!pagination.hasPrevious,onClick:()=>runSearch(pagination.page-1,lastQuery)},ezT('fatwa.previous')),/*#__PURE__*/React.createElement("span",{className:"ezf-page-text"},ezT('fatwa.page',{page:ezikFatwaNumber(pagination.page),pages:ezikFatwaNumber(pagination.totalPages)})),/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus ezf-page-btn",disabled:loading||!pagination.hasNext,onClick:()=>runSearch(pagination.page+1,lastQuery)},ezT('fatwa.next'))):null,!searched&&browsePages&&browsePages.totalPages>1?/*#__PURE__*/React.createElement("nav",{className:"ezf-pager","aria-label":ezT('fatwa.page',{page:ezikFatwaNumber(browsePages.page),pages:ezikFatwaNumber(browsePages.totalPages)})},/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus ezf-page-btn",disabled:browseLoading||!browsePages.hasPrevious,onClick:()=>runBrowse(browsePages.page-1)},ezT('fatwa.previous')),/*#__PURE__*/React.createElement("span",{className:"ezf-page-text"},ezT('fatwa.page',{page:ezikFatwaNumber(browsePages.page),pages:ezikFatwaNumber(browsePages.totalPages)})),/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus ezf-page-btn",disabled:browseLoading||!browsePages.hasNext,onClick:()=>runBrowse(browsePages.page+1)},ezT('fatwa.next'))):null)));}// ============================================================
// EZIK ADHKAR UI V2 -- the premium Arabic RTL redesign of the adhkar browse screen.
// ------------------------------------------------------------
// THE SWITCH, and it has the same shape as MADINA_IMG_ON below: the parameter ANSWERS
// rather than merely writing, so an explicit '1' or '0' returns straight from the URL and
// never consults storage at all. A stale key, a value some other build wrote, a quota-full
// setItem or a storage that throws cannot make ?adhkarui=0 keep V2 on or ?adhkarui=1 keep
// it off. The write is still attempted, in its own try/catch, so the answer survives the
// next visit without the parameter -- but the write failing changes nothing about THIS visit.
//
//   no adhkarui parameter -> V2   (unless this device stored an explicit refusal)
//   ?adhkarui=1           -> V2
//   ?adhkarui=0           -> V1   (the S13.3-A screen, immediate rollback, sticks on device)
//
// V1 IS NOT EDITED. AdhkarScreenV1 below is the previous component with its name changed and
// not one other byte touched, so the rollback path is the old screen itself and not a
// reconstruction of it. V2 is additive: new component, new style keys, no shared mutable state.
//
// NO DEVOTIONAL CONTENT IS AUTHORED, REWRITTEN OR REORDERED HERE. Every title, every dhikr
// body, every repetition target and every audio URL is read from adhkar.json through the same
// loadAdhkar() store the old screen and the chat card read, rendered in the store's own order.
// The only strings this file adds are chrome: the back label, the search placeholder, the
// empty-result line, the source attribution and the listen/stop labels -- and each one is
// LIFTED, code point for code point, from the V1 screen or from DhikrCard. Not one of them
// is a new phrase. They are hoisted into named constants below so the difference between
// chrome and content is visible at a glance and so a future edit cannot drift one of them
// away from the V1 wording without the constant showing it.
const ADHKAR_UI_V2_KEY='adhkar_ui_v2';// device key. '0' = V1, anything else = V2
const readAdhkarUiFlag=()=>{let p=null;try{p=new URLSearchParams(window.location.search).get('adhkarui');}catch(e){p=null;}if(p==='1'||p==='0'){try{localStorage.setItem(ADHKAR_UI_V2_KEY,p);}catch(e){}return p==='1';}// No parameter: the default is V2, and only a stored, well-formed refusal turns it off.
try{return localStorage.getItem(ADHKAR_UI_V2_KEY)!=='0';}catch(e){return true;}};// ITEM 32 (commit three) -- THE ROLLBACK IS RETIRED, and this one line is the whole of it.
//
// WHAT CHANGES FOR A READER. Nothing, unless that reader had typed ?adhkarui=0 at some point
// on this device: V2 has been the default since session 84 and the parameter was the escape
// hatch for it. The hatch is now shut, so a device carrying a stored '0' opens V2 like every
// other device on its next visit.
//
// WHAT IS DELIBERATELY NOT DONE HERE. AdhkarScreenV1 is untouched, and so are readAdhkarUiFlag
// and ADHKAR_UI_V2_KEY above -- deleting the screen a lever protected in the same commit that
// shuts the lever leaves nothing to go back to if shutting it was wrong. The lever is shut
// first and alone; the screen and the reader come out separately, or not at all.
//
// THE OTHER TWO LEVERS OF THIS SHAPE ARE STILL LIVE, ON PURPOSE. ?mushafsvg=0 and
// ?madinaimg=0 both roll a QUR'AN RENDERER back on a device, and both are executed and
// asserted by tools/madina-hafs-guard.cjs (its section 5a drives ten parameter and storage
// cases through the madinaimg switch) and named at eight sites in theme-coverage-guard.cjs.
// Shutting either one means re-cutting roughly twenty assertions to say the opposite of what
// they say today, and taking a printed-mushaf rollback away from readers who chose it. That
// is an owner's decision, not a build one, and it is recorded in BABEL-32-REPORT.md as open.
const ADHKAR_UI_V2_ON=true;// Session 85 -- the royal-blue header pattern that used to live here is GONE with the band it
// painted. Neither new design draws a large filled blue rectangle: both open with a compact
// pure-white top row, so there is no gradient stack, no lattice and no band left to build.
// Chrome strings. Every one of them is a string the app ALREADY shows on this journey
// (V1 header/search/empty, DhikrCard label/meta/buttons); none is new devotional text.
// A2_TITLE is the one intentional wording change on this screen, and it is chrome, not
// content: the V2 header names the screen for the du'a it opens onto.
const A2_BRAND='عزك';const A2_TITLE='الأدعية';let A2_BACK=ezT("common.back");const A2_SEARCH='ابحث عن ذكر';const A2_EMPTY='لا نتائج';const A2_SOURCE='حصن المسلم';const A2_LISTEN='استماع';const A2_STOP='إيقاف';// Byte-for-byte the meta line V1 renders: the same two words around the same Arabic-Indic digits.
const a2Repeat=n=>'تُقال '+toArabicDigits(n)+' مرّات';// A module-level COPY of the V1 search normaliser, so V2 filters identically without reaching
// into V1's closure and without V1 changing. Same replacements, same order, same result.
const adhkarNormAr=str=>String(str||'').replace(/[ؐ-ًؚ-ٰٟ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه');// ============================================================
// ADHKAR UI V2 -- DEVICE-LOCAL STATE. Three keys, and everything true of them is true of all
// three: they are written and read ONLY by the two V2 components below and by resetAll, they
// hold IDENTIFIERS AND INTEGERS AND NOTHING ELSE, and no line of this file passes any of them
// to fetch(), to a request body, to a server handler, to an analytics call or to anything that
// builds an AI payload. There is no beacon, no sync, no background transmission and nothing to
// transmit: a dhikr, a title, a source and an audio URL all stay in adhkar.json, and what is
// stored is '<categoryId>:<index>' plus a count. Clearing the keys loses counters; it cannot
// lose devotional text, because none was ever put there.
const ADHKAR_PROGRESS_KEY='adhkar_daily_progress_v1';const ADHKAR_FAVORITES_KEY='adhkar_favorites_v1';const ADHKAR_USAGE_KEY='adhkar_usage_v1';const ADHKAR_DAILY_GOAL=8;// ── ITEM 43-أ: THE ADHKAR CHAIN, AND THE NUMBER THE READER CHOSE ────────────────────────────
// ONE new key, carrying its own version, holding three fields and nothing else:
//
//     ezik_adhkar_streak_v1 = { goal, last, run }
//
// `goal` is the reader's own daily number. `last` is the LOCAL day the goal was last met, and
// `run` is how many consecutive local days ended on it. Today's completions are NOT stored here
// -- they are already in adhkar_daily_progress_v1 and are counted off the real store, so there
// is exactly one place a completion is recorded and this key can never disagree with it.
//
// DEVICE-LOCAL AND NOTHING ELSE. No request, no beacon, no model call, no notification: a
// scheduled reminder needs the native shell and is not in this build, so nothing here promises
// one and nothing in the interface hints at one.
const ADHKAR_STREAK_KEY='ezik_adhkar_streak_v1';// A day's dhikr, not a mountain: one is a real day and twenty is already more than the whole of
// the morning and evening portions together. A number outside the pair is refused on write and
// ignored on read, so a hand-edited store cannot present a goal the screen would then draw.
const ADHKAR_GOAL_MIN=1;const ADHKAR_GOAL_MAX=20;const ADHKAR_GOAL_PRESETS=[3,5,8,12,20];// The identifier, and it is deliberately (category id, position) rather than d.id: it is stable
// for a given store, it is two integers, and it says nothing about what the item contains.
const A2_ID_RE=/^[0-9]+:[0-9]+$/;const adhkarItemKey=(catId,i)=>String(catId)+':'+String(i);// DEVICE-LOCAL day, not toISOString: the day a reader lives by is their own midnight. Same
// reasoning, and the same three getters, as wirdDayKey -- and its OWN function, so the mushaf
// wird keeps every byte of its behaviour whatever happens here.
function adhkarDayKey(d){const t=d||new Date();const y=t.getFullYear();const m=t.getMonth()+1;const day=t.getDate();return String(y)+'-'+(m<10?'0':'')+String(m)+'-'+(day<10?'0':'')+String(day);}// THE COUNT THE DHIKR ITSELF STATES.
//
// The store's `repeat` field is right when it is there, and it is missing from items whose own
// text ends by naming the number: «(سبع مرات)» on one and «(ثلاثَ مرَّاتٍ)» on another, while the
// record says repeat:1. The counter then offered 0/1 for a dhikr the reader can see is said seven
// times. That is the defect, and it is fixed by READING the text, not by editing adhkar.json --
// the two copies of that file are compared byte for byte by a gate, and picking a number for a
// religious text is not a decision this file gets to make.
//
// WHAT IT WILL MATCH, and it is deliberately narrow: a parenthesised group at the very END of the
// text, containing exactly a number word and the word "مرة"/"مرات", with the diacritics stripped
// first. Nothing else. A group followed by more parentheses does not match, which is how
// «واتفل على يسارك (ثلاثاً)))» is left alone -- that three governs the spitting inside the hadith,
// not the recitation of the dhikr. A group with extra words does not match either, so
// «(مائةَ مرَّةٍ إذا أصبحَ)» falls back to its stored 100 rather than being re-read.
//
// MEASURED over the shipped adhkar.json, all 267 items: nine name a trailing count. Six of those
// nine ALSO carry a stored repeat, and the number read from the text equals the stored number in
// all six -- zero disagreements. The remaining three are the defect: ids 83 and 148 move from
// 1 to 7, and id 130 from 1 to 3. No other item's target moves by one.
const A2_TASHKEEL_RE=/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g;const A2_TAIL_PAREN_RE=/\(([^()]{1,30})\)\s*[.\u060C\u061B]?\s*$/;const A2_REPEAT_UNIT_RE=/^مر(?:ة|ات)$/;// Only words that name a number greater than one: a group that resolves to 1 is no instruction at
// all, and this must never be able to LOWER a target.
const A2_REPEAT_WORDS={'مرتين':2,'ثلاث':3,'ثلاثا':3,'أربع':4,'اربع':4,'خمس':5,'ست':6,'سبع':7,'ثمان':8,'تسع':9,'عشر':10,'عشرا':10,'مائة':100,'مئة':100};const adhkarTextRepeat=text=>{const t=String(text||'').replace(A2_TASHKEEL_RE,'');const m=A2_TAIL_PAREN_RE.exec(t);if(!m)return 0;const parts=m[1].split(/\s+/).filter(Boolean);if(parts.length===1)return parts[0]==='مرتين'?2:0;if(parts.length!==2||!A2_REPEAT_UNIT_RE.test(parts[1]))return 0;const n=A2_REPEAT_WORDS[parts[0]];return n&&n>1?n:0;};// The item's REAL repetition target. THE STORED NUMBER STILL WINS whenever it says anything at
// all: a record that carries repeat:3 is answered with 3 and the text is not consulted. The text
// is read only where the record is silent -- repeat missing, zero, unparseable or 1 -- and only
// through the narrow reader above. A missing repeat with a silent text is one recitation, exactly
// as before. Nothing here can invent a target the item does not state in one place or the other.
const adhkarTarget=d=>{const n=parseInt(d&&d.repeat,10);if(Number.isFinite(n)&&n>1)return n;const fromText=adhkarTextRepeat(d&&d.text);if(fromText>1)return fromText;return Number.isFinite(n)&&n>0?n:1;};// { d: 'YYYY-MM-DD', n: { '<catId>:<index>': count } }. Anything that is not TODAY'S well-formed
// record reads as today's EMPTY record: a record from another local date, damaged JSON, a
// missing key, a non-object map, a storage that throws. That is the whole of the day rollover --
// no timer, no midnight listener, no cleanup pass; the first read after the local date changes
// simply does not recognise yesterday and starts the day at zero. Keys that do not match the
// identifier shape and counts that are not positive integers are dropped on the way out, so a
// hand-edited store cannot produce a count the UI would then present as devotion performed.
function readAdhkarProgress(){const today=adhkarDayKey();const empty={d:today,n:{}};let raw=null;try{raw=localStorage.getItem(ADHKAR_PROGRESS_KEY);}catch(e){return empty;}if(!raw)return empty;let o=null;try{o=JSON.parse(raw);}catch(e){return empty;}if(!o||typeof o!=='object'||o.d!==today)return empty;if(!o.n||typeof o.n!=='object')return empty;const n={};for(const k of Object.keys(o.n)){if(!A2_ID_RE.test(k))continue;const v=o.n[k];if(!Number.isInteger(v)||v<1)continue;n[k]=v;}return{d:today,n:n};}const adhkarCountOf=(rec,catId,i)=>rec&&rec.n&&rec.n[adhkarItemKey(catId,i)]||0;// The ONLY writer of the progress key. One press is one increment: it adds exactly 1 and it
// refuses at the target, so a held finger, a double tap or a replayed click cannot carry an
// item past its real repetition count. localStorage only -- no request, no beacon.
function bumpAdhkarCount(catId,i,target){const rec=readAdhkarProgress();const key=adhkarItemKey(catId,i);if(!A2_ID_RE.test(key))return rec;const cap=Number.isInteger(target)&&target>0?target:1;const cur=rec.n[key]||0;if(cur>=cap)return rec;const n=Object.assign({},rec.n);n[key]=cur+1;const next={d:rec.d,n:n};try{localStorage.setItem(ADHKAR_PROGRESS_KEY,JSON.stringify(next));}catch(e){}return next;}// COMPLETE means the item's own target was reached, and nothing else means it. Both counters
// below resolve every stored count against the REAL item it names and skip any key that no
// longer resolves, so a renumbered store shows fewer completions rather than phantom ones.
function adhkarCatDone(rec,catId,items){if(!rec||!Array.isArray(items))return 0;let done=0;for(let i=0;i<items.length;i++){if(adhkarCountOf(rec,catId,i)>=adhkarTarget(items[i]))done+=1;}return done;}// The day BEFORE a 'YYYY-MM-DD' key, computed on the string alone. No second Date is built and
// no timezone is consulted twice: the only date this file reads from the device is the one
// adhkarDayKey already read, and «yesterday» is arithmetic over that answer.
function adhkarPrevDayKey(key){if(typeof key!=='string'||key.length!==10)return'';const y=parseInt(key.slice(0,4),10);const m=parseInt(key.slice(5,7),10);const d=parseInt(key.slice(8,10),10);if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d))return'';if(m<1||m>12||d<1||d>31)return'';let py=y,pm=m,pd=d-1;if(pd===0){pm=m-1;if(pm===0){pm=12;py=y-1;}const leap=py%4===0&&py%100!==0||py%400===0;const LEN=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];pd=LEN[pm-1];}return String(py)+'-'+(pm<10?'0':'')+String(pm)+'-'+(pd<10?'0':'')+String(pd);}// Anything that is not a well-formed record reads as the DEFAULT record -- a missing key, damaged
// JSON, a goal outside its pair, a malformed date, a run that is not a positive integer, or a
// storage that throws. A chain is never invented from a broken store, and a broken store is never
// an error message either.
function readAdhkarStreak(){const empty={goal:ADHKAR_DAILY_GOAL,last:'',run:0};let raw=null;try{raw=localStorage.getItem(ADHKAR_STREAK_KEY);}catch(e){return empty;}if(!raw)return empty;let o=null;try{o=JSON.parse(raw);}catch(e){return empty;}if(!o||typeof o!=='object')return empty;const goal=Number.isInteger(o.goal)&&o.goal>=ADHKAR_GOAL_MIN&&o.goal<=ADHKAR_GOAL_MAX?o.goal:ADHKAR_DAILY_GOAL;const last=typeof o.last==='string'&&o.last.length===10&&adhkarPrevDayKey(o.last)?o.last:'';const run=last&&Number.isInteger(o.run)&&o.run>0?o.run:0;return{goal:goal,last:last,run:run};}// THE RUN AS OF A GIVEN DAY. A chain whose last credited day is today, or yesterday, is still
// standing -- yesterday's, because today's dhikr has simply not been done YET and a day is not
// over until it is over. Anything older has lapsed and reads as 0.
//
// A LAPSE IS NOT A PUNISHMENT. It returns a number, not a warning: the screen draws 0 in the
// same ink as any other number, with no red, no broken-chain icon and no sentence about what the
// reader failed to do. The chain simply starts again the next time the goal is met.
function adhkarRunAsOf(rec,today){if(!rec||!rec.run||!rec.last)return 0;if(rec.last===today)return rec.run;if(rec.last===adhkarPrevDayKey(today))return rec.run;return 0;}// The goal is the reader's. Out-of-range writes nothing and returns the record unchanged, so the
// caller always renders a number the store would actually accept.
function writeAdhkarGoal(n){const rec=readAdhkarStreak();if(!Number.isInteger(n)||n<ADHKAR_GOAL_MIN||n>ADHKAR_GOAL_MAX)return rec;const next={goal:n,last:rec.last,run:rec.run};try{localStorage.setItem(ADHKAR_STREAK_KEY,JSON.stringify(next));}catch(e){}return next;}// THE ONLY WRITER OF THE CHAIN. It is handed today's real completion count and does nothing at
// all until that count reaches the reader's own goal. A day already credited writes NOTHING, so
// re-entering the screen, or completing a ninth dhikr after the eighth, cannot lengthen the
// chain twice. localStorage only -- no request, no beacon, no reminder.
function markAdhkarDayMet(done){const rec=readAdhkarStreak();if(!Number.isInteger(done)||done<rec.goal)return rec;const today=adhkarDayKey();if(rec.last===today)return rec;const run=rec.run>0&&rec.last===adhkarPrevDayKey(today)?rec.run+1:1;const next={goal:rec.goal,last:today,run:run};try{localStorage.setItem(ADHKAR_STREAK_KEY,JSON.stringify(next));}catch(e){}return next;}function adhkarCompletedToday(rec,byCat){if(!rec||!rec.n||!byCat)return 0;let done=0;for(const k of Object.keys(rec.n)){const parts=k.split(':');const list=byCat[parseInt(parts[0],10)];if(!Array.isArray(list))continue;const item=list[parseInt(parts[1],10)];if(!item)continue;if(rec.n[k]>=adhkarTarget(item))done+=1;}return done;}// Favourites: an ARRAY OF IDENTIFIERS. No text, no title, no audio URL, no timestamp. Entries
// that are not well-formed identifiers, and duplicates, are dropped on read.
function readAdhkarFavorites(){let raw=null;try{raw=localStorage.getItem(ADHKAR_FAVORITES_KEY);}catch(e){return[];}if(!raw)return[];let o=null;try{o=JSON.parse(raw);}catch(e){return[];}if(!Array.isArray(o))return[];const out=[];for(const v of o){if(typeof v!=='string'||!A2_ID_RE.test(v))continue;if(out.indexOf(v)!==-1)continue;out.push(v);}return out;}function toggleAdhkarFavorite(key){const cur=readAdhkarFavorites();if(!A2_ID_RE.test(key))return cur;const at=cur.indexOf(key);const next=at===-1?cur.concat([key]):cur.slice(0,at).concat(cur.slice(at+1));try{localStorage.setItem(ADHKAR_FAVORITES_KEY,JSON.stringify(next));}catch(e){}return next;}// Usage: { '<catId>': timesOpened }. The single call site is the category-open handler, so the
// count is literally "how many times this device opened this door" and is incremented nowhere
// else -- not on render, not on search, not on scroll. It never leaves the device, and the home
// screen shows the section only when the map already has a real entry, so a fresh install sees
// no most-used strip rather than a fabricated one.
function readAdhkarUsage(){let raw=null;try{raw=localStorage.getItem(ADHKAR_USAGE_KEY);}catch(e){return{};}if(!raw)return{};let o=null;try{o=JSON.parse(raw);}catch(e){return{};}if(!o||typeof o!=='object'||Array.isArray(o))return{};const out={};for(const k of Object.keys(o)){if(!/^[0-9]+$/.test(k))continue;const v=o[k];if(!Number.isInteger(v)||v<1)continue;out[k]=v;}return out;}function bumpAdhkarUsage(catId){const cur=readAdhkarUsage();const k=String(catId);if(!/^[0-9]+$/.test(k))return cur;const next=Object.assign({},cur);next[k]=(next[k]||0)+1;try{localStorage.setItem(ADHKAR_USAGE_KEY,JSON.stringify(next));}catch(e){}return next;}// Most-used, resolved against the REAL category list: a stored id with no category is skipped,
// and a category with no stored count never appears. Ties keep the store's own order because
// Array#sort is stable, so the strip cannot reorder itself between two equal counts.
// Session 86 -- THE ADHKAR-ONLY DESIGN KEY IS GONE. adhkar_design_v1 was never deployed, so
// nothing on any device holds it and there is nothing to migrate; the choice it used to make is
// now the APPLICATION UI STYLE declared next to Home (EZIK_UI_STYLE_KEY), and these four screens
// read it through the same useEzikUiStyle hook the home screen and the settings row read. The
// two accepted words are unchanged, 'journey' is still the default, and every property of the
// old reader -- total, per-call try/catch, same-tab custom event, cross-tab storage event, no
// reload -- is a property of the new one. See the block above HOME_GREETINGS_GENERAL.
// A compact WINDOW of real positions around the current one. A category of four hundred items
// does not become four hundred dots: the window is at most A3_WINDOW marks wide, it slides so
// the current position stays inside it, and every number it yields is a real index into the
// real item list -- it shortens the DRAWING, never the category.
const A3_WINDOW=7;function adhkarWindow(len,idx,size){const n=Math.max(0,parseInt(len,10)||0);const w=Math.min(n,Math.max(1,parseInt(size,10)||1));if(w<=0)return[];const at=Math.min(Math.max(0,parseInt(idx,10)||0),n-1);const start=Math.max(0,Math.min(at-Math.floor(w/2),n-w));const out=[];for(let i=0;i<w;i++)out.push(start+i);return out;}// NEW V2 CHROME STRINGS, and every one is written as \u{...} code-point escapes on purpose:
// an escape sequence cannot be silently reflowed, reshaped, normalised or truncated by an
// editor the way a bidirectional literal can, and it keeps every byte of this block ASCII.
// None of these is devotional text. They are a card title, a section title, five control
// labels and three status lines -- chrome, all of it, and none of it read from adhkar.json.
// Glosses are on the right so the wording can be reviewed without decoding by hand.
// ITEM 43-أ. The chain's own words. NEUTRAL BY CONSTRUCTION: there is no sentence here for a
// chain that lapsed, because none is drawn -- the number simply reads zero and the invitation
// below is the same invitation a first-time reader sees.
const A3_CHAIN_TITLE='سلسلتك';// "your chain"
const A3_CHAIN_DAYS='يومًا متتاليًا';// "consecutive days"
const A3_CHAIN_START='تبدأ ببلوغ هدف اليوم';// "it begins when today's goal is reached"
const A3_GOAL_PICK='هدف اليوم';// "today's goal"
const A2_GOAL_TITLE='\u{0648}\u{0631}\u{062F}\u{0643} \u{0627}\u{0644}\u{064A}\u{0648}\u{0645}\u{064A}';// "your daily wird"
const A2_MOST_USED='\u{0627}\u{0644}\u{0623}\u{0643}\u{062B}\u{0631} \u{0627}\u{0633}\u{062A}\u{062E}\u{062F}\u{0627}\u{0645}\u{0627}\u{064B}';// "the most used"
const A2_FAV_ADD='\u{0623}\u{0636}\u{0641} \u{0625}\u{0644}\u{0649} \u{0627}\u{0644}\u{0645}\u{0641}\u{0636}\u{0644}\u{0629}';// "add to favourites"
const A2_FAV_DEL='\u{0623}\u{0632}\u{0644} \u{0645}\u{0646} \u{0627}\u{0644}\u{0645}\u{0641}\u{0636}\u{0644}\u{0629}';// "remove from favourites"
const A2_FAV_LABEL='\u{0627}\u{0644}\u{0645}\u{0641}\u{0636}\u{0644}\u{0629}';// "favourites"
const A2_SHARE='\u{0645}\u{0634}\u{0627}\u{0631}\u{0643}\u{0629}';// "share"
const A2_SHARE_OK='\u{062A}\u{0645}\u{062A} \u{0627}\u{0644}\u{0645}\u{0634}\u{0627}\u{0631}\u{0643}\u{0629}';// "shared"
const A2_COPY_OK='\u{062A}\u{0645} \u{0627}\u{0644}\u{0646}\u{0633}\u{062E}';// "copied"
const A2_SHARE_FAIL='\u{062A}\u{0639}\u{0630}\u{0631}\u{062A} \u{0627}\u{0644}\u{0645}\u{0634}\u{0627}\u{0631}\u{0643}\u{0629}';// "sharing failed"
const A2_COUNT='\u{062A}\u{0643}\u{0631}\u{0627}\u{0631}';// "repetition"
const A2_COUNT_ARIA='\u{0632}\u{064A}\u{0627}\u{062F}\u{0629} \u{0627}\u{0644}\u{0639}\u{062F}\u{062F}';// "increase the count"
const A2_DONE='\u{062A}\u{0645}';// "done"
const A2_PREV='\u{0627}\u{0644}\u{0633}\u{0627}\u{0628}\u{0642}';// "previous"
const A2_NEXT='\u{0627}\u{0644}\u{062A}\u{0627}\u{0644}\u{064A}';// "next"
// Session 85/86. Four CHROME strings for the style choice and one section heading -- escapes for
// the same reason the block above uses them, and none of them is devotional text: two layout
// names, the settings heading and the word that titles the remaining-categories grid.
// Session 86 renamed the heading only: the selector no longer means "adhkar design", it means
// the INTERFACE STYLE of the application, because it now governs Home and Adhkar together.
// The two layout names below are unchanged.
const A3_ALL='\u{0627}\u{0644}\u{0623}\u{0642}\u{0633}\u{0627}\u{0645}';// S100 -- three more chrome strings, escaped for the same reason every string above is: a
// section heading and the two identity names. None of them is devotional text.
let EZ_VT_TITLE=ezT("visualTheme.title");// "the visual identity"
const EZ_VT_QIBLA='\u{0642}\u{0628}\u{0644}\u{0629} \u{0661}\u{0663}';// "qibla 13"
const EZ_VT_ISTANA='\u{0625}\u{0633}\u{062A}\u{0627}\u{0646}\u{0629} \u{0663}\u{0663}';// S102 -- the state words for the active-design card. Chrome, and neither is a choice.
let EZ_VT_ACTIVE=ezT("visualTheme.active");// "the current design"
let EZ_VT_SOON=ezT("visualTheme.soon");// "soon"                     // "istana 33"                                          // "the sections"
function AdhkarScreenV1({onBack}){const[cats,setCats]=useState(null);const[query,setQuery]=useState('');const[selected,setSelected]=useState(null);useEffect(()=>{let alive=true;loadAdhkar().then(db=>{if(alive)setCats(db.categories||[]);}).catch(()=>{if(alive)setCats([]);});return()=>{alive=false;};},[]);const normAr=s=>String(s||'').replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g,'').replace(/[\u0623\u0625\u0622]/g,'\u0627').replace(/\u0649/g,'\u064A').replace(/\u0624/g,'\u0648').replace(/\u0626/g,'\u064A').replace(/\u0629/g,'\u0647');const q=normAr(query).trim();const list=(cats||[]).filter(c=>!q||normAr(c.title).includes(q));// S87 -- the ONE line this rollback screen gains, and it renders nothing: while a category is
// open, the hardware/browser back runs the SAME closer its own back button runs, so V1 obeys
// the application hierarchy too (open category -> this list -> home). Its markup, its state,
// its storage and its DhikrCard are untouched.
useEzikBackLayer(!!selected,()=>setSelected(null));if(selected){return/*#__PURE__*/React.createElement("div",{style:s.adhkarContainer},/*#__PURE__*/React.createElement("div",{style:s.adhkarHeader},/*#__PURE__*/React.createElement("button",{onClick:ezikGoBack,style:s.adhkarBackBtn},"رجوع"),/*#__PURE__*/React.createElement("div",{style:s.adhkarTitle},selected.title)),/*#__PURE__*/React.createElement("div",{style:s.adhkarScroll},/*#__PURE__*/React.createElement(DhikrCard,{catId:selected.id})));}return/*#__PURE__*/React.createElement("div",{style:s.adhkarContainer},/*#__PURE__*/React.createElement("div",{style:s.adhkarHeader},/*#__PURE__*/React.createElement("button",{onClick:onBack,style:s.adhkarBackBtn},"رجوع"),/*#__PURE__*/React.createElement("div",{style:s.adhkarTitle},"الأذكار")),/*#__PURE__*/React.createElement("div",{style:s.adhkarScroll},/*#__PURE__*/React.createElement("input",{value:query,onChange:e=>setQuery(e.target.value),placeholder:"ابحث عن ذكر",style:s.welcomeInput}),cats===null?/*#__PURE__*/React.createElement("div",{style:s.adhkarEmpty},"..."):list.length===0?/*#__PURE__*/React.createElement("div",{style:s.adhkarEmpty},"لا نتائج"):/*#__PURE__*/React.createElement("div",{style:s.adhkarList},list.map(c=>/*#__PURE__*/React.createElement("button",{key:c.id,onClick:()=>setSelected(c),style:s.adhkarRow},/*#__PURE__*/React.createElement("div",{style:s.adhkarRowTitle},c.title),/*#__PURE__*/React.createElement("span",{style:s.adhkarCount},c.count),/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{color:'var(--nav-off)',flexShrink:0}},/*#__PURE__*/React.createElement("path",{d:"M15 18l-6-6 6-6"})))))));}// ============================================================
// ADHKAR UI V2 -- the screens.
// ------------------------------------------------------------
// Two components and a dispatcher. AdhkarScreenV2 is the browse (home) screen; when a
// category is opened it hands the WHOLE screen to AdhkarCategoryV2 rather than swapping a
// body, so each screen owns one header and there is no half-state where a category title
// sits under the browse chrome.
//
// The data path is unchanged in every particular: loadAdhkar() -> db.categories for the
// list, db.byCat[id] for a category. No sort, no dedupe, no slice, no re-key, no mapping of
// any field through anything. d.text is rendered as a text child exactly as V1 and DhikrCard
// render it -- no markdown pass, no tashkeel pass, no age simplification, no truncation.
// the repetition target is shown by the same a2Repeat() wording V1 uses. The
// audio element is built from d.audio and from nothing else.
// ============================================================
const A2_ICON_BEADS=/*#__PURE__*/React.createElement("svg",{width:"22",height:"22",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"12",r:"7"}),/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"5",r:"1.5",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"19",cy:"12",r:"1.5",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"19",r:"1.5",fill:"currentColor"}),/*#__PURE__*/React.createElement("circle",{cx:"5",cy:"12",r:"1.5",fill:"currentColor"}));// RTL: the page runs right to left, so "back" points RIGHT and "onward" points LEFT. These
// two are written as the glyphs the direction calls for, not mirrored by the browser.
const A2_ICON_BACK=/*#__PURE__*/React.createElement("svg",{width:"19",height:"19",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M9 18l6-6-6-6"}));const A2_ICON_ONWARD=/*#__PURE__*/React.createElement("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M15 18l-6-6 6-6"}));const A2_ICON_SEARCH=/*#__PURE__*/React.createElement("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"11",cy:"11",r:"7"}),/*#__PURE__*/React.createElement("path",{d:"M20 20l-3.2-3.2"}));// The controls the second pass adds. All four are drawn in the SAME line-icon language as the
// four above and as the app's <Icon> set -- one viewBox, currentColor, round caps -- so the
// screen keeps one visual vocabulary. NO EMOJI anywhere in V2: an emoji is a font-dependent
// picture that renders differently on every device, and none is used as a control here.
const A2_ICON_HEART=/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M20.8 5.9a5 5 0 0 0-7.1 0L12 7.6l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.7 8.8-8.7a5 5 0 0 0 0-7.1z"}));// The filled heart is the SAME path with a fill -- the favourite state is a solid shape, not a
// second drawing, so on/off cannot drift apart.
const A2_ICON_HEART_ON=/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"currentColor",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M20.8 5.9a5 5 0 0 0-7.1 0L12 7.6l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.7 8.8-8.7a5 5 0 0 0 0-7.1z"}));const A2_ICON_SHARE=/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"18",cy:"5",r:"3"}),/*#__PURE__*/React.createElement("circle",{cx:"6",cy:"12",r:"3"}),/*#__PURE__*/React.createElement("circle",{cx:"18",cy:"19",r:"3"}),/*#__PURE__*/React.createElement("path",{d:"M8.6 10.6l6.8-4M8.6 13.4l6.8 4"}));const A2_ICON_CHECK=/*#__PURE__*/React.createElement("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.6",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M20 6L9 17l-5-5"}));const A2_ICON_PLUS=/*#__PURE__*/React.createElement("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.6",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M12 5v14M5 12h14"}));function AdhkarScreenV2({onBack}){// Session 85. THIS COMPONENT IS STILL THE ONLY OWNER OF BROWSE STATE. The store, the query,
// the selection, today's progress, the usage map and the favourite identifiers are loaded,
// read and written here exactly as before; the two home components below receive them as
// props and render them. There is no second loader, no second storage path and no copy of
// any of these values kept anywhere else -- switching design switches which component draws
// this state, and touches none of it. Session 86: the hook is the APPLICATION one, so the
// style this screen draws in is the style the home screen draws in -- one key, one event.
// The WHOLE store is kept now, not just db.categories: the daily card resolves each stored
// count against the real item it names, and byCat is where those items are. Still one
// loadAdhkar() call, still the store's own objects, still no reshaping of any of them.
const[db,setDb]=useState(null);const[query,setQuery]=useState('');const[searchOpen,setSearchOpen]=useState(false);const[selected,setSelected]=useState(null);const[startAt,setStartAt]=useState(0);const[prog,setProg]=useState(readAdhkarProgress);const[usage,setUsage]=useState(readAdhkarUsage);const[favs,setFavs]=useState(readAdhkarFavorites);// ITEM 43-أ. The chain is browse state like the rest: this component owns it, reads it and
// writes it, and the presentation below is handed the two numbers it draws.
const[streak,setStreak]=useState(readAdhkarStreak);useEffect(()=>{let alive=true;loadAdhkar().then(d=>{if(alive)setDb(d||{categories:[],byCat:{}});}).catch(()=>{if(alive)setDb({categories:[],byCat:{}});});return()=>{alive=false;};},[]);const cats=db?db.categories||[]:null;// Same filter as V1: normalise both sides, substring, and an empty query keeps EVERY
// category in the store's own order. Nothing is ranked and nothing is hidden.
const q=adhkarNormAr(query).trim();const list=(cats||[]).filter(c=>!q||adhkarNormAr(c.title).includes(q));// THE ONLY usage write in the app, and it is still on the OPEN -- one increment per opened
// door, whichever design drew the door. The optional second argument is a real index inside
// the category the caller already resolved (the favourites list opens at the saved item);
// anything else opens at the first item, and nothing here can point past the category.
const open=(c,at)=>{setUsage(bumpAdhkarUsage(c.id));const n=parseInt(at,10);setStartAt(Number.isFinite(n)&&n>0?n:0);setSelected(c);};// ITEM 97 REVOKED -- a deep link stood here, and it is gone with the navigation that fed it.
// This screen has ONE way in again: its own front door, at the browse list, however it was
// reached. open(c, at) above is what the favourites list has always used and is untouched.
// ===== closeAdhkarDetail -- THE ADHKAR'S OWN NESTED CLOSER =====
// It closes the OPEN CATEGORY (with the item being read inside it) and reveals this browse
// screen; it does not leave the adhkar, and only the browse screen's own back does that. It
// touches no storage: the counters, the favourites and the per-category open counts are
// RE-READ from the same keys the reader just wrote, so returning shows exactly what the
// counter recorded -- including a day that rolled over mid-session -- and nothing is cleared,
// reset or re-mounted. Audio and share belong to the reader and stop with it, as they always
// did. S87: this is also what a hardware/browser back runs first while a category is open.
const closeAdhkarDetail=()=>{setSelected(null);setProg(readAdhkarProgress());setFavs(readAdhkarFavorites());setUsage(readAdhkarUsage());};useEzikBackLayer(!!selected,closeAdhkarDetail);// COMPLETED means target reached, counted over distinct items, and capped for DISPLAY at the
// goal -- min(done, 8) of 8. A ninth completion is real and is not shown as a ninth eighth.
const done=adhkarCompletedToday(prog,db&&db.byCat);// ITEM 43-أ. THE ONE PLACE THE CHAIN IS CREDITED, and it is keyed on the real completion count
// rather than on a tap: whichever category the eighth dhikr was finished in, today is credited
// once here. markAdhkarDayMet refuses a day it has already credited, so this effect re-running
// -- on a re-render, on returning from a category, on a day that rolled over mid-session --
// cannot lengthen the chain a second time.
useEffect(()=>{setStreak(markAdhkarDayMet(done));},[done]);// S91: the reader's own back presses the application back, which spends the entry this layer
// took when it opened and then runs closeAdhkarDetail through the registry -- the same closer,
// reached by the same route the device button uses.
if(selected)return/*#__PURE__*/React.createElement(AdhkarCategoryV2,{cat:selected,startAt:startAt,onBack:ezikGoBack});// ONE view object, handed to whichever home is drawn. Both receive the same store, the same
// filtered list, the same progress record and the same handlers -- there is nothing a home
// component can compute that the other cannot, and nothing either of them may write.
const view={onBack:onBack,cats:cats,list:list,query:query,setQuery:setQuery,// The row is open while it is asked for OR while a query is live, so a filter can never be
// in force with no visible way to clear it; closing it clears the query and restores the
// full list. Both designs share this one handler, so a query survives a design switch.
searchOpen:searchOpen||query.length>0,onToggleSearch:()=>{const next=!(searchOpen||query.length>0);setSearchOpen(next);if(!next)setQuery('');},onOpen:open,prog:prog,byCat:db&&db.byCat||{},usage:usage,favs:favs,done:done,goal:streak.goal,run:adhkarRunAsOf(streak,adhkarDayKey()),onGoal:n=>setStreak(writeAdhkarGoal(n))};// The whole of the style switch on this screen: which component receives the state above.
// S103: the istana catalogue is the whole of the answer. Both legacy browse designs were
// deleted in the same commit as this line; nothing else referenced either of them.
return/*#__PURE__*/React.createElement(IstanaAdhkarBrowse,view);}// ============================================================
// SHARED PRESENTATION PARTS. Both homes and both readers draw the same compact PURE WHITE top
// row -- there is no large filled blue band anywhere in either design, and no bitmap: the bar
// is a white surface, a hairline and line icons.
// ============================================================
// The search row, shared by both homes: it is the SAME input, the same handler and the same
// placeholder in either design, so a query typed under one layout filters exactly as it did.
function A3Search({query,setQuery}){return/*#__PURE__*/React.createElement("div",{style:s.a3SearchRow},/*#__PURE__*/React.createElement("span",{style:s.a3SearchIcon},A2_ICON_SEARCH),/*#__PURE__*/React.createElement("input",{value:query,onChange:e=>setQuery(e.target.value),placeholder:A2_SEARCH,style:s.a3SearchInput,"aria-label":A2_SEARCH}));}// Real per-category standing, read off the SAME progress record the counter writes. A category
// the store does not resolve reports zero of zero and is drawn as untouched -- never as begun.
function a3CatStanding(prog,cat,byCat){const items=byCat?byCat[parseInt(cat.id,10)]:null;const total=Array.isArray(items)?items.length:0;const done=total?adhkarCatDone(prog,cat.id,items):0;return{total:total,done:done,full:total>0&&done>=total,started:done>0};}// ---- S103 ISTANA ADHKAR START -------------------------------------------------------------
// THE ISTANA ADHKAR CATALOGUE. It replaces both legacy browse designs, which are deleted in
// this same commit: the overlapping stack and the grid of identical squares are gone.
//
// PRESENTATION ONLY, on exactly the terms the deleted ones had. AdhkarScreenV2 is still the
// only owner of browse state: the store, the query, the progress record, the usage map and
// the favourite identifiers are loaded, read and written there and handed here as props. This
// component reads no storage, writes none, ranks nothing, hides nothing and invents nothing.
//
// EVERY CATEGORY EXACTLY ONCE, IN THE STORE'S OWN ORDER. `list` is the owner's filtered array;
// it is split at a fixed position into a featured head and the catalogue tail, and the two are
// concatenations of the same array -- featured.length + rest.length === list.length, always.
// The split is POSITIONAL, not semantic: nothing here matches a title or hardcodes an id. In
// adhkar.json's own order the first three happen to be the morning/evening, the sleep and the
// waking groups, which is why featuring the head reads as featuring them -- but a data change
// moves what is featured rather than breaking it, and a live query features the top of the
// filtered result, which is the honest thing for a search to do.
const EZIA_FEATURED=3;// One catalogue card. The treatment varies with the category's own standing and position --
// a completed category is crested and checked, every third card takes the coral rule, and the
// rest are plain surface -- so the catalogue is coherent without being 129 identical squares.
function IstanaAdhkarCard({c,st,i,onOpen}){const coral=i%3===2;return/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:()=>onOpen(c),"data-ezia-cat":c.id,style:{...s.eziaCard,...(st.full?s.eziaCardDone:null)}},/*#__PURE__*/React.createElement("span",{className:coral?'ezia-crest ezia-crest-coral':'ezia-crest',"aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{style:s.eziaCardHead},/*#__PURE__*/React.createElement("span",{style:st.full?{...s.eziaEmblem,...s.eziaEmblemDone}:s.eziaEmblem,"aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{className:"ezia-star"})),/*#__PURE__*/React.createElement("span",{style:s.eziaCount},toArabicDigits(c.count))),/*#__PURE__*/React.createElement("span",{style:s.eziaCardTitle},c.title),/*#__PURE__*/React.createElement("span",{style:s.eziaCardFoot},/*#__PURE__*/React.createElement("span",{style:s.eziaStanding},st.total>0&&st.done>0?toArabicDigits(st.done)+' / '+toArabicDigits(st.total):''),/*#__PURE__*/React.createElement("span",{style:s.eziaGo,"aria-hidden":"true"},st.full?A2_ICON_CHECK:EZH_ICON_GO)));}// A featured card: the same data, the same handler, the same id attribute -- a larger arch, a
// bigger emblem and room for the standing line. It is not a second copy of anything.
function IstanaAdhkarFeature({c,st,onOpen}){return/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:()=>onOpen(c),"data-ezia-cat":c.id,style:{...s.eziaFeature,...(st.full?s.eziaCardDone:null)}},/*#__PURE__*/React.createElement("span",{style:s.eziaFeatureTop},/*#__PURE__*/React.createElement("span",{style:st.full?{...s.eziaEmblemLg,...s.eziaEmblemDone}:s.eziaEmblemLg,"aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{className:"ezia-star"})),/*#__PURE__*/React.createElement("span",{style:s.eziaCount},toArabicDigits(c.count))),/*#__PURE__*/React.createElement("span",{style:s.eziaFeatureTitle},c.title),/*#__PURE__*/React.createElement("span",{style:s.eziaCardFoot},/*#__PURE__*/React.createElement("span",{style:s.eziaStanding},st.total>0&&st.done>0?toArabicDigits(st.done)+' / '+toArabicDigits(st.total):A2_SOURCE),/*#__PURE__*/React.createElement("span",{style:s.eziaGo,"aria-hidden":"true"},st.full?A2_ICON_CHECK:EZH_ICON_GO)));}function IstanaAdhkarBrowse({onBack,cats,list,query,setQuery,searchOpen,onToggleSearch,onOpen,prog,byCat,done,goal,run,onGoal}){// ITEM 43-أ. The ring is measured against the READER'S number now, not a constant. The
// constant survives as the default that number starts from, and nothing else reads it.
const shown=Math.min(done,goal);// the real ring, unchanged: min(completions, goal) over the goal, and nothing else.
const CIRC=2*Math.PI*30;const off=CIRC*(1-shown/goal);const featured=list.slice(0,EZIA_FEATURED);const rest=list.slice(EZIA_FEATURED);return/*#__PURE__*/React.createElement("div",{className:"theme-dark adhkar3",style:s.eziaContainer},/*#__PURE__*/React.createElement("div",{className:"ezia-nav"},/*#__PURE__*/React.createElement("div",{className:"ezia-nav-inner"},/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:onBack,style:s.eziaNavBtn,"aria-label":A2_BACK},A2_ICON_BACK),/*#__PURE__*/React.createElement("span",{className:"ezia-brand"},/*#__PURE__*/React.createElement("span",{className:"ezia-brand-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",null,A2_TITLE)),/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:onToggleSearch,"aria-label":A2_SEARCH,"aria-pressed":searchOpen?'true':'false',style:searchOpen?{...s.eziaNavBtn,...s.eziaNavBtnOn}:s.eziaNavBtn},A2_ICON_SEARCH))),searchOpen&&/*#__PURE__*/React.createElement(A3Search,{query:query,setQuery:setQuery}),/*#__PURE__*/React.createElement("div",{style:s.eziaScroll},/*#__PURE__*/React.createElement("div",{className:"ezia-wrap"},/*#__PURE__*/React.createElement("section",{className:"ezia-masthead"},/*#__PURE__*/React.createElement("span",{style:s.eziaRingBox,role:"progressbar","aria-label":A2_GOAL_TITLE,"aria-valuemin":0,"aria-valuemax":goal,"aria-valuenow":shown},/*#__PURE__*/React.createElement("svg",{width:"76",height:"76",viewBox:"0 0 76 76","aria-hidden":"true"},/*#__PURE__*/React.createElement("circle",{cx:"38",cy:"38",r:"30",fill:"none",stroke:"var(--a3-surface)",strokeWidth:"7"}),/*#__PURE__*/React.createElement("circle",{cx:"38",cy:"38",r:"30",fill:"none",stroke:"var(--a3-blue)",strokeWidth:"7",strokeLinecap:"round",strokeDasharray:CIRC,strokeDashoffset:off,transform:"rotate(-90 38 38)"})),/*#__PURE__*/React.createElement("span",{style:s.eziaRingNums},toArabicDigits(shown)," / ",toArabicDigits(goal))),/*#__PURE__*/React.createElement("span",{style:s.eziaMastText},/*#__PURE__*/React.createElement("span",{style:s.eziaMastTitle},A2_GOAL_TITLE),/*#__PURE__*/React.createElement("span",{style:s.eziaMastHint},A2_SOURCE))),/*#__PURE__*/React.createElement("div",{style:s.eziaChainRow},/*#__PURE__*/React.createElement("span",{style:s.eziaChainWord},A3_CHAIN_TITLE),/*#__PURE__*/React.createElement("span",{style:s.eziaChainNum},toArabicDigits(run)),/*#__PURE__*/React.createElement("span",{style:s.eziaChainWord},run>0?A3_CHAIN_DAYS:A3_CHAIN_START)),/*#__PURE__*/React.createElement("div",{style:s.eziaGoalRow,role:"group","aria-label":A3_GOAL_PICK},/*#__PURE__*/React.createElement("span",{style:s.eziaGoalLabel},A3_GOAL_PICK),ADHKAR_GOAL_PRESETS.map(n=>/*#__PURE__*/React.createElement("button",{key:n,type:"button",className:"adhkar2-focus",onClick:()=>onGoal(n),"aria-pressed":goal===n?'true':'false',style:goal===n?{...s.eziaGoalChip,...s.eziaGoalChipOn}:s.eziaGoalChip},toArabicDigits(n)))),cats===null?/*#__PURE__*/React.createElement("div",{style:s.a3Empty},"..."):list.length===0?/*#__PURE__*/React.createElement("div",{style:s.a3Empty},A2_EMPTY):/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{className:"ezia-featured"},featured.map(c=>/*#__PURE__*/React.createElement(IstanaAdhkarFeature,{key:c.id,c:c,st:a3CatStanding(prog,c,byCat),onOpen:onOpen}))),rest.length>0&&/*#__PURE__*/React.createElement("div",{className:"ezia-sec"},/*#__PURE__*/React.createElement("span",{style:s.eziaSecTitle},A3_ALL),/*#__PURE__*/React.createElement("span",{className:"ezia-sec-rule","aria-hidden":"true"})),/*#__PURE__*/React.createElement("div",{className:"ezia-catalogue"},rest.map((c,i)=>/*#__PURE__*/React.createElement(IstanaAdhkarCard,{key:c.id,c:c,i:i,st:a3CatStanding(prog,c,byCat),onOpen:onOpen})))))));}// THE ISTANA READER SHELL. Every protected action of the deleted readers survives here with
// the same handler and the same accessible name: back, favourite, share, previous, audio, the
// counter, and onward. The dhikr text is still {d.text} -- a text child, no pass over it -- the
// counts are still v.count/v.target, the position is still the real index over the real length,
// and the live region is still in the tree from the first render.
function IstanaAdhkarReader(v){const items=v.items;const d=v.d;const len=items?items.length:0;const win=adhkarWindow(len,v.idx,A3_WINDOW);return/*#__PURE__*/React.createElement("div",{className:"theme-dark adhkar3",style:s.eziaReadContainer},/*#__PURE__*/React.createElement("div",{className:"ezia-nav"},/*#__PURE__*/React.createElement("div",{className:"ezia-nav-inner"},/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onBack,style:s.eziaNavBtn,"aria-label":A2_BACK},A2_ICON_BACK),/*#__PURE__*/React.createElement("span",{className:"ezia-brand"},/*#__PURE__*/React.createElement("span",{className:"ezia-brand-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{style:s.eziaReadTitle},v.cat.title)),/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onFav,"aria-label":v.isFav?A2_FAV_DEL:A2_FAV_ADD,"aria-pressed":v.isFav?'true':'false',style:v.isFav?{...s.eziaNavBtn,...s.eziaNavBtnOn}:s.eziaNavBtn},v.isFav?A2_ICON_HEART_ON:A2_ICON_HEART))),/*#__PURE__*/React.createElement("div",{style:s.eziaReadOuter},items===null?/*#__PURE__*/React.createElement("div",{style:s.a3Empty},"..."):len===0||!d?/*#__PURE__*/React.createElement("div",{style:s.a3Empty},A2_EMPTY):/*#__PURE__*/React.createElement("div",{style:s.eziaReadScroll},/*#__PURE__*/React.createElement("div",{className:"ezia-read-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezia-read-panel"},/*#__PURE__*/React.createElement("span",{style:s.eziaReadHead},/*#__PURE__*/React.createElement("span",{style:s.eziaReadPos},toArabicDigits(v.idx+1)," / ",toArabicDigits(len)),v.target>1&&/*#__PURE__*/React.createElement("span",{style:s.eziaReadRepeat},a2Repeat(v.target))),/*#__PURE__*/React.createElement("div",{style:s.eziaReadText},d.text),/*#__PURE__*/React.createElement("div",{style:s.eziaReadSource},A2_SOURCE)),/*#__PURE__*/React.createElement("div",{style:s.eziaRail,role:"progressbar","aria-label":v.cat.title,"aria-valuemin":1,"aria-valuemax":len,"aria-valuenow":v.idx+1},win.map(i=>{const doneHere=adhkarCountOf(v.prog,v.cat.id,i)>=adhkarTarget(items[i]);return/*#__PURE__*/React.createElement("span",{key:i,style:i===v.idx?{...s.eziaRailMark,...s.eziaRailMarkNow}:doneHere?{...s.eziaRailMark,...s.eziaRailMarkDone}:s.eziaRailMark});})),/*#__PURE__*/React.createElement("div",{style:s.eziaNote,role:"status","aria-live":"polite"},v.note),v.full&&/*#__PURE__*/React.createElement("div",{style:s.eziaDoneRow,role:"status","aria-live":"polite"},/*#__PURE__*/React.createElement("span",{style:s.eziaDoneMark,"aria-hidden":"true"},A2_ICON_CHECK),/*#__PURE__*/React.createElement("span",null,A2_DONE," ",toArabicDigits(v.target)," / ",toArabicDigits(v.target)),v.idx<len-1&&/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onNext,style:s.eziaDoneNext},A2_NEXT))))),items!==null&&len>0&&d&&/*#__PURE__*/React.createElement("div",{style:s.eziaDock},/*#__PURE__*/React.createElement("div",{className:"ezia-dock-inner"},/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onPrev,disabled:v.idx<=0,style:v.idx<=0?{...s.eziaDockBtn,...s.eziaDockBtnOff}:s.eziaDockBtn,"aria-label":A2_PREV},A2_ICON_BACK),/*#__PURE__*/React.createElement(A3AudioBtn,{d:d,playing:v.playing,onAudio:v.onAudio,style:s.eziaDockBtn,styleOn:s.eziaDockBtnOn}),/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onCount,style:v.full?{...s.eziaCountBtn,...s.eziaCountBtnDone}:s.eziaCountBtn,"aria-label":A2_COUNT_ARIA,"aria-disabled":v.full?'true':'false'},/*#__PURE__*/React.createElement("span",{style:s.eziaCountNums},toArabicDigits(v.count)," / ",toArabicDigits(v.target)),/*#__PURE__*/React.createElement("span",{style:s.eziaCountLabel},v.full?A2_ICON_CHECK:A2_ICON_PLUS,/*#__PURE__*/React.createElement("span",null,v.full?A2_DONE:A2_COUNT))),/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onShare,style:s.eziaDockBtn,"aria-label":A2_SHARE},A2_ICON_SHARE),/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:v.onNext,disabled:v.idx>=len-1,style:v.idx>=len-1?{...s.eziaDockBtn,...s.eziaDockBtnOff}:s.eziaDockBtn,"aria-label":A2_NEXT},A2_ICON_ONWARD))));}// ---- S103 ISTANA ADHKAR END ---------------------------------------------------------------
// One category, full screen. The audio contract is DhikrCard's, kept identical on purpose:
// one <Audio> at a time, a second tap on the playing item stops it, tapping another item
// swaps to it, and ended/error both clear the playing state so a failed file cannot leave a
// stop button that never stops. The element is also paused and dropped on unmount, so
// leaving the screen mid-recitation leaves nothing playing behind it.
function AdhkarCategoryV2({cat,startAt,onBack}){// Session 85. THE LOGIC BELOW IS UNCHANGED and stays here: one loader, one audio element,
// one counter writer, one favourite writer, one share handler. The two readers underneath
// are presentation only -- they are handed what this component has already resolved and
// they call back into these handlers; neither of them reads or writes storage itself.
// Session 86: the same APPLICATION style hook the browse screen and the home screen read.
// S102: the layout key is gone; there is nothing left to branch on here either.
const[items,setItems]=useState(null);const[idx,setIdx]=useState(0);// the item being read, 0-based
const[prog,setProg]=useState(readAdhkarProgress);const[favs,setFavs]=useState(readAdhkarFavorites);const[note,setNote]=useState('');// share feedback, announced politely
const audioRef=useRef(null);const[playingId,setPlayingId]=useState(null);useEffect(()=>{let alive=true;// The opening position is CLAMPED to the real list: a saved favourite opens at its own
// item, and anything that does not name one of this category's positions opens at the
// first. No index outside the store's own list can be reached from here.
const at=list=>{const n=parseInt(startAt,10);if(!list.length||!Number.isFinite(n)||n<1)return 0;return Math.min(n,list.length-1);};loadAdhkar().then(db=>{if(alive){const list=db.byCat&&db.byCat[parseInt(cat.id,10)]||[];setItems(list);setIdx(at(list));}}).catch(()=>{if(alive){setItems([]);setIdx(0);}});return()=>{alive=false;};},[cat.id]);useEffect(()=>()=>{if(audioRef.current){audioRef.current.pause();audioRef.current=null;}},[]);// UNCHANGED audio contract -- DhikrCard's, code point for code point: one Audio at a time, a
// second tap stops, ended/error clear the state, and the element is built from d.audio and
// from nothing else. The control is rendered only when d.audio exists, so there is never a
// button that pretends to a recitation the store does not have.
const toggle=d=>{if(audioRef.current){audioRef.current.pause();audioRef.current=null;}if(playingId===d.id){setPlayingId(null);return;}if(!d.audio)return;const a=new Audio(d.audio);audioRef.current=a;setPlayingId(d.id);a.onended=()=>setPlayingId(null);a.onerror=()=>setPlayingId(null);a.play().catch(()=>setPlayingId(null));};// Moving between items stops what is playing: the recitation belongs to the dhikr on screen.
const go=n=>{if(!items||items.length===0)return;const next=Math.min(items.length-1,Math.max(0,n));if(next===idx)return;if(audioRef.current){audioRef.current.pause();audioRef.current=null;}setPlayingId(null);setNote('');setIdx(next);};// SHARING. Nothing is transmitted until this handler runs, and it runs only from the share
// control. The payload is read HERE, at the moment of the tap, off the item currently loaded
// in the store -- no cached copy, no accumulated buffer, no other item, and no progress,
// favourites or usage state, which never enter any payload anywhere in this file.
const onShare=()=>{const cur=items&&items[idx]||null;const text=cur&&typeof cur.text==='string'?cur.text:'';if(!text)return;const fail=e=>{if(e&&e.name==='AbortError'){setNote('');return;}setNote(A2_SHARE_FAIL);};try{if(navigator.share){navigator.share({text:text}).then(()=>setNote(A2_SHARE_OK)).catch(fail);return;}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>setNote(A2_COPY_OK)).catch(fail);return;}}catch(e){setNote(A2_SHARE_FAIL);return;}setNote(A2_SHARE_FAIL);};const d=items&&items[idx]||null;const target=adhkarTarget(d);// Clamped for DISPLAY as well as on write, so a stored count larger than a target that has
// since changed still reads as "target of target" and never as more than the target.
const count=Math.min(adhkarCountOf(prog,cat.id,idx),target);const full=count>=target;const fkey=adhkarItemKey(cat.id,idx);const isFav=favs.indexOf(fkey)!==-1;const catDone=items?adhkarCatDone(prog,cat.id,items):0;// ONE view object again. Every value in it was resolved above out of the store or out of the
// progress record; every handler in it is one of this component's own. The two readers get
// the same object and differ only in how they draw it.
const view={cat:cat,onBack:onBack,items:items,d:d,idx:idx,count:count,target:target,full:full,isFav:isFav,note:note,prog:prog,catDone:catDone,playing:!!(d&&playingId===d.id),onPrev:()=>go(idx-1),onNext:()=>go(idx+1),// One press, one increment, and the press is refused at the target -- the cap lives here,
// in the single call site of bumpAdhkarCount, and no reader can raise it.
onCount:()=>{if(!full)setProg(bumpAdhkarCount(cat.id,idx,target));},onFav:()=>setFavs(toggleAdhkarFavorite(fkey)),onShare:onShare,onAudio:()=>{if(d)toggle(d);}};// S103: one reader shell, and every protected action of the deleted two survives in it.
return/*#__PURE__*/React.createElement(IstanaAdhkarReader,view);}// The audio control, shared by both readers so the contract cannot drift between them: it is
// RENDERED ONLY when the loaded item genuinely carries d.audio, and it is the same toggle in
// both designs. No item without a recitation ever shows a listen button.
function A3AudioBtn({d,playing,onAudio,style,styleOn}){if(!d||!d.audio)return null;return/*#__PURE__*/React.createElement("button",{type:"button",className:"adhkar2-focus",onClick:onAudio,style:playing?{...style,...styleOn}:style,"aria-label":playing?A2_STOP:A2_LISTEN},playing?/*#__PURE__*/React.createElement(PauseIcon,{size:16}):/*#__PURE__*/React.createElement(PlayIcon,{size:16}));}// The one place the flag is spent. App still renders <AdhkarScreen onBack=... /> and knows
// nothing about either version, so ?adhkarui=0 changes this line's answer and nothing else.
function AdhkarScreen({onBack}){return ADHKAR_UI_V2_ON?/*#__PURE__*/React.createElement(AdhkarScreenV2,{onBack:onBack}):/*#__PURE__*/React.createElement(AdhkarScreenV1,{onBack:onBack});}// ============================================================
// SESSION 87 -- ONE BACK HIERARCHY FOR THE WHOLE APPLICATION.
// ------------------------------------------------------------
// THE DEFECT THIS REPLACES: every non-chat screen resolved a browser/hardware back to the CHAT,
// because the chat was written as the generic fallback. Reading a dhikr and pressing back left
// the adhkar altogether; so did the mushaf's second back, and the memorizer's, and the settings
// sheet's. The hierarchy below is the one the app already looks like:
//
//   nested layer (open surah / opened adhkar category / running drill) -> its own parent screen
//   feature section (mushaf, adhkar, memorizer)                        -> HOME
//   sheet (parent gate, parent dashboard, settings)                    -> whoever opened it
//   home                                                               -> the app root, as before
//   call                                                               -> the chat, as before
//
// THE REGISTRY. A feature owns its nested layer and nothing outside it may reach into that
// state, so nothing is lifted: while a layer is open the feature REGISTERS its own closer here,
// and the application's single resolver asks the registry before it considers leaving a screen.
// The last registration is the deepest layer, closing or unmounting removes that exact entry,
// and a closed layer therefore can never answer a later press.
//
// SESSION 91 -- EVERY LAYER OWNS ITS OWN HISTORY ENTRY.
// ------------------------------------------------------------
// THE DEFECT THIS REPLACES: a nested layer (an opened dhikr, an opened mushaf page, a running
// drill) pushed NOTHING when it opened, so it was not represented in the history at all. The
// first device back therefore had no entry of its own to spend and consumed the SECTION's entry
// instead; the popstate handler then closed the layer and MINTED A REPLACEMENT entry to stand in
// for the one it had just destroyed. The web stack looked right afterwards, but the browser's
// back-forward list had been truncated and re-appended on every nested back, and a native
// WebView wrapper that caches canGoBack around that window is left holding a stale answer -- so
// the SECOND device back in the same section reached the wrapper's exit path instead of the app.
// Below, opening a layer pushes one real entry at the moment it opens, and closing it spends
// exactly that entry. Nothing is minted inside a popstate handler any more.
//
// THE LEDGER. One counter for the entries this app owns and has not yet spent, at module scope
// because two writers push into the same browser stack -- the App's screen effect and the layer
// hook below -- and they must count the same entries. `current` is that count, so it reads and
// means exactly what it always did.
const histDepthRef={current:0};function ezikHistPush(state){try{window.history.pushState(state,'');histDepthRef.current++;return true;}catch(e){return false;}}// A pop already happened in the browser: just stop counting the entry it spent. Never negative.
function ezikHistSpend(){if(histDepthRef.current>0)histDepthRef.current--;}// Ask the browser to go back, and ONLY while an entry of ours is on the stack -- so a back can
// never reach past the app's first entry and the platform's exit at the root is untouched.
function ezikHistBack(){if(histDepthRef.current<=0)return false;try{window.history.back();return true;}catch(e){return false;}}// The one back the WHOLE app presses. Module scope so a nested layer's own visible back button
// reaches the same resolver the device button reaches -- same route, same result -- without
// threading a callback down through every feature. App installs its resolver here.
let ezikBackHandler=null;function ezikGoBack(){return typeof ezikBackHandler==='function'?ezikBackHandler():false;}const ezikBackLayers=[];function ezikCloseDeepestLayer(){for(let i=ezikBackLayers.length-1;i>=0;i--){const close=ezikBackLayers[i];if(typeof close==='function'&&close()!==false)return true;}return false;}// The registration hook. `open` says whether this feature currently HAS a nested layer; while it
// does, `close` peels exactly one level off it and nothing more. The closer is read through a
// ref so a re-render does not churn the registry, and the cleanup removes this entry by
// identity -- never one another feature registered.
function useEzikBackLayer(open,close){const closeRef=useRef(close);useEffect(()=>{closeRef.current=close;});useEffect(()=>{if(!open)return undefined;// S91: THE LAYER TAKES ITS ENTRY HERE, on the closed->open edge and nowhere else. `open` is a
// boolean and it is the whole dependency list, so changing WHICH dhikr, page or surah is being
// read inside an already-open layer re-runs nothing and pushes nothing -- one layer, one entry.
ezikHistPush({layer:true});const entry=()=>{const f=closeRef.current;if(typeof f!=='function')return false;f();return true;};ezikBackLayers.push(entry);return()=>{const i=ezikBackLayers.indexOf(entry);if(i!==-1)ezikBackLayers.splice(i,1);};},[open]);}// THE DESTINATION TABLE, and it is the whole of the policy. It is a pure function of the screen
// being left and of the origin the sheets recorded, so the visible back button and the hardware
// back button cannot disagree: both ask this. `null` means "this screen has no parent inside the
// app" -- the roots -- and the caller then changes nothing at all.
const EZIK_ROOT_SCREENS=['loading','onboarding','chat'];// S98: «المفضلة» joins the sheets. It is opened from the chat's own drawer through openEzikSheet,
// so it records its opener on the way in and its back returns THERE — the same contract الإعدادات
// has had since S90, and the device button and the visible back button therefore agree.
const EZIK_SHEET_SCREENS=['parentGate','parentDashboard','settings','favorites'];function ezikBackTarget(cur,sheetOrigin){if(EZIK_ROOT_SCREENS.indexOf(cur)!==-1)return null;// The call keeps its own documented exit contract: ending a call returns to the chat, and the
// hardware button now agrees with the call screen's own button instead of contradicting it.
if(cur==='call')return'chat';// Home is the root of the feature sections. Leaving home is the platform-level exit the app
// has always had -- the entry underneath home is the chat the app booted into -- so this line
// preserves that behaviour and invents no loop.
if(cur==='home')return'chat';// A sheet returns to the screen that opened it, and to home when nothing valid was recorded.
// S90: الإعدادات is itself an opener now -- the التحكم row opens the PIN gate from inside it --
// so it joins the openers a sheet may be sent back to. A sheet is never sent back to itself.
if(EZIK_SHEET_SCREENS.indexOf(cur)!==-1){const known=sheetOrigin==='chat'||sheetOrigin==='home'||sheetOrigin==='settings';return known&&sheetOrigin!==cur?sheetOrigin:'home';}// Every feature section: home, never the chat.
return'home';}// ============================================================
// S92 — المحادثات المحفوظة (saved conversations)
// ============================================================
// The chat used to hold exactly ONE thread, in the 'messages' key: opening the app restored it
// and «محادثة جديدة» overwrote it. This layer keeps a LIST instead, through the SAME storage the
// rest of the app uses — localStorage, every touch inside its own try/catch — so a locked, full
// or disabled store degrades to "no history" and can never break the chat itself.
//
// SHAPE. One small index under EZIK_CHATS_KEY — [{ id, pk, title, pinned, at }] — plus one blob
// per conversation under EZIK_CHAT_PREFIX + id holding the messages ARRAY VERBATIM. The messages
// are stored exactly as the thread holds them, which is what carries the source cards back: a
// card is parsed out of the reply TEXT at render time (see SourceCard), and that text is what is
// saved, so a restored reply renders the identical cards without storing anything about them.
//
// `pk` is the profile a conversation belongs to, and EVERY read filters on it — that is the whole
// of the isolation: a second child on the same device never sees the first one's history.
const EZIK_CHATS_KEY='ezik_chats_v1';const EZIK_CHAT_PREFIX='ezik_chat_v1_';const EZIK_CHAT_TITLE_MAX=40;const EZIK_CHATS_MAX=60;// oldest UNPINNED conversations are dropped past this
const EZIK_LEGACY_MSGS_KEY='messages';// A random, opaque identifier — used for both conversation ids and profile ids. crypto when the
// platform has it, and a time+random fallback when it does not; either way it is only ever a
// local key, never anything a request carries.
function ezikMintId(){try{const b=new Uint8Array(8);window.crypto.getRandomValues(b);let out='';for(let i=0;i<b.length;i++)out+=(b[i]+0x100).toString(16).slice(1);return out;}catch(e){return Date.now().toString(36)+Math.random().toString(36).slice(2,10);}}// The profile identity a conversation is filed under. Minted ONCE and stored ON the profile
// object, so it survives every boot and is never re-derived from a field the child can see or
// change — two children who happen to share a name still get separate histories, and renaming
// could not move anyone's history even if renaming existed. Profiles created before this session
// are given one by the boot migration, beside the birthYear migration that already lives there.
function ezikProfileKey(p){return p&&typeof p.pid==='string'&&p.pid?p.pid:'anon';}function ezikReadChatIndex(){let raw;try{raw=localStorage.getItem(EZIK_CHATS_KEY);}catch(e){return[];}if(!raw)return[];let list;try{list=JSON.parse(raw);}catch(e){return[];}if(!Array.isArray(list))return[];return list.filter(r=>r&&typeof r.id==='string'&&r.id);}function ezikWriteChatIndex(list){try{localStorage.setItem(EZIK_CHATS_KEY,JSON.stringify(list));}catch(e){}}// THE ORDER THE MENU SHOWS, and the only place it is decided: pinned first, then the most
// recently written. Both keys are read from the index alone, so the menu never has to open a
// single conversation blob to sort itself.
function ezikSortChats(list){return list.slice().sort((a,b)=>(b&&b.pinned?1:0)-(a&&a.pinned?1:0)||(b&&b.at||0)-(a&&a.at||0));}function ezikListChats(pk){return ezikSortChats(ezikReadChatIndex().filter(r=>r.pk===pk));}function ezikReadChatMessages(id){let raw;try{raw=localStorage.getItem(EZIK_CHAT_PREFIX+id);}catch(e){return[];}if(!raw)return[];try{const m=JSON.parse(raw);return Array.isArray(m)?m:[];}catch(e){return[];}}// The readable text of a message, whatever shape its content has. A plain turn is a string; an
// attachment turn is an array of blocks and only its text block is words — so a photo sent with
// «اشرح لي هذا» reads as that, and never as base64.
function ezikMessageText(m){if(!m)return'';if(typeof m.content==='string')return m.content;if(Array.isArray(m.content)){return m.content.filter(b=>b&&b.type==='text'&&typeof b.text==='string').map(b=>b.text).join(' ');}return'';}// The title, and it is taken from the FIRST QUESTION the child asked — never from a reply, so a
// conversation is named by what was wanted rather than by what was answered. Whitespace collapses
// to single spaces, and a long question is cut on a word boundary when one falls near the limit
// so a title never ends mid-word.
function ezikChatTitle(msgs){let first=null;for(let i=0;i<(msgs||[]).length;i++){if(msgs[i]&&msgs[i].role==='user'){first=msgs[i];break;}}let t=ezikMessageText(first).replace(/\s+/g,' ').trim();if(!t)return'محادثة';if(t.length>EZIK_CHAT_TITLE_MAX){const cut=t.slice(0,EZIK_CHAT_TITLE_MAX);const sp=cut.lastIndexOf(' ');t=(sp>EZIK_CHAT_TITLE_MAX-14?cut.slice(0,sp):cut).trim()+'…';}return t;}// Past the cap, the oldest UNPINNED conversations are dropped — a pinned one is never dropped by
// age, which is what pinning is for. Dropping removes the blob too, so the store cannot fill with
// bodies whose index rows are gone.
function ezikTrimChats(list){if(list.length<=EZIK_CHATS_MAX)return list;const sorted=ezikSortChats(list);// pinned first, so the head is never a pinned drop
const head=sorted.slice(0,EZIK_CHATS_MAX);const tail=sorted.slice(EZIK_CHATS_MAX);const keptTail=tail.filter(r=>r.pinned);tail.filter(r=>!r.pinned).forEach(r=>{try{localStorage.removeItem(EZIK_CHAT_PREFIX+r.id);}catch(e){}});return head.concat(keptTail);}// Writing the body, and the one place a quota failure is handled. A thread carrying a photo or a
// PDF is large, so a full store is a real outcome rather than a theoretical one: the CURRENT
// conversation is the one that must survive, so on failure the oldest unpinned OTHER conversation
// is evicted and the write retried. The pool only shrinks, so the loop always terminates, and a
// store that refuses even an empty write simply returns false and the chat carries on unsaved.
// `idx` is mutated in step with the eviction so the caller writes an index that matches the store.
function ezikWriteChatBody(id,msgs,idx){const payload=JSON.stringify(msgs);const pool=ezikSortChats(idx.filter(r=>r.id!==id&&!r.pinned));for(;;){try{localStorage.setItem(EZIK_CHAT_PREFIX+id,payload);return true;}catch(e){}const victim=pool.pop();// sorted newest-first, so pop() is the oldest
if(!victim)return false;try{localStorage.removeItem(EZIK_CHAT_PREFIX+victim.id);}catch(e2){}const i=idx.indexOf(victim);if(i!==-1)idx.splice(i,1);}}// THE AUTOSAVE. Called after every turn the chat commits, and it is a NO-OP until the thread
// holds a real question: an empty thread — and a thread holding nothing but the boot greeting —
// is never filed. That is exactly what "the empty chat is not saved" means, and it is enforced
// here rather than at the call sites, so no path can file an empty one by forgetting to ask.
// Returns the id the conversation was filed under, so a first save hands the chat its identity.
function ezikSaveChat(id,msgs,pk){const list=(msgs||[]).filter(Boolean);let hasQuestion=false;for(let i=0;i<list.length;i++){if(list[i].role==='user'){hasQuestion=true;break;}}if(!hasQuestion)return null;const cid=id||ezikMintId();const idx=ezikReadChatIndex();let prev=null;for(let i=0;i<idx.length;i++){if(idx[i].id===cid){prev=idx[i];break;}}// The title is minted once, from the first question, and a later turn never renames it.
const rec={id:cid,pk:pk,title:prev&&prev.title?prev.title:ezikChatTitle(list),pinned:!!(prev&&prev.pinned),at:Date.now()};const rest=idx.filter(r=>r.id!==cid);if(!ezikWriteChatBody(cid,list,rest))return null;// store refused: file nothing
ezikWriteChatIndex(ezikTrimChats([rec].concat(rest)));return cid;}function ezikDeleteChat(id){try{localStorage.removeItem(EZIK_CHAT_PREFIX+id);}catch(e){}ezikWriteChatIndex(ezikReadChatIndex().filter(r=>r.id!==id));}function ezikToggleChatPin(id){ezikWriteChatIndex(ezikReadChatIndex().map(r=>r.id===id?{id:r.id,pk:r.pk,title:r.title,pinned:!r.pinned,at:r.at}:r));}// "Delete all my data" has to mean the history too — every body and the index with them.
function ezikClearAllChats(){ezikReadChatIndex().forEach(r=>{try{localStorage.removeItem(EZIK_CHAT_PREFIX+r.id);}catch(e){}});try{localStorage.removeItem(EZIK_CHATS_KEY);}catch(e){}try{localStorage.removeItem(EZIK_LEGACY_MSGS_KEY);}catch(e){}}// THE PARENTS' LOG. Before this session the thread on screen WAS the child's whole record, so the
// parental dashboard could read it straight off `messages`. The chat now opens empty, which would
// have left that dashboard showing «لا توجد محادثات بعد» to a parent whose child has a full
// history -- a real loss of oversight, not a cosmetic one. So the log is assembled from the saved
// conversations instead: all of the ACTIVE profile's, oldest first, as one transcript. That is
// exactly what the dashboard displayed before, when a child could only ever have one thread, and
// no other profile's messages can enter it because the rows are filtered by pk first.
function ezikProfileTranscript(pk){const rows=ezikReadChatIndex().filter(r=>r.pk===pk).sort((a,b)=>(a&&a.at||0)-(b&&b.at||0));let out=[];for(let i=0;i<rows.length;i++)out=out.concat(ezikReadChatMessages(rows[i].id));return out;}// ONE-SHOT migration of the single legacy thread. 'messages' held whatever the child was in the
// middle of when this shipped; it is filed as that profile's first saved conversation and the key
// is then removed, so nothing anyone had is lost and the migration cannot run a second time. A
// legacy thread with no question in it (a greeting alone) files nothing and the key still goes.
function ezikMigrateLegacyThread(pk){let raw;try{raw=localStorage.getItem(EZIK_LEGACY_MSGS_KEY);}catch(e){return;}if(!raw)return;let msgs=null;try{msgs=JSON.parse(raw);}catch(e){msgs=null;}if(Array.isArray(msgs)&&msgs.length)ezikSaveChat(null,msgs,pk);try{localStorage.removeItem(EZIK_LEGACY_MSGS_KEY);}catch(e){}}// ============================================================
// S99 — سهولة الاستخدام (local reading preferences)
// ============================================================
// THREE PREFERENCES, ONE KEY, PER PROFILE. Text size, reading mode and reduced motion are device
// preferences, not account data: they live under their own versioned key, they are filed under the
// profile that chose them, and nothing about them ever reaches the network. The conversation store
// and the profile object are untouched — this adds a key beside them and changes neither.
//
// They are applied by moving three attributes on <html>, so the whole interface follows one write
// and no component subscribes to anything. --ez-fs is the multiplier the styles object above reads.
const EZIK_A11Y_KEY='ezik_reading_prefs_v1';const EZIK_A11Y_DEFAULTS={fontSize:'normal',reading:false,reduceMotion:false};function ezikReadA11yAll(){let raw;try{raw=localStorage.getItem(EZIK_A11Y_KEY);}catch(e){return{};}if(!raw)return{};let map;try{map=JSON.parse(raw);}catch(e){return{};}if(!map||typeof map!=='object'||Array.isArray(map))return{};return map;}// One profile's preferences, with every field validated. An unknown size, a non-boolean flag, a
// record that is not an object at all — each falls back to the default rather than reaching the
// renderer, so a corrupt file degrades to "the app as it shipped" and never to a broken screen.
function ezikReadA11y(pk){const map=ezikReadA11yAll();const raw=map&&map[pk];const out={fontSize:EZIK_A11Y_DEFAULTS.fontSize,reading:false,reduceMotion:false};if(!raw||typeof raw!=='object')return out;if(typeof raw.fontSize==='string'&&Object.prototype.hasOwnProperty.call(EZIK_FS_SCALES,raw.fontSize))out.fontSize=raw.fontSize;out.reading=raw.reading===true;out.reduceMotion=raw.reduceMotion===true;return out;}// Writing returns whether the store actually took it, so the UI never claims a preference was
// saved when a disabled or full store refused it. A profile at defaults is REMOVED rather than
// written, so the key cannot grow a record per profile that never changed anything.
function ezikWriteA11y(pk,prefs){if(!pk)return false;const map=ezikReadA11yAll();const isDefault=prefs.fontSize===EZIK_A11Y_DEFAULTS.fontSize&&!prefs.reading&&!prefs.reduceMotion;if(isDefault)delete map[pk];else map[pk]={fontSize:prefs.fontSize,reading:!!prefs.reading,reduceMotion:!!prefs.reduceMotion};try{localStorage.setItem(EZIK_A11Y_KEY,JSON.stringify(map));return true;}catch(e){return false;}}function ezikClearAllA11y(){try{localStorage.removeItem(EZIK_A11Y_KEY);}catch(e){}}// THE ONE PLACE THE PREFERENCES BECOME VISIBLE. Three attributes and one custom property on the
// root element; every rule and every scaled size reads them from there. Called on load and on
// each change, and never from a render path.
// The local half of the answer, remembered so the listener below can re-ask the whole question
// without going back to the store for a profile key it has no business knowing.
let ezikLocalMotionPref=false;function ezikApplyA11y(prefs){const p=prefs||EZIK_A11Y_DEFAULTS;try{const el=document.documentElement;const scale=EZIK_FS_SCALES[p.fontSize]||1;el.style.setProperty('--ez-fs',String(scale));el.setAttribute('data-ez-fs',p.fontSize||'normal');if(p.reading)el.setAttribute('data-ez-read','1');else el.removeAttribute('data-ez-read');// EITHER SOURCE, ONE ATTRIBUTE. `data-ez-motion` is what every reduced-motion rule reads,
// and it now means «this reader is owed stillness» rather than «this reader found the
// switch». MEASURED before this: a `.ez-anim` element under the PLATFORM setting still
// reported animationName `fadeIn`, because the @media block covered only the two S98
// surfaces while the switch covered the fades, the watermark and the smooth scroll too.
ezikLocalMotionPref=!!p.reduceMotion;if(ezikMotionReduced(p.reduceMotion))el.setAttribute('data-ez-motion','reduce');else el.removeAttribute('data-ez-motion');}catch(e){}}// THE OS CAN CHANGE ITS MIND WHILE THE APP IS OPEN. The rules read the attribute, so the
// attribute is re-synced when the platform query flips. Nothing subscribes to this and no
// component re-renders: one attribute on one element, which is where the answer already lives.
try{const ezMq=window.matchMedia('(prefers-reduced-motion: reduce)');const ezSyncMotion=()=>{try{const el=document.documentElement;if(ezikMotionReduced(ezikLocalMotionPref))el.setAttribute('data-ez-motion','reduce');else el.removeAttribute('data-ez-motion');}catch(e){}};if(ezMq.addEventListener)ezMq.addEventListener('change',ezSyncMotion);else if(ezMq.addListener)ezMq.addListener(ezSyncMotion);}catch(e){}// Does the app owe this user stillness? EITHER the local preference OR the platform one. The
// platform is asked through matchMedia at the moment of the question, never cached, so turning it
// on in the OS settings takes effect without a reload.
function ezikMotionReduced(localPref){if(localPref)return true;try{return!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){return false;}}// The same question for a component that holds no preference of its own. ezikApplyA11y has already
// put the answer on <html>, so reading it back there is reading the SAME value App holds — one
// source of truth, no second copy of the preference threaded through the tree to fall out of date.
function ezikMotionReducedNow(){try{if(document.documentElement.getAttribute('data-ez-motion')==='reduce')return true;}catch(e){}return ezikMotionReduced(false);}let EZIK_A11Y_TITLE=ezT("a11y.title");let EZIK_A11Y_FS_LABEL=ezT("a11y.fontSize");let EZIK_A11Y_FS_NORMAL=ezT("a11y.fontNormal");let EZIK_A11Y_FS_LARGE=ezT("a11y.fontLarge");let EZIK_A11Y_FS_XLARGE=ezT("a11y.fontXLarge");let EZIK_A11Y_READ=ezT("a11y.reading");let EZIK_A11Y_READ_HINT=ezT("a11y.readingHint");let EZIK_A11Y_MOTION=ezT("a11y.motion");let EZIK_A11Y_MOTION_HINT=ezT("a11y.motionHint");let EZIK_A11Y_RESET=ezT("a11y.reset");// ============================================================
// S98 — المفضلة المحلية (local favourite replies)
// ============================================================
// A SEPARATE STORE, and separate is the whole design. It lives under its own versioned key, it is
// never written by the conversation autosave, and the conversation autosave never reads it — so
// the shape of a saved conversation is byte-for-byte what S92 shipped and nothing here can migrate,
// reshape or corrupt it. Deleting a conversation therefore cannot take a saved reply with it,
// which is precisely why a favourite carries its OWN copy of the text.
//
// A record is the minimum that lets the favourites screen stand on its own:
//   id      — the identity of a saved reply. See ezikFavId: it is a POSITION, not a text.
//   pk      — the profile it belongs to, the same isolation every chat read applies. REQUIRED.
//   chatId  — the conversation it came from, or null for a thread not yet filed. Used to offer to
//             open THAT conversation, and it is part of the identity.
//   idx     — the reply's position in that conversation, and part of the identity.
//   at      — when it was saved.
//   snippet — a clean, tag-free line for the list.
//   text    — the reply VERBATIM, which is what keeps it readable after its conversation is gone.
// THE THREE KINDS. The store has held ONE kind since it shipped -- a whole assistant reply --
// and its key still says so. The key does NOT change: renaming it would orphan every
// favourite already on a device, and the one thing this item may not do is lose one.
//
// A record written before this item has no `kind`. It reads as 'reply', which is what it is.
// That is the whole migration, and it is a read-time default rather than a rewrite: nothing
// touches a stored record until the reader next changes something.
//
// «الإحالة» to adhkar_favorites_v1: THAT IS A DIFFERENT STORE AND IS NOT MERGED HERE. It
// holds dhikr keys, it is written by the adhkar screens alone, and nothing in this block
// reads it, writes it, counts it or shows it.
const EZIK_FAV_KINDS=['reply','fatwa','ayah'];const EZIK_FAV_KIND_DEFAULT='reply';const ezikFavKind=k=>EZIK_FAV_KINDS.indexOf(k)===-1?EZIK_FAV_KIND_DEFAULT:k;// THE kind of a record, and the only place that decides it. A record with no kind is a reply --
// which is every reply ever saved, before this item and after it.
const ezikKindOf=f=>ezikFavKind(f&&f.kind);const EZIK_FAVS_EVENT='ezik:favourites';const EZIK_FAVS_KEY='ezik_favorite_replies_v1';const EZIK_FAVS_MAX=200;const EZIK_FAV_SNIPPET_MAX=140;// FNV-1a over a string. Cheap, stable across reloads and devices, and it needs no store of its own.
function ezikHashText(t){const str=String(t==null?'':t);let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}return'r'+h.toString(16)+'-'+str.length.toString(36);}// THE IDENTITY OF A SAVED REPLY, and it is a POSITION rather than a text.
//
// It used to be the hash of the reply alone, and that was wrong in two ways that only show up on a
// real device. Two conversations can hold the SAME answer — ask the same question twice and you
// get it — and the two would have shared one star and one "open the original", so starring the
// second silently re-pointed the first. Worse, two CHILDREN on one device could produce the same
// answer, and with the id equal the second child's star would have removed the first child's
// favourite: one profile reaching into another's data, which is the one thing this app's storage
// discipline exists to prevent.
//
// So the identity is (profile, conversation, position in that conversation), and the reply's text
// hash rides along as a VERIFICATION term: if the reply at that position is not the text that was
// saved, the id does not match and no stale star is drawn. `idx` is sound as a position because a
// thread is append-only — every path that commits a turn pushes onto the end, and the only thing
// that ever removes messages is resetThread, which empties the whole thread and drops its chatId
// with it. Nothing about a MESSAGE object changes: the index is read where the thread is already
// being mapped, and no byte is written into the conversation store.
//
// chatId is null only for a thread that has not been filed yet — the boot greeting, before the
// first question mints an id. Such a favourite is honest about having no conversation to return
// to; the screen says so rather than offering a button that would do nothing.
function ezikFavId(pk,chatId,idx,text){return String(pk||'')+'|'+String(chatId||'-')+'|'+String(idx)+'|'+ezikHashText(text);}// THE IDENTITY OF A SAVED FATWA OR AYAH. Not a position -- neither has one -- but the thing
// itself: a fatwa is its uid on the source, an ayah is its surah:ayah. The profile leads, as
// it does for a reply, so two children on one device can never share or remove a record; and
// the KIND is in the id, so a fatwa and a reply can never collide even if a source uid ever
// looked like a conversation id. The text hash rides along as the same verification term the
// reply id uses: if what is at that reference is not what was saved, the star is not drawn.
// AN AYAH'S REFERENCE, and the one function that builds it. The star on a card and the `ref`
// on a stored record are the same string by construction; two spellings of it would light a
// star for a verse that was never saved. Empty when the reference cannot be resolved, and an
// empty reference is never saved and never matched.
const ezikAyahFavKey=(surahNum,surahName,ayah)=>{const sn=resolveSurahNumber(surahName,surahNum);const an=parseInt(ayah,10);return sn&&an>=1?String(sn)+':'+String(an):'';};function ezikFavRefId(kind,pk,ref,text){return String(pk||'')+'|'+ezikFavKind(kind)+'|'+String(ref||'-')+'|'+ezikHashText(text);}// EVERY read is defensive, because this is a file on a device: it can be absent, it can be
// truncated, it can be hand-edited, and a half-written record can be left behind. None of those
// may reach the screen as an exception — the worst case is "no favourites".
//
// A record with no `pk`, or no `id`, is CORRUPT and is dropped. Neither can be recovered: the id
// is a position and cannot be re-derived from the text, and a record with no owner would otherwise
// have to be shown to every profile on the device — which is precisely the leak this file is
// written to prevent. The feature has never shipped, so nothing real can be lost here and no
// migration is owed to it.
function ezikReadFavs(){let raw;try{raw=localStorage.getItem(EZIK_FAVS_KEY);}catch(e){return[];}if(!raw)return[];let list;try{list=JSON.parse(raw);}catch(e){return[];}if(!Array.isArray(list))return[];const out=[];for(let i=0;i<list.length;i++){const r=list[i];if(!r||typeof r!=='object')continue;const text=typeof r.text==='string'?r.text:'';if(!text)continue;// a record with no reply in it is not one
if(typeof r.pk!=='string'||!r.pk)continue;// no owner: corrupt, and never shown
if(typeof r.id!=='string'||!r.id)continue;// no identity: corrupt, cannot be rebuilt
const rec={id:r.id,pk:r.pk,chatId:typeof r.chatId==='string'&&r.chatId?r.chatId:null,idx:typeof r.idx==='number'&&isFinite(r.idx)?r.idx:-1,at:typeof r.at==='number'&&isFinite(r.at)?r.at:0,snippet:typeof r.snippet==='string'&&r.snippet?r.snippet:ezikFavSnippet(text),text:text};// ONLY IF THE RECORD HAS THEM. A reply has no kind, no title and no ref and never did;
// adding them here would rewrite a record on the next write of the list -- including a
// record belonging to ANOTHER profile, which is a disturbance no read should cause.
if(EZIK_FAV_KINDS.indexOf(r.kind)!==-1&&r.kind!==EZIK_FAV_KIND_DEFAULT)rec.kind=r.kind;if(typeof r.title==='string'&&r.title)rec.title=r.title;if(typeof r.ref==='string'&&r.ref)rec.ref=r.ref;out.push(rec);}return out;}// Writing, and the one place a full store is handled. The list is newest-first, so the oldest
// favourite is the one dropped; the pool only shrinks, so the loop terminates. Returns the list
// ACTUALLY written — which the caller adopts, so the screen never shows a record the disk refused.
// null means the store would not take even an empty list (disabled/locked storage).
function ezikWriteFavs(list){let l=(list||[]).slice(0,EZIK_FAVS_MAX);for(;;){try{localStorage.setItem(EZIK_FAVS_KEY,JSON.stringify(l));// ANNOUNCED. A fatwa is saved from a screen the chat does not own, and the chat is NOT
// unmounted while that screen is up -- measured for item 65. Without this, a fatwa
// saved in الفتاوى would not appear in المفضلة until the app was reloaded.
try{window.dispatchEvent(new CustomEvent(EZIK_FAVS_EVENT));}catch(e2){}return l;}catch(e){}if(!l.length)return null;l=l.slice(0,l.length-1);}}// The list line. Built from the SAME serializer the clipboard uses, so no card tag can reach it.
function ezikFavSnippet(text){let clean='';try{const parsed=parseRichMessage(String(text==null?'':text),30);clean=serializeReply(parsed.segments,{tashkeel:true,band:'adult'});}catch(e){clean=String(text==null?'':text);}clean=clean.replace(/\s+/g,' ').trim();if(clean.length>EZIK_FAV_SNIPPET_MAX){clean=clean.slice(0,EZIK_FAV_SNIPPET_MAX).replace(/\s+\S*$/,'').replace(/\s+$/,'')+' …';}return clean;}function ezikMakeFav(text,pk,chatId,idx){const t=String(text==null?'':text);return{id:ezikFavId(pk,chatId,idx,t),pk:pk||null,chatId:chatId||null,idx:idx,at:Date.now(),snippet:ezikFavSnippet(t),text:t};}// A FATWA OR AN AYAH, made the same way and stored in the same list. `title` is what the card
// shows as its heading and `ref` is where it came from -- the two things a reply gets from its
// conversation and these two have to carry themselves. Neither has a chatId or an idx, and
// both are explicitly null/-1 rather than absent, so every record in the list has one shape.
function ezikMakeFavOf(kind,pk,ref,title,text){const t=String(text==null?'':text);return{id:ezikFavRefId(kind,pk,ref,t),kind:ezikFavKind(kind),pk:pk||null,chatId:null,idx:-1,at:Date.now(),snippet:ezikFavSnippet(t),text:t,title:String(title==null?'':title),ref:String(ref==null?'':ref)};}// THE TOGGLE ANY SCREEN CAN CALL. الفتاوى does not own the chat's state and must not be given
// it, so it goes through the store the same way the chat does: read, toggle by id, write --
// and the write announces, so every mounted screen re-reads. Returns whether it is now saved.
function ezikToggleFavRecord(rec){if(!rec||!rec.id||!rec.pk||!rec.text)return false;const cur=ezikReadFavs();const exists=cur.some(f=>f.id===rec.id);const next=exists?cur.filter(f=>f.id!==rec.id):[rec].concat(cur.filter(f=>f.id!==rec.id));const written=ezikWriteFavs(next);if(written===null)return exists;// the store refused: nothing changed
return!exists;}// "Delete all my data" has to mean the favourites too.
function ezikClearAllFavs(){try{localStorage.removeItem(EZIK_FAVS_KEY);}catch(e){}}// The labels, in one block, referenced through JS expressions rather than written into quoted JSX
// attributes — the convention SettingsSheet already follows for the same reason.
let EZIK_FAV_TITLE=ezT("favorites.title");let EZIK_FAV_HEADING=ezT("favorites.heading");let EZIK_FAV_ADD=ezT("favorites.add");let EZIK_FAV_DEL=ezT("favorites.remove");let EZIK_FAV_REMOVE=ezT("common.remove");let EZIK_FAV_OPEN_CHAT=ezT("favorites.openChat");let EZIK_FAV_CHAT_GONE=ezT("favorites.chatGone");const EZIK_FAV_EMPTY='لا توجد ردود محفوظة بعد. اضغط النجمة تحت أي رد لتحفظه هنا.';let EZIK_BACK=ezT("common.backArrow");let EZIK_SEARCH_PH=ezT("chat.searchPlaceholder");let EZIK_SEARCH_ARIA=ezT("chat.searchAria");let EZIK_SEARCH_RESULTS=ezT("chat.searchResults");let EZIK_SEARCH_NONE=ezT("common.noMatches");let EZIK_FAV_SEARCH_PH=ezT("favorites.searchPlaceholder");let EZIK_FAV_SEARCH_ARIA=ezT("favorites.searchAria");// S112: what the menu says when this profile has saved nothing yet. It is a STATEMENT about the
// store, drawn where the list would be; it reads nothing, writes nothing and offers no action.
let EZIK_CHATS_EMPTY=ezT("chat.noConversations");// The saved date, rendered from the record's own timestamp. Arabic-Kuwait with a Gregorian
// calendar, and a record whose `at` was lost simply shows no date rather than 1970.
function ezikFavDate(at){if(!at)return'';try{return new Date(at).toLocaleDateString('ar-KW',{year:'numeric',month:'long',day:'numeric'});}catch(e){try{return new Date(at).toISOString().slice(0,10);}catch(e2){return'';}}}// The compact form, for the dense search-results list where a spelled-out month wraps.
function ezikShortDate(at){if(!at)return'';try{return new Date(at).toLocaleDateString('ar-KW',{year:'numeric',month:'numeric',day:'numeric'});}catch(e){return ezikFavDate(at);}}// ============================================================
// S98 — البحث المحلي (local search, in the menu and in the favourites)
// ============================================================
// IT NEVER LEAVES THE DEVICE. There is no fetch on this path, no model call, and no index written
// to storage: the corpus is assembled in memory from the conversations already saved, held for as
// long as that list is unchanged, and thrown away with the tab. What the child types is a local
// string and goes nowhere.
//
// ITS OWN NORMALIZER, and normalizeArabic above is deliberately left alone — resolveSurahNumber
// depends on that one, and search needs two things it does not have: the ى/ي fold, and an INDEX
// MAP. The map is what lets a snippet be cut out of the ORIGINAL text after a hit was found in the
// normalized one; without it the two strings have different lengths (diacritics were dropped) and
// every snippet would be shifted by however many harakat preceded the match.
const EZIK_SNIPPET_RADIUS=45;const EZIK_CARD_TAG_RE=/<\/?(?:verse|surah|hadith|steps|suggestions|board|document|source|dhikr|worship)\b[^>]*>/gi;// The searchable form of a reply: the card MARKUP goes, the words inside the cards stay — so a
// hadith or a source's own text is findable, and no tag can ever surface in a snippet.
function ezikSearchPlain(t){return String(t==null?'':t).replace(EZIK_CARD_TAG_RE,' ').replace(/<[^>\n]{0,160}>/g,' ').replace(/[ \t ]+/g,' ');}// One pass that produces BOTH the normalized text and, for each of its characters, the index it
// came from in the source. Folds: harakat and the dagger alef and tatweel are dropped; آ أ إ ٱ
// become ا; ى becomes ي; runs of whitespace collapse to one space; latin letters lowercase.
function ezikSearchNormalize(src){const s=String(src==null?'':src);let out='';const map=[];let prevSpace=false;for(let i=0;i<s.length;i++){const code=s.charCodeAt(i);// 064B..0652 harakat · 0670 dagger alef · 0640 tatweel · 0653..065F extra marks · 06D6..06ED
if(code>=0x064B&&code<=0x065F||code===0x0670||code===0x0640||code>=0x06D6&&code<=0x06ED)continue;let ch=s.charAt(i);if(ch===' '||ch==='\t'||ch==='\n'||ch==='\r'||ch===' '){if(prevSpace)continue;ch=' ';prevSpace=true;}else{prevSpace=false;if(ch==='آ'||ch==='أ'||ch==='إ'||ch==='ٱ')ch='ا';else if(ch==='ى')ch='ي';else if(code>=0x41&&code<=0x5A)ch=ch.toLowerCase();}out+=ch;map.push(i);}return{text:out,map:map};}const ezikSearchQuery=q=>ezikSearchNormalize(q).text.trim();// The line under a result. Cut from the ORIGINAL text around the hit, walked out to word
// boundaries so it never starts or ends mid-word, and marked with ellipses where it was cut.
function ezikSearchSnippet(original,map,at,qLen){const src=String(original==null?'':original);if(!src)return'';if(at<0||!map.length)return src.slice(0,EZIK_SNIPPET_RADIUS*2).replace(/\s+/g,' ').trim();const oStart=map[Math.min(map.length-1,Math.max(0,at))];const oEnd=map[Math.min(map.length-1,Math.max(0,at+qLen-1))]+1;let from=Math.max(0,oStart-EZIK_SNIPPET_RADIUS);let to=Math.min(src.length,oEnd+EZIK_SNIPPET_RADIUS);while(from>0&&!/\s/.test(src.charAt(from-1)))from--;while(to<src.length&&!/\s/.test(src.charAt(to)))to++;let out=src.slice(from,to).replace(/\s+/g,' ').trim();if(from>0)out='… '+out;if(to<src.length)out=out+' …';return out;}// One conversation, made searchable. It reads the body the store already holds; it writes nothing.
function ezikBuildSearchRow(rec){const msgs=ezikReadChatMessages(rec.id);const parts=[];for(let i=0;i<msgs.length;i++){const t=ezikSearchPlain(ezikMessageText(msgs[i])).trim();if(t)parts.push(t);}const body=parts.join('\n');const norm=ezikSearchNormalize(body);return{id:rec.id,title:rec.title,at:rec.at,pinned:rec.pinned,body:body,hay:norm.text,map:norm.map,titleHay:ezikSearchNormalize(rec.title||'').text};}// The match. Order is the store's own — pinned first, then most recent — because the rows arrive
// already sorted and nothing here re-ranks them.
function ezikSearchChats(rows,q){const out=[];if(!q)return out;for(let i=0;i<(rows||[]).length;i++){const r=rows[i];const inTitle=r.titleHay.indexOf(q);const at=r.hay.indexOf(q);if(inTitle===-1&&at===-1)continue;out.push({id:r.id,title:r.title,at:r.at,pinned:r.pinned,snippet:at!==-1?ezikSearchSnippet(r.body,r.map,at,q.length):ezikSearchSnippet(r.body,r.map,0,1)});}return out;}// The same match over the favourites already in memory. No store is touched at all here.
function ezikSearchFavs(favs,q){const out=[];if(!q)return out;for(let i=0;i<(favs||[]).length;i++){const f=favs[i];const plain=ezikSearchPlain(f.text);const norm=ezikSearchNormalize(plain);const at=norm.text.indexOf(q);if(at===-1)continue;out.push(Object.assign({},f,{hit:ezikSearchSnippet(plain,norm.map,at,q.length)}));}return out;}// ============================================================
// THE REVEAL QUEUE -- how already-received text is PAINTED, and nothing else
// ============================================================
// THE DEFECT. The transport is honest: callAI accumulates text_delta into `full` and hands the
// whole of it to onDelta on every event, append-only, never rewritten. What is not smooth is
// what the SERVER emits -- a writing round produces a burst, then the round ends and nothing
// arrives for a while, then the next burst. Painting each burst the instant it lands makes the
// answer arrive in slabs with dead air between them.
//
// WHAT THIS IS. A paint queue in front of the state setter. Everything that has ARRIVED is held
// in a ref; a ticker walks a cursor forward through it and paints the PREFIX up to the cursor.
// The four promises, each of them a property of the arrangement and not of a test:
//   * it can never show text that has not arrived -- the only thing it ever paints is
//     arrived.slice(0, cursor), and the cursor is clamped to arrived.length on every push;
//   * it can never reorder -- a prefix of an append-only string, walked forward only;
//   * it can never change the final text, because the final text does not come through here at
//     all: sendMessage pushes `reply` into messages, byte for byte as callAI returned it;
//   * and when the answer completes, setStreamingText(null) stops the ticker in the same batch
//     that pushes the finished reply -- so a queue still draining is flushed by being replaced
//     with the whole of it, immediately, with nothing withdrawn.
//
// THE RATE. A tick every 28ms, moving an eighth of the backlog with a floor of two characters.
// A share of the backlog rather than a fixed rate is what makes it read as continuous at both
// ends: a 400-character burst drains in about a fifth of a second instead of trickling for six,
// and a slow trickle still moves every tick instead of stalling. The floor is what guarantees
// the cursor always advances, so the queue cannot livelock a byte short of the end.
//
// REDUCED MOTION SKIPS IT ENTIRELY. A reader who has asked for less movement is not asking for
// a typewriter; ezikMotionReducedNow() -- the platform preference OR the app's own -- paints the
// arrived text whole, exactly as the file did before this commit.
const EZIK_REVEAL_MS=28;const EZIK_REVEAL_DIVISOR=8;const EZIK_REVEAL_MIN_STEP=2;function App(){// S100: mounted here and not only in Settings, because the 'storage' event fires in the
// tabs that did NOT make the change -- a tab sitting on the chat has to repaint too. The
// hook owns no screen state and renders nothing; it keeps <html> honest.
// S116: the interface language, subscribed at the root. App owns every screen, so a switch
// made anywhere redraws all of them at once -- no reload, no route change, no lost thread.
const uiLang=useEzLang();useEzikVisualTheme();const[screen,setScreen]=useState('loading');const[selectedSurah,setSelectedSurah]=useState(null);// خطأ ٤٦: سورة المصحف المفتوحة، مرفوعة إلى App كي يقشرها زر الرجوع طبقةً طبقة
const[profile,setProfile]=useState(null);const[messages,setMessages]=useState([]);const[input,setInput]=useState('');// THE COMPOSER'S FOCUS, and it exists for exactly one reason: the section suggestions below
// are stacked cards while the reader is not writing and a scrolling row of pills while they
// are. Nothing else reads it, it is never stored, and it is not part of any payload.
const[composerFocused,setComposerFocused]=useState(false);const[depthMode,setDepthMode]=useState('brief');// 'brief' | 'detailed' | 'scholar' — adult-only 3-state cycle
const SCHOLAR_ENABLED=true;// scholar (طالب العلم) = adult-only 3rd depth state; ENABLED. Set false to hide it (cycle -> brief/detailed only). Server accepts scholar regardless of this flag.
const[pendingImage,setPendingImage]=useState(null);// { media_type, data } or null
const[attachMenuOpen,setAttachMenuOpen]=useState(false);const[drawerOpen,setDrawerOpen]=useState(false);// D85: the chat drawer (menu button)
// S92: the saved-conversation state. `chatId` is the conversation the thread on screen belongs
// to, and NULL means the thread has not been filed yet — a brand new, empty chat. `chatIdRef`
// is its synchronous mirror because the autosave runs after an await, inside a handler whose
// closure was built before the first save handed the chat its id. `chatList` is what the menu
// draws, always already ordered. `chatPendingDelete` is the row currently asking to be
// confirmed, and only ever one at a time.
const[chatId,setChatId]=useState(null);const chatIdRef=useRef(null);const[chatList,setChatList]=useState([]);const[chatPendingDelete,setChatPendingDelete]=useState(null);// S98: THE FAVOURITES, READ ONCE. This is the whole of the performance contract for the feature:
// localStorage is touched here, at mount, and then never again on a render path. No bubble reads
// the store, no bubble parses JSON, and the list of ids a bubble is asked about is a Set derived
// once per change. `favsRef` is the synchronous mirror the toggle reads, so two taps landing in
// the same task both see the truth instead of the same stale array.
const[favs,setFavs]=useState(ezikReadFavs);const favsRef=useRef(favs);// S98: WHICH REPLIES ARRIVED LIVE IN THIS THREAD, by position. A long reply is watched in full
// while it streams, so folding it the instant it settles would shrink the very text that was
// being read — a jump, and the one thing the fold is not allowed to cause. A reply whose index
// is in here opens EXPANDED; everything else opens folded, which is what a conversation restored
// from the store gets. It holds numbers, it is never written to storage, and it is emptied by
// resetThread and by openSavedChat — so a new chat, or another conversation, starts with none.
// The membership is decided by the real streaming transition (the line that retires
// streamingText and pushes the finished reply), never by comparing text.
// S99: the reading preferences. Read ONCE, per profile, into state; every change goes through
// setA11y, which writes the store and repaints the root attributes in one place. Nothing else in
// the tree reads the store, and no render path touches localStorage.
const[a11y,setA11yState]=useState(EZIK_A11Y_DEFAULTS);const a11yRef=useRef(a11y);const setA11y=next=>{const merged=Object.assign({},a11yRef.current,next);// The first time a larger size is chosen, the styles object becomes scalable. From then on the
// multiplier alone moves it, so switching between large and كبير جدًّا costs nothing more.
if(merged.fontSize!=='normal')ezikEnsureScalableStyles();const pk=ezikProfileKey(profileRef.current||profile);const stored=ezikWriteA11y(pk,merged);// A refused store must not leave the screen claiming a preference was saved. It IS applied for
// this session — the user asked for it and the app can honour it now — and it simply will not
// survive a reload, which is the honest outcome for storage that cannot be written.
a11yRef.current=merged;setA11yState(merged);ezikApplyA11y(merged);return stored;};const resetA11y=()=>setA11y(EZIK_A11Y_DEFAULTS);const[streamedOpen,setStreamedOpen]=useState(()=>new Set());// WHICH THREAD IS ON SCREEN, as a number that changes every time the thread is REPLACED — a
// conversation opened, or a new chat started. Nothing else changes it, because nothing else
// replaces the thread: every other path appends. A bubble carries it as the key of whatever the
// reader did to its fold, so opening a conversation invalidates every manual expand at once and
// a restored reply comes back folded, however identical its text is to the one just read.
const[threadEpoch,setThreadEpoch]=useState(0);const newThreadEpoch=()=>setThreadEpoch(n=>n+1);const markStreamedOpen=idx=>setStreamedOpen(prev=>{if(prev.has(idx))return prev;const next=new Set(prev);next.add(idx);return next;});// D88: seeded from the SAME reader the boot script used, so the first render already agrees
// with the attribute already on <html>. No effect runs at mount, so nothing can repaint.
const[theme,setTheme]=useState(readStoredTheme);const chooseTheme=t=>setTheme(applyTheme(t));const fileInputRef=useRef(null);const docInputRef=useRef(null);const[isLoading,setIsLoading]=useState(false);const[pinInput,setPinInput]=useState('');const[pinError,setPinError]=useState(false);const[reportFor,setReportFor]=useState(null);// {ai,user} of the reply being flagged, or null
// THE AI-CONSENT STATE (Apple 5.1.1(i) / 5.1.2(i)). Seeded from the store, and it is the state
// that DRAWS -- every send path reads hasValidAIConsent() from the store itself instead, so a
// stale render can never authorise a send. Independent of profile: an existing profiled reader
// who has never answered this version still sees the screen, and is neither wiped nor
// re-onboarded. The old `disclosureAck` key is deliberately NOT read: it is not consent.
const[aiConsent,setAiConsent]=useState(()=>aiConsentStatus());const[aiConsentReview,setAiConsentReview]=useState(false);// "review the choice" reopens the screen
// Granting is the ONLY writer of 'granted'. `by` is decided by the screen: 'user' at 13+,
// 'guardian' only after the in-app adult barrier has been passed.
const grantAIConsent=by=>{writeAIConsent(EZ_AI_CONSENT_GRANTED,by);setAiConsent(aiConsentStatus());setAiConsentReview(false);};// Declining, and withdrawing, are the SAME write -- there is one refused state, not two. The
// stop-everything below is what makes a withdrawal take effect on a screen that is already
// running: the in-flight stream is aborted, the audio is cancelled, the microphone is released.
// Saved conversations are NOT deleted: withdrawing consent to SEND is not a request to erase.
const declineAIConsent=()=>{writeAIConsent(EZ_AI_CONSENT_DECLINED,'user');try{if(abortRef.current)abortRef.current.abort();}catch(e){}try{cancelAudio();}catch(e){}try{stopCloudAll();}catch(e){}try{stopDictAll();}catch(e){}// EVERY live Web Speech engine, wherever it was built -- the chat's, the call's, and the
// memorizer's, which lives in a different component App has no handle on. The registry is why
// this is one line instead of three refs App would have to be given. Handlers are detached
// before the abort, so no onend survives to restart anything.
try{ezStopAllRecognition();}catch(e){}try{shouldListenRef.current=false;}catch(e){}try{callActiveRef.current=false;callGenRef.current++;}catch(e){}setIsListening(false);setIsLoading(false);setCallState('idle');setAiConsent(aiConsentStatus());setAiConsentReview(false);};// قفل الإنفاق: مفتوحٌ دائماً حين يكون القفل مُعطَّلاً (٦٤ صفراً) فلا يتغيّر سلوك اليوم إطلاقاً.
// spendGateRef مرآةٌ متزامنة يقرؤها callAI/fetchSpeechAudio دون إغلاقٍ على قيمةٍ بائتة.
const[spendGateOpenState,setSpendGateOpenState]=useState(spendGateOpen());const spendGateRef=useRef(spendGateOpenState);useEffect(()=>{spendGateRef.current=spendGateOpenState;},[spendGateOpenState]);const unlockSpendGate=()=>{try{localStorage.setItem(SPEND_GATE_KEY,SPEND_GATE_SHA256);}catch(e){}setSpendGateOpenState(true);};const[voiceMode,setVoiceMode]=useState(false);// chat TTS OFF by default (opt-in): silent unless the user taps a message’s listen button or turns on the header speaker toggle
// Parental lock for direct conversation (المكالمة). Dedicated localStorage key, read/written
// UNCONDITIONALLY (not gated by PERSIST_CONVERSATION, not stored in child_profile which is wiped
// on load). Stored value 'true' = LOCKED; absent/any-other = allowed (default OPEN — absence
// carries the default, so we never write 'false').
const[directConvoLocked,setDirectConvoLocked]=useState(localStorage.getItem('directConvoLocked')==='true');const[isListening,setIsListening]=useState(false);const[isSpeaking,setIsSpeaking]=useState(false);const[voiceError,setVoiceError]=useState('');const messagesEndRef=useRef(null);// S97: the scroll CONTAINER, which nothing used to hold a handle on -- the only scrolling the
// chat did was scrollIntoView on the sentinel above, and that cannot be made instant-before-paint.
const messagesAreaRef=useRef(null);// true from the moment a STORED conversation is loaded until its height has settled. While it is
// true the container is pinned to its own end before every paint, so the last reply is the first
// thing on screen and there is no descent to watch.
const jumpToEndRef=useRef(false);// false while the user has deliberately scrolled up to read something older. Nothing may drag
// them back down while it is false.
const stickToEndRef=useRef(true);// How many upcoming runs of the follow-the-reply effect belong to an OPEN rather than to a new
// message. Opening sets it to 1. Without it the two mechanisms race: the pin releases as soon as
// the layout settles, and on a SHORT conversation that happens before the follow effect runs, so
// the follow effect saw an unarmed pin and animated an open it was never meant to touch.
// A counter is decided by the code path, not by which timer won.
const skipFollowRef=useRef(0);// ── STREAM-P4 §٣/١: THE QUESTION STAYS AT THE TOP ─────────────────────────
// The reader's own note, verbatim: the question they just asked should settle at the top of
// the transcript and the answer should grow underneath it, instead of the view chasing the
// last written character down the screen.
//
// WHY IT IS AN INDEX AND NOT A BOOLEAN. It is the index of the user message to pin, so a
// second question in the same thread re-arms the whole behaviour by pointing at a different
// message rather than by resetting a flag. `null` means nothing is pinned.
const[pinnedAskIndex,setPinnedAskIndex]=useState(null);const pinAnchorRef=useRef(null);// Live mirror of the state above, for the scroll handlers and the follow effect: those run
// outside React's render and must not read a value a re-render has not delivered yet.
const pinActiveRef=useRef(false);// Circuit breaker for a device geometry whose rendered spacer never converges. It is reset
// for every turn and bounds the number of state-writing layout passes that turn may make.
const pinPassRef=useRef(0);// ITEM 102-ب. The streamed length the PREVIOUS pin pass measured, so a pass can tell «the
// answer grew» from «nothing changed and I am writing anyway». -1 is «no stream in flight»,
// which is also where a finished turn leaves it, so the first pass of the next turn reads as
// a change and starts that turn's count from zero.
const pinLenRef=useRef(-1);// The room under the last turn that lets a SHORT answer still be pushed to the top. It is a
// number of pixels, recomputed as the answer grows and collapsed to 0 when the turn ends, so
// no gap is left behind for the reader to scroll through.
const[askPinPad,setAskPinPad]=useState(0);// The spacer ELEMENT. Its applied height is read off it rather than remembered, because a ref
// written when `setAskPinPad` is called is one commit ahead of the DOM — see the layout effect.
const askPadElRef=useRef(null);// The last scroll position the pin itself wrote, read back from the element. Anything else is
// the reader's hand. -1 means the pin has not placed anything yet this turn.
const pinScrollTopRef=useRef(-1);// ── STREAM-P4 §٣/٢: `Enter` DOES NOT SEND ON A PHONE ──────────────────────
// True while an IME or a predictive keyboard is still assembling a character. An `Enter` in
// that state belongs to the keyboard — it is ACCEPTING a candidate — and treating it as a
// send is the single commonest way half a question is submitted. `isComposing` on the native
// event says this on modern browsers; this ref is what covers the ones where it does not.
const composingRef=useRef(false);// WHETHER THE COMPOSER IS BEING DRIVEN BY TOUCH, and «التمييزُ بنوعِ الإدخالِ لا بعرضِ
// النافذة» is the whole point: a narrow window on a laptop is still a keyboard, and a wide
// tablet is still a thumb. The opening value is the media query — the only thing knowable
// before the reader has touched anything — and the first pointer event on the field replaces
// it with what the reader is ACTUALLY using, which is what makes a hybrid device correct
// rather than merely guessed at.
const[inputIsTouch,setInputIsTouch]=useState(()=>{try{return!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches);}catch(e){return false;}});// The stored choice, read at mount. الإعدادات unmounts this tree while it is on screen, so
// coming back from the switch re-mounts the chat and re-reads the key -- the same lifecycle
// the theme and the watermark already rely on, and no value is threaded between them.
const[enterPref,setEnterPref]=useState(readEnterPref);const enterSends=ezikEnterSends(enterPref,inputIsTouch);const[wmAutoHide,setWmAutoHide]=useState(readWatermarkAutoHide);useEffect(()=>{const onWm=()=>setWmAutoHide(readWatermarkAutoHide());try{window.addEventListener(EZIK_WM_HIDE_EVENT,onWm);}catch(e){}return()=>{try{window.removeEventListener(EZIK_WM_HIDE_EVENT,onWm);}catch(e){}};},[]);useEffect(()=>{const onPref=()=>setEnterPref(readEnterPref());try{window.addEventListener(EZIK_ENTER_EVENT,onPref);}catch(e){}return()=>{try{window.removeEventListener(EZIK_ENTER_EVENT,onPref);}catch(e){}};},[]);const recognitionRef=useRef(null);const transcriptRef=useRef('');const baseTextRef=useRef('');// input snapshot when dictation (re)starts — new speech is appended after it
const shouldListenRef=useRef(false);// desired mic state; true between start-tap and stop-tap (survives auto-restarts)
const audioRef=useRef(null);// عنصر الصوت الوحيد النشِط (TTS أو تلاوة)
const profileRef=useRef(null);// synchronous mirror of profile for the audio path — avoids the stale-closure male voice on the greeting
const audioUnlockedRef=useRef(false);// true after the one-time first-gesture audio unlock (mobile autoplay)
const sequenceIdRef=useRef(0);// رمز إلغاء تسلسل الصوت الجاري
const audioElRef=useRef(null);// single gesture-unlocked element, REUSED for TTS (iOS autoplay)
const audioDoneRef=useRef(null);// current TTS playback resolver, so takeAudioFocus can cancel it cleanly
const audioPlayTokenRef=useRef(0);// invalidates stale pause/ended events on the reused element
// The RAW setter is deliberately renamed: everything in this component calls setStreamingText
// below, which is the queue, and nothing outside these few lines paints the preview directly.
const[streamingText,setStreamingReveal]=useState(null);// live streaming text (null = no stream in flight)
const revealFullRef=useRef('');// everything that has ARRIVED, append-only, never painted whole
const revealAtRef=useRef(0);// how much of it is on screen
const revealTimerRef=useRef(null);const revealStop=()=>{if(revealTimerRef.current===null)return;try{clearInterval(revealTimerRef.current);}catch(e){}revealTimerRef.current=null;};const revealTick=()=>{const full=revealFullRef.current;const backlog=full.length-revealAtRef.current;if(backlog<=0){revealStop();return;}const step=Math.max(EZIK_REVEAL_MIN_STEP,Math.ceil(backlog/EZIK_REVEAL_DIVISOR));revealAtRef.current=Math.min(full.length,revealAtRef.current+step);setStreamingReveal(full.slice(0,revealAtRef.current));if(revealAtRef.current>=full.length)revealStop();};// The one door. It takes exactly what the shipped setter took -- null to retire the preview,
// '' to arm it, and the cumulative text on every delta -- and it is the reason the delta
// handler, the abort path and the streaming transition below are all untouched.
const setStreamingText=next=>{if(typeof next!=='string'||next===''){// null (retire / abort) and '' (arm): both empty the queue and paint immediately. This is
// also the flush: the completion calls setStreamingText(null) in the same batch that
// pushes the finished reply, so a half-drained queue is replaced by the whole answer.
revealStop();revealFullRef.current='';revealAtRef.current=0;setStreamingReveal(next);return;}revealFullRef.current=next;// A cursor can never sit past what has arrived. It cannot happen with an append-only
// stream; it is clamped anyway, because "never show text that has not arrived" is the
// promise and a promise that depends on the transport is not one.
if(revealAtRef.current>next.length)revealAtRef.current=next.length;if(ezikMotionReducedNow()){revealStop();revealAtRef.current=next.length;setStreamingReveal(next);return;}if(revealTimerRef.current===null)revealTimerRef.current=setInterval(revealTick,EZIK_REVEAL_MS);};useEffect(()=>revealStop,[]);// TEXT path only: shows chat.searchingSources during the silent round-1 wait. The name is
// historical — XI-02 made the string neutral, because the client cannot know that a search
// is running and three of ten measured rounds carrying this hint returned no source at all.
const[searchingSources,setSearchingSources]=useState(false);const abortRef=useRef(null);// aborts the in-flight stream when a new message starts
const searchTimerRef=useRef(null);// delayed trigger for the "searching sources…" hint (client-side, time-based)
// ===== Live voice-call mode (Layer 2) — dedicated recognition + one-turn loop, isolated from the dictation mic =====
const callRecognitionRef=useRef(null);// dedicated SpeechRecognition for call mode (NOT the dictation instance)
const callTranscriptRef=useRef('');// accumulated finals for the current call turn (NEVER written to `input`)
const callBaseTextRef=useRef('');// turn text carried ACROSS SR restarts within ONE turn
const silenceTimerRef=useRef(null);// end-of-turn debounce handle
const callActiveRef=useRef(false);// true while a turn is listening; guards against double-fire (timer + onend)
const callTurnRef=useRef(null);// latest runCallTurn closure (avoids stale `messages` inside the SR handlers)
const callMutedRef=useRef(false);// mirror of isCallMuted for use inside handlers/timers
const[callState,setCallState]=useState('idle');// 'idle' | 'listening' | 'thinking' | 'speaking'
const[isCallMuted,setIsCallMuted]=useState(false);const[callHeard,setCallHeard]=useState('');// light "what I'm hearing" feedback (interim transcript)
const CALL_SILENCE_MS=1500;// silence after which a non-empty turn auto-ends (tunable)
// Item 84: `unlockAsk` stood here. It remembered which LOCKED depth tier had been tapped so
// a successful PIN could apply it, and it existed only for the lock this item lifted --
// with the lock gone nothing can set it, so the sheet it fed could never open again. It is
// removed rather than left as an unreachable branch that reads like a gate the chat still
// has. The chat therefore has no PIN surface at all now; the call screen keeps its own
// UnlockSheet on the same component, and الإعدادات keeps the change-PIN row for a founder.
// `founderUnlocked` STAYS: the call screen's sheet is its other caller. It exists ONLY to
// force a re-render after unlocking -- every real gate re-reads hasFounderToken(), never it.
const[founderUnlocked,setFounderUnlocked]=useState(()=>hasFounderToken());const[tashkeelOn,setTashkeelOn]=useState(()=>{try{return localStorage.getItem('tashkeel_v1')==='1';}catch(e){return false;}});const toggleTashkeel=()=>setTashkeelOn(v=>{const n=!v;try{localStorage.setItem('tashkeel_v1',n?'1':'0');}catch(e){}return n;});const CALL_RESTART_GRACE_MS=3000;// deaf window BETWEEN SR sessions - must never count as user silence
const CALL_VAD=false;// OFF: on Android, getUserMedia steals the mic from the recogniser (measured, live device)
// ---- Path B: the app records the turn itself and transcribes it server-side (api/stt.js). ----
// Why: on Android the Web Speech engine owns the microphone exclusively, so no client VAD can
// measure the user's silence, and every engine session plays Google's start/stop tone. Recording
// locally removes BOTH -- and the vendor key never leaves the server.
const CALL_STT_CLOUD=true;// flip to false to fall straight back to the Web Speech path
const CLOUD_MAX_TURN_MS=60000;// hard cap on a single recorded turn
// ---- Failures on this path must SPEAK. ----
// Every cloud-STT failure used to end in `catch (e) {}` + a re-opened microphone: a denied
// permission, a missing vendor key and a working-but-silent room were pixel-identical, and the
// call sat there listening forever. These three helpers are the ONLY exit for a failure now.
const CALL_ERROR_MS=8000;const callErrorTimerRef=useRef(null);const showCallError=msg=>{setVoiceError(msg);if(callErrorTimerRef.current)clearTimeout(callErrorTimerRef.current);callErrorTimerRef.current=setTimeout(()=>setVoiceError(''),CALL_ERROR_MS);};// getUserMedia rejection -> a sentence naming what the user must actually DO about it.
const micErrorMessage=e=>{const name=String(e&&(e.name||e.code)||'');if(name==='NotAllowedError'||name==='PermissionDeniedError'||name==='SecurityError')return'🚫 لم يُسمح باستخدام الميكروفون. افتح إعدادات التطبيق واسمح بالميكروفون ثم أعد الدخول للمكالمة.';if(name==='NotFoundError'||name==='DevicesNotFoundError')return'🎤 لا يوجد ميكروفون متاح على هذا الجهاز.';if(name==='NotReadableError'||name==='TrackStartError')return'🎤 الميكروفون مشغول بتطبيق آخر. أغلقه ثم أعد المحاولة.';return'🎤 تعذّر فتح الميكروفون. تحقّق من الإذن ثم أعد المحاولة.';};// A NON-OK /api/stt. Distinct from "heard nothing": the audio WAS recorded and sent.
const sttErrorMessage=status=>{if(status===429)return'⏳ تجاوزنا حدّ الاستماع المسموح الآن. انتظر قليلاً ثم أعد المحاولة.';if(status===413)return'🎤 المقطع طويل جدًّا. تكلّم بمقاطع أقصر.';if(status===403)return'🚫 خدمة تحويل الكلام غير متاحة لهذا الحساب.';if(status>=500)return'🛠️ خدمة تحويل الكلام متوقّفة مؤقّتًا. حاول بعد قليل.';return'🛠️ تعذّر تحويل كلامك إلى نصّ (رمز '+status+'). حاول مرّة أخرى.';};const cloudStreamRef=useRef(null);const cloudChunksRef=useRef([]);const mediaRecRef=useRef(null);const vadAnalyserRef=useRef(null);const pickRecMime=()=>{const cands=['audio/webm;codecs=opus','audio/webm','audio/mp4'];for(let i=0;i<cands.length;i++){try{if(window.MediaRecorder&&MediaRecorder.isTypeSupported(cands[i]))return{mimeType:cands[i]};}catch(e){}}return{};};const blobToBase64=blob=>new Promise(resolve=>{const fr=new FileReader();fr.onloadend=()=>{const s=String(fr.result||'');const i=s.indexOf(',');resolve(i>=0?s.slice(i+1):'');};fr.onerror=()=>resolve('');fr.readAsDataURL(blob);});const stopCloudAll=()=>{try{if(mediaRecRef.current&&mediaRecRef.current.state!=='inactive')mediaRecRef.current.stop();}catch(e){}mediaRecRef.current=null;try{cloudStreamRef.current?.getTracks().forEach(tr=>tr.stop());}catch(e){}cloudStreamRef.current=null;try{vadCtxRef.current?.close();}catch(e){}vadCtxRef.current=null;vadAnalyserRef.current=null;};const startCloudListening=async()=>{// آخرُ حاجزٍ قبل getUserMedia نفسِه: بلا موافقةٍ سارية لا يُفتح الميكروفون. سحبُ الموافقةِ
// أثناءَ مكالمةٍ جاريةٍ يمنع الدَّورَ التالي حتى لو نجا مؤقّتٌ من دورةِ الإنهاء.
if(!hasValidAIConsent()){stopCloudAll();setCallState('idle');return;}const myGen=callGenRef.current;try{if(!cloudStreamRef.current)cloudStreamRef.current=await navigator.mediaDevices.getUserMedia({audio:true});if(callGenRef.current!==myGen){stopCloudAll();return;}try{if(mediaRecRef.current&&mediaRecRef.current.state!=='inactive')mediaRecRef.current.stop();}catch(e){}cloudChunksRef.current=[];const mr=new MediaRecorder(cloudStreamRef.current,pickRecMime());mr.ondataavailable=e=>{if(e.data&&e.data.size)cloudChunksRef.current.push(e.data);};mediaRecRef.current=mr;mr.start(250);callActiveRef.current=true;setCallState('listening');if(!vadCtxRef.current){const Ctx=window.AudioContext||window.webkitAudioContext;vadCtxRef.current=new Ctx();vadAnalyserRef.current=vadCtxRef.current.createAnalyser();vadAnalyserRef.current.fftSize=1024;vadCtxRef.current.createMediaStreamSource(cloudStreamRef.current).connect(vadAnalyserRef.current);}const an=vadAnalyserRef.current;const buf=new Uint8Array(an.fftSize);const startedAt=Date.now();vadLastVoiceRef.current=startedAt;let heard=false;const tick=()=>{if(callGenRef.current!==myGen){stopCloudAll();return;}if(!callActiveRef.current){setTimeout(tick,200);return;}// keep watching for the exit so the mic is always released
if(mediaRecRef.current!==mr)return;// a newer turn owns the audio graph now
an.getByteTimeDomainData(buf);let sum=0;for(let i=0;i<buf.length;i++){const v=(buf[i]-128)/128;sum+=v*v;}const now=Date.now();if(Math.sqrt(sum/buf.length)>VAD_RMS_ON){vadLastVoiceRef.current=now;heard=true;armInactivityTimer();}else if(heard&&now-vadLastVoiceRef.current>VAD_SILENCE_MS){stopCloudTurn();return;}if(heard&&now-startedAt>CLOUD_MAX_TURN_MS){stopCloudTurn();return;}setTimeout(tick,100);};tick();}catch(e){// The microphone never opened. A SILENT fall to 'idle' here was the whole bug: on a denied
// permission the ring simply stopped and the call looked like it was working but deaf.
console.error('[Al-Murabbi] call mic error:',e);callActiveRef.current=false;stopCloudAll();// release whatever half-opened, so a retry starts clean
setCallHeard('');setCallState('idle');showCallError(micErrorMessage(e));}};const stopCloudTurn=async()=>{if(!callActiveRef.current)return;callActiveRef.current=false;const myGen=callGenRef.current;setCallState('thinking');let blob=null;const mr=mediaRecRef.current;if(mr&&mr.state!=='inactive'){blob=await new Promise(resolve=>{mr.onstop=()=>{try{resolve(new Blob(cloudChunksRef.current,{type:mr.mimeType||'audio/webm'}));}catch(e){resolve(null);}};try{mr.stop();}catch(e){resolve(null);}});}mediaRecRef.current=null;if(callGenRef.current!==myGen){stopCloudAll();return;}if(!blob||blob.size<1500){startCloudListening();return;}const b64=await blobToBase64(blob);if(callGenRef.current!==myGen){stopCloudAll();return;}let text='';let sttError='';try{const band=(()=>{try{return deriveCaps(profileRef.current?.age).band;}catch(e){return'young';}})();const r=await aiFetch('/api/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:b64,mime:blob.type,band})});if(r.ok){const d=await r.json();text=String(d.text||'').trim();}else{const body=await r.text().catch(()=>'');console.error('[Al-Murabbi] /api/stt '+r.status+':',body.slice(0,300));sttError=sttErrorMessage(r.status);}}catch(e){console.error('[Al-Murabbi] /api/stt network error:',e);sttError='📡 تعذّر الوصول إلى خدمة تحويل الكلام. تحقّق من الاتصال ثم أعد المحاولة.';}if(callGenRef.current!==myGen){stopCloudAll();return;}if(sttError){// A FAILED transcription is not silence, so it must not be answered with more listening.
// Re-opening the mic here (the old behaviour) hid a dead key / spent quota behind a call
// that recorded turn after turn and answered none of them, forever.
callActiveRef.current=false;setCallHeard('');setCallState('idle');showCallError(sttError);return;}// Transcribed OK but empty => genuine silence. THAT is the one case that keeps listening.
if(!text){startCloudListening();return;}setCallHeard('');if(callTurnRef.current)callTurnRef.current(text);};const VAD_SILENCE_MS=1200;// real acoustic silence (ms) that ends a turn
const VAD_RMS_ON=0.02;// speech energy threshold (RMS 0..1)
const vadOkRef=useRef(false);// true only while a live VAD loop owns the turn-ender
const vadCtxRef=useRef(null);const vadStreamRef=useRef(null);const vadGenRef=useRef(-1);const vadLastVoiceRef=useRef(0);const stopVad=()=>{vadOkRef.current=false;try{vadStreamRef.current?.getTracks().forEach(tr=>tr.stop());}catch(e){}try{vadCtxRef.current?.close();}catch(e){}vadStreamRef.current=null;vadCtxRef.current=null;};// The Android recognizer is DEAF between sessions, so SR events cannot measure user silence.
// This loop reads microphone energy directly and is the SOLE turn-ender while it lives.
const ensureVad=async()=>{// A microphone is a microphone even when nothing is transcribed from it: this loop opens one
// to measure silence. CALL_VAD is false today so the path is dormant, but a dormant path is
// exactly the one that gets switched on later without anybody re-reading the consent rules.
if(!hasValidAIConsent()){stopVad();return;}if(vadCtxRef.current){vadGenRef.current=callGenRef.current;vadLastVoiceRef.current=Date.now();return;}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const Ctx=window.AudioContext||window.webkitAudioContext;const ctx=new Ctx();const an=ctx.createAnalyser();an.fftSize=1024;ctx.createMediaStreamSource(stream).connect(an);vadStreamRef.current=stream;vadCtxRef.current=ctx;vadGenRef.current=callGenRef.current;vadLastVoiceRef.current=Date.now();vadOkRef.current=true;const buf=new Uint8Array(an.fftSize);const tick=()=>{if(!vadCtxRef.current)return;if(vadGenRef.current!==callGenRef.current){stopVad();return;}an.getByteTimeDomainData(buf);let sum=0;for(let i=0;i<buf.length;i++){const v=(buf[i]-128)/128;sum+=v*v;}const now=Date.now();if(Math.sqrt(sum/buf.length)>VAD_RMS_ON){vadLastVoiceRef.current=now;if(callActiveRef.current)armInactivityTimer();}else if(callActiveRef.current&&now-vadLastVoiceRef.current>VAD_SILENCE_MS&&(callBaseTextRef.current+callTranscriptRef.current).trim()){endCallTurnNow();}setTimeout(tick,100);};tick();}catch(e){vadOkRef.current=false;}};// Layer 3 (continuous call) — anti-leak + auto-end machinery.
const callGenRef=useRef(0);// increments on every call ENTER and EXIT; any async continuation comparing a captured value against this ref aborts if they differ.
const inactivityTimerRef=useRef(null);// 45s no-speech auto-end timer handle (the real loop terminator)
// تحميل البيانات من التخزين
useEffect(()=>{try{// مؤقت: التخزين مُعطَّل — تصرّف كأنه تثبيت جديد في كل فتح: امسح الملف والمحادثة معاً،
// ولا تُحمِّل ملف الطفل، وابدأ دائماً من شاشة التهيئة (لاختبار أطفال مختلفين على نفس الجهاز).
if(!PERSIST_CONVERSATION){localStorage.removeItem('messages');localStorage.removeItem('child_profile');setScreen('onboarding');return;}const profileData=localStorage.getItem('child_profile');if(profileData){const p=JSON.parse(profileData);// Session 06 / Commit 2 (DOB) -- one-shot migration: legacy profiles carry age only.
// Derive birthYear from it once and persist, so nobody loses their band or re-onboards.
if(p&&p.birthYear==null&&p.age!=null){p.birthYear=new Date().getFullYear()-(parseInt(p.age,10)||0);try{localStorage.setItem('child_profile',JSON.stringify(p));}catch(e){}}// DOB refresh: age is DERIVED from birthYear on every boot (approx, +/- 1y accepted),
// so the stored account ages automatically. deriveCaps keeps reading p.age, and p.age is
// now also POSTED so the server can build the prompt from it (D02ب).
if(p&&p.birthYear!=null){const derivedAge=new Date().getFullYear()-(parseInt(p.birthYear,10)||0);if(derivedAge>=0&&derivedAge<=120)p.age=derivedAge;}// S92 -- one-shot migration, beside the birthYear one above: a profile created before
// saved conversations existed has no id to file its history under. Mint one and persist
// it now, so this profile's history is its own from the very first save.
if(p&&!p.pid){p.pid=ezikMintId();try{localStorage.setItem('child_profile',JSON.stringify(p));}catch(e){}}profileRef.current=p;voiceProfileRef.current=p;// غ‑٣: مرآةُ حاجزِ الصوت — تُكتب مع profileRef دائماً
setProfile(p);// S92: the app ALWAYS opens on a NEW, EMPTY thread. What the child wrote before is not
// poured back into the chat — it is one tap away in the side menu — so nobody resumes a
// conversation they did not choose to resume, and the empty thread it opens on is not
// filed anywhere until a first question is asked. The single legacy thread the old
// 'messages' key held is filed as this profile's first saved conversation on the way past.
ezikMigrateLegacyThread(ezikProfileKey(p));// S99: this profile's reading preferences, read once here — the same single read the boot
// script already performed, so the value React holds agrees with what is on <html> and no
// repaint follows. A second child on the device gets THEIR settings, not the first one's.
{const prefs=ezikReadA11y(ezikProfileKey(p));a11yRef.current=prefs;setA11yState(prefs);ezikApplyA11y(prefs);}chatIdRef.current=null;setChatId(null);setMessages([]);setChatList(ezikListChats(ezikProfileKey(p)));setScreen('chat');// D85: a returning profile also lands on the chat
}else{setScreen('onboarding');}}catch{setScreen('onboarding');}},[]);// تحميل المصحف الكنسي مسبقاً بعد الإقلاع كي تظهر أول آية فوراً (يُتجاهَل الفشل بهدوء)
useEffect(()=>{// S117 PERF. The prefetch stays; it no longer races the first paint. Measured cold against
// live ezik.app, THIS effect issued /quran-uthmani.json (338KB transferred, 1.41MB parsed)
// while React was still committing the first screen -- 24% of everything a cold visit
// downloads, in flight during the window the paint was waiting on. Nothing on the first
// screen reads __quranData: every consumer calls loadQuran() and awaits the same promise,
// so the request is now handed to the idle callback with a 3s backstop. Same URL, same
// cache entry, same "the first verse is already there"; only the moment it starts moved
// past the paint it was competing with. The service worker precaches the same file anyway.
const go=()=>{loadQuran().catch(()=>{});};if(typeof requestIdleCallback==='function'){const h=requestIdleCallback(go,{timeout:3000});return()=>{try{cancelIdleCallback(h);}catch(e){}};}const t=setTimeout(go,1200);return()=>clearTimeout(t);},[]);// زر الرجوع (أندرويد/المتصفح) — خطأ ١٥: بلا هذا يُغلق التطبيق فوراً من أي شاشة فرعية.
// خطأ ٤٦: داخل المصحف يقشر الرجوع طبقة واحدة (قارئ السورة ← منتقي السورة) بدل القفز إلى home، ثم يعيد دفع مدخل تاريخ كي لا تُخرج الضغطة التالية من التطبيق قبل بلوغ home.
// S87: القرار صار واحداً لكل الشاشات — goEzikBack أدناه — فالزرّ المرئيّ وزرّ الجهاز يسألان الجدول نفسه، والمحادثة لم تعد وجهةَ الرجوع الافتراضية.
const backNavRef=useRef(false);// this transition was CAUSED by a pop: the entry is already spent
const histReplaceRef=useRef(false);// this transition is a BACK: relabel the entry, never deepen the stack
const screenRef=useRef(screen);// مرآة متزامنة للشاشة الحالية (onPop مسجّل بـ[] فيغلق على قيمة بائتة)
const selectedSurahRef=useRef(selectedSurah);// مرآة متزامنة لسورة المصحف المفتوحة، للسبب ذاته
// S90: a STACK of openers, not one slot. A sheet may now open another sheet -- الإعدادات opens
// التحكم -- and a single slot was overwritten by the inner one, so the outer sheet forgot who
// opened it and fell back to home. Each open pushes its own opener; each back pops that one.
const sheetOriginRef=useRef([]);// which screen opened each open settings/parental sheet
// S91: the ledger that counts the entries this app owns now lives at module scope, next to the
// layer registry, because the layer hook pushes into the same stack the screen effect does.
useEffect(()=>{screenRef.current=screen;},[screen]);useEffect(()=>{selectedSurahRef.current=selectedSurah;},[selectedSurah]);// The nested layer, if any, and it is asked FIRST by both back paths. The registry answers for
// the adhkar's opened category, the memorizer's running drill and the mushaf's open surah; the
// second line is a safety net for the mushaf alone, whose open surah is App state, so a first
// back inside the mushaf peels to the index even if that screen never registered.
const closeEzikNested=()=>{if(ezikCloseDeepestLayer())return true;if(screenRef.current==='mushaf'&&selectedSurahRef.current!=null){setSelectedSurah(null);return true;}return false;};// ===== goEzikBack -- THE ONE APPLICATION BACK RESOLVER =====
// Every visible section-level back control and the browser/hardware button both end here, so
// there is exactly one hierarchy and one place to read it. `viaPop` says the press was the
// browser's own and has therefore ALREADY consumed a history entry; it changes the bookkeeping
// and never the destination. It reads screenRef/refs only, so the popstate listener may keep
// the identity it captured at mount and still resolve against the live screen.
const resolveEzikBack=viaPop=>{const cur=screenRef.current;// S92: the layer registry is asked FIRST on EVERY screen, root or not -- the `!rooted` guard
// that used to stand here is gone. The chat is a root screen and it now owns a layer, the side
// menu, so that guard would have let a press pass straight through an open menu and out of the
// app. Nothing else changes route: no root screen registered a layer before this one, and the
// mushaf safety net inside closeEzikNested is gated on its own screen.
// 1. The deepest open layer closes, and NOTHING else happens: the section is retained.
if(closeEzikNested()){// S91: the entry the pop just spent BELONGED to the layer that has now closed, so there is
// nothing to put back. The section's own entry was never touched and is still underneath,
// which is exactly what a native wrapper reads when it asks whether it can go back.
return true;}// 2. The screen itself leaves, to its own parent from the table -- never to the chat by default.
const dest=ezikBackDestination(cur);if(!dest||dest===cur)return false;if(EZIK_SHEET_SCREENS.indexOf(cur)!==-1)sheetOriginRef.current.pop();// spend this sheet's opener, not another's
if(viaPop)backNavRef.current=true;// the entry is gone: do not push a replacement
else histReplaceRef.current=true;// a visible press moves within the entry it stands on
setScreen(dest);return true;};// The destination this screen's back resolves to, read without spending anything -- both the
// resolver above and the visible-press path below ask it, so they cannot disagree.
const ezikBackDestination=cur=>{const origins=sheetOriginRef.current;const isSheet=EZIK_SHEET_SCREENS.indexOf(cur)!==-1;return ezikBackTarget(cur,isSheet?origins[origins.length-1]:null);};// ===== goEzikBack -- WHAT EVERY VISIBLE BACK CONTROL PRESSES =====
// S90: it produces the SAME one-step result as the hardware button because, for a screen-level
// back, it now asks the browser to go back and lets the popstate listener resolve it through
// the table above. That is what keeps the depth honest: the app pops exactly one entry per
// layer it leaves, where before a visible press RELABELLED its entry and left it on the stack,
// so entries only ever accumulated and the hardware button then answered a run of dead presses
// at the root before the app would close. A nested layer pushed no entry, so it still closes
// here directly and touches no history. With nothing of ours left on the stack the direct
// resolution is kept, so a back can never reach past the app's first entry.
const goEzikBack=()=>{const cur=screenRef.current;if(EZIK_ROOT_SCREENS.indexOf(cur)===-1){// S91: a REGISTERED layer owns an entry, so its visible back takes the same route the
// device button takes -- a real pop, resolved by the same popstate listener. The direct
// close below is kept for the one layer that owns no entry (the mushaf's unregistered
// safety net), and only for it.
if(ezikBackLayers.length>0&&ezikHistBack())return true;if(closeEzikNested())return true;}const dest=ezikBackDestination(cur);if(!dest||dest===cur)return false;if(ezikHistBack())return true;return resolveEzikBack(false);};// Sheets remember their opener so their back returns THERE: home when home opened them, the
// chat when the chat's own drawer did, الإعدادات when its own التحكم row did. Recorded on the
// way in, spent once on the way out.
const openEzikSheet=target=>{sheetOriginRef.current.push(screenRef.current);setScreen(target);};// S90: the PIN gate and the parental screen behind it are ONE layer, not two -- passing the
// gate spends it and there is no back TO it. Relabelling the gate's entry instead of pushing a
// second one keeps one entry per layer, so the parental screen's back lands on الإعدادات and
// leaves no spent entry behind to swallow a later press.
const replaceEzikScreen=target=>{histReplaceRef.current=true;setScreen(target);};// S91: publish this resolver so a nested layer's own back button presses the same one.
useEffect(()=>{ezikBackHandler=goEzikBack;});// ===== S92 -- THE SIDE MENU IS A BACK LAYER =====
// The device back button has to CLOSE THE MENU FIRST, and the chat is a root screen: it owns no
// history entry of its own, so a press there would otherwise reach the platform and leave the
// app with the menu still on screen. Registering the menu here gives it one real entry for
// exactly as long as it is open, through the same hook the adhkar reader and the mushaf's open
// surah use -- one layer, one entry, spent once.
//
// The consequence is that EVERY visible way out of the menu has to spend that same entry, or a
// spent-but-unclaimed entry would answer a later press with nothing. So no menu item calls
// setDrawerOpen(false) itself: each hands its action to closeDrawerWith, which asks the
// application back to close the menu and runs the action inside the closer -- after the pop that
// spent the entry, so any screen the action then opens pushes its own entry cleanly on top.
const drawerNavRef=useRef(null);useEzikBackLayer(drawerOpen,()=>{setDrawerOpen(false);setChatPendingDelete(null);// a half-asked delete never survives the menu closing
const run=drawerNavRef.current;drawerNavRef.current=null;if(run)run();});const closeDrawerWith=fn=>{drawerNavRef.current=typeof fn==='function'?fn:null;// ezikHistBack is false only when this app owns nothing on the stack -- the menu's entry could
// not be pushed at all. Then there is nothing to spend and the menu closes directly.
if(ezikHistBack())return;setDrawerOpen(false);setChatPendingDelete(null);const run=drawerNavRef.current;drawerNavRef.current=null;if(run)run();};// Opening it re-reads the list from the store, so the menu always shows what a reboot would.
// S98: and it clears the search box, so the menu never reopens on somebody's half-typed query.
// No corpus is built here — that happens on the first letter and not before.
const openDrawer=()=>{refreshChatList();setChatPendingDelete(null);setChatQuery('');setDrawerOpen(true);};useEffect(()=>{const onPop=()=>{ezikHistSpend();resolveEzikBack(true);};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);// ONE ENTRY PER OPENED SCREEN, and never one for a back. Opening a section pushes; a back
// relabels the entry it is standing on (replaceState) instead of stacking a second copy of the
// parent; a pop-driven change pushes nothing at all, because the pop already spent the entry.
// Nothing here runs during render -- this is an effect, after commit, as it always was.
useEffect(()=>{if(backNavRef.current){backNavRef.current=false;return;}const rooted=EZIK_ROOT_SCREENS.indexOf(screen)!==-1;if(histReplaceRef.current){histReplaceRef.current=false;if(!rooted){try{window.history.replaceState({screen},'');}catch(e){}}return;}if(!rooted)ezikHistPush({screen});},[screen]);// Stop audio when leaving a screen. App never unmounts on a screen switch, so playing
// Audio() objects in audioRef survive; this cleanup fires on every `screen` transition.
// cancelAudio() is UNCONDITIONAL (stops greeting TTS + recitation on any transition). The
// abort is gated to "leaving chat" only: the greeting-leak fix needs the abort when leaving
// chat (chat→memorize/call), but on the startup onboarding→chat transition the greeting's
// controller is set DURING that transition, so an unconditional abort here would kill the
// just-started greeting (leaving the UI stuck on the typing dots). `leaving` captures the
// screen this cleanup belongs to, so we abort only when that screen was 'chat'.
useEffect(()=>{const leaving=screen;return()=>{if(leaving==='chat'){try{abortRef.current?.abort();}catch(e){}}cancelAudio();};},[screen]);// Mobile autoplay fix: with chat voice ON by default, the first spoken reply (the greeting) plays
// after an async callAI gap, so user-activation can lapse and mobile Safari/Chrome may block it.
// Prime the audio channel once, synchronously inside the first real gesture anywhere in the app
// (the onboarding tap always precedes the greeting; also covers a returning user who lands in chat).
// Best-effort and fully guarded — must never break onboarding or the greeting. Does NOT touch the
// existing blob-play path; it only unlocks the channel.
const unlockAudioPlayback=()=>{if(audioUnlockedRef.current)return;// one-time only
audioUnlockedRef.current=true;try{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){const ctx=new Ctx();if(ctx.state==='suspended'&&ctx.resume)ctx.resume().catch(()=>{});// A 1-sample silent buffer started within the gesture satisfies the user-activation requirement.
const src=ctx.createBufferSource();src.buffer=ctx.createBuffer(1,1,22050);src.connect(ctx.destination);src.start(0);}}catch(e){/* fail silent — never block onboarding or audio */}// iOS: HTML5 <audio> has a SEPARATE activation gate from AudioContext. The blob-play path
// uses `new Audio()`, so we must also prime an HTML5 element here, inside the gesture, or
// iOS keeps audio muted. A 1-sample silent WAV (built inline as a Blob — no network) does it.
try{const wav=new Uint8Array([82,73,70,70,38,0,0,0,87,65,86,69,102,109,116,32,16,0,0,0,1,0,1,0,64,31,0,0,128,62,0,0,2,0,16,0,100,97,116,97,2,0,0,0,0,0]);const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));const u=audioElRef.current||(audioElRef.current=new Audio());u.src=url;const pr=u.play();if(pr&&pr.then)pr.then(()=>{try{u.pause();}catch(e){}URL.revokeObjectURL(url);}).catch(()=>{try{URL.revokeObjectURL(url);}catch(e){}audioUnlockedRef.current=false;});// play() rejected -> not actually unlocked; allow a later gesture to retry
}catch(e){audioUnlockedRef.current=false;/* prime threw -> allow a later gesture to retry */}};useEffect(()=>{const handler=()=>{unlockAudioPlayback();};const opts={capture:true};// Stay armed: after a real success the ref guard makes each call a no-op; before success we retry on every gesture.
window.addEventListener('pointerdown',handler,opts);window.addEventListener('keydown',handler,opts);return()=>{window.removeEventListener('pointerdown',handler,opts);window.removeEventListener('keydown',handler,opts);};},[]);// إعداد التعرف على الصوت
// The dependency is `aiConsent`, not []. Without consent ezNewRecognition() returns null and
// NO engine is built at all -- so no microphone permission is ever requested for dictation.
// When consent is granted the effect re-runs and the engine appears; when it is withdrawn the
// effect re-runs, the cleanup below kills the old engine, and the rebuild refuses. That is the
// whole lifecycle in one place, instead of a mount-time singleton that outlives the choice.
useEffect(()=>{const recognition=ezNewRecognition();if(!recognition){recognitionRef.current=null;return;}recognition.lang='ar-SA';recognition.continuous=true;// keep listening across pauses until the user taps the mic off
recognition.interimResults=true;recognition.onresult=event=>{// This ar-SA engine emits CUMULATIVE isFinal results (each later final RE-INCLUDES the
// earlier text), so appending stacks/duplicates. Mirror the proven call-mode handler:
// rebuild from index 0 with a prefix-merge and REPLACE the committed buffer (not +=).
let finalText='',interim='';for(let i=0;i<event.results.length;i++){const t=event.results[i][0].transcript;if(event.results[i].isFinal){const seg=t.trim();if(!seg)continue;if(!finalText)finalText=seg;else if(seg.startsWith(finalText))finalText=seg;// cumulative restatement -> replace
else if(finalText.startsWith(seg)){/* shorter prefix already covered -> skip */}else finalText=finalText+' '+seg;// genuine new segment -> append
}else{interim+=t;}}transcriptRef.current=finalText;// REPLACE (not append) — dedupes cumulative finals
setInput(joinSpeech(joinSpeech(baseTextRef.current,transcriptRef.current),interim));};recognition.onend=()=>{if(childVoiceBlocked()){// غ‑٣: لا إعادةَ فتحٍ بعد الحجب — أوقفِ الحلقة
shouldListenRef.current=false;setIsListening(false);return;}// THE AUTO-RESTART IS THE DANGEROUS ONE. This loop was armed while consent was held; if it
// has been withdrawn since, restarting here would re-open the microphone to Google or Apple
// moments after the reader said no. Re-read the store, never a captured flag.
if(!hasValidAIConsent()){shouldListenRef.current=false;setIsListening(false);ezKillRecognizer(recognition);return;}// Browsers end recognition periodically even in continuous mode. If the user still
// wants to dictate, fold finalized speech into the base and restart so dictation
// continues until the mic is tapped off. The mic NEVER sends.
if(shouldListenRef.current){baseTextRef.current=joinSpeech(baseTextRef.current,transcriptRef.current);transcriptRef.current='';if(ezStartRecognition(recognition))return;// Restart failed (mic dropped, rapid toggling, or consent gone) — stop cleanly, no loop.
shouldListenRef.current=false;setIsListening(false);return;}shouldListenRef.current=false;setIsListening(false);// Transcribed text stays in the box for the owner to review/edit/send. No auto-send.
};recognition.onerror=event=>{// Fatal errors end dictation; transient ones (e.g. no-speech) let onend restart it.
const fatal=['not-allowed','audio-capture','service-not-allowed','network'];if(fatal.includes(event.error))shouldListenRef.current=false;const errorMap={'not-allowed':'🚫 لم يتم السماح بالميكروفون. افتح إعدادات المتصفح واسمح بالميكروفون.','no-speech':'🤫 لم أسمع شيئاً، جرب مرة أخرى.','audio-capture':'🎤 الميكروفون غير متصل.','network':'📡 خطأ في الشبكة.','aborted':''};const msg=errorMap[event.error]!==undefined?errorMap[event.error]:`خطأ: ${event.error}`;if(msg){setVoiceError(msg);setTimeout(()=>setVoiceError(''),6000);}};recognitionRef.current=recognition;// Teardown on rebuild AND on unmount. Handlers first, then abort: an abort() fires onend, and
// a live onend is precisely what would restart the engine we are trying to end.
return()=>{shouldListenRef.current=false;recognitionRef.current=null;ezKillRecognizer(recognition);};},[aiConsent]);// ============================================================
// S97: WHERE A CONVERSATION OPENS.
// This used to be one line:
//     useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); },
//              [messages, streamingText]);
// and it produced exactly what the device video showed. Two independent faults in it:
//   * useEffect is a PASSIVE effect. It runs after the browser is free to paint, so the first
//     frame the user saw of a stored conversation was its TOP.
//   * behavior:'smooth' then ANIMATED the correction, so the descent was watchable.
// Measured, not guessed: opening a 40-turn conversation produced 0 scroll operations during the
// commit and 1 smooth one after paint.
// The replacement splits the two jobs that line was doing.
// (1) OPENING. A layout effect runs inside the same commit that puts the messages in the DOM,
// before the browser paints, so writing scrollTop here means the end IS the first frame. It has
// no dependency list on purpose: while a conversation is still assembling (markdown, source
// cards) every re-render re-pins it, so the bottom is held instead of drifting.
React.useLayoutEffect(()=>{if(!jumpToEndRef.current)return;const el=messagesAreaRef.current;if(el)el.scrollTop=el.scrollHeight;});// (2) HOLDING while the first layout settles. Some height changes never go through React -- an
// attached image decoding, a font swapping in -- so a re-render is not enough on its own. A
// ResizeObserver keeps the pin through those, and the pin is released the moment it is no longer
// needed: either the size stopped changing, or the user touched the scroll themselves. The
// timeout is only a backstop for a browser with no ResizeObserver, not the positioning mechanism.
useEffect(()=>{if(!jumpToEndRef.current)return undefined;const el=messagesAreaRef.current;if(!el){jumpToEndRef.current=false;return undefined;}el.scrollTop=el.scrollHeight;let ro=null,timer=null,settled=0,lastH=-1;const release=()=>{jumpToEndRef.current=false;if(ro){try{ro.disconnect();}catch(e){}}if(timer)clearTimeout(timer);el.removeEventListener('wheel',release);el.removeEventListener('touchstart',release);};try{ro=new ResizeObserver(()=>{if(!jumpToEndRef.current)return;const h=el.scrollHeight;el.scrollTop=h;// two consecutive observations at the same height means the layout has stopped moving
if(h===lastH){if(++settled>=2)release();}else{settled=0;lastH=h;}});ro.observe(el);for(let i=0;i<el.children.length;i++)ro.observe(el.children[i]);}catch(e){ro=null;}// the user reaching for the scroll ends the pin immediately -- they own it from then on
el.addEventListener('wheel',release,{passive:true});el.addEventListener('touchstart',release,{passive:true});timer=setTimeout(release,ro?1200:300);return release;},[chatId]);// (3) FOLLOWING a live reply. Unchanged behaviour -- smooth, as before -- but only while the
// user is actually at the end. Someone who scrolled up to re-read an old answer is no longer
// yanked back down, and the opening pin above is never fought by an animation.
useEffect(()=>{if(skipFollowRef.current>0){skipFollowRef.current--;return;}// this run IS an open
if(jumpToEndRef.current)return;// the opening pin owns the position right now
// STREAM-P4 §٣/١: «لا قفزَ تلقائيًّا إلى الأسفل أثناءَ الكتابة». This effect IS the jump to
// the bottom, and while the question is pinned it is the one thing that would undo it on
// every delta. It is declined here rather than by clearing `stickToEndRef`, so the reader's
// own at-the-end/reading-above state is exactly what it was when the pin lets go.
if(pinActiveRef.current)return;if(!stickToEndRef.current)return;// the user is reading further up
// S99: the ONE thing reduced motion changes here is the WORD 'smooth'. Every guard the pin
// depends on is above this line and untouched — the skip counter, the opening pin, the
// stick-to-end test — so S97 behaves identically; the correction simply arrives instantly
// instead of being animated. No timer was added and none was removed.
messagesEndRef.current?.scrollIntoView({behavior:ezikMotionReduced(a11yRef.current.reduceMotion)?'auto':'smooth'});},[messages,streamingText]);// Who is in charge of the scroll: recomputed on every scroll event, cheap, no state churn.
const onMessagesScroll=()=>{const el=messagesAreaRef.current;if(!el)return;stickToEndRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;// ── STREAM-P4 §٣/١: «حرّكَ بيدِه ⟹ يتوقّفُ التثبيت» ──────────────────────
// The reader moving the transcript ends the pin, and it is detected by comparing where the
// container IS against where the pin last PUT it, rather than by listening for a wheel or a
// touch. That is not a stylistic preference: wheel and touch are two of the ways a person
// scrolls, and a scrollbar drag, a trackpad flick, Page Down, a spacebar and a screen
// reader's own navigation are the others. A divergence from the pinned position is what all
// of them have in common, so this needs no list of input devices and cannot be defeated by
// arriving on a device the list did not name.
//
// The two-pixel tolerance is for sub-pixel layout and zoom, where reading back `scrollTop`
// after writing it does not always return the number that was written.
if(pinActiveRef.current&&pinScrollTopRef.current>=0&&Math.abs(el.scrollTop-pinScrollTopRef.current)>2){pinActiveRef.current=false;}};// ── STREAM-P4 §٣/١: THE QUESTION SETTLES AT THE TOP, THE ANSWER GROWS UNDER IT ──
//
// ONE LAYOUT EFFECT, TWO STEPS IN A FIXED ORDER, because the second cannot succeed until the
// first has run: a container that does not have enough content below the question CANNOT
// scroll that question to its top, and writing `scrollTop` in that state silently does
// nothing. So the room is made first and the position is taken second.
//
// IT IS A LAYOUT EFFECT for the same reason S97's opening pin is: a passive effect runs after
// the browser is free to paint, so the reader would see the un-pinned frame first and watch
// the correction. This runs inside the commit, so the pinned position IS the first frame.
//
// AND IT HAS NO DEPENDENCY LIST, deliberately. The answer arrives in many small renders and
// each one changes the height underneath the question; re-pinning on every one of them is how
// the question is HELD there instead of drifting up as the reply grows.
React.useLayoutEffect(()=>{if(pinnedAskIndex==null||!pinActiveRef.current)return;const el=messagesAreaRef.current;const anchor=pinAnchorRef.current;if(!el||!anchor)return;// Where the question starts, in the container's own scroll coordinates.
const anchorTop=anchor.getBoundingClientRect().top-el.getBoundingClientRect().top+el.scrollTop;// ── ITEM 102-ب: THE BREAKER NOW COUNTS STUCKNESS, NOT WORK ───────────────────────────
// MEASURED before this block existed, in Chrome at 430x932 driven by real touches:
// `pinPassRef` had already reached 9 at 504 VISIBLE CHARACTERS of a 6,697-character answer
// -- one write per ~72 streamed characters. The breaker at 8 was therefore being spent in
// the MIDDLE of most ordinary Ezik answers, not on the rare device whose spacer never
// converges: it fires, the pin is disarmed, `askPinPad` collapses to 0, and the question it
// exists to hold drifts away exactly while the answer is still arriving.
//
// A WRITE THAT FOLLOWS NEW CONTENT IS NOT A SYMPTOM. The answer grew, the room underneath it
// genuinely changed, and re-pinning is the entire job of this effect -- which is why it has
// no dependency list. The pathology the breaker was put here for is the opposite one:
// passes that keep writing while the content STANDS STILL. So the count is cleared whenever
// the streamed text has a different length from the one the previous pass saw, and what is
// left counted is only CONSECUTIVE writes with NO content change -- the defect itself.
//
// THE BREAKER BELOW IS UNTOUCHED: same bound, same disarm, same collapse to 0. This does not
// raise its ceiling and does not remove it. It stops charging it for work that was asked for.
const streamLen=streamingText==null?-1:streamingText.length;if(streamLen!==pinLenRef.current){pinLenRef.current=streamLen;pinPassRef.current=0;}// (1) ROOM. The shortfall against one viewport is the room still needed, and it therefore
// shrinks to zero by itself as a long answer fills the screen. Nothing here is a fixed spacer.
//
// THE MEASUREMENT MUST NOT CONTAIN THE SPACER, AND SUBTRACTING IT BACK OUT DOES NOT ACHIEVE
// THAT. The previous version read `el.scrollHeight` and took `appliedPad` off it. MEASURED on
// a real phone (430x932, DPR 3, coarse pointer), that identity is false twice over:
//
//   · A spacer in a column flexbox brings a ROW GAP with it. `offsetHeight` is the spacer's
//     own box and knows nothing of that gap, so `scrollHeight - appliedPad` came back 14px
//     short — the gap — and the pin always needed a SECOND commit to correct itself. Measured
//     on a full transcript: 0 -> 553 -> 539, settling on the right number one frame late.
//
//   · Worse, `scrollHeight` never drops below `clientHeight`. While the transcript is shorter
//     than the viewport — which is EVERY first question in a new chat — it stays pinned at
//     714 no matter how tall the spacer grows, so subtracting the spacer from it removed a
//     height that was never added. `need` then came back larger by exactly `anchorTop` on
//     every pass and the effect walked away from its own answer: measured 14, 28, 42, 56, 70,
//     84, 98, 112, and only `pinPassRef` stopped it. The breaker was being spent on EVERY
//     TURN, and the question it was protecting was never pinned at all.
//
// So the room is measured from the DOM directly and the spacer is excluded by NOT BEING PART
// OF THE READING, rather than by arithmetic. The spacer sits immediately before the end
// sentinel, so whichever of the two is present marks the same place — the point where the
// real content stops — and the reading is identical whether the spacer is mounted or not.
// `need` is therefore a function of the layout alone and NOT of `askPinPad`: the effect can
// no longer disagree with its own output, and one write is all it can ever take.
//
// The gap is subtracted because mounting the spacer is what creates it: a spacer that would
// buy less room than its own gap costs is not worth mounting, and `need` correctly comes out
// 0 there instead of flickering the element in and out of the tree.
//
// The #185 HISTORY IS STILL WHY THIS IS READ AND NOT REMEMBERED. An earlier version kept the
// applied height in a ref written when `setAskPinPad` was called — one commit BEFORE the DOM
// had it — and a render landing in that gap measured a `scrollHeight` without the spacer while
// subtracting a spacer already recorded. React stopped the page with «Maximum update depth
// exceeded». Nothing below asks anything to remember a height.
const tail=askPadElRef.current||messagesEndRef.current;if(!tail)return;// The scroller carries its own bottom padding (.ezc-scroll), and that padding is real room
// below the content — `scrollHeight` counted it and a bare rect read does not, so it is
// put back explicitly rather than being lost in the change of instrument.
// THE VIEW IS ASKED THROUGH THE ELEMENT, AND ONLY IF IT ANSWERS. The guards mount this tree
// in linkedom, which has no `getComputedStyle` at all; a bare global call threw inside this
// layout effect and took the whole app down with it under every DOM guard. There is no
// layout in that environment either -- every rect is 0 -- so falling back to 0 gives the
// same answer it would have given anyway, and the browser path is unchanged.
const view=el.ownerDocument&&el.ownerDocument.defaultView;const cs=view&&typeof view.getComputedStyle==='function'?view.getComputedStyle(el):null;const rowGap=cs?parseFloat(cs.rowGap)||0:0;const naturalBelow=tail.getBoundingClientRect().top-anchor.getBoundingClientRect().top+(cs?parseFloat(cs.paddingBottom)||0:0);const need=Math.max(0,Math.ceil(el.clientHeight-naturalBelow-rowGap));// Compared against the RENDERED value, and with a pixel of tolerance, so sub-pixel layout
// cannot start the same argument by a different route.
if(Math.abs(need-askPinPad)>1){pinPassRef.current+=1;if(pinPassRef.current>8){pinActiveRef.current=false;setAskPinPad(0);return;}setAskPinPad(need);// The spacer lands on the next commit, and this effect runs again then. Taking the
// position now, against a height that is about to change, would pin to a stale number.
return;}// (2) POSITION. The written value is read back rather than assumed: the browser clamps
// `scrollTop` to what the content allows, and remembering what we ASKED for instead of what
// we GOT is what would make the divergence test above fire on the pin's own writes.
if(Math.abs(el.scrollTop-anchorTop)>1)el.scrollTop=anchorTop;pinScrollTopRef.current=el.scrollTop;});// The turn is over: the room is given back so no gap is left under the answer, and the pin is
// disarmed. Keyed on the two facts that together mean «nothing more is coming».
useEffect(()=>{if(pinnedAskIndex==null)return;if(isLoading||streamingText!==null)return;pinActiveRef.current=false;pinPassRef.current=0;pinLenRef.current=-1;setAskPinPad(0);setPinnedAskIndex(null);},[pinnedAskIndex,isLoading,streamingText]);// S92: THE AUTOSAVE, and it is still the ONE write point the chat has -- every path that
// commits a turn (the greeting, a sent message, a call turn) already called this, so filing the
// conversation here means no path can forget to. The store decides whether there is anything
// worth filing: an empty thread files nothing and the chat keeps its null id, so an untouched
// chat leaves no row behind. The first real question is what mints the id, and from then on
// every turn rewrites the same conversation.
const saveMessages=msgs=>{if(!PERSIST_CONVERSATION)return;// مؤقت: لا تكتب المحادثة أثناء مرحلة التجارب.
const cid=ezikSaveChat(chatIdRef.current,msgs,ezikProfileKey(profileRef.current));if(!cid)return;if(cid!==chatIdRef.current){chatIdRef.current=cid;setChatId(cid);}refreshChatList();};// The menu's list, re-read from the store rather than patched in memory, so what the menu shows
// is always what a reboot would show. Filtered to the ACTIVE profile: that filter is the whole
// of the isolation, and it is applied on every single read.
const refreshChatList=()=>setChatList(ezikListChats(ezikProfileKey(profileRef.current)));// Put the thread back to the empty state: stop anything in flight, drop the conversation
// identity, clear the composer. Shared by «محادثة جديدة», by an explicit entry into the chat
// from the home screen, and by deleting the conversation that is currently open.
const resetThread=()=>{try{abortRef.current?.abort();}catch(e){}abortRef.current=null;cancelAudio();// S97: an empty thread has no end to land on, so the opening pin is disarmed rather than
// carried over from whatever conversation was open before. stickToEnd goes back to true
// because an empty thread IS at its end.
jumpToEndRef.current=false;stickToEndRef.current=true;chatIdRef.current=null;setChatId(null);setMessages([]);setStreamedOpen(new Set());// S98: a new thread inherits nobody's expanded replies
newThreadEpoch();// ...and nobody's manual ones either
setStreamingText(null);setIsLoading(false);setInput('');setPendingImage(null);};// D85: "new chat" -- returns the thread to the empty state. It stops anything in flight
// (a streaming reply, playing audio) and clears the composer too, so nothing survives it.
// S92: it no longer OVERWRITES anything. The conversation being left was filed the moment it
// got its first question and stays in the menu; this only lets go of it. The empty thread it
// leaves behind is not filed, and closing the drawer is the caller's business now, because
// every drawer item has to spend the drawer's history entry on its way out (closeDrawerWith).
//
// S94: this MUST stay next to resetThread, above every `if (screen === ...) return`. It used to
// sit just before the chat's own `return (`, which the home screen never reaches -- so the
// home FAB closed over a binding still in its temporal dead zone and the first tap threw
// «Cannot access 'newChat' before initialization» instead of opening the chat. A `const` is
// only initialised when control actually runs its line; an early return skips it entirely.
// chat-history-guard.cjs pins this ordering.
const newChat=()=>{resetThread();};// S118: what «محادثة جديدة» calls. newChat only RESETS the thread, which was enough while the
// menu could be opened from the chat and from nowhere else -- the reader was already on the
// screen the reset applies to. The home opens the same menu now, and a row that emptied the
// thread and left the reader on the home screen would be a control that silently does nothing.
// So it resets AND lands on the chat. From the chat, setScreen('chat') is the screen already
// showing, so that path is byte-for-byte the behaviour it had.
const startChatFromMenu=()=>{newChat();setScreen('chat');};// Open a saved conversation: the same stop-everything as a new chat, then the stored messages
// become the thread and the chat adopts that conversation's id, so the next turn rewrites it
// rather than filing a second copy. The messages are restored VERBATIM, which is what brings
// the source cards back -- they are rendered from the reply text that was saved.
const openSavedChat=id=>{try{abortRef.current?.abort();}catch(e){}abortRef.current=null;cancelAudio();chatIdRef.current=id;// S97: arm the pin BEFORE the messages are handed to React, so the layout effect that runs
// inside this very commit already knows to land at the end. Set after, it would be one paint
// too late -- which is the whole bug this replaces.
jumpToEndRef.current=true;stickToEndRef.current=true;skipFollowRef.current=1;// the one follow-effect run this open is about to cause
setChatId(id);setMessages(ezikReadChatMessages(id));setStreamedOpen(new Set());// S98: a restored conversation opens with every long reply folded
newThreadEpoch();// ...including one the reader had expanded a moment ago
setStreamingText(null);setIsLoading(false);setInput('');setPendingImage(null);};const pinSavedChat=id=>{ezikToggleChatPin(id);refreshChatList();};// ============================================================
// S98 — المفضلة (favourites), managed centrally and in one place
// ============================================================
// Everything about favourites goes through the three things below. Nothing else in the tree
// reads the store, and no component holds its own copy — which is what stops a screen from
// showing a record the disk refused, or a star that disagrees with the list behind it.
const favPk=ezikProfileKey(profileRef.current||profile);// THIS PROFILE'S FAVOURITES, and only this profile's. The match is exact: a record whose owner
// is anything other than the active profile is not shown, not counted in the menu badge, and
// not reachable from any screen. A record with no owner at all never gets this far — the reader
// drops it — so there is no "belongs to everyone" case left for a second child to fall into.
const myFavs=React.useMemo(()=>favs.filter(f=>f.pk===favPk).sort((a,b)=>(b.at||0)-(a.at||0)),[favs,favPk]);// The lookup a bubble is asked for. A Set, rebuilt once per change — never a scan per bubble.
const favIdSet=React.useMemo(()=>{const set=new Set();for(let i=0;i<myFavs.length;i++)set.add(myFavs[i].id);return set;},[myFavs]);// WHICH BUBBLE WEARS A FILLED STAR, decided ONCE per change of the thread, the conversation, the
// profile or the favourites — never per render. Hashing a reply is O(its length), so asking the
// question inside the map would have re-hashed every answer in a 120-turn conversation on every
// keystroke in the composer: exactly the class of defect S97 removed from the markdown parse. A
// user turn is not hashed at all. The index the map already has IS the position term of the id.
const favFlags=React.useMemo(()=>messages.map((m,i)=>!!(m&&m.role==='assistant'&&typeof m.content==='string'&&m.content&&favIdSet.has(ezikFavId(favPk,chatId,i,m.content)))),[messages,favIdSet,favPk,chatId]);// The ONE writer. It reads the ref, not the state, so a fast double tap toggles twice rather
// than adding the same reply twice; it adopts whatever the store actually accepted, so a full
// or refused store never leaves the screen claiming something was saved when it was not.
const applyFavs=next=>{const written=ezikWriteFavs(next);const settled=written===null?favsRef.current:written;// store refused: change nothing
favsRef.current=settled;setFavs(settled);return written!==null;};// The ONE writer's toggle. `idx` is the bubble's own position, handed down from the map that
// already had it — no message object is touched to obtain it. chatIdRef is read rather than the
// chatId state because it is the synchronous truth: the id is minted inside saveMessages during
// the same turn, and a tap landing before React has committed that state must still file the
// favourite under the conversation it really belongs to.
const toggleFavoriteReply=(msg,idx)=>{const text=msg&&typeof msg.content==='string'?msg.content:'';if(!text.trim())return;const id=ezikFavId(favPk,chatIdRef.current,idx,text);const cur=favsRef.current;const exists=cur.some(f=>f.id===id);applyFavs(exists?cur.filter(f=>f.id!==id):[ezikMakeFav(text,favPk,chatIdRef.current,idx)].concat(cur.filter(f=>f.id!==id)));};const removeFavorite=id=>applyFavs(favsRef.current.filter(f=>f.id!==id));// Item 86: THE AYAH STAR. A set of REFERENCES, not of ids -- a bubble knows which verse it is
// showing but not the hash of the canonical text, and asking it to hash one per render is the
// cost favIdSet was written to avoid. Rebuilt once per change, exactly like favIdSet.
const ayahFavIds=React.useMemo(()=>{const set=new Set();for(let i=0;i<myFavs.length;i++)if(ezikKindOf(myFavs[i])==='ayah'&&myFavs[i].ref)set.add(myFavs[i].ref);return set;},[myFavs]);// The verse card hands up what it is showing -- including the CANONICAL text it fetched from
// the guarded mushaf, never the model's -- and this makes the record from it.
const toggleFavoriteAyah=v=>{const ref=ezikAyahFavKey(v&&v.surahNum,v&&v.surah,v&&v.ayah);const text=String(v&&v.text||'').trim();if(!ref||!text)return;const title=v&&v.surah?'سورة '+v.surah+'، آية '+toArabicDigits(v.ayah):ref;const rec=ezikMakeFavOf('ayah',favPk,ref,title,text);const cur=favsRef.current;const exists=cur.some(f=>f.id===rec.id);applyFavs(exists?cur.filter(f=>f.id!==rec.id):[rec].concat(cur.filter(f=>f.id!==rec.id)));};// ...and the store may now be written from a screen this component does not own (الفتاوى), so
// it is re-read on the store's own announcement rather than only on this component's writes.
useEffect(()=>{const onFavs=()=>{const l=ezikReadFavs();favsRef.current=l;setFavs(l);};try{window.addEventListener(EZIK_FAVS_EVENT,onFavs);}catch(e){}return()=>{try{window.removeEventListener(EZIK_FAVS_EVENT,onFavs);}catch(e){}};},[]);// ============================================================
// S98 — البحث (search), and where its cost is paid
// ============================================================
// THE COST IS PAID ONCE, ON THE FIRST LETTER, and never on opening the menu. Assembling the
// corpus means reading and parsing one stored body per conversation — at 40 conversations that
// is 40 reads, and doing it on every keystroke, or merely on every menu open, is exactly the
// regression this phase is not allowed to introduce. So it is built lazily and cached against
// the conversation list's own identity: the first letter builds it, every later letter reuses
// it, and a conversation saved, pinned or deleted invalidates it by changing that identity.
const searchCorpusRef=useRef({key:null,rows:null});const getSearchCorpus=()=>{let key='';for(let i=0;i<chatList.length;i++)key+=chatList[i].id+':'+(chatList[i].at||0)+'|';if(searchCorpusRef.current.key===key&&searchCorpusRef.current.rows)return searchCorpusRef.current.rows;// A plain loop rather than a mapped one, deliberately: chat-history-guard counts the mapping
// of the conversation list to prove the menu renders that list exactly once, and a second
// mapping here — a corpus build, not a render — would read to that gate as a duplicated
// list. Identical result, and the gate keeps the meaning it was written with.
const rows=[];for(let i=0;i<chatList.length;i++)rows.push(ezikBuildSearchRow(chatList[i]));searchCorpusRef.current={key:key,rows:rows};return rows;};const[chatQuery,setChatQuery]=useState('');const[favQuery,setFavQuery]=useState('');// Item 86: WHICH KIND THE VIEWER IS SHOWING. 'all' is the opening state, so the screen still
// opens on everything the reader has ever saved and the filter is a narrowing, never a wall.
const[favKind,setFavKind]=useState('all');// null means "no search is running" — the menu then shows its ordinary list, untouched.
const chatResults=React.useMemo(()=>{const q=ezikSearchQuery(chatQuery);if(!q)return null;return ezikSearchChats(getSearchCorpus(),q);},[chatQuery,chatList]);const favResults=React.useMemo(()=>{const q=ezikSearchQuery(favQuery);if(!q)return null;return ezikSearchFavs(myFavs,q);},[favQuery,myFavs]);// The kind narrows FIRST and the search runs over what is left, so a query and a kind mean
// "this word, among these" rather than two independent lists fighting over one screen.
const kindFavs=favKind==='all'?myFavs:myFavs.filter(f=>ezikKindOf(f)===favKind);const shownFavs=favResults===null?kindFavs:favResults.filter(f=>favKind==='all'||ezikKindOf(f)===favKind);// What each tab would hold, counted once for the whole screen rather than per tab.
const favCounts=React.useMemo(()=>{const c={all:myFavs.length,reply:0,fatwa:0,ayah:0};for(let i=0;i<myFavs.length;i++){const k=ezikKindOf(myFavs[i]);c[k]=(c[k]||0)+1;}return c;},[myFavs]);// Which saved conversations still exist, computed ONCE for the whole favourites screen rather
// than once per card — the screen asks it for every row.
const liveChatIds=React.useMemo(()=>{const set=new Set();if(screen!=='favorites')return set;// only the screen that needs it pays for it
ezikReadChatIndex().forEach(r=>set.add(r.id));return set;},[screen,chatList]);const openFavoriteChat=id=>{if(!id||!liveChatIds.has(id))return;openSavedChat(id);goEzikBack();// spend the sheet's own history entry
};// Deleting is confirmed first (chatPendingDelete holds the row that asked). Deleting the
// conversation that is OPEN empties the thread too -- the chat cannot go on showing messages
// whose conversation no longer exists -- and that empty thread is not re-filed, because the
// autosave files nothing without a question in it.
const deleteSavedChat=id=>{ezikDeleteChat(id);if(chatIdRef.current===id)resetThread();setChatPendingDelete(null);refreshChatList();};// ============================================================
// مُنسِّق الصوت الموحَّد — مصدر واحد يعمل في كل لحظة
// ============================================================
// كل الأصوات (نُطق المربّي عبر ElevenLabs + تلاوة القارئ) تمرّ عبر audioRef
// الواحد. بدء أيّ مصدر يُوقف الآخر (takeAudioFocus)، ويُنسَّق التسلسل
// «كلام → تلاوة → كلام» عبر speakReply. sequenceIdRef يُلغي أي تسلسل جارٍ.
// إيقاف الصوت النشِط حالياً (دون إلغاء التسلسل) — يُستخدم للتبديل بين المصادر
const takeAudioFocus=()=>{audioPlayTokenRef.current++;// stale TTS events become no-ops
const f=audioDoneRef.current;audioDoneRef.current=null;if(f){try{f();}catch(e){}}// resolve+detach the in-flight TTS playback
if(audioRef.current){try{audioRef.current.pause();}catch(e){}// recitation path: pause fires its onpause -> resolves
audioRef.current=null;}try{if(audioElRef.current)audioElRef.current.pause();}catch(e){}// actually stop the reused TTS element
};// إلغاء التسلسل الجاري بالكامل (رسالة جديدة / بدء استماع / إيقاف يدوي)
const cancelAudio=()=>{sequenceIdRef.current++;takeAudioFocus();setIsSpeaking(false);};const stopSpeaking=cancelAudio;// ===== خطّ أنابيب الصوت: نفصل "جلب" المقطع الكلاميّ عن "تشغيله" =====
// fetchSpeechAudio يُحضّر الصوت (tashkeel عند اللزوم + ElevenLabs → blob) دون تشغيلٍ
// ودون سحبِ التركيز — فيمكن استدعاؤه مُسبقاً أثناء تشغيل مقطعٍ آخر، فيزول صمتُ الانتظار.
// يُرجع {kind:'blob',url} (صوت ElevenLabs) أو null (فارغ/مُلغى/فشل — فشل آمن بلا صوت).
const SPEAK_EMOJI_RE=/[\u{1F600}-\u{1F6FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2300}-\u{23FF}\u{2B50}\u{1F900}-\u{1F9FF}]/gu;const fetchSpeechAudio=async(rawText,myId)=>{if(!spendGateRef.current)return null;// قفل الإنفاق مغلق ⇐ لا نداءَ tashkeel/tts
if(!hasValidAIConsent())return null;// لا موافقة ⇐ لا نصَّ يُرسَل لـ Anthropic ولا لـ ElevenLabs
if(childVoiceBlocked()){// غ‑٣: لا إرسالَ نصٍّ لأيّ خدمةِ نطقٍ من ملفّ طفل
showChildVoiceNotice(setVoiceError);// فشلٌ آمنٌ بلا صوت — ولا زرٌّ أخرس
return null;}const isCurrent=()=>myId===undefined||myId===sequenceIdRef.current;// إزالة الوسوم وتحويلها لنص طبيعي للنطق (الآية محذوفة هنا — تُتلى لا تُنطق)
const ttsText=formatForTTS(rawText);const cleanText=ttsText.replace(SPEAK_EMOJI_RE,'').trim();if(!cleanText||!isCurrent())return null;// فَحص ذكيّ للتشكيل — نتخطّى Haiku إن كان تشكيل Opus كافياً (٦٠٪+)
const diacriticCount=(cleanText.match(/[ً-ْٰ]/g)||[]).length;const letterCount=(cleanText.match(/[ء-ي]/g)||[]).length;const diacriticRatio=letterCount>0?diacriticCount/letterCount:0;let textForTTS=cleanText;const bandForVoice=(()=>{try{return deriveCaps(profileRef.current?.age).band;}catch(e){return'young';}})();if(diacriticRatio>=0.6||!TTS_TASHKEEL_ENABLED){// النصّ مُشكَّل جيداً من Opus — نَتخطّى Haiku، نوفِّر ثانيةً كاملة
console.log(`[المربّي] تشكيل Opus كافٍ (${Math.round(diacriticRatio*100)}٪) — تخطّينا Haiku`);}else{// التشكيل ناقص — نَستدعي Haiku للضبط
console.log(`[المربّي] تشكيل ناقص (${Math.round(diacriticRatio*100)}٪) — نَستدعي Haiku للضبط`);try{const tashkeelResponse=await aiFetch('/api/tashkeel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:cleanText,gender:profileRef.current?.gender,band:bandForVoice})});if(tashkeelResponse.ok){const tashkeelData=await tashkeelResponse.json();if(tashkeelData.text&&tashkeelData.text.trim()){textForTTS=tashkeelData.text;}}}catch(e){console.warn('[المربّي] Tashkeel failed, using original text:',e);// نُكمل بالنص الأصلي بدون توقف
}}if(!isCurrent())return null;// أُلغِيَ أثناء التشكيل
// مفتاح A/B: تجريد التشكيل من النصّ المُرسَل للنطق فقط (العرض يبقى مُشَكَّلاً)
const spokenText=STRIP_TASHKEEL_FOR_TTS?stripAllTashkeel(textForTTS):textForTTS;// ElevenLabs TTS — نُحضّر الـ blob فقط، ولا نُشغّل ولا نسحب التركيز هنا
try{const response=await aiFetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:spokenText,gender:profileRef.current?.gender,band:bandForVoice})});if(!isCurrent())return null;// أُلغِيَ أثناء جلب الصوت
if(response.ok){const audioBlob=await response.blob();if(!isCurrent())return null;const url=URL.createObjectURL(audioBlob);if(!isCurrent()){URL.revokeObjectURL(url);return null;}// مُلغى → لا تُسرّب blob
return{kind:'blob',url,consumed:false};}console.warn('ElevenLabs TTS failed (HTTP '+response.status+') — failing safe: no audio, no system-voice fallback');}catch(e){console.warn('ElevenLabs TTS error — failing safe: no audio, no system-voice fallback:',e);}// فشل ElevenLabs → فشل آمن: لا صوت إطلاقاً. تطبيق الأطفال يجب ألّا يُصدر صوت نظامٍ
// مجهولاً/عشوائياً أبداً، لذا لا نرجع أيّ مقطعٍ كلاميّ. مؤشّر بصري خفيف غير معطِّل يظهر
// في واجهة المحادثة (يُمسح تلقائياً بعد ٦ ثوانٍ) — لا نُشغّل احتياط المتصفح.
if(isCurrent()){setVoiceError('🔇 تعذّر تشغيل الصوت — تحقّق من الاتصال وحاول مرة أخرى.');setTimeout(()=>setVoiceError(''),6000);}return null;};// playPreparedSpeech يستقبل وعدَ تحضيرٍ (قد يكون اكتمل مسبقاً) ويُشغّله. هنا فقط نسحب
// التركيز ونشغّل — awaitable حتى الانتهاء/الخطأ/الإيقاف. يحترم الإلغاء قبل التشغيل.
const playPreparedSpeech=async(prepPromise,myId)=>{const isCurrent=()=>myId===undefined||myId===sequenceIdRef.current;if(!prepPromise)return;let r=null;try{r=await prepPromise;}catch(e){r=null;}if(!r)return;if(!isCurrent()){// أُلغِيَ قبل أن نُشغّله — تخلّص من blob المُحضَّر دون تشغيلٍ بائت
if(r.kind==='blob'&&r.url){r.consumed=true;URL.revokeObjectURL(r.url);}return;}r.consumed=true;takeAudioFocus();if(r.kind==='blob'){const audio=audioElRef.current||(audioElRef.current=new Audio());// REUSE the unlocked element (iOS)
audioRef.current=audio;const myPlay=++audioPlayTokenRef.current;await new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;audio.onended=null;audio.onerror=null;audio.onpause=null;try{URL.revokeObjectURL(r.url);}catch(e){}if(audioRef.current===audio)audioRef.current=null;if(audioDoneRef.current===finish)audioDoneRef.current=null;resolve();};audioDoneRef.current=finish;// lets takeAudioFocus cancel cleanly
const guard=()=>{if(myPlay===audioPlayTokenRef.current)finish();};// ignore stale events
audio.onended=guard;audio.onerror=guard;audio.onpause=guard;audio.src=r.url;const p=audio.play();if(p&&p.catch)p.catch(guard);});return;}// فشل آمن: لم يَعُد هناك احتياط صوت نظام. أيّ نتيجةٍ غير 'blob' لا تُنطَق إطلاقاً
// (تطبيق أطفال يجب ألّا يُصدر صوتاً مجهولاً). عملياً الآن تكون النتيجة إمّا 'blob' أو null.
};// تشغيل مقطعِ تلاوةٍ (mp3) على العنصر المفتوح بإيماءة المستخدم — نفس عنصر TTS (audioElRef).
// العطبُ عاش سنةً لأن التلاوة كانت تُنشئ new Audio() بعد await‑ات فيَنقضي التفعيلُ الصوتيّ
// للجوّال ويُحجَب play()، والرفضُ يُبتلع. هنا نُعيد استخدام العنصر المفتوح، ونحمي الأحداثَ
// البائتة بـaudioPlayTokenRef، ونُسجّل المُنهيَ في audioDoneRef كي يُنهيَه takeAudioFocus مباشرةً.
// لا يمرّ عبر fetchSpeechAudio ولا بوّابة TTS — التلاوة مسموحة للطفل (mp3 قارئٍ حقيقيّ).
const playRecitationUrl=(url,myId)=>new Promise(resolve=>{if(myId!==undefined&&myId!==sequenceIdRef.current)return resolve({failed:false});takeAudioFocus();const audio=audioElRef.current||(audioElRef.current=new Audio());// العنصر المفتوح (iOS)
audioRef.current=audio;const myPlay=++audioPlayTokenRef.current;// يُبطِل أحداثَ التشغيل البائتة
let settled=false;const finish=failed=>{if(settled)return;settled=true;audio.onended=null;audio.onerror=null;audio.onpause=null;if(audioRef.current===audio)audioRef.current=null;if(audioDoneRef.current===finishExternal)audioDoneRef.current=null;resolve({failed:!!failed});};const finishExternal=()=>finish(false);// takeAudioFocus/إيقاف خارجيّ: يُنهي المقطعَ مباشرةً
audioDoneRef.current=finishExternal;audio.onended=()=>{if(myPlay===audioPlayTokenRef.current)finish(false);};audio.onerror=()=>{if(myPlay===audioPlayTokenRef.current)finish(true);};audio.onpause=()=>{if(myPlay===audioPlayTokenRef.current)finish(false);};// سحبُ تركيزٍ/إيقافٌ يدويّ
audio.src=url;const p=audio.play();if(p&&p.catch)p.catch(e=>{// ⛔ لا نبتلع الفشل صامتاً — نُسجّل سببَ الرفض (تفعيلٌ صوتيّ محجوب / شبكة) بدل تمريره كنجاح
console.warn('[المربّي] تعذّر تشغيل التلاوة:',e&&(e.name||e.message)||e);if(myPlay===audioPlayTokenRef.current)finish(true);});});// تشغيل تلاوة آيةٍ مفردةٍ بصوت القارئ — awaitable: يُحَلّ {failed} عند انتهاء/خطأ/إيقاف الصوت
const playRecitation=(sNum,aNum,myId)=>{if(myId!==undefined&&myId!==sequenceIdRef.current)return Promise.resolve({failed:false});const pad3=x=>String(x).padStart(3,'0');const url=`https://everyayah.com/data/${QURAN_RECITER}/${pad3(sNum)}${pad3(aNum)}.mp3`;return playRecitationUrl(url,myId);};// بناء تسلسل الصوت من الردّ: مقاطع كلام + تلاوات (آية مفردة <verse> أو سورة/مدى <surah>).
// نَقسِم عند حدود <verse>/<surah> — الحديث/الخطوات تبقى داخل مقاطع الكلام (تُنطق عبر
// formatForTTS)، ونصّ الآية/السورة يقع بين الحدود فلا يُنطق (يتلوه القارئ الحقيقي).
// Sentence-level TTS streaming: split the teacher's prose into short sentences that flow
// through the EXISTING prefetch machinery (prep[]/prepareSpeak in speakReply). Only the
// first sentence is awaited before audio starts; the rest are generated/fetched while the
// current sentence plays. Does NOT touch fetchSpeechAudio, the mobile audio unlock, or the server.
// We run formatForTTS BEFORE splitting so a multi-line tag (<steps>/<source>/<hadith> …) is
// never cut across two chunks; fetchSpeechAudio re-runs formatForTTS per chunk, which is
// idempotent on already-clean text, so double formatting is safe.
const splitSpeechIntoSentences=prose=>{const clean=formatForTTS(prose).trim();if(!clean)return[];const SENT='\uE000';// private-use sentinel; never appears in real text
const marked=clean.replace(/([.!\u061F?\u061B])\s+/g,'$1'+SENT)// after . ! ؟ ? ؛ + space (won't split "3.5")
.replace(/\n+/g,SENT);// and at line breaks
const MIN_CHARS=40;// merge tiny fragments to avoid choppy micro-requests
const chunks=[];for(let s of marked.split(SENT)){s=s.trim();if(!s)continue;const n=chunks.length;if(n&&chunks[n-1].length<MIN_CHARS)chunks[n-1]+=' '+s;else chunks.push(s);}return chunks.length?chunks:[clean];};const buildAudioSequence=text=>{// نُنظّف الترميز الناقص أوّلاً كي لا يُرسَل "<verse surah=..." خاماً إلى ElevenLabs
text=stripIncompleteTags(text,{rescue:true});const parts=[];const blockRe=/<(verse|surah|dhikr)([^>]*)>[\s\S]*?<\/\1>/g;let last=0,m;while((m=blockRe.exec(text))!==null){const before=text.slice(last,m.index);for(const chunk of splitSpeechIntoSentences(before))parts.push({kind:'speak',text:chunk});const tag=m[1],attrs=m[2]||'';if(tag==='dhikr'){// dhikr - recorded Hisn al-Muslim recitation, auto-played inline (empty <dhikr id="N">)
const catId=(attrs.match(/id=["']([^"']+)["']/)||[])[1];if(catId)parts.push({kind:'reciteDhikr',catId});}else if(tag==='verse'){const sNum=resolveSurahNumber((attrs.match(/surah=["']([^"']+)["']/)||[])[1],(attrs.match(/surah_num=["']([^"']+)["']/)||[])[1]);const aNum=parseInt((attrs.match(/ayah=["']([^"']+)["']/)||[])[1],10);if(sNum&&aNum>=1)parts.push({kind:'recite',sNum,aNum});}else{// surah — تلاوة متتابعة لمدًى من الآيات
const sNum=resolveSurahNumber(undefined,(attrs.match(/num=["']([^"']+)["']/)||[])[1]);const from=parseInt((attrs.match(/from=["']([^"']+)["']/)||[])[1],10);const to=parseInt((attrs.match(/to=["']([^"']+)["']/)||[])[1],10);if(sNum)parts.push({kind:'reciteSurah',sNum,from:from>=1?from:1,to:to>=1?to:null});}last=m.index+m[0].length;}const tail=text.slice(last);for(const chunk of splitSpeechIntoSentences(tail))parts.push({kind:'speak',text:chunk});return parts;};// تلاوة سورة/مدًى متتابعاً بصوت القارئ، مع تحميلٍ مُسبقٍ للآية التالية → بلا فجوات.
// يحترم الإلغاء (sequenceIdRef/takeAudioFocus). يُرجع {failed}.
const playSurahRecitation=async(sNum,from,to,myId)=>{const isCurrent=()=>myId===undefined||myId===sequenceIdRef.current;if(!sNum)return{failed:true};let f=from>=1?from:1;let t=to;if(!(t>=1)){// المدى مفتوح → السورة كاملة: نحتاج عدد الآيات من المصحف
try{await loadQuran();}catch(e){}t=getSurahAyahCount(sNum);}if(!(t>=f))return{failed:true};const pad3=x=>String(x).padStart(3,'0');const mkUrl=a=>`https://everyayah.com/data/${QURAN_RECITER}/${pad3(sNum)}${pad3(a)}.mp3`;// كلُّ آيةٍ تُشغَّل على العنصر المفتوح (playRecitationUrl) بدل new Audio() بعد await، فينجو
// التفعيلُ الصوتيّ للجوّال. لا عنصرَ ثانٍ يُسبَق (كان يفلت من takeAudioFocus)؛ نُسخّن كاشَ الآية
// التالية بجلبٍ رخيصٍ (preloadRecitation) لتبقى الفجوة صغرى. takeAudioFocus/cancelAudio يوقفان العنصر ذاته.
let failedAny=false;for(let a=f;a<=t;a++){if(!isCurrent())break;if(a+1<=t)preloadRecitation(sNum,a+1);const res=await playRecitationUrl(mkUrl(a),myId);if(res.failed)failedAny=true;if(!isCurrent())break;}return{failed:failedAny};};// إعادة تشغيل تلاوة السورة يدوياً من زرّ البطاقة — يُوقف كلام المربّي أولاً. awaitable.
const playSurahManual=async(sNum,from,to)=>{const myId=++sequenceIdRef.current;// يُلغي أي تسلسل/كلام جارٍ
takeAudioFocus();setIsSpeaking(true);const res=await playSurahRecitation(sNum,from,to,myId);if(myId===sequenceIdRef.current)setIsSpeaking(false);return res;};// تحميل مسبق رخيص لتلاوةٍ قادمة (تسخين كاش المتصفح) — أفضل جهد، يُتجاهَل أيّ فشل.
const __preloadedRecitations=new Set();const preloadRecitation=(sNum,aNum)=>{if(!sNum||!(aNum>=1))return;const pad3=x=>String(x).padStart(3,'0');const url=`https://everyayah.com/data/${QURAN_RECITER}/${pad3(sNum)}${pad3(aNum)}.mp3`;if(__preloadedRecitations.has(url))return;__preloadedRecitations.add(url);try{fetch(url,{mode:'no-cors'}).catch(()=>{});}catch(e){}};// تشغيل الردّ كاملاً بالتنسيق: كلام-قبل → تلاوة → كلام-بعد، مع إمكان الإلغاء.
// الإصلاح (ب): نُحضّر المقطع الكلاميّ التالي (ElevenLabs) أثناء تشغيل الحاليّ، فيبدأ
// فوراً عند انتهاء التلاوة/الكلام بلا صمتِ انتظار. كلّ تحضيرٍ يحترم الإلغاء (sequenceIdRef)،
// وأيّ صوتٍ مُحضَّرٍ لم يُشغَّل يُلغى ويُحرَّر (لا يُشغَّل مقطعٌ بائت أبداً).
const speakReply=async text=>{if(!text)return;text=await resolveWorshipTags(text,deriveCaps(profileRef.current?.age).band);const parts=buildAudioSequence(text);if(!parts.length)return;const myId=++sequenceIdRef.current;// يُلغي أي تسلسل سابق
takeAudioFocus();setIsSpeaking(true);// وعود تحضير المقاطع الكلامية (index → Promise<{kind,...}|null>)
const prep=new Array(parts.length).fill(null);const prepareSpeak=i=>{if(i<0||i>=parts.length||parts[i].kind!=='speak')return null;if(!prep[i])prep[i]=fetchSpeechAudio(parts[i].text,myId);return prep[i];};const nextSpeakIndex=from=>{for(let j=from;j<parts.length;j++)if(parts[j].kind==='speak')return j;return-1;};// ابدأ تحضير أوّل مقطعٍ كلاميّ فوراً (لا شيء نُوازيه قبله — تأخيره الابتدائيّ كاليوم).
prepareSpeak(nextSpeakIndex(0));for(let i=0;i<parts.length;i++){if(myId!==sequenceIdRef.current)break;// أُلغِيَ
const part=parts[i];// أثناء تشغيل المقطع الحاليّ: حضّر المقطع الكلاميّ القادم، وسخّن التلاوة التالية إن وُجدت.
const nx=nextSpeakIndex(i+1);if(nx>=0)prepareSpeak(nx);if(i+1<parts.length){const np=parts[i+1];if(np.kind==='recite')preloadRecitation(np.sNum,np.aNum);else if(np.kind==='reciteSurah')preloadRecitation(np.sNum,np.from||1);}try{if(part.kind==='speak')await playPreparedSpeech(prepareSpeak(i),myId);else if(part.kind==='reciteSurah')await playSurahRecitation(part.sNum,part.from||1,part.to,myId);else if(part.kind==='reciteDhikr')await playDhikrRecitation(part.catId,myId);else await playRecitation(part.sNum,part.aNum,myId);}catch(e){}if(myId!==sequenceIdRef.current)break;}if(myId===sequenceIdRef.current)setIsSpeaking(false);// نظافة: حرّر أيّ صوتٍ كلاميّ مُحضَّرٍ لم يُشغَّل (إلغاء/خطأ) كي لا تتسرّب blob URLs.
for(let i=0;i<prep.length;i++){const pr=prep[i];if(!pr)continue;Promise.resolve(pr).then(r=>{if(r&&r.kind==='blob'&&r.url&&!r.consumed)URL.revokeObjectURL(r.url);}).catch(()=>{});}};// إعادة تشغيل التلاوة يدوياً من زر البطاقة — يُوقف كلام المربّي أولاً. awaitable.
const playVerseManual=async(sNum,aNum)=>{const myId=++sequenceIdRef.current;// يُلغي أي تسلسل/كلام جارٍ
takeAudioFocus();setIsSpeaking(true);const res=await playRecitation(sNum,aNum,myId);if(myId===sequenceIdRef.current)setIsSpeaking(false);return res;};// Auto-play the recorded Hisn al-Muslim recitation for a dua/dhikr category, inline in the
// audio sequence -- the dhikr counterpart of playSurahRecitation for a verse. Plays each
// item's d.audio (from adhkar.json) in order, in the reciter's recorded voice (NOT Murabbi
// TTS). Respects cancellation (sequenceIdRef/takeAudioFocus) and reuses the unlocked audio
// element (playRecitationUrl) -- no parallel player. Items without audio stay silent.
const playDhikrRecitation=async(catId,myId)=>{const isCurrent=()=>myId===undefined||myId===sequenceIdRef.current;if(!catId)return{failed:true};let items=[];try{const db=await loadAdhkar();items=db&&db.byCat&&db.byCat[parseInt(catId,10)]||[];}catch(e){return{failed:true};}const urls=items.map(d=>d&&d.audio).filter(Boolean);if(!urls.length)return{failed:false};// كلُّ ذِكرٍ يُشغَّل على العنصر المفتوح (playRecitationUrl) بدل new Audio() بعد await.
let failedAny=false;for(const url of urls){if(!isCurrent())break;const res=await playRecitationUrl(url,myId);if(res.failed)failedAny=true;if(!isCurrent())break;}return{failed:failedAny};};// CALL_STREAM_SPEECH streaming speech. Speaks COMPLETE prose sentences that arrive
// BEFORE the first tag (first-audio latency win); the moment any tag appears, streaming
// stops and everything from the first tag onward is played by the PROVEN buildAudioSequence
// at finish(). One session (sequenceIdRef) so barge-in / cancelAudio stops it; reuses the
// existing play machinery -- no parallel player. feed(full) is used as callAI onDelta;
// finish(fullReply) replaces speakReply(reply) and resolves when playback ends.
const createCallSpeechStream=()=>{const myId=++sequenceIdRef.current;// one session; cancelAudio()/barge-in bump this to stop us
takeAudioFocus();setIsSpeaking(true);const queue=[];let consuming=false,inputDone=false,hitTag=false,consumedLen=0;let resolveDone;const donePromise=new Promise(r=>{resolveDone=r;});const isCurrent=()=>myId===sequenceIdRef.current;const finishUp=()=>{if(isCurrent())setIsSpeaking(false);resolveDone();};const pump=async()=>{if(consuming)return;consuming=true;while(true){if(!isCurrent()){consuming=false;finishUp();return;}// barge-in / superseded
if(queue.length===0){if(inputDone){consuming=false;finishUp();return;}consuming=false;return;// idle; re-kicked by enqueue/finish
}const seg=queue.shift();try{if(seg.kind==='speak')await playPreparedSpeech(fetchSpeechAudio(seg.text,myId),myId);else if(seg.kind==='reciteSurah')await playSurahRecitation(seg.sNum,seg.from||1,seg.to,myId);else if(seg.kind==='reciteDhikr')await playDhikrRecitation(seg.catId,myId);else await playRecitation(seg.sNum,seg.aNum,myId);}catch(e){}}};const enqueue=segs=>{for(const s of segs)queue.push(s);pump();};// last safe cut inside tag-free prose: end of the last COMPLETE sentence
const lastSentenceCut=s=>{let cut=0,re=/[.!\u061F?\u061B]\s|\n/g,m;while((m=re.exec(s))!==null)cut=m.index+m[0].length;return cut;};const feed=full=>{if(!isCurrent()||hitTag)return;const safe=stripIncompleteTags(full);// drops any incomplete trailing tag
const tm=/<(verse|surah|hadith|steps|suggestions|source|dhikr|worship)[\s>\/]/.exec(safe);const firstTag=tm?tm.index:safe.length;// prose is streamable only BEFORE the first tag
const region=safe.slice(consumedLen,firstTag);// tag-free prose not yet spoken
const cut=tm?region.length:lastSentenceCut(region);// tag present -> flush prose up to it; else complete sentences only
if(cut>0){const segs=[];for(const c of splitSpeechIntoSentences(region.slice(0,cut)))segs.push({kind:'speak',text:c});consumedLen+=cut;enqueue(segs);}if(tm)hitTag=true;// reached a tag -> stop streaming; finish() plays the rest via buildAudioSequence
};const finish=async fullReply=>{let rest=(fullReply||'').slice(consumedLen);// tags + any trailing prose not yet spoken
rest=await resolveWorshipTags(rest,deriveCaps(profileRef.current?.age).band);if(rest.trim())enqueue(buildAudioSequence(rest));inputDone=true;pump();await donePromise;};return{feed,finish};};// Chat dictation goes through api/stt (Scribe) too: tap to record, tap again to transcribe.
// The Google engine is not used here at all -- it mishears Kuwaiti Arabic and cannot be tuned,
// and a round-trip proof (our own TTS -> /api/stt) came back letter-perfect. DICTATE_CLOUD=false
// restores the Web Speech path untouched.
const DICTATE_CLOUD=false;// OFF until the silent failure after the second tap is measured (call mode is unaffected)
const inputElRef=useRef(null);// The composer grows from STATE, not from the keystroke: dictation fills it programmatically
// and an onChange-only resize would leave a one-line box holding six lines of speech.
useEffect(()=>{const el=inputElRef.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,200)+'px';},[input]);const dictStreamRef=useRef(null);const dictRecRef=useRef(null);const dictChunksRef=useRef([]);const stopDictAll=()=>{try{if(dictRecRef.current&&dictRecRef.current.state!=='inactive')dictRecRef.current.stop();}catch(e){}dictRecRef.current=null;try{dictStreamRef.current?.getTracks().forEach(tr=>tr.stop());}catch(e){}dictStreamRef.current=null;};const startCloudDictation=async()=>{// The cloud dictation recorder, on the same terms as everything else: no consent, no
// getUserMedia. startListening already refuses above this, so this is the second barrier.
if(!hasValidAIConsent()){setIsListening(false);setVoiceError(EZ_SPEECH_NO_CONSENT);setTimeout(()=>setVoiceError(''),6000);return;}try{dictStreamRef.current=await navigator.mediaDevices.getUserMedia({audio:true});dictChunksRef.current=[];const mr=new MediaRecorder(dictStreamRef.current,pickRecMime());mr.ondataavailable=e=>{if(e.data&&e.data.size)dictChunksRef.current.push(e.data);};dictRecRef.current=mr;mr.start(250);setIsListening(true);}catch(e){stopDictAll();setIsListening(false);setVoiceError('\u0644\u0645 \u0623\u062A\u0645\u0643\u0651\u0646 \u0645\u0646 \u0641\u062A\u062D \u0627\u0644\u0645\u0627\u064A\u0643.');setTimeout(()=>setVoiceError(''),6000);}};const stopCloudDictation=async()=>{const mr=dictRecRef.current;setIsListening(false);if(!mr){stopDictAll();setVoiceError('DBG A no-recorder');setTimeout(()=>setVoiceError(''),8000);return;}const blob=await new Promise(resolve=>{mr.onstop=()=>{try{resolve(new Blob(dictChunksRef.current,{type:mr.mimeType||'audio/webm'}));}catch(e){resolve(null);}};try{mr.stop();}catch(e){resolve(null);}});stopDictAll();if(!blob||blob.size<1500){setVoiceError('DBG B bytes='+(blob?blob.size:-1));setTimeout(()=>setVoiceError(''),8000);return;}const b64=await blobToBase64(blob);let text='';try{const band=(()=>{try{return deriveCaps(profileRef.current?.age).band;}catch(e){return'young';}})();const r=await aiFetch('/api/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:b64,mime:blob.type,band})});if(r.ok){const d=await r.json();text=String(d.text||'').trim();}else{setVoiceError('DBG C http='+r.status);setTimeout(()=>setVoiceError(''),8000);return;}}catch(e){setVoiceError('DBG E '+String(e&&e.message).slice(0,40));setTimeout(()=>setVoiceError(''),8000);return;}if(!text){setVoiceError('\u0644\u0645 \u0623\u0633\u0645\u0639\u0643\u060C \u062D\u0627\u0648\u0644 \u0645\u0631\u0651\u0629\u064B \u0623\u062E\u0631\u0649.');setTimeout(()=>setVoiceError(''),5000);return;}setInput((baseTextRef.current||'')+text);};const startListening=async()=>{if(childVoiceBlocked()){// غ‑٣: لا getUserMedia ولا recognition.start
showChildVoiceNotice(setVoiceError);return;}// بلا موافقة: لا يُفتح الميكروفونُ إطلاقاً — لا تسجيلٌ يُرسَل إلى ElevenLabs ولا جلسةُ
// تعرُّفٍ يفتحها المتصفّح. فشلٌ آمنٌ صامتٌ إلى الوضعِ المحلّيّ.
if(!hasValidAIConsent()){setAiConsent(aiConsentStatus());return;}if(DICTATE_CLOUD){if(isSpeaking)stopSpeaking();baseTextRef.current=input&&!/\s$/.test(input)?input+' ':input;setVoiceError('');await startCloudDictation();return;}if(!recognitionRef.current){// Two different truths, and they must not be told as one. No engine in the browser is the
// browser's limit; no engine because consent was refused is OUR gate, and saying "your
// browser is not supported" there would be a lie that sends the reader to change browsers.
setVoiceError(hasValidAIConsent()?'🚫 متصفحك لا يدعم التعرف على الصوت. استخدم Chrome أو Safari.':EZ_SPEECH_NO_CONSENT);setTimeout(()=>setVoiceError(''),6000);return;}try{if(navigator.mediaDevices?.getUserMedia){const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());}}catch(e){setVoiceError('🚫 لم يُمنح إذن الميكروفون.');setTimeout(()=>setVoiceError(''),6000);return;}if(isSpeaking)stopSpeaking();// Snapshot the current box (typed or previously dictated, incl. hand-edits) as the base.
// New speech is appended AFTER it — nothing already there is erased or replaced.
baseTextRef.current=input&&!/\s$/.test(input)?input+' ':input;transcriptRef.current='';shouldListenRef.current=true;setVoiceError('');setIsListening(true);// Re-read at the instant of starting: the getUserMedia permission prompt above can sit open
// for as long as the reader likes, and consent may have been withdrawn in another tab while
// it did. ezStartRecognition refuses and tears the engine down if so.
if(!ezStartRecognition(recognitionRef.current)){shouldListenRef.current=false;setIsListening(false);}};const stopListening=()=>{if(DICTATE_CLOUD){stopCloudDictation();return;}// User tapped the mic off: prevent the onend auto-restart and keep the text in the box.
shouldListenRef.current=false;if(recognitionRef.current)recognitionRef.current.stop();};const startChat=async(name,age,gender)=>{// Session 06 / Commit 2 (DOB, option A): birthYear is the authoritative stored datum.
// age stays on the object as a DERIVED value (approx, +/- 1y: month unknown) and is
// recomputed from birthYear on every boot load, so accounts grow automatically.
const birthYear=new Date().getFullYear()-(parseInt(age,10)||0);// S92: pid is the identity this profile's saved conversations are filed under. It is minted
// here, once, so a NEW profile on a device that already carries one starts with an empty
// menu and can never be shown the previous child's history.
const p={name,age,gender,birthYear,pid:ezikMintId(),createdAt:new Date().toISOString()};profileRef.current=p;voiceProfileRef.current=p;// غ‑٣: مرآةُ حاجزِ الصوت — قبل أيّ نطقٍ أو تحيّة
setProfile(p);// D85: after the age step the landing screen is the chat, and it opens EMPTY. The boot
// greeting is NOT sent -- nothing sits in the thread until the child writes the first line.
chatIdRef.current=null;setChatId(null);setMessages([]);setChatList([]);// S92: a new profile starts with an empty menu
setScreen('chat');try{localStorage.setItem('child_profile',JSON.stringify(p));}catch(e){}};const callAI=async(history,p,{onDelta,signal,mode='chat',endpoint='/api/ask'}={})=>{if(!spendGateRef.current)return'';// قفل الإنفاق مغلق ⇐ لا يُنفَق رصيد (يشمل تحيّة الإقلاع 0d)
// بلا موافقةٍ صريحةٍ سارية: لا سؤال، ولا تصنيف، ولا تحيّةَ إقلاع. يُقرأ المخزنُ هنا لا رايةٌ
// محفوظةٌ سلفاً، فسحبُ الموافقةِ أثناءَ فتحِ الشاشةِ يُطاع فوراً.
if(!hasValidAIConsent())return'';// Text and call share the same deterministic server router and evidence path. The thin
// classifier remains below as dead-compatible code for rollback archaeology, but no voice
// turn can bypass /api/ask and disagree with the text answer.
const FAST_CHANNEL_ENABLED=false;const __classifyFast=async()=>{try{const __ex=m=>m&&typeof m.content==='string'?m.content:m&&typeof m.text==='string'?m.text:m&&Array.isArray(m.content)?m.content.map(c=>c&&typeof c.text==='string'?c.text:'').join(' '):'';const __n=(history||[]).length;const __curText=__ex(__n?history[__n-1]:null).trim();if(!__curText)return'DEEN';const __prev=__n>=2?history[__n-2]:null;const __prevText=__prev&&__prev.role==='assistant'?__ex(__prev).trim():'';const __userContent=__prevText?'السياق السابق: '+__prevText+' | الرسالة الحاليّة: '+__curText:__curText;const __resp=await aiFetch('/api/chat-fast',{method:'POST',headers:{'Content-Type':'application/json'},signal,// D02ب: the classifier's own instructions are the server's too (max_tokens 8 is what
// tells api/chat-fast.js this is the classifier turn). `band` and `age` travel because
// this route runs the hazard triage on THIS turn as well — a dangerous question must be
// caught before it is ever labelled neutral, not after.
body:JSON.stringify({max_tokens:8,stream:true,name:p.name,age:p.age,gender:p.gender,mode:'call',band:deriveCaps(p.age).band,messages:[{role:'user',content:__userContent}]})});if(!__resp.ok||!__resp.body)return'DEEN';const __reader=__resp.body.getReader();const __decoder=new TextDecoder();let __buf='',__out='';while(true){const __chunk=await __reader.read();if(__chunk.done)break;__buf+=__decoder.decode(__chunk.value,{stream:true});const __lines=__buf.split('\n');__buf=__lines.pop();for(let __i=0;__i<__lines.length;__i++){const __s=__lines[__i].trim();if(__s.indexOf('data:')!==0)continue;const __data=__s.slice(5).trim();if(__data==='[DONE]')continue;try{const __evt=JSON.parse(__data);if(__evt.type==='content_block_delta'&&__evt.delta&&__evt.delta.type==='text_delta'){__out+=__evt.delta.text;}}catch(__pe){}}}return __out.trim().toUpperCase()==='GEN'?'GEN':'DEEN';}catch(__e){return'DEEN';}};// D02ب: NO PROMPT IS BUILT HERE ANY MORE. The routing decision is unchanged — a call turn the
// classifier reads as neutral knowledge still goes to the thin channel — but the TEXT that
// route uses is the server's, and it picks between its classifier prompt and its GEN answer
// prompt from max_tokens (see api/chat-fast.js and lib/system-prompt.js).
if(FAST_CHANNEL_ENABLED&&mode==='call'&&(await __classifyFast())==='GEN'){endpoint='/api/chat-fast';}try{// Text and voice both enter /api/ask; the server's current-turn router decides GENERAL,
// specialised local DEEN, or hybrid DEEN. `endpoint` may still be overridden by an explicit
// non-conversation caller, but call mode itself no longer selects a different brain.
// Model is chosen SERVER-SIDE (api/ask: Opus for adult detailed/scholar, else Sonnet;
// api/chat: Sonnet). The client does NOT pick it; any model/temperature/top_p/top_k sent here
// is ignored or 400s -- so we send none. max_tokens 4096 leaves room for a long fully-vocalized
// Arabic reply (each diacritic = a token); server effort caps overall spend. depth/band below
// are TEXT-route (/api/ask) only.
const __extra={// depth: adult-only, non-'brief' -> server reads body.depth==='deep'/'scholar' for round-2 effort.
// Item 84: `&& hasFounderToken()` was here and is gone. It meant the client refused to
// SEND a depth it had let the reader select, so the field never reached the one place
// that is allowed to judge it. api/ask.js is that place and is unchanged: it honours a
// depth only for a founder or under DEPTH_FREE_TRIAL, and drops it silently otherwise.
// The band gate stays -- this field is still adult-only and still never sent for brief.
...(mode==='chat'&&endpoint==='/api/ask'&&deriveCaps(p.age).band==='adult'&&depthMode!=='brief'?{depth:depthMode==='scholar'?'scholar':'deep'}:{}),// band: so the server restricts RAG sources by age (khilaf-policy §6: under-18 is served
// from the two tiers SITES_MINOR + SITES_MINOR_FALLBACK in lib/retrieve.js -- primary first,
// fallback only when the primary comes back empty). Those two constants ARE the list; this
// comment names them instead of a count, because the count written here went on naming just
// the first two domains long after the primary tier had grown past them.
//
// D02ب/م٥: SENT TO ALL THREE ROUTES, UNCONDITIONALLY. This used to be two conditional
// spreads — one for /api/ask, one for /api/chat — and /api/chat-fast was in neither. So
// the thin voice route read `band` as undefined on every turn, resolveAudience returned
// the unknown-reader default 'adult', and the child floor that route already implements
// never fired for anybody. api/chat-fast.js named this hole in its own comments and said
// it could not close it alone. This line is the close: the condition is gone, so a route
// added later cannot silently inherit the same silence.
band:deriveCaps(p.age).band};// D02ب: the four reader fields REPLACE `system`. The server builds the prompt from them
// (lib/system-prompt.js); nothing here decides what the model is told any more. The server
// deletes all four before forwarding — /v1/messages 400s on an unknown top-level field —
// so they never reach the vendor, exactly as `band` already did.
const __mkBody=msgs=>({max_tokens:4096,stream:true,name:p.name,age:p.age,gender:p.gender,mode,messages:msgs,...__extra});// Item 1 / defect 44: drop OLDEST turns until the body fits CLIENT_BUDGET, measured the SERVER's
// way -- never shipping a body the server would 413. Keeps the system prompt + the newest turn.
const __apiMessages=fitMessagesToBudget(__mkBody,history.map(m=>({role:m.role,content:m.content})));const response=await aiFetch(endpoint,{method:'POST',// capHeaders() carries the device id (and a founder token when one exists) for the
// daily question cap. credentials:'same-origin' is what lets the server's httpOnly
// mrb_did cookie travel — it is already fetch()'s default, stated here so the cap's
// second counter cannot be broken by someone tightening the default later.
headers:{'Content-Type':'application/json',...capHeaders()},credentials:'same-origin',signal,body:JSON.stringify(__mkBody(__apiMessages))});// NOTE: the server still reports the remaining allowance in a response header. That is
// an OPERATIONS witness for the live deploy check ONLY, and is deliberately not read
// here -- the child is never shown a count of any kind (directive 79).
if(!response.ok){// Upstream error via the proxy — distinct from a network drop. Logged to console
// (for parents via devtools), never shown raw to the child.
const errText=await response.text().catch(()=>'');console.error(`[Al-Murabbi] API error ${response.status}:`,errText.slice(0,500));if(response.status===429){// Day cap (directive 78): the SERVER owns the wording, so the child is told the
// truth — the allowance is spent, or we could not verify it. NEVER the generic
// "weak connection" line, which blames the child for our own failure and sends
// them chasing a working network. Any other 429 (the per-IP burst windows in
// lib/ratelimit.js, which carry no message) still falls back to the friendly line.
let capMsg='';try{const j=JSON.parse(errText);if(j&&typeof j.message==='string'&&j.message){capMsg=j.message;}}catch(e){}if(capMsg)return capMsg;return getFriendlyError('rateLimit',p.gender);}if(response.status>=500)return getFriendlyError('server',p.gender);// Every remaining non-2xx is a TECHNICAL failure of ours (400 bad body, 403, 413 too
// large, ...). It used to answer with the 'general' line -- "لم أفهم سؤالك" -- which
// blamed the child for a request the model never even saw. One env var setting an
// unsupported field on api/chat.js was enough to make EVERY call turn say it.
return getFriendlyError('technical',p.gender);}// Read the SSE stream: accumulate text_delta and notify onDelta on every update.
const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let full='';let streamError=null;const handleEvent=block=>{let dataStr='';for(const line of block.split('\n')){const l=line.trim();if(l.startsWith('data:'))dataStr+=l.slice(5).trim();}if(!dataStr)return;let evt;try{evt=JSON.parse(dataStr);}catch{return;}if(evt.type==='content_block_delta'&&evt.delta&&evt.delta.type==='text_delta'){full+=evt.delta.text;if(onDelta)onDelta(full);}else if(evt.type==='error'){streamError=evt.error||{message:'stream error'};}// message_stop / ping / message_start / ... -> ignore
};while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n\n'))!==-1){handleEvent(buffer.slice(0,idx));buffer=buffer.slice(idx+2);}}if(buffer.trim())handleEvent(buffer);if(streamError){// Anthropic error event mid-stream (overloaded / rate / ...) — distinct message, not "weak connection".
console.error('[Al-Murabbi] Stream error:',streamError);const sig=`${streamError.type||''} ${streamError.message||''}`;if(/rate|429|overloaded/i.test(sig))return getFriendlyError('rateLimit',p.gender);return getFriendlyError('server',p.gender);}// Return the full accumulated text so the existing parse + audio pipeline runs unchanged.
//
// ── «تعذّر الجواب» ليست «لم أفهم سؤالك» (أ-٦/٣) ────────────────────────
// بلوغُ هذا السطرِ بنصٍّ فارغٍ يعني أنّ البثَّ وصلَ سليمَ البنيةِ ولم يحملْ حرفًا واحدًا —
// أي أنّ الخادمَ لم يُنتِجْ جوابًا. جملةُ `general` تقولُ للطفلِ «لم أفهم سؤالك»، فتُلقي
// عليه عهدةَ عطبٍ عندنا وترسلُه يعيدُ صياغةَ سؤالٍ سليمٍ إلى ما لا نهاية، بينما يبقى
// العطبُ الحقيقيُّ غيرَ مرئيّ. وهي العلّةُ نفسُها الموثّقةُ فوقَ `technical` في جدولِ
// الرسائل، والحالةُ هنا حالتُها: نتحمّلُ العطبَ ولا ننسبُه إلى سؤاله.
return full||getFriendlyError('technical',p.gender);}catch(e){if(e.name==='AbortError')throw e;// cancelled by a new message — handled by the caller
// Genuine network failure (offline browser, CORS, ...) — friendly message.
console.error('[Al-Murabbi] Network error:',e);return getFriendlyError('network',p.gender);}};const onPickImage=async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;// الصورةُ أو الملفُّ لا يُقرآن أصلاً بلا موافقة — فالقراءةُ هنا هي الخطوةُ الأولى في طريقِ
// الرفعِ إلى Anthropic. نُفرِّغ حقلَ الملفّ ونعود إلى الوضعِ المحلّيّ.
if(!hasValidAIConsent()){e.target.value='';setAiConsent(aiConsentStatus());return;}const rawName=(file.name||'').trim();const lowerName=rawName.toLowerCase();const ext=(lowerName.match(/\.([a-z0-9]+)\s*$/)||[,''])[1];// extension without dot, or ''
const mime=file.type||'';const isImage=mime.startsWith('image/')||['png','jpg','jpeg','gif','webp','bmp','heic','heif'].includes(ext);const isPdf=mime==='application/pdf'||ext==='pdf';const isTxt=mime==='text/plain'||ext==='txt';const isDocx=ext==='docx'||mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document';const isLegacyDoc=ext==='doc';const fail=msg=>{alert(msg);e.target.value='';};try{if(isImage){const block=await fileToImageBlock(file);// { media_type, data }
const over=attachOverBudget({type:'image',source:{type:'base64',media_type:block.media_type,data:block.data}},messages,profileRef.current);if(over)return fail(over);setPendingImage({kind:'image',name:file.name,media_type:block.media_type,data:block.data});}else if(isPdf){const pdfCeil=deriveTypeCeiling('pdf',2*1024*1024,profileRef.current);// policy 2MB kept as upper bound; announce the smaller derived ceiling
if(file.size>pdfCeil.ceilingBytes)return fail(fileTooBigMsg('ملف PDF',file.size,pdfCeil.ceilingBytes,pdfCeil.bound));const data=await fileToBase64(file);// base64, no data-URI prefix
const over=attachOverBudget({type:'document',source:{type:'base64',media_type:'application/pdf',data}},messages,profileRef.current);if(over)return fail(over);setPendingImage({kind:'pdf',name:file.name,media_type:'application/pdf',data});}else if(isTxt){const txtCeil=deriveTypeCeiling('txt',1*1024*1024,profileRef.current);// clipped text: policy is the true ceiling
if(file.size>txtCeil.ceilingBytes)return fail(fileTooBigMsg('ملف النصّ',file.size,txtCeil.ceilingBytes,txtCeil.bound));let raw='';let buf=null;try{buf=await file.arrayBuffer();// UTF-8 first; if it produces nothing usable, fall back to Windows-1256 (common for Arabic .txt from Notepad)
raw=new TextDecoder('utf-8',{fatal:false}).decode(buf);if(!raw.trim()||raw.indexOf('\uFFFD')!==-1){const alt=new TextDecoder('windows-1256',{fatal:false}).decode(buf);if(alt.trim()&&(alt.match(/\uFFFD/g)||[]).length<(raw.match(/\uFFFD/g)||[]).length+1)raw=alt;}}catch(tErr){return fail('تعذّرت قراءة الملف النصّي. حاول حفظه بترميز UTF-8.');}const text0=raw.replace(/^\uFEFF/,'').trim();// strip BOM + trim
if(!text0)return fail('الملف النصّي فارغ أو بترميز غير مدعوم. احفظه بترميز UTF-8 ثمّ أعد رفعه.');const MAX=100000;const clipped=text0.length>MAX?text0.slice(0,MAX)+'\n\n[تم اختصار بقيّة الملف]':text0;const over=attachOverBudget({type:'text',text:'المستند المرفق «'+(file.name||'ملف نصّي')+'»:\n\n'+clipped},messages,profileRef.current);if(over)return fail(over);setPendingImage({kind:'txt',name:file.name,media_type:'text/plain',data:clipped});}else if(isDocx){const docxCeil=deriveTypeCeiling('docx',5*1024*1024,profileRef.current);// clipped text: policy is the true ceiling
if(file.size>docxCeil.ceilingBytes)return fail(fileTooBigMsg('ملف Word',file.size,docxCeil.ceilingBytes,docxCeil.bound));// S97: mammoth is warmed on idle after the first paint rather than blocking boot. The
// await below is what makes that invisible here -- the message beneath it still means
// exactly what it meant before: the CDN did not give us the library.
if(window.__ezikVendor){try{await window.__ezikVendor('mammoth');}catch(e){}}if(!window.mammoth)return fail('تعذّر تحميل أداة قراءة ملفات Word. تحقّق من الاتصال وأعد المحاولة.');let extracted='';try{const buf=await file.arrayBuffer();const result=await window.mammoth.extractRawText({arrayBuffer:buf});extracted=(result&&result.value?result.value:'').trim();}catch(mErr){return fail('تعذّرت قراءة ملف Word. تأكّد أنّه بصيغة ‎.docx حديثة.');}if(!extracted)return fail('لم يُعثَر على نصٍّ في ملف Word. قد يكون فارغًا أو صورًا فقط.');const MAXD=100000;const clippedDoc=extracted.length>MAXD?extracted.slice(0,MAXD)+'\n\n[تم اختصار بقيّة الملف]':extracted;const over=attachOverBudget({type:'text',text:'المستند المرفق «'+(file.name||'ملف نصّي')+'»:\n\n'+clippedDoc},messages,profileRef.current);if(over)return fail(over);setPendingImage({kind:'txt',name:file.name,media_type:'text/plain',data:clippedDoc});}else if(isLegacyDoc){return fail('صيغة ‎.doc القديمة غير مدعومة. الرجاء حفظه بصيغة ‎.docx ثمّ رفعه.');}else{return fail('نوع الملف غير مدعوم: '+(rawName||'بلا اسم')+' | '+(mime||'بلا نوع'));}}catch(err){return fail('تعذّرت قراءة الملف. حاول ملفًّا آخر.');}e.target.value='';// allow re-selecting the same file
};// "Searching sources…" hint (TEXT path only). On a search question, /api/ask's round 1 is
// non-streamed + retrieval is silent, so onDelta stays quiet for ~20-35s. This is a purely
// CLIENT-SIDE, TIME-BASED reassurance — the client can't know from the server whether a search
// is running (round 1 is opaque), so we use a timer, not a server signal. Cleared on the first
// delta, on completion, on error, and on abort — never lingers.
const clearSearchingHint=()=>{if(searchTimerRef.current){clearTimeout(searchTimerRef.current);searchTimerRef.current=null;}setSearchingSources(false);};const sendMessage=async text=>{if(!text.trim()&&!pendingImage||isLoading)return;// بلا موافقةٍ سارية لا تُكتب الرسالةُ في السجلّ ولا تُرسَل: الشاشةُ نفسُها مستبدَلةٌ بوضعِ
// «بلا ذكاء اصطناعيّ»، وهذا حاجزٌ ثانٍ كي لا يفتح مسارٌ آخرُ هذا البابَ لاحقاً.
if(!hasValidAIConsent()){setAiConsent(aiConsentStatus());return;}// New message mid audio sequence -> cancel current audio so the new reply starts clean.
cancelAudio();// Abort any in-flight stream cleanly (ties into the cancellation discipline).
if(abortRef.current)abortRef.current.abort();let attachBlock=null;if(pendingImage){if(pendingImage.kind==='pdf'){attachBlock={type:'document',source:{type:'base64',media_type:'application/pdf',data:pendingImage.data}};}else if(pendingImage.kind==='txt'){attachBlock={type:'text',text:'المستند المرفق «'+(pendingImage.name||'ملف نصّي')+'»:\n\n'+pendingImage.data};}else{attachBlock={type:'image',source:{type:'base64',media_type:pendingImage.media_type,data:pendingImage.data}};}}const content=attachBlock?[attachBlock,...(text.trim()?[{type:'text',text:text.trim()}]:[{type:'text',text:'اشرح لي هذا'}])]:text;const userMsg={role:'user',content,timestamp:new Date().toISOString()};const updated=[...messages,userMsg];setMessages(updated);// ── STREAM-P4 §٣/١: ARM THE PIN ON THE QUESTION THAT WAS JUST ASKED ──────
// Batched with the setMessages above, so the question's very first commit is already the
// pinned one and there is no unpinned frame between them. The refs are set synchronously
// because the layout effect that does the pinning runs in that same commit, before any
// re-render could have delivered the state.
//
// «ومع كلِّ سؤالٍ جديدٍ في الصفحةِ نفسِها يتكرّرُ السلوك» — this runs on every send, so a
// second question re-arms by pointing at its own index; there is no flag to get stuck.
pinActiveRef.current=true;pinPassRef.current=0;pinLenRef.current=-1;pinScrollTopRef.current=-1;setAskPinPad(0);setPinnedAskIndex(updated.length-1);// S92: the conversation is filed HERE, on the QUESTION -- not after the reply lands. "Saved
// automatically on the first message" has to survive a reply that never arrives: a dropped
// connection, an abort, the app being closed mid-stream. This is the write that mints the id
// and the title; the save after the reply then rewrites the SAME conversation, because
// chatIdRef already carries the id this call set.
saveMessages(updated);setInput('');setPendingImage(null);setIsLoading(true);setStreamingText('');// Sliding window: send only the last 12 messages to the API (avoids 429, fewer tokens).
// The full `updated` stays in the UI and in localStorage for parents.
const apiHistory=sliceHistoryForAPI(updated);const controller=new AbortController();abortRef.current=controller;// Arm the "searching sources…" hint: if no delta has arrived after ~4s (fast non-search
// answers reply well before this), swap the blank dots for the reassurance text. Guarded on
// controller ownership so a superseded send can't flip it back on.
clearSearchingHint();searchTimerRef.current=setTimeout(()=>{if(abortRef.current===controller)setSearchingSources(true);},4000);let reply;try{reply=await callAI(apiHistory,profile,{signal:controller.signal,// First delta = streaming has begun -> retire the searching hint and show real text.
onDelta:partial=>{if(abortRef.current===controller){clearSearchingHint();setStreamingText(partial);}}});}catch(e){if(e.name==='AbortError'){// Aborted (newer message, or leaving chat via the [screen] cleanup). Clear the
// loading/typing UI so the chat isn't wedged on the dots with input/mic disabled —
// but ONLY if this controller still owns the UI; if a newer send took over, leave it.
// The partial reply is discarded (the assistant message is only pushed below on success).
if(abortRef.current===controller){clearSearchingHint();setIsLoading(false);setStreamingText(null);}return;}reply=getFriendlyError('network',profile?.gender);}if(abortRef.current!==controller)return;// a newer request owns the UI — leave its state alone
abortRef.current=null;clearSearchingHint();setStreamingText(null);const aiMsg={role:'assistant',content:reply,timestamp:new Date().toISOString()};const final=[...updated,aiMsg];setMessages(final);// S98: THIS LINE IS THE STREAMING TRANSITION — setStreamingText(null) two lines up retires the
// live preview and this push puts the finished reply in its place. Recording the position here
// is what keeps a long answer at the length it was just read at, instead of collapsing under
// the reader the moment it finished arriving. Batched with the setMessages above, so the
// bubble's first commit already knows it is open and there is no intermediate folded frame.
markStreamedOpen(final.length-1);saveMessages(final);setIsLoading(false);if(voiceMode)speakReply(reply);// audio runs on the final full text — not during the stream
};// ============================================================
// THE SECTION SUGGESTIONS -- three ways out of an empty chat, above the composer
// ============================================================
// WHAT THEY ARE. Three of the app's own sections, each opened by the SAME handler the home
// screen uses for it: الفتاوى -> setScreen('fatwa'), رحلة الكنوز -> /quest.html, المصحف ->
// setScreen('mushaf'). No fourth entry: the brief allows a lessons section only if one already
// exists, and this app has no lessons section -- the five modules are memorize, adhkar,
// mushaf, treasure and fatwa, and none of them is that. The labels and the one-line
// descriptions are the module strings the home already shows, so they translate with the rest
// of the interface and no new wording enters the app.
//
// WHAT THEY ARE NOT. They send nothing, they do not touch the composer's text, and they are
// not a suggestion the MODEL made -- <suggestions> inside a reply is a different thing
// rendered elsewhere by MessageBubble, and this neither replaces nor imitates it.
const sectionSuggestions=[{id:'fatwa',label:EZH_FATWA,icon:EZH_ICON_FATWA,go:()=>setScreen('fatwa')},{id:'treasure',label:EZH_TREASURE,icon:EZH_ICON_TREASURE,go:()=>{window.location.href='/quest.html';}},{id:'mushaf',label:EZH_MUSHAF,icon:EZH_ICON_MUSHAF,go:()=>setScreen('mushaf')}];// THE THIRD STATE IS ABSENCE. One expression decides it, and each term is a separate promise
// the brief makes: an empty thread (a conversation with anything in it keeps them hidden --
// and a stream implies a question, so messages is never empty during one), nothing being
// streamed, and NOT ONE typed character. Because it reads the live value of `input`, clearing
// the text brings them straight back, and because `composerFocused` only chooses the SHAPE,
// blurring an empty composer returns the stack rather than the row.
const sectionSuggestVisible=messages.length===0&&streamingText===null&&input.length===0;// ============================================================
// S98 — الإجراءات السريعة والاقتباس (quick actions + quote)
// ============================================================
// A quick action IS a message. It goes through sendMessage above and nothing else, so the model
// tier, the depth mode, the sourcing policy and the sliding history window are all whatever the
// composer would have used for the same sentence typed by hand.
//
// ONE PRESS, ONE SEND. `isLoading` alone could not promise that: it is state, and two clicks
// dispatched inside one task both read the value from before React committed the first. This
// ref flips SYNCHRONOUSLY on the first press, so the second finds it already taken. It is
// released when the turn ends, which is exactly when isLoading goes back to false.
const quickBusyRef=useRef(false);useEffect(()=>{if(!isLoading)quickBusyRef.current=false;},[isLoading]);const runQuickAction=prompt=>{if(quickBusyRef.current||isLoading||streamingText!==null)return;quickBusyRef.current=true;sendMessage(prompt);};// ── STREAM-P4 §٣/٢: THE COMPOSER'S `Enter`, IN ONE PLACE ──────────────────
//
// FOUR TESTS, IN THIS ORDER, AND THE ORDER IS THE RULE:
//
//  1. NOT AN `Enter` AT ALL — nothing to decide.
//  2. THE KEYBOARD IS STILL COMPOSING. An IME, and every predictive Arabic keyboard, uses
//     `Enter` to ACCEPT the candidate it is offering. Sending there submits the half of the
//     question that had been typed so far, which is the most-reported version of this defect
//     and the reason this test comes before every other one.
//  3. `Shift+Enter` IS A NEWLINE. Unchanged, on every device.
//  4. AND THEN WHAT THE READER ASKED FOR. `enterSends` is the resolved preference, and its
//     person writes a second line, and the button beside the field is how they send. The
//     reverse — the shipped behaviour until now — costs a question every time somebody
//     reaches for a new paragraph. الإعدادات can now overrule the guess in either
//     direction; it cannot overrule tests 1..3, which run first and are not preferences.
//
// AND THE KEY IS LABELLED HONESTLY. `enterKeyHint` is what puts «send» or a return arrow on
// the on-screen keyboard's corner key; leaving it saying «send» on a path where `Enter`
// writes a newline is the keyboard promising something the app then declines to do.
const onComposerKeyDown=e=>{if(e.key!=='Enter')return;if(composingRef.current||e.nativeEvent?.isComposing||e.which===229||e.keyCode===229)return;if(e.shiftKey)return;if(!enterSends)return;e.preventDefault();e.target.style.height='auto';sendMessage(input);};// The reader's actual device, recorded from the event rather than inferred from the viewport.
// Guarded so an unchanged value costs no render: this fires on every press of the field.
const onComposerPointerDown=e=>{const touch=e.pointerType==='touch'||e.pointerType==='pen';if(touch!==inputIsTouch)setInputIsTouch(touch);};// Where the quick actions may appear, and it is deliberately ONE place: under the newest reply,
// when that reply is finished, is the assistant's, is not one of the client's own error lines,
// and the conversation actually has a question in it (so the boot greeting never grows a «بسّط»).
const lastMsg=messages.length?messages[messages.length-1]:null;const quickActionsVisible=!!lastMsg&&lastMsg.role==='assistant'&&!isLoading&&streamingText===null&&!ezikIsErrorReply(lastMsg.content)&&messages.some(m=>m&&m.role==='user');// ============================================================
// S98 PERF — the bubble's props are PINNED
// ============================================================
// MEASURED, and this is what it is for. Adding a quote button and a star to every reply put two
// more buttons and an icon into each of a 120-turn thread's bubbles, and the composer's state
// lives on App — so a single keystroke rebuilt and reconciled all of them. Interleaved before/
// after over 440 keystrokes: 1.20 ms -> 1.60 ms, +33%, Welch t=14.4. Small in absolute terms and
// real beyond any doubt, which is exactly the kind of drift that accumulates until someone
// measures a 60 ms keystroke and cannot say which of ten sessions caused it.
//
// THE FIX IS TO STOP RE-RENDERING THE THREAD AT ALL, not to shave the new buttons. Every handler
// a bubble takes is pinned to one identity for the life of the app and reaches the CURRENT
// implementation through a ref that is refreshed after each render — the same latest-ref pattern
// useEzikBackLayer and the spend gate already use here. With the callbacks stable and the rest of
// the props primitives (or the message object itself, whose identity the thread preserves),
// React.memo on MessageBubble makes a keystroke re-render the composer and nothing else.
//
// It is safe for the cards precisely because none of them depends on a parent re-render: every
// async card — verse, surah, dhikr, worship — holds its own state and its own effect and
// re-renders itself when its store lands.
// MOVED UP from beside submitReport, and it must stay above every `if (screen === ...) return`.
// The effect below closes over it, and an effect callback runs AFTER the component function has
// returned — so on the loading screen, where App returns long before the old position was ever
// reached, the binding was still in its temporal dead zone and the first commit threw «Cannot
// access 'openReport' before initialization». The same trap S94 documents for newChat.
const openReport=(aiMsg,prevMsg)=>{const aiText=aiMsg&&typeof aiMsg.content==='string'?aiMsg.content:'';let userText='';if(prevMsg&&prevMsg.role==='user'){const c=prevMsg.content;if(typeof c==='string')userText=c;else if(Array.isArray(c)){const t=c.find(b=>b&&b.type==='text');userText=t?t.text:'';}}setReportFor({ai:aiText,user:userText});};const bubbleFnRef=useRef({});useEffect(()=>{bubbleFnRef.current={send:sendMessage,playVerse:playVerseManual,playSurah:playSurahManual,stopAudio:cancelAudio,speak:speakReply,toggleTashkeel:toggleTashkeel,quote:quoteReply,favorite:toggleFavoriteReply,favoriteAyah:toggleFavoriteAyah,report:openReport,messages:messages};});const cbSuggestion=React.useCallback(sg=>bubbleFnRef.current.send(sg),[]);const cbPlayVerse=React.useCallback((sNum,aNum)=>bubbleFnRef.current.playVerse(sNum,aNum),[]);const cbPlaySurah=React.useCallback((sNum,from,to)=>bubbleFnRef.current.playSurah(sNum,from,to),[]);const cbStopAudio=React.useCallback(()=>bubbleFnRef.current.stopAudio(),[]);const cbPlayMessage=React.useCallback(t=>bubbleFnRef.current.speak(t),[]);const cbToggleTashkeel=React.useCallback(()=>bubbleFnRef.current.toggleTashkeel(),[]);const cbQuote=React.useCallback(t=>bubbleFnRef.current.quote(t),[]);const cbFavorite=React.useCallback((m,idx)=>bubbleFnRef.current.favorite(m,idx),[]);const cbFavoriteAyah=React.useCallback(v=>bubbleFnRef.current.favoriteAyah(v),[]);// The report needs the reply AND the question before it, which used to be closed over per bubble.
// The index is a stable prop; the pair is looked up on the tap, off the current thread.
const cbReport=React.useCallback(idx=>{const ms=bubbleFnRef.current.messages||[];bubbleFnRef.current.report(ms[idx],idx>0?ms[idx-1]:null);},[]);// THE QUOTE. It writes to the composer and moves the caret there — no send, no store, and the
// reply it was taken from is not altered in any way. Text already typed is KEPT: the quote is
// appended below it after a blank line, so nothing a child was in the middle of writing is lost.
const quoteReply=clean=>{const block=ezikBuildQuote(clean);if(!block)return;setInput(prev=>ezikComposeWithQuote(prev,block));// After the value lands, not before — otherwise the caret is placed in the old text.
setTimeout(()=>{const el=inputElRef.current;if(!el)return;try{el.focus();const n=String(el.value||'').length;el.setSelectionRange(n,n);}catch(e){}},0);};// ============================================================
// Live voice-call mode (Layer 2) — ONE automatic turn
// ============================================================
// Reuses the existing brain (callAI + sliceHistoryForAPI; the prompt itself is the server's
// since D02ب) and audio-out
// (speakReply / cancelAudio). A dedicated callRecognitionRef is fully isolated from the dictation
// mic. Call onresult writes ONLY to callTranscriptRef / callHeard — never to the chat `input`.
// ===== Layer 3: 45s inactivity auto-end (silent — no spoken goodbye) =====
const clearInactivityTimer=()=>{if(inactivityTimerRef.current){clearTimeout(inactivityTimerRef.current);inactivityTimerRef.current=null;}};// Silent auto-end. setScreen('chat') fires the call useEffect cleanup, which stops rec,
// aborts the in-flight callAI, cancels audio, and bumps callGenRef (invalidating continuations).
const endCallSilently=()=>{clearInactivityTimer();if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}callActiveRef.current=false;try{callRecognitionRef.current?.stop();}catch(e){}if(abortRef.current){try{abortRef.current.abort();}catch(e){}}cancelAudio();setScreen('chat');};// (Re)start the 45s idle clock. Armed on a FRESH listening turn and on detected speech only —
// NOT on the silence self-close re-arm (that passes armIdleClock=false), so genuine silence
// accumulates toward the 45s end instead of resetting on every engine self-close.
const armInactivityTimer=()=>{// The idle clock runs ONLY while we are actually listening. A late SR result arriving during
// thinking/playback used to re-arm it, and 45s later it exited the call MID-ANSWER.
if(!callActiveRef.current)return;clearInactivityTimer();const genAtArm=callGenRef.current;inactivityTimerRef.current=setTimeout(()=>{if(callGenRef.current!==genAtArm)return;// call ended/changed → bail
endCallSilently();},45000);};// Start (or re-arm) a listen turn. armIdleClock=true resets the 45s idle clock (a fresh turn);
// the silence self-close re-arm passes false so silence keeps counting toward the auto-end.
const startCallListening=(armIdleClock=true)=>{if(callMutedRef.current)return;// muted = do not listen
if(childVoiceBlocked())return;// غ‑٣: مقفول ⇒ لا فتحَ ميكروفونٍ (صامت — التنبيهُ يظهر بدل الشاشة)
if(!hasValidAIConsent())return;// بلا موافقة: لا ميكروفون. شاشةُ المكالمةِ نفسُها مستبدَلةٌ بوضعِ المحلّيّ
if(!hasFounderToken())return;// directive 82: no unlock token => the mic never opens
if(CALL_STT_CLOUD){callTranscriptRef.current='';callBaseTextRef.current='';setCallHeard('');callActiveRef.current=true;setCallState('listening');startCloudListening();if(armIdleClock)armInactivityTimer();return;}const rec=callRecognitionRef.current;if(!rec)return;callTranscriptRef.current='';callBaseTextRef.current='';setCallHeard('');callActiveRef.current=true;setCallState('listening');// Re-read here too: startCallListening is re-entered on every turn of a call that may have
// been running for minutes, and the check at the top of this function ran on the first one.
if(ezStartRecognition(rec)){if(CALL_VAD){vadLastVoiceRef.current=Date.now();ensureVad();}if(armIdleClock)armInactivityTimer();}else{callActiveRef.current=false;setCallState('idle');}};// End the active listen turn and route it to the brain. Guarded so the silence timer and
// recognition.onend can never both fire a turn (double-send guard via callActiveRef).
const endCallTurnNow=()=>{if(!callActiveRef.current)return;callActiveRef.current=false;if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}try{callRecognitionRef.current?.stop();}catch(e){}const text=collapseRepeats((callBaseTextRef.current+' '+callTranscriptRef.current).trim());if(!text){setCallState('idle');return;}// never send an empty turn
if(callTurnRef.current)callTurnRef.current(text);};// One full call turn — mirrors sendMessage exactly: pushes the same user+assistant messages to
// the SHARED messages array (so the Q&A shows in chat history and guardrails are identical), then
// speaks the reply via the existing speakReply(). No setInput, no streamingText bubble.
const runCallTurn=async text=>{const myGen=callGenRef.current;// capture the call session; re-arm after playback only if still valid
setCallHeard('');setCallState('thinking');clearInactivityTimer();// child is engaged (thinking/speaking) — pause the idle clock
cancelAudio();if(abortRef.current)abortRef.current.abort();const userMsg={role:'user',content:text,timestamp:new Date().toISOString()};const updated=[...messages,userMsg];// Do NOT commit the user msg to messages here. It is written together with the reply on
// success (final = [...updated, aiMsg]). So an interrupted/superseded turn leaves NO orphan
// user message -> fixes empty-reply-in-transcript AND the abandoned-question-answered-later bug.
const apiHistory=sliceHistoryForAPI(updated);const controller=new AbortController();abortRef.current=controller;let reply;let callStream=null;// CALL_STREAM_SPEECH: lazily-created streaming session (off -> stays null; classic speakReply used)
try{reply=await callAI(apiHistory,profile,{signal:controller.signal,mode:'call',...(CALL_STREAM_SPEECH?{onDelta:full=>{if(abortRef.current!==controller)return;if(!callStream){callStream=createCallSpeechStream();setCallState('speaking');}callStream.feed(full);}}:{})});}catch(e){if(e.name==='AbortError')return;// exited mid-turn — do not write state
reply=getFriendlyError('network',profile?.gender);}if(abortRef.current!==controller)return;// superseded or call exited
abortRef.current=null;const aiMsg={role:'assistant',content:reply,timestamp:new Date().toISOString()};const final=[...updated,aiMsg];setMessages(final);saveMessages(final);setCallState('speaking');if(CALL_STREAM_SPEECH&&callStream)await callStream.finish(reply);// stream: flush remainder + await playback drain (same completion contract)
else await speakReply(reply);// completion hook -- resolves when playback fully finishes
// Layer 3 guarded auto-rearm. speakReply cannot reject and resolves only after playback ends.
if(callGenRef.current!==myGen)return;// End/exit or session change during playback → do NOT re-arm
if(callActiveRef.current)return;// a manual interrupt already re-opened the mic → don't double-arm
if(callMutedRef.current){setCallState('idle');return;}// muted → idle; user re-arms manually
if(childVoiceBlocked()){setCallState('idle');return;}// غ‑٣: لا إعادةَ تسليحٍ بعد الحجب
startCallListening();// continuous: reopen the mic for the next turn
};// Keep callTurnRef pointing at the latest runCallTurn so the (once-created) SR handlers always
// see the current messages/profile rather than a stale closure.
useEffect(()=>{callTurnRef.current=runCallTurn;});// Mute toggle — actually gates the mic: muted = stop/suppress listening (not just visual).
const toggleCallMute=()=>{setIsCallMuted(m=>{const next=!m;callMutedRef.current=next;if(next){callActiveRef.current=false;if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}clearInactivityTimer();// leaving listening (muted) — stop the idle clock; user re-arms manually
try{callRecognitionRef.current?.stop();}catch(e){}if(CALL_STT_CLOUD)stopCloudAll();// mute must STOP capturing, not merely ignore the audio
setCallState(csNow=>csNow==='listening'?'idle':csNow);}return next;});};// Avatar tap = "my turn". Layer 3 makes it state-aware: it is the manual interrupt (no voice
// barge-in). Tapping during think/speak cancels the tutor and opens the mic; from idle it starts.
const onCallTalk=()=>{if(callMutedRef.current)return;if(callState==='thinking'||callState==='speaking'){// Manual interrupt: cancel the in-flight turn + tutor audio, then open the mic for the child.
if(abortRef.current)abortRef.current.abort();// thinking: aborts callAI -> runCallTurn bails at the AbortError guard (before re-arm)
cancelAudio();// speaking: stops playback (speakReply resolves; EDIT-A re-arm suppressed by its callActiveRef guard)
startCallListening();return;}if(callState==='idle')startCallListening();// 'listening' → no-op (unchanged from Layer 2)
};// Call-screen lifecycle: create/tear down the dedicated recognition with the call screen.
// On entry: force the dictation mic OFF and stop any audio so the two can never fight.
// On exit: stop recognition, clear the timer, abort any in-flight turn, and stop audio.
useEffect(()=>{if(screen!=='call')return;if(childVoiceBlocked())return;// غ‑٣: لا يُبنى معرِّفُ كلامٍ أصلاً — الرسمُ يعرض التنبيهَ بدل الشاشة
// No consent, no call session: neither the Web Speech engine nor the cloud recorder is built,
// so no microphone permission is requested. The screen itself is already the local-mode
// notice by this point; this is the second, independent barrier behind it.
if(!hasValidAIConsent())return;if(!hasFounderToken())return;// directive 82: no token => the call session is never built
callGenRef.current++;// ENTER: open a new call session (invalidates any stale continuation)
const SR=ezSpeechEngine();// CLOUD STT DOES NOT USE SpeechRecognition AT ALL. It records with MediaRecorder and
// transcribes in api/stt.js, so demanding SR here refused the ENTIRE call screen over a
// dependency the live path never touches -- every engine without Web Speech (Android
// WebView shells, Firefox) got a "your browser is not supported" banner and a dead call,
// while the path that would have worked was never even started. Only the Web Speech
// FALLBACK may require SR.
if(!SR&&!CALL_STT_CLOUD){showCallError('🚫 متصفحك لا يدعم التعرف على الصوت. استخدم Chrome أو Safari.');return;}setVoiceError('');// entering a call clears any stale banner from the chat screen
// Force the dictation mic off (never modify it — just ensure it is not running).
shouldListenRef.current=false;try{recognitionRef.current?.stop();}catch(e){}cancelAudio();callActiveRef.current=false;callTranscriptRef.current='';setCallHeard('');setCallState('idle');// `rec` is NULL when the engine has no Web Speech and the cloud path is carrying the call.
// The three handlers below are still DEFINED either way (they are the fallback's behaviour,
// unchanged), but they are only WIRED when there is an engine to fire them.
const rec=ezNewRecognition();if(rec){rec.lang='ar-SA';rec.continuous=true;// interim events keep resetting the silence timer (smoother end-of-turn)
rec.interimResults=true;}const onRecResult=event=>{// This ar-SA engine emits multiple isFinal results where each later final RE-INCLUDES the
// earlier final text (cumulative restatement), so concatenating all finals double-counts.
// Merge instead: a final that extends what we have (starts with the accumulated text) REPLACES
// it; a final already covered is skipped; only a genuinely new (non-overlapping) final is
// appended. Correct for this cumulative engine AND standard segmented engines.
let finalText='',interim='';for(let i=0;i<event.results.length;i++){const t=event.results[i][0].transcript;if(event.results[i].isFinal){const seg=t.trim();if(!seg)continue;if(!finalText)finalText=seg;else if(seg.startsWith(finalText))finalText=seg;// cumulative restatement -> replace
else if(finalText.startsWith(seg)){/* shorter prefix already covered -> skip */}else finalText=finalText+' '+seg;// genuine new segment -> append
}else{interim+=t;}}callTranscriptRef.current=finalText;setCallHeard((finalText+interim).trim());// feedback only — NEVER setInput
// Layer 3: actual speech this event → child present → reset the 45s idle clock.
if((finalText+interim).trim())armInactivityTimer();// Reset the end-of-turn debounce on any speech activity.
if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);silenceTimerRef.current=setTimeout(()=>{// Fire only with a non-empty transcript; silence on an empty turn keeps listening.
if(callActiveRef.current&&(callBaseTextRef.current+callTranscriptRef.current).trim())endCallTurnNow();},vadOkRef.current?86400000:CALL_SILENCE_MS);};const onRecEnd=()=>{// Chrome owns onend and fires it on its own schedule (short Arabic pauses, engine timeouts).
// It must NEVER end a turn: doing so shipped truncated questions to the model.
// The CLIENT-OWNED silence timer is the SOLE turn-ender. onend only RESTARTS the recognizer,
// carrying this session's transcript into callBaseTextRef first (the proven dictation pattern).
if(!callActiveRef.current)return;// turn already ended, or call exited
if(childVoiceBlocked()){// غ‑٣: لا إعادةَ تشغيلٍ بعد الحجب — أوقفِ الحلقة
callActiveRef.current=false;setCallState('idle');return;}callBaseTextRef.current=(callBaseTextRef.current+' '+callTranscriptRef.current).trim();callTranscriptRef.current='';// new SR session => results[] restarts at 0
// RESTART-GAP GUARD: the recognizer is DEAF between sessions, so that window must not be
// counted as user silence. Re-arm the silence timer here with a longer grace deadline;
// the first onresult of the new session restores the normal CALL_SILENCE_MS cadence.
// The timer still SURVIVES the restart and stays the sole turn-ender - it only gets a fair
// deadline instead of counting a window in which nobody could have been heard.
if(silenceTimerRef.current)clearTimeout(silenceTimerRef.current);silenceTimerRef.current=setTimeout(()=>{if(callActiveRef.current&&(callBaseTextRef.current+callTranscriptRef.current).trim())endCallTurnNow();},vadOkRef.current?86400000:CALL_RESTART_GRACE_MS);const genAtEnd=callGenRef.current;const tryStart=attempt=>{if(childVoiceBlocked())return;// غ‑٣: الحجبُ يقطع محاولاتِ إعادةِ التشغيل الخمس
// A withdrawal mid-call must also break the FIVE-ATTEMPT BACKOFF, not just the first try:
// each retry is a fresh setTimeout that would otherwise keep reaching for the microphone
// for three quarters of a second after the reader revoked consent.
if(!hasValidAIConsent()){ezKillRecognizer(rec);callActiveRef.current=false;setCallState('idle');return;}if(callGenRef.current!==genAtEnd)return;// call ended/changed
if(!callActiveRef.current)return;// turn ended during the gap
if(!ezStartRecognition(rec)&&attempt<5)setTimeout(()=>tryStart(attempt+1),150);// never leave the mic dead
};setTimeout(()=>tryStart(0),120);};const onRecError=event=>{if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}callActiveRef.current=false;setCallHeard('');setCallState('idle');// A denied mic is fatal and MUST be said. 'no-speech'/'aborted' are routine and stay quiet.
const fatal=['not-allowed','audio-capture','service-not-allowed'];if(fatal.includes(event.error)){showCallError(event.error==='audio-capture'?'🎤 الميكروفون غير متاح على هذا الجهاز.':'🚫 لم يُمنح إذن الميكروفون. افتح إعدادات التطبيق واسمح بالميكروفون ثم أعد الدخول للمكالمة.');}else if(event.error==='network'){showCallError('📡 انقطع الاتّصال بمحرّك التعرّف على الصوت. تحقّق من الإنترنت ثم أعد المحاولة.');}};if(rec){rec.onresult=onRecResult;rec.onend=onRecEnd;rec.onerror=onRecError;}callRecognitionRef.current=rec;startCallListening();// child just enters and talks - no button
return()=>{callGenRef.current++;// EXIT: invalidate every in-flight continuation (re-arm / backoff / inactivity)
callActiveRef.current=false;if(silenceTimerRef.current){clearTimeout(silenceTimerRef.current);silenceTimerRef.current=null;}clearInactivityTimer();// Clear the banner WITH its dismiss timer. Cancelling the timer alone would strand a
// call-mode error on the chat screen with nothing left running to ever take it down.
if(callErrorTimerRef.current){clearTimeout(callErrorTimerRef.current);callErrorTimerRef.current=null;}setVoiceError('');ezKillRecognizer(rec);// handlers first, then abort+stop, and drop it from the live registry
stopCloudAll();// EXIT must release the recorder + the mic track, SR path or not
callRecognitionRef.current=null;if(abortRef.current){try{abortRef.current.abort();}catch(e){}}cancelAudio();callMutedRef.current=false;setIsCallMuted(false);setCallHeard('');setCallState('idle');};},[screen]);// Toggle the parental direct-conversation lock. Locking writes 'true'; unlocking REMOVES the key
// (absence = allowed default — we never persist 'false').
const toggleDirectConvoLock=()=>setDirectConvoLocked(prev=>{const next=!prev;try{if(next)localStorage.setItem('directConvoLocked','true');else localStorage.removeItem('directConvoLocked');}catch(e){}return next;});const resetAll=()=>{if(confirm('هل أنت متأكد من حذف كل البيانات؟')){localStorage.removeItem('child_profile');// S92 -- "delete all my data" has to mean the SAVED CONVERSATIONS too: every stored body,
// the index that lists them, and the single legacy thread the old 'messages' key held.
ezikClearAllChats();// S98 -- and the saved replies, which live in their own key precisely BECAUSE they survive a
// deleted conversation. Nothing else clears them, so this line is the only way they go.
ezikClearAllFavs();// S99 -- and the reading preferences, which are per-profile device settings and go with
// everything else this button clears.
ezikClearAllA11y();localStorage.removeItem('directConvoLocked');localStorage.removeItem(MUSHAF_BOOKMARK_KEY);// ITEM 87: `mushaf_pos_v1` IS A DEAD NAME. This sweep is its ONLY appearance in the file
// and it is a CLEANUP, not a use: nothing reads it, nothing writes it, and the position
// this app keeps is mushaf_last_page_v1 and nothing else. The line stays exactly because
// it is the cleaning -- a device that still carries the pre-bookmark key is swept by
// "delete all my data" like everything else. It must never be resurrected as a live key.
localStorage.removeItem('mushaf_pos_v1');// Session 51 -- one-shot sweep of the pre-bookmark name
// Session 82 -- the three device-local mushaf keys go with everything else. "Delete all
// my data" has to mean the last page, the daily target and today's progress too.
localStorage.removeItem(MUSHAF_LAST_PAGE_KEY);localStorage.removeItem(WIRD_TARGET_KEY);localStorage.removeItem(WIRD_DAY_KEY);// Session 84 -- the three device-local adhkar keys, added to this list and to nothing
// else. "Delete all my data" has to mean today's counters, the favourite identifiers
// and the per-category open counts too. Three removals; no other reset behaviour moves.
localStorage.removeItem(ADHKAR_PROGRESS_KEY);localStorage.removeItem(ADHKAR_FAVORITES_KEY);localStorage.removeItem(ADHKAR_USAGE_KEY);// Session 86 -- and the APPLICATION UI STYLE with them, the one key that now governs the
// home screen and the adhkar screens together. Removing it is enough: the reader is total,
// so an absent key IS 'journey', and the event tells every mounted screen -- the home, the
// adhkar browse, the adhkar reader and the settings row -- to re-read now rather than at
// the next mount. The chat screen does not listen for it and is unaffected either way.
// S102 -- the obsolete layout key goes with them. Nothing reads it any more, so this
// is housekeeping rather than behaviour: it stops a dead value outliving the feature.
try{localStorage.removeItem(EZIK_UI_STYLE_KEY_DEAD);}catch(e){}// S100 -- and the VISUAL IDENTITY, on the same terms. Removing the key is enough: the
// reader is total, so an absent key IS istana_33. The attribute is repainted here rather
// than waiting for a mount, because the screen behind this dialog is still on screen.
try{localStorage.removeItem(EZIK_VISUAL_THEME_KEY);}catch(e){}try{localStorage.removeItem(EZIK_VISUAL_THEME_KEY_V1);}catch(e){}applyEzikVisualTheme(EZIK_VISUAL_THEME_DEFAULT);try{window.dispatchEvent(new CustomEvent(EZIK_VISUAL_THEME_EVENT,{detail:EZIK_VISUAL_THEME_DEFAULT}));}catch(e){}setDirectConvoLocked(false);setProfile(null);voiceProfileRef.current=null;// غ‑٣: حذفُ البيانات يُعيد الحاجزَ إلى المقفول
setMessages([]);chatIdRef.current=null;setChatId(null);setChatList([]);setScreen('onboarding');}};// THE CONSENT SCREEN (Apple 5.1.1(i) / 5.1.2(i)). Shown to anyone who has not answered THIS
// version of the disclosure, and again on demand from Settings ("review the choice"). Keyed on
// the independent consent record, NOT on profile age, so an existing profiled reader sees it too
// and nobody is wiped or forced to re-onboard. Gated on `profile` so it lands at the END of
// onboarding, never over the onboarding form itself.
//
// Showing this screen sends NOTHING. It is drawn from strings in this file; no request of any
// kind is issued by rendering it, and the boot greeting is already refused by callAI's own
// consent check until a grant is recorded.
const aiConsentDecided=aiConsent===EZ_AI_CONSENT_GRANTED||aiConsent===EZ_AI_CONSENT_DECLINED;if(profile&&(!aiConsentDecided||aiConsentReview))return/*#__PURE__*/React.createElement(AIConsentGate,{age:profile.age,current:aiConsent,onGrant:grantAIConsent,onDecline:declineAIConsent,onBack:aiConsentDecided?()=>setAiConsentReview(false):null});// S118 -- ONE MENU, DRAWN BY TWO SCREENS. This block used to sit inside the chat's own
// return, below the `if (screen === ...)` ladder, so `openDrawer()` from anywhere else set
// state that nothing rendered. It is LIFTED, not copied: there is still exactly one panel,
// one overlay, one search box, one conversation list and one history entry, and every
// handler inside it is the handler it already was. The home's three-bar button and the
// chat's rail button call the same openDrawer.
//
// It is a function and not a value so that it is read at RENDER time: the returns below it
// each call it, and nothing above it has to know the drawer exists.
//
// D85: the drawer. Order is fixed: new chat, القائمة (the existing home screen -- the
// mushaf, the adhkar, the memorizer and the quest are all reached from there), then the
// profile entry pinned at the bottom. It used to have a second, duplicate control beside
// it; that one is gone and the ONE row opens the account area the home screen opens.
// The theme settings screen is phase C and is deliberately not built here.
//
// S118 -- THE TOKEN CARRIER, and it is not decoration: without it the menu is INVISIBLE on the
// home. MEASURED, on the first render of this lift: the panel and its scrim came up with no
// surface and no shadow and the home showed straight through the rows. The colours are not
// literals anywhere in this file -- .ezc-drawer paints var(--a3-surface) / var(--a3-line) /
// var(--a3-lift), and the scrim paints var(--ezc-scrim). --a3-* are declared on .ezhome and
// --ezc-scrim on .ezc, and while this markup lived inside the chat's return it sat inside BOTH.
// Rendered beside <Home/> it sits inside neither, so every one of those var() calls resolved to
// nothing. The two classes are named here, on ONE element, so the menu resolves the very same
// tokens from either screen and no value is written twice. It is a plain div: it creates no
// containing block, so the fixed positioning underneath it is untouched.
const ezikDrawer=()=>drawerOpen&&/*#__PURE__*/React.createElement("div",{className:"ezhome ezc"},/*#__PURE__*/React.createElement("div",{onClick:()=>closeDrawerWith(null),className:"ezc-drawer-ov"}),/*#__PURE__*/React.createElement("div",{className:"ezc-drawer",role:"dialog","aria-modal":"true"},/*#__PURE__*/React.createElement("div",{className:"ezc-drawer-head"},/*#__PURE__*/React.createElement("span",{className:"ezc-drawer-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",null,A2_BRAND)),/*#__PURE__*/React.createElement("div",{style:s.drawerTop},/*#__PURE__*/React.createElement("div",{style:s.drawerSearchWrap},/*#__PURE__*/React.createElement("input",{type:"search",value:chatQuery,onChange:e=>setChatQuery(e.target.value),placeholder:EZIK_SEARCH_PH,"aria-label":EZIK_SEARCH_ARIA,className:"ezik-focus",style:s.drawerSearch})),/*#__PURE__*/React.createElement("button",{onClick:()=>closeDrawerWith(startChatFromMenu),style:s.drawerItem},/*#__PURE__*/React.createElement("svg",{width:"19",height:"19",viewBox:"0 0 24 24",fill:"none",stroke:"var(--ink)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M21 11.5a8.5 8.5 0 0 1-11.8 7.8L3 21l1.7-6.2A8.5 8.5 0 1 1 21 11.5z"}),/*#__PURE__*/React.createElement("line",{x1:"12",y1:"8",x2:"12",y2:"14"}),/*#__PURE__*/React.createElement("line",{x1:"9",y1:"11",x2:"15",y2:"11"})),/*#__PURE__*/React.createElement("span",null,ezT('chat.newConversation')||'\u0645\u062d\u0627\u062f\u062b\u0629 \u062c\u062f\u064a\u062f\u0629')),/*#__PURE__*/React.createElement("button",{onClick:()=>closeDrawerWith(()=>setScreen('home')),style:s.drawerItem},/*#__PURE__*/React.createElement("svg",{width:"19",height:"19",viewBox:"0 0 24 24",fill:"none",stroke:"var(--ink)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("line",{x1:"3",y1:"6",x2:"21",y2:"6"}),/*#__PURE__*/React.createElement("line",{x1:"3",y1:"12",x2:"21",y2:"12"}),/*#__PURE__*/React.createElement("line",{x1:"3",y1:"18",x2:"21",y2:"18"})),/*#__PURE__*/React.createElement("span",null,ezT('navigation.menu')||'\u0627\u0644\u0642\u0627\u0626\u0645\u0629')),/*#__PURE__*/React.createElement("button",{onClick:()=>closeDrawerWith(()=>openEzikSheet('favorites')),style:s.drawerItem,className:"ezik-focus"},/*#__PURE__*/React.createElement("svg",{width:"19",height:"19",viewBox:"0 0 24 24",fill:"none",stroke:"var(--ink)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M12 17.3l-5.4 3 1-6-4.4-4.3 6-.9L12 3.5l2.8 5.6 6 .9-4.4 4.3 1 6z"})),/*#__PURE__*/React.createElement("span",{style:{flex:1,minWidth:0}},EZIK_FAV_TITLE),myFavs.length>0&&/*#__PURE__*/React.createElement("span",{style:s.drawerBadge},myFavs.length)),chatResults!==null&&/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{style:s.drawerSectionLabel},EZIK_SEARCH_RESULTS),chatResults.length===0&&/*#__PURE__*/React.createElement("div",{style:s.drawerEmpty},EZIK_SEARCH_NONE),chatResults.map(r=>/*#__PURE__*/React.createElement("div",{key:r.id,className:r.id===chatId?'ezc-row is-on':'ezc-row',style:s.drawerResultRow},/*#__PURE__*/React.createElement("button",{onClick:()=>closeDrawerWith(()=>openSavedChat(r.id)),style:s.drawerResultBtn,title:r.title,className:"ezik-focus"},/*#__PURE__*/React.createElement("span",{style:s.drawerResultTitle},r.title),r.snippet&&/*#__PURE__*/React.createElement("span",{style:s.drawerSnippet},r.snippet),r.at?/*#__PURE__*/React.createElement("span",{style:s.drawerResultDate},ezikShortDate(r.at)):null)))),chatResults===null&&chatList.length>0&&/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{style:s.drawerSectionLabel},'\u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0627\u062a'),chatList.map(c=>/*#__PURE__*/React.createElement("div",{key:c.id,className:'ezc-row'+(c.id===chatId?' is-on':'')+(c.pinned?' is-pinned':''),style:s.drawerChatRow},chatPendingDelete===c.id?/*#__PURE__*//* The confirmation, and it replaces the row it belongs to rather than
                         covering the menu -- so what is about to be deleted stays readable. */React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("span",{style:s.drawerConfirmText},'\u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629\u061f'),/*#__PURE__*/React.createElement("button",{onClick:()=>deleteSavedChat(c.id),style:s.drawerConfirmYes},'\u062d\u0630\u0641'),/*#__PURE__*/React.createElement("button",{onClick:()=>setChatPendingDelete(null),style:s.drawerConfirmNo},'\u0625\u0644\u063a\u0627\u0621')):/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("button",{onClick:()=>closeDrawerWith(()=>openSavedChat(c.id)),style:s.drawerChatOpen,title:c.title},c.pinned&&/*#__PURE__*/React.createElement("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"var(--red)",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flexShrink:0}},/*#__PURE__*/React.createElement("path",{d:"M12 17v5"}),/*#__PURE__*/React.createElement("path",{d:"M9 10.8V5h6v5.8l2.5 3.2h-11L9 10.8z"})),/*#__PURE__*/React.createElement("span",{style:s.drawerChatTitle},c.title)),/*#__PURE__*/React.createElement("button",{onClick:()=>pinSavedChat(c.id),style:s.drawerChatIcon,"aria-label":c.pinned?'\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u062b\u0628\u064a\u062a':'\u062a\u062b\u0628\u064a\u062a'},/*#__PURE__*/React.createElement("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:c.pinned?'var(--red)':'var(--muted)',strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M12 17v5"}),/*#__PURE__*/React.createElement("path",{d:"M9 10.8V5h6v5.8l2.5 3.2h-11L9 10.8z"}))),/*#__PURE__*/React.createElement("button",{onClick:()=>setChatPendingDelete(c.id),style:s.drawerChatIcon,"aria-label":'\u062d\u0630\u0641'},/*#__PURE__*/React.createElement("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"var(--muted)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M3 6h18"}),/*#__PURE__*/React.createElement("path",{d:"M8 6V4h8v2"}),/*#__PURE__*/React.createElement("path",{d:"M6 6l1 14h10l1-14"}))))))),chatResults===null&&chatList.length===0&&/*#__PURE__*/React.createElement("div",{style:s.drawerEmpty},EZIK_CHATS_EMPTY)),/*#__PURE__*/React.createElement("div",{style:s.drawerPinned},/*#__PURE__*/React.createElement("button",{onClick:()=>closeDrawerWith(()=>openEzikSheet('settings')),style:s.drawerProfile,"aria-label":ezT('navigation.settings2')},/*#__PURE__*/React.createElement("span",{style:s.drawerAvatar},/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"var(--on-accent)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("circle",{cx:"12",cy:"8",r:"4"}),/*#__PURE__*/React.createElement("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"}))),/*#__PURE__*/React.createElement("span",{style:s.drawerProfileName},profile?.name)))));// S115: the boot mark is a bounded arch instead of a 48px emoji. The animation, its keyframe,
// its duration and the style key that carries it are the ones that shipped, so reduced motion
// behaves exactly as it did and no timer, wait or step was added to the boot.
if(screen==='loading')return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezload",style:s.loadingScreen},/*#__PURE__*/React.createElement("div",{style:s.loadingSpinner,className:"ezload-mark","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{className:"ezload-mark-in"})));if(screen==='onboarding')return/*#__PURE__*/React.createElement(Onboarding,{onStart:startChat});// قفل الإنفاق: المطالبة تظهر فقط أمام الشاشتين اللتين تُنفقان (المحادثة/المكالمة) وحين يكون القفل مفعّلاً وغير مفتوح.
// القفل المُعطَّل (٦٤ صفراً) ⇒ spendGateOpenState=true دائماً ⇒ لا تظهر هذه السطر أبداً. أما 0b (المصحف/المحفّظ/الأذكار) فتبقى مفتوحة.
if((screen==='chat'||screen==='call')&&!spendGateOpenState)return/*#__PURE__*/React.createElement(SpendGate,{onUnlock:unlockSpendGate,onExit:()=>setScreen('home')});// REFUSED, or a disclosure the reader has not answered: the two screens that SEND are replaced
// by a named local-mode notice -- never a blank page and never a chat box that silently does
// nothing. Everything that does not send (المصحف، الأذكار، كنوز المعرفة، الإعدادات) is BELOW
// this line and is untouched, which is the point: refusing is a real choice, not a dead app.
if((screen==='chat'||screen==='call')&&aiConsent!==EZ_AI_CONSENT_GRANTED)return/*#__PURE__*/React.createElement(AILocalModeNotice,{onReview:()=>openEzikSheet('settings'),onMushaf:()=>setScreen('mushaf'),onAdhkar:()=>setScreen('adhkar'),onTreasure:()=>{window.location.href='/quest.html';},onBack:()=>setScreen('home')});// S87: the home's chat entry is the FAB in its own bottom bar and nothing else -- the chat is
// opened by an explicit chat action, and no back path resolves to it. The profile entry records
// home as its opener through openEzikSheet, so the gate's back comes back HERE.
// S92: the FAB is the explicit entry into the chat, so it opens a NEW, EMPTY thread -- the same
// rule the app's own boot follows. Nothing is lost by it: the thread being left was filed at its
// first question and is in the menu. The BACK path out of home also lands on the chat, and it
// does not come through here, so returning from home never wipes the thread underneath it.
// S118: the home hands its bar the SAME openDrawer the chat's rail calls, and draws the SAME
// ezikDrawer() the chat draws -- one panel, one state, one history entry. It no longer takes
// an onOpenChat: the chat is entered from that menu's «محادثة جديدة» row.
if(screen==='home')return/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement(Home,{profile:profile,onOpenMenu:openDrawer,onOpenMemorize:()=>setScreen('memorize'),onOpenAdhkar:()=>setScreen('adhkar'),onOpenMushaf:()=>setScreen('mushaf'),onOpenFatwa:()=>setScreen('fatwa'),onOpenSettings:()=>openEzikSheet('settings')}),ezikDrawer());// S87: the three sheets resolve their back through goEzikBack, which returns them to the screen
// recorded when they were opened (home or the chat drawer) and to home when nothing valid was.
// The gate still clears its own PIN field first -- that is its state, not navigation.
if(screen==='parentGate')return/*#__PURE__*/React.createElement(ParentGate,{pinInput:pinInput,setPinInput:setPinInput,pinError:pinError,setPinError:setPinError,onSuccess:()=>{setPinInput('');setPinError(false);replaceEzikScreen('parentDashboard');},onBack:()=>{setPinInput('');setPinError(false);goEzikBack();}});// S92: the dashboard reads the SAVED conversations, not the thread that happens to be open --
// the chat opens empty now, so the open thread is no longer the child's record. Read here, at
// the moment the dashboard is drawn, so it costs nothing on any other screen.
if(screen==='parentDashboard')return/*#__PURE__*/React.createElement(ParentDashboard,{profile:profile,messages:ezikProfileTranscript(ezikProfileKey(profileRef.current)),onBack:goEzikBack,onReset:resetAll,directConvoLocked:directConvoLocked,onToggleDirectConvo:toggleDirectConvoLock});// D88/S90: the settings sheet, and it is now the ONE door to the account area -- the home
// screen's الإعدادات item, the drawer's gear and the drawer's profile entry all open THIS,
// immediately and with no PIN. The parental screen it used to stand in front of has not moved
// an inch or lost its lock: it is reached from the التحكم row inside, which is the only thing
// in the app that still opens the gate.
if(screen==='settings')return/*#__PURE__*/React.createElement(SettingsSheet,{theme:theme,onTheme:chooseTheme,onBack:goEzikBack,onOpenControl:()=>openEzikSheet('parentGate'),a11y:a11y,onA11y:setA11y,onA11yReset:resetA11y,aiConsent:aiConsent,aiConsentBy:aiConsentGrantedBy(),onWithdrawAI:declineAIConsent,onReviewAI:()=>setAiConsentReview(true)});// S98: المفضلة. A sheet, opened from the chat's drawer, handed everything it draws.
if(screen==='favorites')return/*#__PURE__*/React.createElement(FavoritesScreen,{items:shownFavs,total:myFavs.length,kind:favKind,onKind:setFavKind,counts:favCounts,query:favQuery,onQuery:setFavQuery,searching:favResults!==null,liveChatIds:liveChatIds,onBack:goEzikBack,onOpenChat:openFavoriteChat,onRemove:removeFavorite,age:profile?.age,tashkeel:tashkeelOn});// غ‑٣: ملفُّ طفلٍ (أو ملفٌّ يتعذّر تحديدُه) لا يدخل شاشةَ المكالمة — يُعرَض التنبيهُ ومعه طريقُ رجوع.
// S90: the three call-screen exits resolve through goEzikBack like every other back control.
// The DESTINATION is unchanged -- the table sends 'call' to the chat, which is its documented
// contract and genuinely the entry underneath it -- but the history entry the call pushed is
// now spent on the way out instead of being left behind to absorb a later press.
if(screen==='call'&&childVoiceBlocked())return/*#__PURE__*/React.createElement(ChildVoiceNotice,{onBack:goEzikBack});// CALL UNLOCK (directive 82). Sits at the SCREEN transition, immediately AFTER the child
// barrier above, so a child profile always gets the notice and is never shown a PIN sheet.
// This decides only what is DISPLAYED; the mic itself is held shut by the guards inside
// startCallListening and the call useEffect, because that effect runs on [screen] whatever
// this chain renders -- a screen that mounts unlocked would otherwise be a mic that opens.
if(screen==='call'&&!hasFounderToken())return/*#__PURE__*/React.createElement(UnlockSheet,{onUnlocked:()=>setFounderUnlocked(true),onBack:goEzikBack});// `error` is what makes a failed call SAY something: voiceError was rendered on the chat screen
// ONLY, so every banner a call raised was written to a view the user was not looking at.
if(screen==='call')return/*#__PURE__*/React.createElement(CallScreen,{profileName:profile?.name,gender:profile?.gender,callState:callState,heard:callHeard,isMuted:isCallMuted,error:voiceError,onToggleMute:toggleCallMute,onTalk:onCallTalk,onExit:goEzikBack});// المحفّظ — full screen (mirrors CallScreen). Quran playback reuses the App-scoped manual
// entry points (playVerseManual/playSurahManual) passed down as props; no new audio code.
// S87 -- THE FEATURE SECTIONS. Each hands goEzikBack to its OWN section-level back
// control, so the visible button and the hardware button resolve through the same table: a
// nested layer (drill / open surah / opened adhkar category) closes first and the section is
// retained, and only a back taken from the section's own top level goes home.
if(screen==='memorize')return/*#__PURE__*/React.createElement(MemorizeScreen,{profile:profile,onExit:goEzikBack,onPlayVerse:playVerseManual,onPlaySurah:playSurahManual,onStopAudio:cancelAudio});if(screen==='mushaf')return/*#__PURE__*/React.createElement(MushafScreen,{selected:selectedSurah,setSelected:setSelectedSurah,onBack:goEzikBack,onPlaySurah:playSurahManual,onStopAudio:cancelAudio});if(screen==='adhkar')return/*#__PURE__*/React.createElement(AdhkarScreen,{onBack:goEzikBack});if(screen==='fatwa')return/*#__PURE__*/React.createElement(FatwaScreen,{onBack:goEzikBack,favPk:favPk});// Single-source capability flags for the chat UI. `directConvoAllowed` layers the parental lock
// on top of the band: young is allowed unless the parent explicitly locked it; teen/adult always
// allowed (the lock does not apply to them).
const caps=deriveCaps(profile?.age);const directConvoAllowed=caps.band==='young'?!directConvoLocked:true;// S112: what the top rail says. It is the REAL title -- the one the store filed for the
// conversation that is open, read off the list the menu already holds -- and the app's own
// name while the thread is new and has no conversation yet. Nothing is invented here, nothing
// is written, and no store is opened: chatList is state that refreshChatList already fills.
const ezcOpenChat=chatId?chatList.find(c=>c.id===chatId):null;// ITEM 94, THE REST OF IT. This line used to fall back to the app's own name, so an empty
// chat carried «عزك» in the rail with the arch already beside it -- the same name twice,
// which is what item 94 took out of the transcript. There is no fallback now: with no
// conversation there is no title, and the span that would draw it is not rendered at all
// (not hidden -- absent). The moment a conversation exists the rail carries ITS title,
// exactly as before, read out of the store and never invented here.
const ezcTitle=ezcOpenChat&&ezcOpenChat.title?ezcOpenChat.title:null;// Report button (step 2b). Opens the flag modal for a given assistant reply, capturing the
// user question that preceded it (messages[i-1]) for context. Client only -- POSTs to api/report.
// The size guard MEASURES real UTF-8 bytes and halves ai then user until the body is under
// 20000 bytes -- comfortably below the server 21812-byte cap -- so a 413 is structurally
// impossible, not merely unlikely. It never assumes "1 char = 2 bytes". Returns ok|rate|fail;
// the modal maps those to messages that NEVER claim success on anything but a real 200.
const submitReport=async(reason,note)=>{const R=reportFor||{};let a=(typeof R.ai==='string'?R.ai:'').slice(0,3500);let u=(typeof R.user==='string'?R.user:'').slice(0,3500);const enc=new TextEncoder();const build=()=>JSON.stringify({reason,note:(note||'').slice(0,500),ai:a,user:u,band:caps.band,mode:'chat'});let body=build();let n=0;while(enc.encode(body).length>20000&&n<40){if(n%2===0)a=a.slice(0,Math.floor(a.length/2));else u=u.slice(0,Math.floor(u.length/2));body=build();n++;}try{const resp=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body});if(resp.status===200)return'ok';if(resp.status===429)return'rate';return'fail';}catch(e){return'fail';}};return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezc",style:s.chatContainer},/*#__PURE__*/React.createElement("div",{className:'ezwm'+(wmAutoHide&&(isLoading||streamingText!==null)?' is-quiet':''),"aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{className:"ezc-rail"},/*#__PURE__*/React.createElement("div",{className:"ezc-rail-inner"},/*#__PURE__*/React.createElement("button",{onClick:openDrawer,className:"ezc-icon","aria-label":'\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062c\u0627\u0646\u0628\u064a\u0629',...(uiLang==='ar'?null:{'aria-label':ezT('navigation.openMenu')})},/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("line",{x1:"3",y1:"6",x2:"21",y2:"6"}),/*#__PURE__*/React.createElement("line",{x1:"3",y1:"12",x2:"21",y2:"12"}),/*#__PURE__*/React.createElement("line",{x1:"3",y1:"18",x2:"21",y2:"18"}))),/*#__PURE__*/React.createElement("span",{className:"ezc-brand"},/*#__PURE__*/React.createElement("span",{className:"ezc-brand-arch","aria-hidden":"true"}),ezcTitle?/*#__PURE__*/React.createElement("span",{className:"ezc-brand-text"},ezcTitle):null))),/*#__PURE__*/React.createElement("div",{ref:messagesAreaRef,onScroll:onMessagesScroll,className:'ezc-scroll'+(pinnedAskIndex==null?'':' ezc-askpinned'),style:s.messagesArea},messages.length===0&&streamingText===null&&/*#__PURE__*/React.createElement("div",{className:"ezc-empty"}),messages.map((m,i)=>/*#__PURE__*//* STREAM-P4 §٣/١: a zero-height marker immediately BEFORE the pinned question, which
             is what the pin measures against. It is a bare element rather than a ref threaded
             into MessageBubble because that component's props are deliberately pinned for
             performance (see S98 PERF below) and adding a per-render ref to them would undo
             that on every message in the thread, to locate one of them. */React.createElement(React.Fragment,{key:i},i===pinnedAskIndex&&/*#__PURE__*/React.createElement("div",{ref:pinAnchorRef,"aria-hidden":"true","data-ezik-ask-pin":""}),/*#__PURE__*/React.createElement(MessageBubble,{index:i,tashkeel:tashkeelOn,onToggleTashkeel:cbToggleTashkeel,message:m,onSuggestionClick:cbSuggestion,onPlayVerse:cbPlayVerse,onPlaySurah:cbPlaySurah,onStopAudio:cbStopAudio,onPlayMessage:cbPlayMessage,age:profile?.age,onReport:cbReport,onQuote:cbQuote,onFavorite:cbFavorite,isFavorite:favFlags[i],onFavoriteAyah:cbFavoriteAyah,ayahFavIds:ayahFavIds,defaultOpen:streamedOpen.has(i),foldEpoch:threadEpoch}))),quickActionsVisible&&ezikAnswerIncomplete(lastMsg.content)&&/*#__PURE__*/React.createElement("div",{style:s.incompleteNotice,role:"status"},ezT('chat.qa.incomplete')),quickActionsVisible&&/*#__PURE__*/React.createElement("div",{className:"ez-hit",style:s.quickRow,role:"group","aria-label":ezT("chat.quickActions")},EZIK_QUICK_ACTIONS.map(qa=>/*#__PURE__*/React.createElement("button",{key:qa.key,type:"button",onClick:()=>runQuickAction(qa.prompt),disabled:isLoading,className:"ezik-focus",style:{...s.quickBtn,opacity:isLoading?0.5:1}},qa.label))),streamingText!==null&&/*#__PURE__*/React.createElement("div",{className:"ezc-turn is-ai"},/*#__PURE__*/React.createElement("div",{style:{...s.messageBubble,...s.assistantBubble}},formatForStreamPreview(streamingText)/* S93: the live preview formats too, so a heading or a bold phrase does not appear
                 as ## and ** for a second and then re-flow when the reply settles. The renderer
                 only formats constructs whose closing side has arrived, so the half-written tail
                 of the stream stays literal text instead of flickering. */?/*#__PURE__*/React.createElement("div",{style:s.bubbleText},/*#__PURE__*/React.createElement(EzikMarkdown,{text:formatForStreamPreview(streamingText)})):searchingSources?/*#__PURE__*/React.createElement("div",{style:s.searchingHint},/*#__PURE__*/React.createElement("span",null,ezT('chat.searchingSources')),/*#__PURE__*/React.createElement("span",{style:s.dot},"●"),/*#__PURE__*/React.createElement("span",{style:{...s.dot,animationDelay:'0.2s'}},"●"),/*#__PURE__*/React.createElement("span",{style:{...s.dot,animationDelay:'0.4s'}},"●")):/*#__PURE__*/React.createElement("div",{style:s.typingDots},/*#__PURE__*/React.createElement("span",{style:s.dot},"●"),/*#__PURE__*/React.createElement("span",{style:{...s.dot,animationDelay:'0.2s'}},"●"),/*#__PURE__*/React.createElement("span",{style:{...s.dot,animationDelay:'0.4s'}},"●")))),askPinPad>0&&/*#__PURE__*/React.createElement("div",{ref:askPadElRef,"aria-hidden":"true","data-ezik-ask-pad":"",style:{height:askPinPad,flexShrink:0}}),/*#__PURE__*/React.createElement("div",{ref:messagesEndRef})),/*#__PURE__*/React.createElement("div",{className:"ezc-dock"},/*#__PURE__*/React.createElement("div",{className:"ezc-dock-inner"},sectionSuggestVisible&&/*#__PURE__*/React.createElement("div",{className:composerFocused?'ezsug is-row':'ezsug',role:"group","aria-label":ezT('navigation.menu')},sectionSuggestions.map(sg=>/*#__PURE__*/React.createElement("button",{key:sg.id,type:"button",onMouseDown:e=>e.preventDefault(),onClick:sg.go,className:composerFocused?'ezsug-pill ezik-focus':'ezsug-card ezik-focus',"data-ezik-section-suggestion":sg.id},/*#__PURE__*/React.createElement("span",{className:"ezsug-mark","aria-hidden":"true"},sg.icon),composerFocused?/*#__PURE__*/React.createElement("span",null,sg.label):/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("span",{className:"ezsug-body"},/*#__PURE__*/React.createElement("span",{className:"ezsug-title"},sg.label),/*#__PURE__*/React.createElement("span",{className:"ezsug-sub"},EZIST_SUB[sg.id])),/*#__PURE__*/React.createElement("span",{className:"ezsug-go","aria-hidden":"true"},EZH_ICON_GO))))),voiceError&&/*#__PURE__*/React.createElement("div",{style:s.errorBanner},voiceError),pendingImage&&/*#__PURE__*/React.createElement("div",{style:{display:'flex',alignItems:'center',gap:8,padding:'6px 10px'}},pendingImage.kind==='image'||pendingImage.kind===undefined?/*#__PURE__*/React.createElement("img",{src:`data:${pendingImage.media_type};base64,${pendingImage.data}`,style:{height:56,borderRadius:8,border:'1px solid var(--line)'}}):/*#__PURE__*/React.createElement("span",{style:{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:8,border:'1px solid var(--line)',background:'var(--tint)',fontSize:14}},/*#__PURE__*/React.createElement("span",null,"📄"),/*#__PURE__*/React.createElement("span",null,pendingImage.name),/*#__PURE__*/React.createElement("span",{style:{color:'var(--muted)',fontSize:12}},pendingImage.kind==='pdf'?'PDF':'نصّ')),/*#__PURE__*/React.createElement("button",{onClick:()=>setPendingImage(null),style:{background:'none',border:'none',color:'var(--red-lift)',fontSize:18,cursor:'pointer'},"aria-label":ezT("chat.removeImage")},"×")),/*#__PURE__*/React.createElement("div",{style:s.inputBar},/*#__PURE__*/React.createElement("textarea",{ref:inputElRef,rows:1,value:input,onChange:e=>setInput(e.target.value),onKeyDown:onComposerKeyDown,onPointerDown:onComposerPointerDown,onFocus:()=>setComposerFocused(true),onBlur:()=>setComposerFocused(false),onCompositionStart:()=>{composingRef.current=true;},onCompositionEnd:()=>{composingRef.current=false;},enterKeyHint:enterSends?'send':'enter',style:s.input,disabled:isLoading||isListening}),/*#__PURE__*/React.createElement("button",{onClick:()=>sendMessage(input),disabled:isLoading||!input.trim()&&!pendingImage,style:{...s.sendBtn,opacity:isLoading||!input.trim()?0.4:1}},/*#__PURE__*/React.createElement(SendIcon,{size:20,color:"var(--on-accent)"}))),/*#__PURE__*/React.createElement("input",{ref:fileInputRef,type:"file",accept:"image/*",onChange:onPickImage,style:{display:'none'}}),/*#__PURE__*/React.createElement("input",{ref:docInputRef,type:"file",accept:".pdf,application/pdf,.txt,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",onChange:onPickImage,style:{display:'none'}}),/*#__PURE__*/React.createElement("div",{style:s.toolBar},/*#__PURE__*/React.createElement("div",{style:s.toolGroup},caps.upload&&/*#__PURE__*/React.createElement("div",{style:{position:'relative',display:'inline-flex'}},attachMenuOpen&&/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{onClick:()=>setAttachMenuOpen(false),style:{position:'fixed',inset:0,zIndex:40}}),/*#__PURE__*/React.createElement("div",{style:{position:'absolute',bottom:'120%',right:0,zIndex:41,background:'var(--white)',border:'1px solid var(--line)',borderRadius:12,boxShadow:'var(--a3-lift)',padding:6,minWidth:168,display:'flex',flexDirection:'column',gap:2}},/*#__PURE__*/React.createElement("button",{onClick:()=>{setAttachMenuOpen(false);if(fileInputRef.current)fileInputRef.current.click();},style:{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'none',border:'none',borderRadius:8,cursor:'pointer',fontSize:15,color:'var(--ink)',width:'100%',textAlign:'right'}},/*#__PURE__*/React.createElement("span",{style:{fontSize:18}},'\uD83D\uDDBC\uFE0F'),/*#__PURE__*/React.createElement("span",null,ezT('chat.attachImage'))),/*#__PURE__*/React.createElement("button",{onClick:()=>{setAttachMenuOpen(false);if(docInputRef.current)docInputRef.current.click();},style:{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'none',border:'none',borderRadius:8,cursor:'pointer',fontSize:15,color:'var(--ink)',width:'100%',textAlign:'right'}},/*#__PURE__*/React.createElement("span",{style:{fontSize:18}},'\uD83D\uDCC4'),/*#__PURE__*/React.createElement("span",null,ezT('chat.attachFile'))))),/*#__PURE__*/React.createElement("button",{onClick:()=>setAttachMenuOpen(v=>!v),disabled:isLoading||isListening,style:{...s.toolBtn,opacity:isLoading||isListening?0.4:1},"aria-label":'\u0625\u0631\u0641\u0627\u0642 \u0645\u0644\u0641 \u0623\u0648 \u0635\u0648\u0631\u0629',...(uiLang==='ar'?null:{'aria-label':ezT('chat.attach')})},/*#__PURE__*/React.createElement("svg",{width:"20",height:"20",viewBox:"0 0 24 24",fill:"none",stroke:"var(--red)",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("line",{x1:"12",y1:"5",x2:"12",y2:"19"}),/*#__PURE__*/React.createElement("line",{x1:"5",y1:"12",x2:"19",y2:"12"})))),/*#__PURE__*/React.createElement("button",{onClick:()=>{if(caps.band!=='adult')return;// 18+ visibility on the deep tiers is unchanged
const next=depthMode==='brief'?'detailed':depthMode==='detailed'?SCHOLAR_ENABLED?'scholar':'brief':'brief';// THE CLIENT NO LONGER ASKS FOR THE TOKEN HERE. The removed line tested the two
// deep tier names against the founder token and handed off to the unlock sheet;
// it is quoted in the commit message and deliberately NOT here, because holding
// it byte for byte in a comment left theme-coverage matching this very block and
// reporting the gate as present after the gate was gone.
// The reason given for it was that it stopped a reader selecting a tier that would
// silently do nothing. That reason still stands, and it is now the owner's to
// weigh: with DEPTH_FREE_TRIAL off, api/ask.js still drops an unearned depth, so
// a non-founder selecting مفصّل gets the default tier and no notice. Lifting this
// is what makes the tiers SELECTABLE the moment the owner flips that flag, with
// no second deploy of this page.
//
// WHAT IS NOT LIFTED: the server lock, which is not in this file; the 18+ gate on
// the deep tiers, two lines above, which still returns for any non-adult; and the
// cycle itself, which still reaches these two tiers and no others.
setDepthMode(next);},disabled:isLoading||caps.band!=='adult',title:caps.band==='adult'?ezT('chat.depthHint'):undefined,"aria-label":depthMode==='brief'?ezT('chat.depthBrief'):depthMode==='detailed'?ezT('chat.depthDetailed'):ezT('chat.depthScholar'),style:{...s.sendBtn,background:depthMode==='brief'?'var(--tint)':depthMode==='detailed'?'var(--red)':'var(--scholar)',opacity:isLoading?0.4:1,cursor:caps.band==='adult'?'pointer':'default',fontSize:13,fontWeight:700,color:depthMode==='brief'?'var(--red)':'var(--white)',minWidth:52,whiteSpace:'nowrap',paddingInline:10}},depthMode==='brief'?ezT('chat.depthBrief'):depthMode==='detailed'?ezT('chat.depthDetailed'):ezT('chat.depthScholar'))),/*#__PURE__*/React.createElement("div",{style:s.toolGroup},/*#__PURE__*/React.createElement("button",{onClick:isListening?stopListening:startListening,disabled:isLoading,"aria-label":'\u0625\u0645\u0644\u0627\u0621 \u0635\u0648\u062a\u064a',...(uiLang==='ar'?null:{'aria-label':ezT('chat.dictate')}),className:"ez-anim",style:{...s.micBtn,background:isListening?'var(--red-deep)':'var(--tint)',animation:isListening?'pulse 1.2s ease-in-out infinite':'none',opacity:isLoading?0.4:1}},isListening?/*#__PURE__*/React.createElement(MicOffIcon,{size:20,color:"var(--on-accent)"}):/*#__PURE__*/React.createElement(MicIcon,{size:20,color:"var(--red)"})),directConvoAllowed&&/*#__PURE__*/React.createElement("button",{onClick:()=>setScreen('call'),disabled:isLoading||isListening,"aria-label":'\u0645\u0643\u0627\u0644\u0645\u0629 \u0635\u0648\u062a\u064a\u0629 \u0645\u0628\u0627\u0634\u0631\u0629',...(uiLang==='ar'?null:{'aria-label':ezT('chat.call')}),style:{...s.toolBtn,opacity:isLoading||isListening?0.4:1}},/*#__PURE__*/React.createElement(PhoneCallIcon,{size:20,color:"var(--red)"})))),/*#__PURE__*/React.createElement("div",{className:"ezc-note"},ezT(standingNoticeKey(caps.band))))),ezikDrawer(),reportFor&&/*#__PURE__*/React.createElement(ReportModal,{onClose:()=>setReportFor(null),onSubmit:submitReport}));}// Per-message listen button (opt-in TTS). Mirrors VerseCard's play/stop pattern:
// local `playing` state; unified App audio via onPlayMessage (speakReply), which
// resolves when playback ends or is cancelled; onStopAudio (cancelAudio) stops it.
// The reply is spoken through the SAME pipeline (formatForTTS -> smart tashkeel
// skip -> tts), so the shipped audio rate-limit governs it. Verses inside the
// reply are recited by the reciter exactly as in the old auto-play path.
function MessageListenButton({text,onPlayMessage,onStopAudio}){const[playing,setPlaying]=useState(false);if(!text||!onPlayMessage)return null;const toggle=()=>{if(playing){if(onStopAudio)onStopAudio();setPlaying(false);return;}setPlaying(true);Promise.resolve(onPlayMessage(text)).then(()=>setPlaying(false)).catch(()=>setPlaying(false));};return/*#__PURE__*/React.createElement("button",{type:"button",onClick:toggle,"aria-label":playing?'إيقاف الصوت':'استمع للرد',style:{display:'inline-flex',alignItems:'center',gap:5,background:'transparent',color:'var(--red)',border:'1px solid var(--line)',borderRadius:8,padding:'4px 10px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}},playing?/*#__PURE__*/React.createElement(PauseIcon,{size:13}):/*#__PURE__*/React.createElement(PlayIcon,{size:13}),/*#__PURE__*/React.createElement("span",null,playing?'إيقاف':'استمع'));}// ============================================================
// D90 -- plain-text serialization of a reply, for the copy button.
// ============================================================
// MessageBubble renders ONE component per segment type. This table produces ONE plain-text form
// per segment type, from the SAME segment objects and the SAME stores those cards read -- so the
// clipboard carries what is on the screen, in display order. It renders nothing and changes no
// component; it is a serializer only.
//
// TASHKEEL: the toggle touches PROSE ONLY. MessageBubble applies stripTashkeelOutsideQuran to
// seg.type==='text' and to NOTHING else -- every card body is drawn verbatim. So card bodies are
// copied verbatim too. Stripping an ayah or a hadith here would put on the clipboard something
// that was never on the screen, and would strip harakat from canonical scripture, which
// stripTashkeelOutsideQuran only protects when it is wrapped in U+FD3F..U+FD3E ornaments.
//
// ASYNC BODIES: verse/surah/dhikr/worship segments carry no text of their own -- their cards
// resolve it from the canonical stores after a fetch. We read the SAME module caches through the
// SAME accessors (getVerseText / __adhkarData / __worshipData). A cache not yet filled means the
// card is not showing that text either, so the body is omitted and what IS on screen is copied.
// A verse's seg.content -- the MODEL's wording -- is deliberately never used, exactly as
// VerseCard never uses it.
const REPLY_LINE=parts=>parts.filter(x=>x&&String(x).trim()).join('\n');const REPLY_SERIALIZERS={text:(sg,ctx)=>ctx.tashkeel?sg.content:stripTashkeelOutsideQuran(sg.content),verse:sg=>{const sNum=resolveSurahNumber(sg.surah,sg.surahNum);const aNum=parseInt(sg.ayah,10);const surahName=sg.surah||(sNum?SURAH_NAMES[sNum]:'');const body=sNum&&aNum>=1?getVerseText(sNum,aNum):null;// canonical only
const meta=[surahName?'\u0633\u0648\u0631\u0629 '+surahName:'',sg.ayah?'\u0622\u064A\u0629 '+sg.ayah:''].filter(Boolean).join('\u060C ');return REPLY_LINE(['\u0642\u064E\u0627\u0644\u064E \u0627\u0644\u0644\u0647\u064F \u062A\u064E\u0639\u064E\u0627\u0644\u064E\u0649',body,meta]);},surah:sg=>{const sNum=resolveSurahNumber(undefined,sg.num);const surahName=sNum?SURAH_NAMES[sNum]:'';const head='\u0642\u064E\u0627\u0644\u064E \u0627\u0644\u0644\u0647\u064F \u062A\u064E\u0639\u064E\u0627\u0644\u064E\u0649'+(surahName?' \u2014 \u0633\u064F\u0648\u0631\u064E\u0629\u064F '+surahName:'');const count=sNum?getSurahAyahCount(sNum):0;let body='',meta='';if(count){let f=parseInt(sg.from,10);if(!(f>=1))f=1;let t=parseInt(sg.to,10);if(!(t>=1)||t>count)t=count;if(f<=t){const pieces=[];if(f===1&&sNum!==1&&sNum!==9){const b=getVerseText(1,1);if(b)pieces.push(b);}let missing=false;for(let a=f;a<=t;a++){const vt=getVerseText(sNum,a);if(!vt){missing=true;break;}pieces.push(vt+' \u06DD'+toArabicDigits(a));}if(!missing)body=pieces.join(' ');meta=f===1&&t===count?'\u0633\u0648\u0631\u0629 '+surahName:'\u0633\u0648\u0631\u0629 '+surahName+'\u060C \u0627\u0644\u0622\u064A\u0627\u062A '+toArabicDigits(f)+'\u2013'+toArabicDigits(t);}}if(!meta&&surahName)meta='\u0633\u0648\u0631\u0629 '+surahName;return REPLY_LINE([head,body,meta]);},hadith:sg=>{const att=resolveHadithAttribution(sg.narrator,sg.ruling);return REPLY_LINE([att.narrator?'\u0631\u064E\u0648\u064E\u0649 '+att.narrator:'\u0645\u0646 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0646\u0628\u0648\u064A\u0629',sg.content,att.ruling]);},dhikr:sg=>{const db=typeof __adhkarData!=='undefined'?__adhkarData:null;const list=db&&db.byCat&&db.byCat[parseInt(sg.catId,10)]||[];if(!list.length)return'';const head=(list[0]&&list[0].category||'\u0630\u0643\u0631')+' \u2014 \u062D\u0635\u0646 \u0627\u0644\u0645\u0633\u0644\u0645';return REPLY_LINE([head].concat(list.map(d=>REPLY_LINE([d.text,d.repeat>1?'\u062A\u064F\u0642\u0627\u0644 '+toArabicDigits(d.repeat)+' \u0645\u0631\u0651\u0627\u062A':'']))));},worship:(sg,ctx)=>{const d=typeof __worshipData!=='undefined'?__worshipData:null;const arm=ctx.band==='young'?'young':'adult';// byte-for-byte WorshipCard's ternary
const cell=d&&d.cells&&d.cells[sg.id+':'+arm];return cell&&cell.text?cell.text:'';},source:sg=>{let host=(sg.site||'').trim();if(!host&&sg.url){try{host=new URL(sg.url).hostname.replace(/^www\./,'');}catch(e){host='';}}const label=host||'\u0627\u0644\u0645\u0635\u062F\u0631';const text=(sg.content||'').trim();// The url is the REFERENCE. A fiqh answer pasted into a message without it is incomplete,
// and the chip's own href is the only place it exists on screen.
return REPLY_LINE([text?label+' \u2014 '+text:label,sg.url||'']);},// The heading comes from the ANSWER (the tag's title), or there is no heading at all. It used
// to be one fixed sentence printed above every list -- see readStepsTitle for what that cost.
steps:sg=>REPLY_LINE(((sg.title||'').trim()?[(sg.title||'').trim()]:[]).concat((sg.items||[]).map((it,i)=>i+1+'. '+it))),// matches the card's <ol> decimal marks
board:sg=>sg.content,// XI-04: THE CLIPBOARD CARRIES THE MEANING WITHOUT THE BRACKETS. The reader copied 【】 verbatim
// before this, which is the one thing §٥ names about the clipboard. What it says is kept — it is
// on the screen and it is about the answer — and the ornate brackets, which were never anything
// but a transport marker between the reviewer and this renderer, are not.
notice:sg=>[sg.label,sg.content].map(x=>String(x||'').trim()).filter(Boolean).join(' '),document:sg=>REPLY_LINE([sg.title||'\u0645\u0633\u062A\u0646\u062F',toPlainText(sg.content)])};// ITEM 42-C. THE SHARE CARD'S SOURCE FOOTER, and it lives HERE for a reason.
//
// The host is derived EXACTLY as REPLY_WRITERS.source above derives it -- the site field, and
// the url hostname only when the site field is empty -- so the footer on the image and the
// line in the copied text can never name the reply's sources two different ways.
//
// It is module-level, not a helper inside MessageBubble, because N22 asserts that the chat
// sheet itself never re-orders, filters or counts the sources. That invariant is older than
// this item and is not being relaxed to fit it: the ORDER is the reply's own, nothing is
// dropped, nothing is de-duplicated, and a reply that cites nothing yields the empty string,
// which draws no footer at all rather than an invented one.
const ezikCardSourceLine=segments=>{const names=[];for(const sg of segments||[]){if(!sg||sg.type!=='source')continue;let host=(sg.site||'').trim();if(!host&&sg.url){try{host=new URL(sg.url).hostname.replace(/^www\./,'');}catch(e){host='';}}if(host)names.push(host);}return names.join('  ·  ');};// Every type MessageBubble can render must have an entry above. A new card added to the renderer
// without one lands here and is announced -- loudly, and visibly in the copied text -- instead of
// vanishing from the clipboard the way every card did before this directive.
const serializeReply=(segments,ctx)=>{const out=[];(segments||[]).forEach(sg=>{const fn=sg&&REPLY_SERIALIZERS[sg.type];if(!fn){try{console.error('[copy] no serializer for segment type:',sg&&sg.type);}catch(e){}out.push('['+(sg&&sg.type||'unknown')+': not serialized]');return;}const piece=fn(sg,ctx||{});if(piece&&String(piece).trim())out.push(String(piece).trim());});return out.join('\n\n');};// ============================================================
// S98 — طيُّ الردود الطويلة (long-reply folding)
// ============================================================
// A long reply is a wall the child has to scroll past to reach the next thing. This folds the
// PROSE of one and nothing else. Three properties make it safe, and each is load-bearing:
//
//   1. IT IS A VIEW, NOT AN EDIT. It returns a SECOND segment array to draw. `segments` — the one
//      the clipboard, the voice, the export and the stored thread all read — is never touched, so
//      a folded reply copies, speaks and exports in full exactly as an unfolded one does.
//   2. ONLY seg.type === 'text' FOLDS. parseRichMessage has already lifted every verse, hadith,
//      source, dhikr, worship, steps, board and document out into its own segment; those are
//      copied through untouched, so a source card, an ayah, a hadith, the steps, a warning board
//      and the suggestions are all on screen WHILE it is folded. There is no line-clamp anywhere:
//      clamping the bubble would have hidden precisely those cards.
//   3. THE CUT IS ON A BOUNDARY. A markdown string cut mid-construct renders as debris, so the
//      cut walks back to a blank line, then a line end, then a word end — and if it landed inside
//      a fenced block it closes the fence, because an unclosed fence would swallow the ellipsis.
//
// THE THRESHOLD, and why it is 900 / 320. Measured off the shipped layout rather than picked: the
// bubble draws at s.bubbleText — fontSize 15, lineHeight 1.85 (27.75px a line) — inside a bubble
// whose content box is ~273px on a 360px phone (14px area padding either side, bubble maxWidth
// 92%, 16px bubble padding either side). Arabic in Tajawal averages ~0.48em of advance, so a line
// carries ~38 characters. The chat's visible area on a 640px-tall phone is ~380px ≈ 13 lines ≈
// ~520 characters — ONE screenful. 900 is therefore "clearly longer than a screenful" (~24 lines)
// and never folds a reply that already fitted; 320 (~8 lines, ~230px) is a preview long enough to
// decide by and still shorter than the screen it saves.
const EZIK_FOLD_MIN_CHARS=900;// total prose length past which a completed reply folds
const EZIK_FOLD_HEAD_CHARS=320;// prose shown while it is folded
// One pair of labels for the two places a reply folds — the chat bubble and the favourites card —
// so the two can never drift into saying different things about the same control.
const EZIK_FOLD_SHOW='chat.foldShow';// a translation KEY now, read through ezT()
const EZIK_FOLD_HIDE='chat.foldHide';// a translation KEY now, read through ezT()
function ezikProseLength(segments){let n=0;for(let i=0;i<(segments||[]).length;i++){if(segments[i]&&segments[i].type==='text')n+=String(segments[i].content||'').length;}return n;}// Cut markdown at or before `budget`, on the safest boundary available. The 0.4 floors stop a
// pathological single-paragraph reply (no blank line, no newline) from collapsing to almost
// nothing just because the only boundary found sat near the start.
function ezikFoldCut(src,budget){const t=String(src==null?'':src);if(t.length<=budget)return t;const window=t.slice(0,budget);let at=window.lastIndexOf('\n\n');if(at<budget*0.4){const nl=window.lastIndexOf('\n');if(nl>at)at=nl;}if(at<budget*0.4){const sp=window.lastIndexOf(' ');if(sp>at)at=sp;}let cut=(at>0?window.slice(0,at):window).replace(/\s+$/,'');if(!cut)cut=window;// An odd number of fence lines means the cut fell INSIDE a code block: close it, or every
// following character in the bubble is drawn as code.
if((cut.match(/^\s*```/gm)||[]).length%2===1)cut+='\n```';return cut+' …';}// The folded view, or null when there is nothing worth folding. Null is the signal the bubble
// reads to decide whether the toggle exists at all — a short reply never grows one.
function ezikFoldSegments(segments,minChars,headChars){const list=segments||[];if(ezikProseLength(list)<=minChars)return null;let budget=headChars;let changed=false;const out=[];for(let i=0;i<list.length;i++){const sg=list[i];if(!sg||sg.type!=='text'){out.push(sg);continue;}// every card is kept, always
const body=String(sg.content==null?'':sg.content);// A hidden segment leaves a HOLE rather than closing the gap: the bubble keys its children by
// index, so dropping an entry would renumber every card after it and remount them — a verse
// card would refetch and a dhikr card would re-read its store on every toggle. A null draws
// nothing and keeps all the later indices exactly where the unfolded view has them.
if(budget<=0){changed=true;out.push(null);continue;}if(body.length<=budget){out.push(sg);budget-=body.length;continue;}out.push({type:'text',content:ezikFoldCut(body,budget)});budget=0;changed=true;}return changed?out:null;}// ============================================================
// S98 — الإجراءات السريعة (quick actions under the last completed reply)
// ============================================================
// Five follow-ups, and every one of them is an ORDINARY QUESTION: the label is pressed, the
// sentence below is handed to the SAME sendMessage the composer calls, and from that point the
// turn is indistinguishable from one the child typed. No endpoint, no flag, no depth change, no
// second send path — which is why nothing about the model choice or the sourcing policy moves.
let EZIK_QUICK_ACTIONS=[{key:'simplify',label:ezT('chat.qa.simplify'),prompt:'بسّط لي الإجابة السابقة بكلمات أسهل، مع الحفاظ على المعنى والمصدر الشرعي إن وُجد.'},{key:'example',label:ezT('chat.qa.example'),prompt:'أعطني مثالًا واضحًا ومختصرًا على الإجابة السابقة.'},{key:'quiz',label:ezT('chat.qa.quiz'),prompt:'اختبرني بسؤال واحد عن الإجابة السابقة، ولا تعرض الحل حتى أجيب.'},{key:'shorten',label:ezT('chat.qa.shorten'),prompt:'اختصر الإجابة السابقة في نقاط قصيرة، مع إبقاء المصدر الشرعي الموثق إن وُجد.'},{key:'continue',label:ezT('chat.qa.continue'),prompt:'كمّل الشرح من آخر نقطة، من دون إعادة ما سبق.'}];// A reply the CLIENT wrote to report its own failure is not something to offer «بسّط» under.
// FRIENDLY_ERRORS is the closed table those replies come from, so matching against it is exact
// and needs no marker on the message — which matters, because a marker would change the shape of
// what is stored. (A server-worded day-cap message arrives as an ordinary 200 reply and is by
// design indistinguishable from an answer; the client cannot and does not guess at it.)
const EZIK_ERROR_REPLIES=function(){const out=[];Object.keys(FRIENDLY_ERRORS).forEach(k=>{const b=FRIENDLY_ERRORS[k];if(b&&b.male)out.push(b.male);if(b&&b.female)out.push(b.female);});return out;}();const ezikIsErrorReply=t=>typeof t==='string'&&EZIK_ERROR_REPLIES.indexOf(t.trim())!==-1;// ============================================================
// S98 — اقتباس الرد (quote a reply into the composer)
// ============================================================
// It puts text in the box and moves the caret there. It sends NOTHING, it stores nothing, and it
// leaves whatever the child had already typed exactly where it was.
const EZIK_QUOTE_MAX=500;const EZIK_QUOTE_LABEL='اقتباس';// ITEM 42-أ. The share control speaks through the SAME dictionary the rest of the rail does,
// so a reader who switches the interface language switches this button with everything else.
let EZIK_SHARE_LABEL=ezT("chat.share");let EZIK_SHARE_ARIA=ezT("chat.shareAria");let EZIK_SHARE_COPIED=ezT("common.copied");let EZIK_SHARE_FAIL=ezT("common.copyFailed");let EZIK_QUOTE_ARIA=ezT("chat.quoteAria");function ezikBuildQuote(clean){let t=String(clean==null?'':clean).replace(/\s+/g,' ').trim();if(!t)return'';if(t.length>EZIK_QUOTE_MAX){t=t.slice(0,EZIK_QUOTE_MAX).replace(/\s+\S*$/,'').replace(/\s+$/,'')+' …';}return'« '+t+' »';}// WHERE A QUOTE LANDS. Kept as a pure rule rather than a line buried inside the handler, because
// the one thing it must never do — throw away what the child had already typed — is worth being
// able to state and to test on its own. Existing text is kept and the quotation is appended under
// it after a blank line; an empty box simply receives the quotation.
function ezikComposeWithQuote(prev,block){const had=String(prev==null?'':prev);if(!block)return had;return had.trim()?had.replace(/\s+$/,'')+'\n\n'+block+'\n':block+'\n';}// ============================================================
// S93 — عارض Markdown للعرض فقط (display-only Markdown)
// ============================================================
// The model writes ordinary Markdown — **bold**, ## headings, - lists, ---, | tables — and the
// bubble printed those characters at the child. This turns them into layout instead. It is a
// DISPLAY layer and nothing else: the raw reply is still what is stored, what is sent back as
// history, what the clipboard copies and what the voice reads. Only the JSX changed.
//
// IT NEVER PARSES HTML AND IT NEVER INJECTS ANY. There is no dangerouslySetInnerHTML in it, and
// no path that turns a string into markup: every output is a React element or a string child, so
// anything HTML-shaped in the reply — <script>, an <img onerror=…>, an <iframe> — arrives as a
// TEXT node and is escaped by React exactly as it is today. Markdown's own raw-HTML passthrough
// is deliberately NOT implemented; there is nowhere for model-authored HTML to become an element.
//
// IT RUNS AFTER THE CARDS ARE SEPARATED. parseRichMessage has already lifted every verse, hadith,
// source, dhikr, board, steps and document out into its own card before this is reached, so it
// only ever sees seg.type === 'text' prose and no card body can be reformatted by it.
//
// IT IS SAFE ON A HALF-WRITTEN LINE. While a reply streams, the tail is arbitrary: an unclosed
// **, a table whose delimiter row has not arrived, a heading with no text yet. EVERY rule below
// requires its closing side before it formats anything, so an unfinished construct renders as the
// literal characters it is made of and never swallows the rest of the message.
// The inline rules. Each needs its CLOSING delimiter present, which is what makes a streaming
// tail safe. `pre` names a leading group that is context, not part of the match.
const EZ_MD_INLINE=[// EVERY delimiter must HUG its content: an opener is followed by a non-space and a closer is
// preceded by one. That single rule is what keeps «٥ * ٣ = ١٥ و٢ * ٤ = ٨» as arithmetic instead
// of turning the middle of it into italics — the asterisks there are surrounded by spaces, so
// neither one can open anything.
{re:/`([^`\n]+)`/,tag:'code',literal:true},{re:/\*\*(\S|\S[^\n]*?\S)\*\*/,tag:'strong'},{re:/__(\S|\S[^\n]*?\S)__/,tag:'strong'},{re:/~~(\S|\S[^\n]*?\S)~~/,tag:'del'},// A single * is italic only between word boundaries, so a stray asterisk stays a stray asterisk.
{re:/(^|[\s(\[«"'،؛:.!?؟])\*(\S|\S[^*\n]*?\S)\*(?=$|[\s)\]»"'،؛:.!?؟])/,tag:'em',group:2,pre:1}];// Inline pass: emit the EARLIEST match, recurse into its content, continue after it. Anything the
// rules do not claim is returned as a plain string child, which React escapes.
function ezMdInline(text,keyPrefix){const out=[];let rest=String(text==null?'':text);let k=0;let guard=0;while(rest&&guard++<600){let best=null;for(let i=0;i<EZ_MD_INLINE.length;i++){const rule=EZ_MD_INLINE[i];const mm=rule.re.exec(rest);if(!mm)continue;const at=mm.index+(rule.pre?mm[rule.pre].length:0);if(!best||at<best.at)best={at:at,mm:mm,rule:rule};}if(!best)break;const head=rest.slice(0,best.at);if(head)out.push(head);const rule=best.rule;const inner=best.mm[rule.group||1];const key=keyPrefix+'i'+k++;const consumed=best.mm[0].length-(rule.pre?best.mm[rule.pre].length:0);// Code spans are literal by definition — nothing inside them is a rule.
out.push(React.createElement(rule.tag,{key:key,style:rule.literal?s.mdCode:undefined},rule.literal?inner:ezMdInline(inner,key)));rest=rest.slice(best.at+consumed);}if(rest)out.push(rest);return out;}// One paragraph line, and the <br/> that separates it from the next — a single newline inside a
// paragraph is a line break here, because a reply written for a child means it as one.
function ezMdLines(lines,keyPrefix){const out=[];for(let i=0;i<lines.length;i++){if(i)out.push(React.createElement('br',{key:keyPrefix+'br'+i}));const parts=ezMdInline(lines[i],keyPrefix+'l'+i);for(let j=0;j<parts.length;j++)out.push(parts[j]);}return out;}const EZ_MD_HR=/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;const EZ_MD_HEAD=/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;const EZ_MD_UL=/^(\s*)[-*+]\s+(.*)$/;const EZ_MD_OL=/^(\s*)(\d{1,9})[.)]\s+(.*)$/;const EZ_MD_QUOTE=/^\s*>\s?(.*)$/;const EZ_MD_FENCE=/^\s*```+\s*[A-Za-z0-9+#_-]*\s*$/;// The delimiter row is what PROMOTES a line of pipes into a table. Until it arrives the header
// line is still an ordinary paragraph, which is exactly what a half-streamed table should be.
const EZ_MD_TABLE_SEP=/^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;function ezMdIsBlockStart(line){return!line.trim()||EZ_MD_HR.test(line)||EZ_MD_HEAD.test(line)||EZ_MD_UL.test(line)||EZ_MD_OL.test(line)||EZ_MD_QUOTE.test(line)||EZ_MD_FENCE.test(line);}function ezMdSplitRow(row){let r=String(row).trim();if(r.charAt(0)==='|')r=r.slice(1);if(r.charAt(r.length-1)==='|')r=r.slice(0,-1);return r.split('|').map(c=>c.trim());}// LOGICAL alignment, not physical. The page is RTL, so a leading colon means "the edge the text
// starts at" and a trailing one means "the edge it ends at"; start/end let the direction decide,
// and an undecorated column simply starts where the language starts.
function ezMdAlign(cell){const c=String(cell).trim();const l=c.charAt(0)===':';const r=c.charAt(c.length-1)===':';if(l&&r)return'center';if(r)return'end';return'start';}// A table only exists once the DELIMITER ROW has arrived AND declares the same number of columns
// the header did. Both halves matter: the row is what promotes a line of pipes into a table, and
// the column count is what stops a half-typed «| --» mid-stream from doing it early. Returns the
// parsed header and alignments, or null — and the paragraph gatherer asks the very same question,
// so the two can never disagree about where a table begins.
function ezMdTableAt(lines,i){if(i+1>=lines.length)return null;const head=lines[i];const sep=lines[i+1];if(head.indexOf('|')===-1||sep.indexOf('-')===-1||!EZ_MD_TABLE_SEP.test(sep))return null;const cells=ezMdSplitRow(head);const align=ezMdSplitRow(sep).map(ezMdAlign);if(align.length!==cells.length)return null;return{head:cells,align:align};}// The block pass. Returns an array of React elements — never a string of markup.
function ezMdBlocks(text){const src=String(text==null?'':text).replace(/\r\n?/g,'\n');const lines=src.split('\n');const out=[];let i=0;let key=0;const K=()=>'b'+key++;while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue;}// fenced code — the body is literal, and an unclosed fence still renders what has arrived
if(EZ_MD_FENCE.test(line)){const body=[];i++;while(i<lines.length&&!EZ_MD_FENCE.test(lines[i])){body.push(lines[i]);i++;}if(i<lines.length)i++;const k=K();out.push(React.createElement('pre',{key:k,style:s.mdPre},React.createElement('code',null,body.join('\n'))));continue;}if(EZ_MD_HR.test(line)){out.push(React.createElement('hr',{key:K(),style:s.mdHr}));i++;continue;}const h=line.match(EZ_MD_HEAD);if(h){const lvl=h[1].length;const k=K();out.push(React.createElement('div',{key:k,style:lvl<=1?s.mdH1:lvl===2?s.mdH2:s.mdH3,role:'heading','aria-level':lvl},ezMdInline(h[2],k)));i++;continue;}// table — only once the delimiter row confirms it
const tbl=ezMdTableAt(lines,i);if(tbl){const head=tbl.head;const align=tbl.align;i+=2;const rows=[];while(i<lines.length&&lines[i].trim()&&lines[i].indexOf('|')!==-1&&!EZ_MD_HR.test(lines[i])){rows.push(ezMdSplitRow(lines[i]));i++;}const k=K();out.push(React.createElement('div',{key:k,style:s.mdTableWrap},React.createElement('table',{style:s.mdTable},React.createElement('thead',null,React.createElement('tr',null,head.map((c,j)=>React.createElement('th',{key:j,style:Object.assign({},s.mdTh,{textAlign:align[j]||'right'})},ezMdInline(c,k+'h'+j))))),React.createElement('tbody',null,rows.map((r,ri)=>React.createElement('tr',{key:ri},head.map((_,j)=>React.createElement('td',{key:j,style:Object.assign({},s.mdTd,{textAlign:align[j]||'right'})},ezMdInline(r[j]==null?'':r[j],k+'r'+ri+'c'+j)))))))));continue;}// blockquote
if(EZ_MD_QUOTE.test(line)){const body=[];while(i<lines.length&&EZ_MD_QUOTE.test(lines[i])){body.push(lines[i].match(EZ_MD_QUOTE)[1]);i++;}const k=K();out.push(React.createElement('div',{key:k,style:s.mdQuote},ezMdLines(body,k)));continue;}// lists — a following indented line continues the item it belongs to
if(EZ_MD_UL.test(line)||EZ_MD_OL.test(line)){// A line begins with either a digit or a bullet, never both, so the two cannot disagree.
const isOrdered=EZ_MD_OL.test(line);const items=[];const startAt=isOrdered?parseInt(line.match(EZ_MD_OL)[2],10):1;while(i<lines.length){const cur=lines[i];const mu=cur.match(EZ_MD_UL);const mo=cur.match(EZ_MD_OL);const sameKind=isOrdered?!!mo&&!mu:!!mu;if(sameKind){items.push([isOrdered?mo[3]:mu[2]]);i++;continue;}if(items.length&&cur.trim()&&/^\s{2,}/.test(cur)&&!ezMdIsBlockStart(cur)){items[items.length-1].push(cur.trim());i++;continue;}break;}const k=K();out.push(React.createElement(isOrdered?'ol':'ul',{key:k,style:isOrdered?s.mdOl:s.mdUl,start:isOrdered&&startAt!==1?startAt:undefined},items.map((it,ii)=>React.createElement('li',{key:ii,style:s.mdLi},ezMdLines(it,k+'i'+ii)))));continue;}// paragraph — everything up to a blank line or the start of another block
const para=[line];i++;while(i<lines.length&&lines[i].trim()&&!ezMdIsBlockStart(lines[i])&&!ezMdTableAt(lines,i)){para.push(lines[i]);i++;}const k=K();out.push(React.createElement('div',{key:k,style:s.mdP},ezMdLines(para,k)));}return out;}// The component the bubble renders. Memoised on the string, because the whole thread re-renders
// on every streaming delta and a settled reply must not be re-parsed for each one.
const EzikMarkdown=React.memo(function EzikMarkdown({text}){const t=String(text==null?'':text);if(!t.trim())return null;const blocks=ezMdBlocks(t);if(!blocks.length)return null;return React.createElement(React.Fragment,null,blocks);});// THE ONE PLACE A SEGMENT BECOMES AN ELEMENT.
// Lifted out of MessageBubble in S98 so the favourites screen can show a saved reply through the
// EXACT renderer the chat uses. A second, parallel renderer there is what would eventually leak a
// raw <verse …> at a reader — this makes that impossible by construction, because there is only
// one mapping and both callers go through it. Behaviour is byte-identical to the map it replaces:
// same components, same props, same index keys, same null for a folded-away prose segment.
// The JSX below is byte-for-byte the map it replaces, down to the names `tashkeel`, `age`,
// `onPlayVerse`, `onPlaySurah` and `onStopAudio` — which is deliberate. markdown-guard pins the
// exact form of the prose site and counts the display sites of EzikMarkdown; keeping the shape
// identical means this refactor moves the code without loosening a single thing that gate holds.
function ezikRenderSegments(segments,ctx){const{tashkeel,age,onPlayVerse,onPlaySurah,onStopAudio,onFavoriteAyah,ayahFavIds}=ctx||{};return(segments||[]).map((seg,i)=>{if(!seg)return null;// S98: a folded-away prose segment, holding its index open
if(seg.type==='text'){// S93: PROSE ONLY, and the last thing that happens to it. The cards were separated above,
// the tashkeel toggle has already had its say (it removes diacritics and touches no Markdown
// character), and what remains is turned into layout for the eye. seg.content itself is
// untouched — the clipboard, the voice and the stored thread all still read the raw text,
// which is why an old saved conversation formats too: the formatting is computed here, at
// display, from text that was never rewritten.
// S99: `ez-prose` marks THE prose of a reply — the one surface reading mode opens up. Cards
// do not carry it, so an ayah, a hadith and a source keep their own measured spacing.
return/*#__PURE__*/React.createElement("div",{key:i,className:"ez-prose",style:s.bubbleText},/*#__PURE__*/React.createElement(EzikMarkdown,{text:tashkeel?seg.content:stripTashkeelOutsideQuran(seg.content)}));}if(seg.type==='verse'){return/*#__PURE__*/React.createElement(VerseCard,{key:i,surah:seg.surah,surahNum:seg.surahNum,ayah:seg.ayah,onPlayVerse:onPlayVerse,onStopAudio:onStopAudio,onFavorite:onFavoriteAyah,isFavorite:!!(ayahFavIds&&onFavoriteAyah&&ayahFavIds.has(ezikAyahFavKey(seg.surahNum,seg.surah,seg.ayah)))});}if(seg.type==='surah'){return/*#__PURE__*/React.createElement(SurahCard,{key:i,num:seg.num,from:seg.from,to:seg.to,onPlaySurah:onPlaySurah,onStopAudio:onStopAudio});}if(seg.type==='hadith'){return/*#__PURE__*/React.createElement(HadithCard,{key:i,content:seg.content,narrator:seg.narrator,ruling:seg.ruling});}if(seg.type==='source'){return/*#__PURE__*/React.createElement(SourceCard,{key:i,site:seg.site,url:seg.url,content:seg.content});}if(seg.type==='dhikr'){return/*#__PURE__*/React.createElement(DhikrCard,{key:i,catId:seg.catId});}if(seg.type==='worship'){return/*#__PURE__*/React.createElement(WorshipCard,{key:i,id:seg.id,band:deriveCaps(age).band});}if(seg.type==='steps'){return/*#__PURE__*/React.createElement(StepsCard,{key:i,items:seg.items,title:seg.title});}if(seg.type==='board'){return/*#__PURE__*/React.createElement(BoardCard,{key:i,content:seg.content});}if(seg.type==='document'){return/*#__PURE__*/React.createElement(DocumentCard,{key:i,title:seg.title,content:seg.content,age:age});}if(seg.type==='notice'){return/*#__PURE__*/React.createElement(ReviewNotice,{key:i,label:seg.label,content:seg.content});}return null;});}// S98 PERF: MEMOISED. Every prop below is either a primitive, the message object itself (whose
// identity the thread preserves across a re-render) or a callback App pins to one identity — so a
// keystroke in the composer re-renders the composer and NOT the thread. See the note beside the
// pinned callbacks in App for the measurement that made this necessary.
const MessageBubble=React.memo(function MessageBubble({message,index,onSuggestionClick,onPlayVerse,onPlaySurah,onStopAudio,onPlayMessage,age,onReport,tashkeel,onToggleTashkeel,onQuote,onFavorite,isFavorite,onFavoriteAyah,ayahFavIds,defaultOpen,foldEpoch}){const isUser=message.role==='user';// S97 PERF. This parse used to run on EVERY render of EVERY assistant bubble, and the chat's
// composer state lives on App -- so a single keystroke re-parsed the whole thread. On a 120-turn
// conversation that was ~60 full re-parses per typed character, and nothing about them changed.
// parseRichMessage is a pure function of exactly the two inputs in the dependency list: it reads
// the text and the viewer's age band and returns segment DESCRIPTORS. It touches no store. The
// cards that DO read stores (dhikr, worship, verse) are separate components below and still
// re-render and re-read on every pass, exactly as before -- so the D91 note further down ("the
// stores the cards read are still filling while this runs") is untouched by caching descriptors.
// TWO things about the shape of this, both load-bearing:
//   - it sits ABOVE the isUser early return, because bubbles are keyed by INDEX: React reuses
//     the instance at index i across conversations, and if the role at that index flips
//     user<->assistant a hook below the return would change the hook COUNT and React would throw.
//   - it still must not RUN for a user bubble: a user turn carrying an attachment has an ARRAY
//     content, and parseRichMessage calls text.search() before its own typeof guard, so parsing
//     one would throw. The branch is inside the callback, so the hook stays unconditional.
const{segments,suggestions}=React.useMemo(()=>isUser?{segments:[],suggestions:[]}:parseRichMessage(message.content,age),[isUser,message.content,age]);// S98 THE FOLD. Two hooks, both unconditional and both ABOVE the isUser return, for the same
// reason the memo above is: bubbles are keyed by index, so React reuses the instance at index i
// when a conversation is replaced, and a hook below the return would change the hook COUNT the
// moment the role at that index flipped.
//
// WHERE THE FOLD STARTS is App's to say (`defaultOpen`): a reply that just finished streaming in
// this thread opens EXPANDED, everything else opens folded. WHAT THE USER DID TO IT since is
// this component's to remember, and it overrides the default in either direction — so the button
// works on a streamed reply exactly as it does on a restored one.
//
// The override carries the THREAD EPOCH as its key. Bubbles are keyed by index, so React reuses
// the instance at index i whenever the thread is replaced; without a key, a reply the reader had
// expanded would hand that state to whatever reply later occupied the slot — and, since a
// reopened conversation holds the very same text at the very same index, a text key could not
// tell the two apart either. The epoch can: it changes on exactly the two events that replace a
// thread. Everything else appends, so an epoch that has not changed means the same thread. It is
// UI state and it is deliberately not stored: reopening the app folds every long reply again.
const[foldOverride,setFoldOverride]=React.useState(null);// { epoch, open } | null
const foldView=React.useMemo(()=>isUser?null:ezikFoldSegments(segments,EZIK_FOLD_MIN_CHARS,EZIK_FOLD_HEAD_CHARS),[isUser,segments]);// S112: THE TWO TURNS ARE DIFFERENT STRUCTURES, not two colours of one. A user turn is a
// COMPACT card held to one side of the column and to a fraction of its width -- it is a thing
// said, and it is short. An assistant turn is a full-measure READING SHEET, stretched across
// the whole column with room for prose, cards and the sources beneath them. The two are told
// apart by shape at a glance, with the page reversed or the colours inverted.
if(isUser){const c=message.content;if(Array.isArray(c)){const imgBlock=c.find(b=>b&&b.type==='image');const txtBlock=c.find(b=>b&&b.type==='text');return/*#__PURE__*/React.createElement("div",{className:"ezc-turn is-user"},/*#__PURE__*/React.createElement("div",{className:"ez-anim",style:{...s.messageBubble,...s.userBubble,animation:'fadeIn 0.3s ease-out'}},imgBlock&&/*#__PURE__*/React.createElement("img",{src:`data:${imgBlock.source.media_type};base64,${imgBlock.source.data}`,style:{maxWidth:'100%',borderRadius:10,marginBottom:txtBlock?8:0,display:'block'}}),txtBlock&&txtBlock.text));}return/*#__PURE__*/React.createElement("div",{className:"ezc-turn is-user"},/*#__PURE__*/React.createElement("div",{className:"ez-anim",style:{...s.messageBubble,...s.userBubble,animation:'fadeIn 0.3s ease-out'}},c));}// رسالة الأستاذ: بطاقاتها مفصولةٌ أعلاه قبل أن يعمل عارضُ Markdown
// D90: the clipboard carries EVERY rendered block, in display order. D91: it is built on the
// TAP, not here, because the stores the cards read are still filling while this runs.
const buildCopyText=()=>serializeReply(segments,{tashkeel,band:deriveCaps(age).band});// ITEM 42-C: the card is handed the source footer by the module-level reader below, beside
// the writer that already renders sources into the copy payload. THIS component does not
// filter, re-order or count them -- N22 pins that, and a share card is no reason to weaken it.
const buildCardSource=()=>ezikCardSourceLine(segments);// S98: the fold decides only what is DRAWN. buildCopyText above, the listen button below and
// every export path all read `segments` / message.content — the WHOLE reply — so a folded reply
// is copied, spoken and exported in full.
const canFold=!!foldView;const overrideActive=!!foldOverride&&foldOverride.epoch===foldEpoch;const foldOpen=canFold&&(overrideActive?foldOverride.open:!!defaultOpen);const shownSegments=canFold&&!foldOpen?foldView:segments;return/*#__PURE__*/React.createElement("div",{className:"ez-anim",style:{animation:'fadeIn 0.3s ease-out',display:'flex',flexDirection:'column',alignItems:'stretch',gap:8,maxWidth:'100%'}},/*#__PURE__*/React.createElement("div",{className:"ezc-ans",style:{...s.assistantBubble,maxWidth:'100%',/* 13.4-b2 */padding:'16px 18px',display:'flex',flexDirection:'column',gap:10}},ezikRenderSegments(shownSegments,{tashkeel,age,onPlayVerse,onPlaySurah,onStopAudio,onFavoriteAyah,ayahFavIds}),canFold&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>setFoldOverride({epoch:foldEpoch,open:!foldOpen}),"aria-expanded":foldOpen?'true':'false',"aria-label":ezT(foldOpen?EZIK_FOLD_HIDE:EZIK_FOLD_SHOW),className:"ezik-focus",style:s.foldToggle},/*#__PURE__*/React.createElement("span",null,ezT(foldOpen?EZIK_FOLD_HIDE:EZIK_FOLD_SHOW)),/*#__PURE__*/React.createElement("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",style:{flexShrink:0,transform:foldOpen?'rotate(180deg)':'none'}},/*#__PURE__*/React.createElement("polyline",{points:"6 9 12 15 18 9"})))),/*#__PURE__*/React.createElement("div",{className:"ezc-acts",style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'flex-start',padding:'0 2px'}},/*#__PURE__*/React.createElement(MessageListenButton,{text:message.content,onPlayMessage:onPlayMessage,onStopAudio:onStopAudio}),/*#__PURE__*/React.createElement(CopyReplyButton,{text:String(message.content||'').trim(),getText:buildCopyText}),/*#__PURE__*/React.createElement(ShareReplyButton,{getText:buildCopyText}),/*#__PURE__*/React.createElement(ExportPdfReplyButton,{getText:buildCopyText}),/*#__PURE__*/React.createElement(SaveReplyImageButton,{getText:buildCopyText,getSource:buildCardSource}),onQuote&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>onQuote(buildCopyText()),"aria-label":EZIK_QUOTE_ARIA,className:"ezik-focus",style:miniBtnStyle},EZIK_QUOTE_LABEL),onFavorite&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>onFavorite(message,index),"aria-pressed":isFavorite?'true':'false',"aria-label":isFavorite?EZIK_FAV_DEL:EZIK_FAV_ADD,className:"ezik-focus",style:{...miniBtnStyle,opacity:isFavorite?1:0.7,borderColor:isFavorite?'var(--red)':'var(--line)',color:isFavorite?'var(--red)':'inherit'}},/*#__PURE__*/React.createElement("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:isFavorite?'currentColor':'none',stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M12 17.3l-5.4 3 1-6-4.4-4.3 6-.9L12 3.5l2.8 5.6 6 .9-4.4 4.3 1 6z"}))),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onToggleTashkeel,"aria-label":'\u062A\u0634\u0643\u064A\u0644',style:{...miniBtnStyle,opacity:tashkeel?1:0.7,borderColor:tashkeel?'var(--red)':'var(--line)'}},'\u062A\u0634\u0643\u064A\u0644'),/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>onReport&&onReport(index),"aria-label":ezT("chat.report"),style:{display:'inline-flex',alignItems:'center',gap:5,background:'transparent',color:'var(--muted)',border:'1px solid var(--line)',borderRadius:8,padding:'4px 10px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}},/*#__PURE__*/React.createElement("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"}),/*#__PURE__*/React.createElement("line",{x1:"4",y1:"22",x2:"4",y2:"15"})),/*#__PURE__*/React.createElement("span",null,"بلّغ"))),suggestions&&suggestions.length>0&&/*#__PURE__*/React.createElement("div",{style:s.suggestionsInline},suggestions.map((sg,i)=>/*#__PURE__*/React.createElement("button",{key:i,onClick:()=>onSuggestionClick&&onSuggestionClick(sg),style:s.suggestionChipSmall},sg))));});// ============================================================
// S98 — شاشة المفضلة (the favourites screen)
// ============================================================
// It draws ONLY what it is handed: the records, and the set of conversation ids that still exist.
// It reads no store, parses no JSON and owns no copy of anything — so it cannot disagree with the
// menu badge, and a record whose conversation was deleted is a data question answered before this
// component is reached rather than a crash inside it.
//
// A saved reply is drawn through ezikRenderSegments, the SAME renderer the chat bubble uses, so
// its ayah, hadith and source card appear here exactly as they did in the conversation and no raw
// tag can reach the reader by a second path.
// One saved reply's body, and it folds exactly as the chat bubble does — through the same
// ezikFoldSegments and the same toggle. Without it a single long favourite filled several screens
// and pushed its own copy/remove/open buttons far below the fold, which made the list unusable at
// the one length that most needs saving.
function FavoriteReplyBody({segments,age,tashkeel}){const[open,setOpen]=useState(false);const folded=React.useMemo(()=>ezikFoldSegments(segments,EZIK_FOLD_MIN_CHARS,EZIK_FOLD_HEAD_CHARS),[segments]);const shown=folded&&!open?folded:segments;return/*#__PURE__*/React.createElement("div",{style:{display:'flex',flexDirection:'column',gap:10}},ezikRenderSegments(shown,{tashkeel,age}),folded&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>setOpen(!open),"aria-expanded":open?'true':'false',"aria-label":ezT(open?EZIK_FOLD_HIDE:EZIK_FOLD_SHOW),className:"ezik-focus",style:{...s.foldToggle,alignSelf:'flex-start'}},/*#__PURE__*/React.createElement("span",null,ezT(open?EZIK_FOLD_HIDE:EZIK_FOLD_SHOW))));}// S114: the same component, on istana chrome. It is handed the SAME props, in the SAME order the
// owner already computed them, and it still reads no store, parses no JSON and owns no copy of
// anything. `items` is mapped once, exactly as it arrives -- there is no sort, no filter, no
// slice and no reverse anywhere on this screen; the newest-first order is myFavs' and the search
// order is ezikSearchFavs'. Nothing below writes a byte.
//
// THE RAIL's back control is the shipped one: same handler, same visible «← رجوع», so the name a
// reader hears and the target a test clicks are both unchanged. The MASTHEAD is small and it is
// useful -- it holds the one control this screen has. The CATALOGUE is .ezfav-cat in <style>: the
// column count is the only thing the viewport decides, and every card keeps its own height.
// Item 86: THE FOUR TABS, as their own component. A record now has a kind, and this is where the
// reader uses it. «الكل» is the opening state, so المفضلة still opens on everything a reader has
// ever saved and the filter is a narrowing, never a wall. A tab with nothing in it is still
// shown, with its zero, rather than hidden -- a tab that appears only once it has content
// teaches nothing about where a saved fatwa goes.
//
// It is a component and not an inline block for a plain reason: FavoritesScreen is read by two
// guards that measure the DISTANCE from its opening line to the first card it draws, and a
// twenty-line control spliced into the middle of it makes that screen look like it grew a
// second job. It has not: this maps four constants and calls the handler it is given.
// Item 86: WHAT A CARD SAYS IT IS. A reply says nothing -- it is what this screen has always
// held and needs no label. A fatwa and an ayah say their kind and then their own heading: the
// fatwa its title, the ayah its سورة/آية. That heading is the thing a reply gets from its
// conversation, and these two have to carry for themselves.
function EzikFavKindNote({f}){const kind=ezikKindOf(f);if(kind==='reply')return null;return/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{style:s.ezistMeta},ezT('favorites.kind.'+kind)),f.title||f.ref?/*#__PURE__*/React.createElement("div",{style:s.favMeta},f.title||f.ref):null);}function EzikFavKindTabs({kind,onKind,counts}){return/*#__PURE__*/React.createElement("div",{style:s.themeRow,role:"radiogroup","aria-label":ezT('favorites.kindAria')},[['all',ezT('favorites.kind.all')],['reply',ezT('favorites.kind.reply')],['fatwa',ezT('favorites.kind.fatwa')],['ayah',ezT('favorites.kind.ayah')]].map(([v,label])=>/*#__PURE__*/React.createElement("button",{key:v,type:"button",role:"radio","aria-checked":kind===v?'true':'false',onClick:()=>onKind(v),className:"ezik-focus",style:{...s.a11yOpt,...(kind===v?s.themeOptActive:{})}},label," ",toArabicDigits(counts&&counts[v]||0))));}function FavoritesScreen({items,liveChatIds,onBack,onOpenChat,onRemove,age,tashkeel,query,onQuery,searching,total,kind,onKind,counts}){return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezfav",style:s.favScreen},/*#__PURE__*/React.createElement("div",{className:"ezfav-rail"},/*#__PURE__*/React.createElement("div",{className:"ezfav-rail-inner"},/*#__PURE__*/React.createElement("button",{onClick:onBack,className:"ezfav-back ezik-focus"},EZIK_BACK),/*#__PURE__*/React.createElement("span",{className:"ezfav-brand"},/*#__PURE__*/React.createElement("span",{className:"ezfav-brand-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{className:"ezfav-brand-text"},EZIK_FAV_HEADING)))),/*#__PURE__*/React.createElement("div",{style:s.favBody},/*#__PURE__*/React.createElement("div",{className:"ezfav-wrap"},total>0&&/*#__PURE__*/React.createElement("div",{className:"ezfav-masthead"},/*#__PURE__*/React.createElement("span",{className:"ezfav-crest","aria-hidden":"true"}),/*#__PURE__*/React.createElement(EzikFavKindTabs,{kind:kind,onKind:onKind,counts:counts}),/*#__PURE__*/React.createElement("div",{className:"ezfav-mast-field"},/*#__PURE__*/React.createElement("input",{type:"search",value:query,onChange:e=>onQuery(e.target.value),placeholder:EZIK_FAV_SEARCH_PH,"aria-label":EZIK_FAV_SEARCH_ARIA,className:"ezik-focus",style:s.drawerSearch}))),total===0&&/*#__PURE__*/React.createElement("div",{className:"ezfav-empty"},/*#__PURE__*/React.createElement("span",{className:"ezfav-empty-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{className:"ezfav-empty-in"})),ezLangGet()==='ar'?/*#__PURE__*/React.createElement("div",{className:"ezfav-empty-text"},EZIK_FAV_EMPTY):/*#__PURE__*/React.createElement("div",{className:"ezfav-empty-text"},ezT('favorites.empty'))),total>0&&searching&&items.length===0&&/*#__PURE__*/React.createElement("div",{style:s.drawerEmpty},EZIK_SEARCH_NONE),/*#__PURE__*/React.createElement("div",{className:"ezfav-cat"},items.map(f=>{const parsed=parseRichMessage(f.text,age);const alive=!!f.chatId&&liveChatIds.has(f.chatId);const when=ezikFavDate(f.at);return/*#__PURE__*/React.createElement("div",{key:f.id,className:"ezfav-card",style:s.favCard},/*#__PURE__*/React.createElement("div",{className:"ezfav-head"},/*#__PURE__*/React.createElement("span",{className:"ezfav-head-mark","aria-hidden":"true"}),when&&/*#__PURE__*/React.createElement("div",{style:s.favMeta},when)),/*#__PURE__*/React.createElement(EzikFavKindNote,{f:f}),/*#__PURE__*/React.createElement("div",{className:"ezfav-read"},/*#__PURE__*/React.createElement(FavoriteReplyBody,{segments:parsed.segments,age:age,tashkeel:tashkeel})),/*#__PURE__*/React.createElement("div",{className:"ezfav-foot",style:s.favRow},/*#__PURE__*/React.createElement(CopyReplyButton,{text:String(f.text||'').trim(),getText:()=>serializeReply(parsed.segments,{tashkeel,band:deriveCaps(age).band})}),/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>onRemove(f.id),"aria-label":EZIK_FAV_DEL,className:"ezik-focus",style:s.favBtn},EZIK_FAV_REMOVE),ezikKindOf(f)!=='reply'?null:alive?/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>onOpenChat(f.chatId),"aria-label":EZIK_FAV_OPEN_CHAT,className:"ezik-focus",style:s.favBtn},EZIK_FAV_OPEN_CHAT):/*#__PURE__*/React.createElement("span",{style:{...s.favBtn,...s.favBtnOff}},EZIK_FAV_CHAT_GONE)));})))));}// Flag-a-reply modal (step 2b). Copies AdultGate's overlay+card pattern (the app's one existing
// floating popup) so there is no second modal idiom. The four reason keys below are the server's
// literal keys -- labels are shown, keys are sent. The result text is honest: only a real 200 says
// "delivered"; a 429 or any other outcome says it did NOT arrive (the server fails closed on
// purpose, and the client must not paper over that with a false smile).
function ReportModal({onClose,onSubmit}){const[reason,setReason]=useState('');const[note,setNote]=useState('');const[status,setStatus]=useState('idle');// idle | sending | ok | rate | fail
const REASON_OPTIONS=[{key:'wrong_info',label:'معلومةٌ خاطئة'},{key:'wrong_ruling',label:'حكمٌ شرعيٌّ خاطئ'},{key:'inappropriate',label:'محتوًى غيرُ مناسب'},{key:'other',label:'شيءٌ آخر'}];const send=async()=>{if(!reason||status==='sending')return;setStatus('sending');const r=await onSubmit(reason,note);setStatus(r);};const overlay={position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'rgba(30,30,30,0.6)'};if(status==='ok'){return/*#__PURE__*/React.createElement("div",{style:overlay},/*#__PURE__*/React.createElement("div",{style:{...s.onboardingCard,maxWidth:360}},/*#__PURE__*/React.createElement("div",{style:s.bigEmoji},"✅"),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},"وصل بلاغُك. شكرًا لك."),/*#__PURE__*/React.createElement("button",{onClick:onClose,style:s.primaryBtn},"إغلاق")));}return/*#__PURE__*/React.createElement("div",{style:overlay},/*#__PURE__*/React.createElement("div",{style:{...s.onboardingCard,maxWidth:360}},/*#__PURE__*/React.createElement("div",{style:s.bigEmoji},"🚩"),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},"بلّغ عن هذا الردّ"),/*#__PURE__*/React.createElement("div",{style:s.onboardingSubtitle},"اختر السبب، وأضِف ملاحظةً إن شئت."),/*#__PURE__*/React.createElement("div",{style:{display:'flex',flexDirection:'column',gap:8,width:'100%',margin:'4px 0 10px'}},REASON_OPTIONS.map(o=>/*#__PURE__*/React.createElement("button",{key:o.key,type:"button",onClick:()=>setReason(o.key),style:{textAlign:'right',padding:'10px 14px',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:15,border:reason===o.key?'1px solid var(--red)':'1px solid var(--line)',background:reason===o.key?'var(--tint)':'var(--white)',color:'var(--ink)'}},o.label))),/*#__PURE__*/React.createElement("textarea",{value:note,onChange:e=>setNote(e.target.value),maxLength:500,rows:3,placeholder:"ملاحظة (اختياري)",style:{...s.onboardingInput,resize:'none',textAlign:'right',marginBottom:12}}),status==='rate'&&/*#__PURE__*/React.createElement("div",{style:{color:'var(--ink)',fontSize:14,marginBottom:10}},"أرسلتَ بلاغاتٍ كثيرةً الآن. حاول بعد قليل."),status==='fail'&&/*#__PURE__*/React.createElement("div",{style:{color:'var(--ink)',fontSize:14,marginBottom:10}},"لم يصل بلاغُك. حاول لاحقًا."),/*#__PURE__*/React.createElement("button",{onClick:send,disabled:!reason||status==='sending',style:{...s.primaryBtn,opacity:!reason||status==='sending'?0.5:1}},status==='sending'?'…':'أرسِل'),/*#__PURE__*/React.createElement("button",{onClick:onClose,style:{background:'none',border:'none',color:'var(--muted)',fontSize:14,marginTop:10,cursor:'pointer',fontFamily:'inherit'}},"إلغاء")));}// Item 86: the ayah is savable in its own right. `onFavorite` and `isFavorite` are handed
// DOWN, exactly as the reply star is -- this component reads no store and scans no list. The
// controls simply do not render when no handler is given, which is what keeps the card inside
// المفضلة itself from offering to save what is already saved.
function VerseCard({surah,surahNum,ayah,onPlayVerse,onStopAudio,onFavorite,isFavorite}){const[playing,setPlaying]=useState(false);const[audioFailed,setAudioFailed]=useState(false);// نصّ الآية يأتي حصراً من المصحف الكنسي المُحمَّل، لا من النموذج.
const[verseText,setVerseText]=useState('');const[textState,setTextState]=useState('loading');// loading | ok | fail
const audioRef=useRef(null);// fallback محلي فقط (إن لم تُمرَّر دوال المنسِّق)
const sNum=resolveSurahNumber(surah,surahNum);const aNum=parseInt(ayah,10);const canPlay=!!sNum&&aNum>=1;const surahName=surah||(sNum?SURAH_NAMES[sNum]:'');const pad3=x=>String(x).padStart(3,'0');const audioUrl=canPlay?`https://everyayah.com/data/${QURAN_RECITER}/${pad3(sNum)}${pad3(aNum)}.mp3`:null;// جلب نصّ الآية الكنسي مرة واحدة (مُخزَّن في الذاكرة). عند الفشل: لا نصّ —
// نعرض المرجع وزرّ التلاوة فقط، ولا نقع أبداً على نصّ النموذج أو ترميز خام.
useEffect(()=>{let alive=true;if(!canPlay){setTextState('fail');return;}loadQuran().then(()=>{if(!alive)return;const t=getVerseText(sNum,aNum);if(t){setVerseText(t);setTextState('ok');}else{setTextState('fail');}}).catch(()=>{if(alive)setTextState('fail');});return()=>{alive=false;};},[sNum,aNum,canPlay]);// إيقاف صوت fallback المحلي وتنظيفه عند إزالة البطاقة
useEffect(()=>()=>{if(audioRef.current){audioRef.current.pause();audioRef.current=null;}},[]);// إعادة تشغيل يدوية — عبر منسِّق App: يُوقف كلام المربّي أولاً ثم يُعيد التلاوة.
// الزر الآن «تكرار» يدوي؛ التلاوة تُشغَّل تلقائياً ضمن تسلسل الردّ في App.
const togglePlay=()=>{// مسار المنسِّق الموحَّد (الاستخدام الفعلي في المحادثة)
if(onPlayVerse){if(playing){if(onStopAudio)onStopAudio();setPlaying(false);return;}setAudioFailed(false);setPlaying(true);Promise.resolve(onPlayVerse(sNum,aNum)).then(res=>{setPlaying(false);if(res&&res.failed)setAudioFailed(true);}).catch(()=>{setPlaying(false);setAudioFailed(true);});return;}// fallback محلي (لو رُكِّبت البطاقة خارج المحادثة بدون دوال المنسِّق)
setAudioFailed(false);if(!audioRef.current){const audio=new Audio(audioUrl);audio.onended=()=>setPlaying(false);audio.onerror=()=>{setPlaying(false);setAudioFailed(true);};audioRef.current=audio;}const audio=audioRef.current;if(playing){audio.pause();setPlaying(false);}else{setPlaying(true);const p=audio.play();if(p&&p.catch)p.catch(()=>{setPlaying(false);setAudioFailed(true);});}};return/*#__PURE__*/React.createElement("div",{style:s.verseCard},/*#__PURE__*/React.createElement("div",{style:s.verseCardLabel},/*#__PURE__*/React.createElement("span",null,"قَالَ اللهُ تَعَالَى")),textState==='ok'&&/*#__PURE__*/React.createElement("div",{style:s.verseText},verseText),/*#__PURE__*/React.createElement("div",{style:s.verseFooter},(surahName||ayah)&&/*#__PURE__*/React.createElement("div",{style:s.verseMeta},surahName&&`سورة ${surahName}`,surahName&&ayah&&'، ',ayah&&`آية ${ayah}`),onFavorite&&textState==='ok'&&/*#__PURE__*/React.createElement("button",{type:"button",className:"ezik-focus","aria-pressed":isFavorite?'true':'false',"aria-label":isFavorite?ezT('favorites.remove'):ezT('favorites.addAyah'),onClick:()=>onFavorite({surah:surahName,surahNum:sNum,ayah:aNum,text:verseText}),style:{...s.versePlayBtn,opacity:isFavorite?1:0.75}},/*#__PURE__*/React.createElement("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:isFavorite?'currentColor':'none',stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M12 17.3l-5.4 3 1-6-4.4-4.3 6-.9L12 3.5l2.8 5.6 6 .9-4.4 4.3 1 6z"})),/*#__PURE__*/React.createElement("span",null,isFavorite?ezT('favorites.saved'):ezT('favorites.addAyah'))),canPlay&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:togglePlay,style:s.versePlayBtn,"aria-label":playing?'إيقاف التلاوة':'تشغيل التلاوة'},playing?/*#__PURE__*/React.createElement(PauseIcon,{size:14}):/*#__PURE__*/React.createElement(PlayIcon,{size:14}),/*#__PURE__*/React.createElement("span",null,playing?'إيقاف':'استمع للتلاوة'))),audioFailed&&/*#__PURE__*/React.createElement("div",{style:s.verseAudioError},"تعذّر تحميل التلاوة"));}// بطاقة السورة الكاملة (أو مدًى متّصل): نصّ واحد متّصل بأرقام آيات ۝، وزرّ تلاوة واحد.
// النصّ من المصحف الكنسي حصراً؛ عند الفشل نعرض الاسم والمدى فقط (لا نصّ نموذج ولا ترميز خام).
function SurahCard({num,from,to,onPlaySurah,onStopAudio}){const[playing,setPlaying]=useState(false);const[audioFailed,setAudioFailed]=useState(false);const[body,setBody]=useState('');const[state,setState]=useState('loading');// loading | ok | fail
const[range,setRange]=useState({from:0,to:0,whole:false});const sNum=resolveSurahNumber(undefined,num);const surahName=sNum?SURAH_NAMES[sNum]:'';useEffect(()=>{let alive=true;if(!sNum){setState('fail');return;}loadQuran().then(()=>{if(!alive)return;const count=getSurahAyahCount(sNum);if(!count){setState('fail');return;}let f=parseInt(from,10);if(!(f>=1))f=1;let t=parseInt(to,10);if(!(t>=1)||t>count)t=count;if(f>t){setState('fail');return;}setRange({from:f,to:t,whole:f===1&&t===count});const pieces=[];// البسملة (للسورة كاملة من الآية ١) — غير مرقّمة، إلا الفاتحة (آية ١) والتوبة (لا بسملة).
// نُعيد استخدام نصّ البسملة الكنسي getVerseText(1,1) — لا نكتب نصّاً قرآنياً يدوياً.
if(f===1&&sNum!==1&&sNum!==9){const basmala=getVerseText(1,1);if(basmala)pieces.push(basmala);}let missing=false;for(let a=f;a<=t;a++){const vt=getVerseText(sNum,a);if(!vt){missing=true;break;}pieces.push(`${vt} ۝${toArabicDigits(a)}`);// آية + رقمها داخل زخرفة نهاية الآية
}if(missing){setState('fail');return;}setBody(pieces.join(' '));setState('ok');}).catch(()=>{if(alive)setState('fail');});return()=>{alive=false;};},[sNum,from,to]);const metaLabel=!surahName?'':range.whole?`سورة ${surahName}`:range.from?`سورة ${surahName}، الآيات ${toArabicDigits(range.from)}–${toArabicDigits(range.to)}`:`سورة ${surahName}`;const togglePlay=()=>{if(!onPlaySurah)return;if(playing){if(onStopAudio)onStopAudio();setPlaying(false);return;}setAudioFailed(false);setPlaying(true);Promise.resolve(onPlaySurah(sNum,range.from||1,range.to||null)).then(res=>{setPlaying(false);if(res&&res.failed)setAudioFailed(true);}).catch(()=>{setPlaying(false);setAudioFailed(true);});};return/*#__PURE__*/React.createElement("div",{style:s.verseCard},/*#__PURE__*/React.createElement("div",{style:s.verseCardLabel},/*#__PURE__*/React.createElement("span",null,"قَالَ اللهُ تَعَالَى",surahName?` — سُورَةُ ${surahName}`:'')),state==='ok'&&/*#__PURE__*/React.createElement("div",{style:s.surahText},body),/*#__PURE__*/React.createElement("div",{style:s.verseFooter},metaLabel&&/*#__PURE__*/React.createElement("div",{style:s.verseMeta},metaLabel),sNum&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:togglePlay,style:s.versePlayBtn,"aria-label":playing?'إيقاف التلاوة':'تشغيل التلاوة كاملة'},playing?/*#__PURE__*/React.createElement(PauseIcon,{size:14}):/*#__PURE__*/React.createElement(PlayIcon,{size:14}),/*#__PURE__*/React.createElement("span",null,playing?'إيقاف':'استمع للتلاوة (كاملة)'))),audioFailed&&/*#__PURE__*/React.createElement("div",{style:s.verseAudioError},"تعذّر تحميل التلاوة"));}// ============================================================
// ITEM 28. A QUR'ANIC SPAN IS NOT A «نص منقول».
// ============================================================
// MEASURED BEFORE: HadithCard printed «نص منقول» over WHATEVER its tag carried whenever the
// model sent no narrator and no ruling. A verse of the Qur'an that arrived inside a <hadith>
// tag was therefore shown to a child as a "transmitted text" -- in the same conversation where
// the app's own verse card calls those very words «قَالَ اللهُ تَعَالَى». The two labels are not
// interchangeable, and on scripture one of them is simply wrong.
//
// THE TEST IS THE APP'S OWN, NOT A SECOND ONE. QURAN_SPAN_RE already declares, in its own
// comment, that "anything between the ornate parentheses U+FD3F..U+FD3E is scripture and is
// left byte-for-byte as it came" -- that is why the tashkeel stripper refuses to touch it.
// This reads the SAME contract. It does not invent a second definition of what scripture is,
// and it does not sniff at the words themselves.
//
// UI ONLY, AND DELIBERATELY SO. No retrieval, no cleaning, no classifier and no prompt is
// touched: the tag arrives exactly as it did, the model is not consulted, and nothing here
// can change WHICH text is shown. What changes is the label above it and the line beneath it.
const QURAN_ORNATE_SPAN_RE=/\uFD3F[\s\S]*?\uFD3E/;const hasQuranicSpan=t=>QURAN_ORNATE_SPAN_RE.test(String(t||''));// The label a verse gets, and it is the one the verse card already uses -- not a new string,
// so the two surfaces cannot drift into calling the same thing two names.
const AYAH_CARD_LABEL='قَالَ اللهُ تَعَالَى';// THE REFERENCE IS READ, NEVER GUESSED. It counts only when the content STATES it as
// «سورة <name> ... <number>» and <name> is a surah the app already knows (SURAH_NUMBERS, the
// same map the recitation link is built from). Anything else -- no reference, an unknown name,
// or two different references in one card -- yields null, and the card then shows the label
// with NO reference line. A citation invented under a verse would be worse than none.
const readStatedAyahRef=t=>{const src=String(t||'');const found=[];const re=/سورة\s+([^\s،,:()\[\]\uFD3E\uFD3F]+(?:\s+[^\s،,:()\[\]\uFD3E\uFD3F]+)?)\s*[،,:]?\s*(?:الآية|آية)?\s*[:\s]*([٠-٩0-9]+)/g;let m;while((m=re.exec(src))!==null){let name=m[1];if(SURAH_NUMBERS[name]===undefined){// «سورة آل عمران، آية ١٧٣» captures two words; «سورة البقرة» captures one. Try the
// shorter reading before giving up, so a two-word name does not swallow the next word.
name=name.split(/\s+/)[0];if(SURAH_NUMBERS[name]===undefined)continue;}found.push({surah:name,ayah:m[2]});}if(!found.length)return null;const first=found[0];if(found.some(f=>f.surah!==first.surah||f.ayah!==first.ayah))return null;return first;};const NEUTRAL_HADITH_LABEL='نص منقول';function HadithCard({content,narrator,ruling}){// خانةُ المخرِّجِ قد تصلُ مملوءةً بالدرجة، فتُطبَعُ الدرجةُ مرّتين وأُولاهما «رَوَى متفق عليه».
const att=resolveHadithAttribution(narrator,ruling);let label=!att.narrator&&!att.ruling?NEUTRAL_HADITH_LABEL:'من السنة النبوية';// ITEM 28. Scripture first, and it outranks the attribution entirely: a verse carries no
// narrator and takes no grading, so a ruling printed under one would be a hadith's apparatus
// applied to the Qur'an. The reference replaces it, and only if the content stated one.
const quranic=hasQuranicSpan(content);const ayahRef=quranic?readStatedAyahRef(content):null;if(quranic)label=AYAH_CARD_LABEL;return/*#__PURE__*/React.createElement("div",{style:s.hadithCard},/*#__PURE__*/React.createElement("div",{style:s.hadithCardLabel},/*#__PURE__*/React.createElement("span",null,label)),/*#__PURE__*/React.createElement("div",{style:s.hadithText},content),quranic?ayahRef&&/*#__PURE__*/React.createElement("div",{style:s.hadithMeta},`سورة ${ayahRef.surah}، آية ${ayahRef.ayah}`):att.ruling&&/*#__PURE__*/React.createElement("div",{style:s.hadithMeta},att.ruling));}// بطاقة المصدر: شريحةُ عزوٍ قابلةٌ للنقر في نهاية الجواب — أوّلُ رابطٍ خارجيٍّ في التطبيق.
// تُظهِر اسمَ النطاق (site) ثمّ وصفاً عربيّاً موجزاً (المحتوى)، وتفتح url في تبويبٍ جديد.
function SourceCard({site,url,content}){// D92: this chip is the app's ONLY external navigation -- tapping it leaves for the system
// browser (a Custom Tab in the standalone/TWA shell, which the web side cannot intercept, so
// the decision has to be made here). Google's Families policy puts a parental gate exactly
// here, and before D92 there was none. The hook sits above the missing-url early return so the
// hook order is stable on every render.
const[gate,setGate]=useState(null);// اسمُ النطاق للعرض: نُفضّل site، وإلا نشتقّه من رابط الصفحة إن أمكن.
let host=(site||'').trim();if(!host&&url){try{host=new URL(url).hostname.replace(/^www\./,'');}catch(e){host='';}}const label=host||'المصدر';const text=(content||'').trim()||host||url||'';const body=[/*#__PURE__*/React.createElement("span",{key:"site",style:s.sourceChipSite},label),text?/*#__PURE__*/React.createElement("span",{key:"text",style:s.sourceChipText},text):null,/*#__PURE__*/React.createElement("span",{key:"arrow",style:s.sourceChipArrow,"aria-hidden":"true"},"↗")];// حمايةٌ من رابطٍ مفقود: بلا url نرسم شريحةً نصّيّةً غير قابلةٍ للنقر — لا <a href=""> أبداً.
if(!url){return/*#__PURE__*/React.createElement("div",{style:s.sourceChip},body);}const chipStyle={...s.sourceChip,...s.sourceChipLink};if(!(PARENTAL_GATE_ENABLED&&childProfileActive())){return/*#__PURE__*/React.createElement("a",{href:url,target:"_blank",rel:"noopener noreferrer",style:chipStyle},body);}// The href stays real, so long-press / copy-link still behave. Only the tap is intercepted:
// the navigation happens in onPass, which is itself a button click, so no popup blocker fires.
return/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("a",{href:url,target:"_blank",rel:"noopener noreferrer",style:chipStyle,onClick:e=>{e.preventDefault();setGate({a:2+Math.floor(Math.random()*8),b:2+Math.floor(Math.random()*8)});}},body),gate&&/*#__PURE__*/React.createElement(AdultGate,{a:gate.a,b:gate.b,onPass:()=>{setGate(null);try{window.open(url,'_blank','noopener,noreferrer');}catch(e){}},onCancel:()=>setGate(null)}));}function DhikrCard({catId}){const[items,setItems]=useState(null);const[title,setTitle]=useState('');const audioRef=useRef(null);const[playingId,setPlayingId]=useState(null);useEffect(()=>{let alive=true;loadAdhkar().then(db=>{if(!alive)return;const list=db.byCat&&db.byCat[parseInt(catId,10)]||[];setItems(list);if(list[0])setTitle(list[0].category||'');}).catch(()=>{if(alive)setItems([]);});return()=>{alive=false;};},[catId]);useEffect(()=>()=>{if(audioRef.current){audioRef.current.pause();audioRef.current=null;}},[]);const toggle=d=>{if(audioRef.current){audioRef.current.pause();audioRef.current=null;}if(playingId===d.id){setPlayingId(null);return;}if(!d.audio)return;const a=new Audio(d.audio);audioRef.current=a;setPlayingId(d.id);a.onended=()=>setPlayingId(null);a.onerror=()=>setPlayingId(null);a.play().catch(()=>setPlayingId(null));};if(items===null)return/*#__PURE__*/React.createElement("div",{style:s.hadithCard},/*#__PURE__*/React.createElement("div",{style:s.hadithText},"…"));if(items.length===0)return null;return/*#__PURE__*/React.createElement("div",{style:s.hadithCard},/*#__PURE__*/React.createElement("div",{style:s.hadithCardLabel},/*#__PURE__*/React.createElement("span",null,title||'ذكر'," — حصن المسلم")),items.map((d,i)=>/*#__PURE__*/React.createElement("div",{key:d.id,style:{marginBottom:i<items.length-1?10:0}},/*#__PURE__*/React.createElement("div",{style:s.hadithText},d.text),/*#__PURE__*/React.createElement("div",{style:{display:'flex',alignItems:'center',gap:10,marginTop:4,flexWrap:'wrap'}},d.repeat>1&&/*#__PURE__*/React.createElement("span",{style:s.hadithMeta},"تُقال ",toArabicDigits(d.repeat)," مرّات"),d.audio&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>toggle(d),style:s.versePlayBtn,"aria-label":playingId===d.id?'إيقاف':'استماع'},playingId===d.id?/*#__PURE__*/React.createElement(PauseIcon,{size:14}):/*#__PURE__*/React.createElement(PlayIcon,{size:14}),/*#__PURE__*/React.createElement("span",null,playingId===d.id?'إيقاف':'استماع'))))));}function WorshipCard({id,band}){const[display,setDisplay]=useState(null);const[failed,setFailed]=useState(false);useEffect(()=>{let alive=true;loadWorship().then(d=>{if(alive)setDisplay(d);}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[]);// arm: byte-for-byte the prompt's own ternary (band === 'young'). A teen (13-17) takes the
// ADULT arm. That is TODAY's behaviour — this commit changes ZERO policy.
const arm=band==='young'?'young':'adult';// FAIL CLOSED: a missing cell renders a VISIBLE error, never model text, never empty silence.
const errorCard=why=>/*#__PURE__*/React.createElement("div",{style:{background:'var(--tint)',border:'1px solid var(--red)',borderRadius:10,padding:'12px 14px',color:'var(--red)',direction:'ltr',textAlign:'left',fontSize:13,fontFamily:'monospace'}},"worship card unavailable — ",why);if(failed)return errorCard('display fetch failed');if(display===null)return/*#__PURE__*/React.createElement("div",{style:s.hadithCard},/*#__PURE__*/React.createElement("div",{style:s.hadithText},"…"));const cell=display.cells&&display.cells[id+':'+arm];if(!cell||!cell.text)return errorCard('no cell for '+id+':'+arm);// Render cell.text VERBATIM: no markdown pass, no tashkeel pass, no age simplification,
// no truncation, line breaks preserved (pre-wrap). The text is authored+guarded, not model output.
return/*#__PURE__*/React.createElement("div",{style:s.stepsCard},/*#__PURE__*/React.createElement("div",{style:s.stepsCardLabel},/*#__PURE__*/React.createElement(ListCheckIcon,{size:12,color:"var(--red)"})),/*#__PURE__*/React.createElement("div",{style:{...s.hadithText,whiteSpace:'pre-wrap'}},cell.text));}// العنوانُ يأتي من الجوابِ نفسِه (خاصّيّةُ title على الوسم) — وإن غابَ فلا عنوانَ أصلًا،
// ولا سقوطَ إلى عبارةٍ ثابتة. الأيقونةُ وحدَها تكفي علامةً على أنّ ما تحتَها قائمةُ خطوات،
// كما تفعلُ بطاقةُ العبادةِ أعلاه بالضبط.
function StepsCard({items,title}){const heading=(title||'').trim();return/*#__PURE__*/React.createElement("div",{style:s.stepsCard},/*#__PURE__*/React.createElement("div",{style:s.stepsCardLabel},/*#__PURE__*/React.createElement(ListCheckIcon,{size:12,color:"var(--red)"}),heading?/*#__PURE__*/React.createElement("span",null,heading):null),/*#__PURE__*/React.createElement("ol",{style:s.stepsList},items.map((item,i)=>/*#__PURE__*/React.createElement("li",{key:i,style:s.stepsItem},item))));}// XI-04 — الشارةُ التي حلّت محلَّ المحارفِ الخام. It is drawn like the cards beside it and it
// carries NO EzikMarkdown: the mark's own body is one plain sentence written by the server, and a
// second Markdown display site would be a second place for a construct to be interpreted.
// role="note" so a screen reader announces it as an aside about the answer rather than as more of
// the answer, which is exactly what it is.
function ReviewNotice({label,content}){const body=String(content||'').trim();return/*#__PURE__*/React.createElement("div",{role:"note",style:s.reviewNotice},/*#__PURE__*/React.createElement("span",{style:s.reviewNoticeLabel},label),body?/*#__PURE__*/React.createElement("span",{style:s.reviewNoticeText},body):null);}function BoardCard({content}){return/*#__PURE__*/React.createElement("div",{style:{direction:'ltr',textAlign:'left',background:'var(--tint)',border:'1px solid var(--line)',borderRadius:10,padding:'12px 14px',fontFamily:"'Courier New', monospace",fontSize:15,lineHeight:1.9,color:'var(--ink)',whiteSpace:'pre-wrap',overflowX:'auto',width:'100%'}},content);}function DocumentCard({title,content,age}){const exportDoc=()=>downloadAsWord(title||'مستند',title||'مستند','<h1>'+escapeHtml(title||'مستند')+'</h1>'+docToHtml(content));const exportPdf=()=>printAsPdf(title||'مستند',docToHtml(content));const canExport=deriveCaps(age).export;return/*#__PURE__*/React.createElement("div",{style:{border:'1px solid var(--line)',borderRadius:12,padding:'14px 16px',background:'var(--white)',width:'100%'}},/*#__PURE__*/React.createElement("div",{style:{fontWeight:'bold',color:'var(--ink)',fontSize:17,marginBottom:8}},title),/*#__PURE__*/React.createElement("div",{className:"doc-rendered",style:{fontSize:14.5,lineHeight:1.9,color:'var(--ink)',maxHeight:320,overflowY:'auto'},dangerouslySetInnerHTML:{__html:docToHtml(content)}}),canExport&&/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("button",{onClick:exportDoc,style:{marginTop:12,background:'var(--red)',color:'var(--on-accent)',border:'none',borderRadius:10,padding:'9px 16px',fontSize:15,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8}},/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"var(--on-accent)",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"}),/*#__PURE__*/React.createElement("path",{d:"M14 2v6h6"}),/*#__PURE__*/React.createElement("path",{d:"M12 18v-6M9 15h6"})),"صدِّر كملف Word"),/*#__PURE__*/React.createElement("button",{onClick:exportPdf,style:{marginTop:12,marginRight:8,background:'transparent',color:'var(--red)',border:'1px solid var(--red)',borderRadius:10,padding:'9px 16px',fontSize:15,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:8}},/*#__PURE__*/React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"var(--red)",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},/*#__PURE__*/React.createElement("path",{d:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"}),/*#__PURE__*/React.createElement("path",{d:"M14 2v6h6"}),/*#__PURE__*/React.createElement("path",{d:"M12 18v-4"})),"PDF")));}// childProfileActive -- is the ACTIVE stored profile a child (young band)? SourceCard is a leaf
// and carries no profile prop, so the judgement is read from storage at call time, the same way
// childVoiceBlocked reads its mirror. fail-closed: no readable profile => treat as a child, so a
// broken read raises the gate rather than opening the door. Nothing renders a source chip before
// onboarding, so this is never consulted at boot.
function childProfileActive(){try{const raw=localStorage.getItem('child_profile');if(!raw)return true;return deriveCaps(JSON.parse(raw).age).band==='young';}catch(e){return true;}}const PARENTAL_GATE_ENABLED=true;// Session 08: gate off during testing - MUST be true before store release
function AdultGate({a,b,onPass,onCancel}){const[answer,setAnswer]=useState("");const[error,setError]=useState(false);const submit=()=>{const v=parseInt(String(answer).replace(/[٠-٩]/g,x=>x.charCodeAt(0)-0x0660),10);if(v===a*b)onPass();else{setError(true);setTimeout(()=>setError(false),1500);}};return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate ezgate-scrim"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card is-modal",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},"🔒")),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},"تأكيد ولي الأمر"),/*#__PURE__*/React.createElement("div",{style:s.onboardingSubtitle},"هذا القسم مخصّص للكبار. للتأكيد أنّ وليًّا حاضر، احسب الناتج:"),/*#__PURE__*/React.createElement("div",{className:"ezgate-sum"},a," × ",b),/*#__PURE__*/React.createElement("input",{type:"text",inputMode:"numeric",value:answer,onChange:e=>setAnswer(e.target.value),onKeyDown:e=>e.key==="Enter"&&submit(),placeholder:"الجواب",autoFocus:true,style:{...s.onboardingInput,textAlign:"center",borderColor:error?"var(--a3-cyan)":"var(--a3-line)"}}),error&&/*#__PURE__*/React.createElement("div",{className:"ezgate-err"},"جواب غير صحيح، حاول مرة أخرى"),/*#__PURE__*/React.createElement("button",{onClick:submit,style:s.primaryBtn},"تأكيد"),/*#__PURE__*/React.createElement("button",{onClick:onCancel,style:s.secondaryBtn},"رجوع")));}// ============================================================
// THE AI-CONSENT SCREEN  (Apple 5.1.1(i) / 5.1.2(i))
// ============================================================
// This replaces the old one-button "قبل أن نبدأ" acknowledgement, which said the tutor can be
// wrong -- a true statement, but not a disclosure of what travels and not a request for consent.
// Apple refused the build for exactly that gap, so this screen states the three things a consent
// screen has to state before anything is sent: WHAT data, to WHOM, and for WHAT.
//
// THE RULES THIS SCREEN OBEYS, and which the probe re-checks:
//   * Rendering it sends NOTHING. It is strings from this file and no request of any kind.
//   * TWO real buttons, neither preselected, both legible. There is no "فهمت" here: an
//     acknowledgement is not a consent, and a single button is not a choice.
//   * Refusing is a genuine, recorded answer -- the reader keeps the mushaf, the adhkar, the
//     treasures and everything else local, and the screen does not come back to nag.
//   * UNDER 13, the agree button alone cannot enable anything: it opens the app's own adult
//     barrier first, and only passing it records grantedBy:'guardian'. Cancelling leaves the app
//     in local mode with nothing sent.
// The links are our OWN pages and are NOT parent-gated: a policy Apple requires to be reachable
// must be reachable.
const EZ_AIC_TITLE='مشاركة البيانات مع خدمات الذكاء الاصطناعي';const EZ_AIC_LEAD='عند تشغيل المحادثة الذكية أو الصوت أو رفع الملفات، قد تُرسَل البيانات التالية إلى الجهات المذكورة أدناه لتنفيذ طلبك:';const EZ_AIC_DATA=['الاسم والعمر والجنس المسجَّلة في الملف.','نصّ السؤال ورسائل المحادثة السابقة.','الصور أو الملفات التي تختار رفعها.','التسجيل الصوتيّ والنصّ الناتج منه عند تشغيل الصوت أو التسميع.','عبارات بحث مشتقّة من السؤال للوصول إلى المصادر.'];const EZ_AIC_PROVIDERS_TITLE='الجهات التي تستقبل هذه البيانات، ووظيفة كلٍّ منها:';const EZ_AIC_PROVIDERS=[['Anthropic (Claude)','توليد الإجابات ومعالجة النصوص والصور والملفات.'],['ElevenLabs','تحويل النصّ إلى صوت، وتحويل التسجيل الصوتيّ إلى نصّ عند استخدام المسار السحابيّ.'],['Brave Search','إرسال عبارات بحث مشتقّة من السؤال للوصول إلى مصادر الويب.']];// The first line was «لا تُستخدم هذه البيانات للإعلانات ولا لتتبُّعك» -- an absolute passive that
// reads as a promise about what EVERY provider does with the data after it leaves us. We cannot
// audit Anthropic's, ElevenLabs' or Brave's internals, so we do not get to promise it. The
// replacement states exactly what is ours to state: what Ezik does, and why it sends at all.
const EZ_AIC_ASSURANCES=['لا يستخدم عزك هذه البيانات للإعلانات أو لتتبعك، ولا يرسلها إلى مزودي الخدمة إلا لتشغيل الميزات التي تختار استخدامها.','يمكنك استخدام المصحف والأذكار وكنوز المعرفة والميزات المحلّيّة دون تشغيل الذكاء الاصطناعيّ.','يمكنك سحب الموافقة لاحقاً من: الإعدادات ← الخصوصية والذكاء الاصطناعي.'];const EZ_AIC_GUARDIAN_LINE='يجب على ولي الأمر مراجعة هذه المعلومات والموافقة قبل تشغيل ميزات الذكاء الاصطناعي للطفل.';const EZ_AIC_AGREE='أوافق وأفعّل ميزات الذكاء الاصطناعي';const EZ_AIC_DECLINE='استخدام عزك دون الذكاء الاصطناعي';const EZ_AIC_LINK_PRIVACY='سياسة الخصوصية';const EZ_AIC_LINK_DELETE='حذف البيانات';const EZ_AIC_LINK_SUPPORT='الدعم';// MEASURED IN A REAL BROWSER, not assumed: rendered as one plain string inside this RTL card,
// "2026-08-06-1" came out as "1-06-08-2026". The hyphens are bidi-NEUTRAL, so the digit groups
// get reordered around them and the reader is shown a version number that is not the version
// number. It is the identifier the whole consent record is keyed on, so it is isolated LTR --
// the same treatment EZ_AIC_PROVIDERS already gives the Latin vendor names.
const EZ_AIC_VERSION_LABEL='نسخة الموافقة:';const EZ_AIC_VERSION_LINE=EZ_AIC_VERSION_LABEL+' '+EZ_AI_CONSENT_VERSION;function AIConsentVersion({style}){return/*#__PURE__*/React.createElement("div",{style:style},EZ_AIC_VERSION_LABEL+' ',/*#__PURE__*/React.createElement("span",{style:s.aicVersionNum},EZ_AI_CONSENT_VERSION));}// The three policy links, drawn identically wherever they appear.
function AIConsentLinks(){return/*#__PURE__*/React.createElement("div",{style:s.aicLinks},/*#__PURE__*/React.createElement("a",{href:"/privacy.html",target:"_blank",rel:"noopener noreferrer",style:s.aicLink},EZ_AIC_LINK_PRIVACY),/*#__PURE__*/React.createElement("a",{href:"/delete.html",target:"_blank",rel:"noopener noreferrer",style:s.aicLink},EZ_AIC_LINK_DELETE),/*#__PURE__*/React.createElement("a",{href:"/support.html",target:"_blank",rel:"noopener noreferrer",style:s.aicLink},EZ_AIC_LINK_SUPPORT));}function AIConsentGate({age,current,onGrant,onDecline,onBack}){// FAIL-CLOSED on the age: a missing or unreadable age parses to 0, which is under 13, which
// means the guardian barrier. An unknown age is never treated as an adult.
const isUnder13=(parseInt(age,10)||0)<13;const[guard,setGuard]=useState(null);// the arithmetic challenge, or null
const agree=()=>{if(!isUnder13){onGrant('user');return;}setGuard({a:2+Math.floor(Math.random()*8),b:2+Math.floor(Math.random()*8)});};if(guard){return/*#__PURE__*/React.createElement(AdultGate,{a:guard.a,b:guard.b,onPass:()=>{setGuard(null);onGrant('guardian');},onCancel:()=>setGuard(null)});}return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate",style:s.onboardingContainer},/*#__PURE__*/React.createElement("div",{className:"ezgate-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},"🔐")),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},EZ_AIC_TITLE),/*#__PURE__*/React.createElement("div",{style:s.aicBody},/*#__PURE__*/React.createElement("div",{style:s.aicLead},EZ_AIC_LEAD),/*#__PURE__*/React.createElement("ul",{style:s.aicList},EZ_AIC_DATA.map(t=>/*#__PURE__*/React.createElement("li",{key:t,style:s.aicItem},t))),/*#__PURE__*/React.createElement("div",{style:s.aicSubhead},EZ_AIC_PROVIDERS_TITLE),/*#__PURE__*/React.createElement("ul",{style:s.aicList},EZ_AIC_PROVIDERS.map(([n,d])=>/*#__PURE__*/React.createElement("li",{key:n,style:s.aicItem},/*#__PURE__*/React.createElement("span",{style:s.aicProvider},n),': '+d))),/*#__PURE__*/React.createElement("ul",{style:s.aicList},EZ_AIC_ASSURANCES.map(t=>/*#__PURE__*/React.createElement("li",{key:t,style:s.aicItem},t))),isUnder13&&/*#__PURE__*/React.createElement("div",{style:s.aicGuardian},EZ_AIC_GUARDIAN_LINE),/*#__PURE__*/React.createElement(AIConsentLinks,null),/*#__PURE__*/React.createElement(AIConsentVersion,{style:s.aicVersion})),/*#__PURE__*/React.createElement("button",{type:"button",onClick:agree,style:s.primaryBtn},EZ_AIC_AGREE),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onDecline,style:s.secondaryBtn},EZ_AIC_DECLINE),onBack&&/*#__PURE__*/React.createElement("button",{type:"button",onClick:onBack,style:s.secondaryBtn},A2_BACK))));}// The two screens that SEND, when consent has not been granted. Never a blank page: it names the
// reason, offers the way back to the choice, and offers the three modules that need no AI at all.
const EZ_AILM_TITLE='الوضع المحلّيّ';const EZ_AILM_BODY='ميزات الذكاء الاصطناعي غير مفعّلة لأن مشاركة البيانات لم تتم الموافقة عليها.';const EZ_AILM_REVIEW='مراجعة إعدادات الخصوصية';const EZ_AILM_MUSHAF='فتح المصحف';const EZ_AILM_ADHKAR='فتح الأذكار';const EZ_AILM_TREASURE='فتح كنوز المعرفة';function AILocalModeNotice({onReview,onMushaf,onAdhkar,onTreasure,onBack}){return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate",style:s.onboardingContainer},/*#__PURE__*/React.createElement("div",{className:"ezgate-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},"🔒")),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},EZ_AILM_TITLE),/*#__PURE__*/React.createElement("div",{style:{...s.onboardingSubtitle,lineHeight:1.9,marginBottom:20}},EZ_AILM_BODY),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onReview,style:s.primaryBtn},EZ_AILM_REVIEW),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onMushaf,style:s.secondaryBtn},EZ_AILM_MUSHAF),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onAdhkar,style:s.secondaryBtn},EZ_AILM_ADHKAR),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onTreasure,style:s.secondaryBtn},EZ_AILM_TREASURE),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onBack,style:s.secondaryBtn},A2_BACK))));}// غ‑٣ — بديلُ شاشةِ المكالمة حين يكون الصوتُ مقفولاً. يحتذي شكلَ DisclosureGate بالضبط:
// رموزُ التنسيق القائمة فقط، بلا أيّ لونٍ جديد. نصٌّ واحدٌ ثابت + زرُّ رجوعٍ ظاهر.
function ChildVoiceNotice({onBack}){return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate",style:s.onboardingContainer},/*#__PURE__*/React.createElement("div",{className:"ezgate-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},"🔈")),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},"الصوتُ قيدَ التجهيز"),/*#__PURE__*/React.createElement("div",{style:{...s.onboardingSubtitle,lineHeight:1.9,marginBottom:20}},CHILD_VOICE_NOTICE),/*#__PURE__*/React.createElement("button",{onClick:onBack,style:s.primaryBtn},"رجوع"))));}// ONE PIN sheet, reached from two places: selecting a locked depth tier, and entering the
// call. The PIN is typed, POSTed once and discarded -- only the returned token is kept.
//
// The child barrier (CHILD_VOICE_ENABLED / childVoiceBlocked) sits ABOVE this sheet in every
// caller, so a child profile gets the "being prepared" notice and is never even offered the
// chance to unlock. This sheet is not the lock either: api/unlock.js rate-limits attempts and
// api/ask.js ignores an unearned tier regardless of what the UI shows.
function UnlockSheet({onUnlocked,onBack}){const[pin,setPin]=useState('');const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false);const submit=async()=>{if(busy||!pin)return;setBusy(true);setMsg('');try{const r=await fetch('/api/unlock',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({pin,deviceId:getDeviceId()})});const d=await r.json().catch(()=>({}));if(r.ok&&d&&d.token){storeFounderToken(d.token);setPin('');onUnlocked();return;}// The SERVER owns the wording. A wrong code, a day lockout and an unreachable store are
// three different truths and only it knows which -- so show its message verbatim and
// never an invented generic line.
setMsg(d&&d.message||'');}catch(e){// A network failure carries no server message; leave the sheet up rather than invent a
// second copy of wording the server owns.
setMsg('');}setPin('');setBusy(false);};return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate",style:s.onboardingContainer},/*#__PURE__*/React.createElement("div",{className:"ezgate-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},'\uD83D\uDD10')),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},'\u0627\u0644\u0631\u0645\u0632 \u0645\u0637\u0644\u0648\u0628'),/*#__PURE__*/React.createElement("div",{style:s.onboardingSubtitle},'\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 \u0627\u0644\u0641\u062A\u062D \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.'),/*#__PURE__*/React.createElement("input",{type:"password",inputMode:"numeric",value:pin,onChange:e=>setPin(e.target.value),onKeyDown:e=>e.key==='Enter'&&submit(),placeholder:"••••",autoFocus:true,style:{...s.onboardingInput,textAlign:'center',letterSpacing:'0.5em',borderColor:msg?'var(--a3-cyan)':'var(--a3-line)'}}),msg&&/*#__PURE__*/React.createElement("div",{className:"ezgate-err"},msg),/*#__PURE__*/React.createElement("button",{onClick:submit,disabled:busy,style:{...s.primaryBtn,opacity:busy?0.5:1}},'\u0641\u062A\u062D'),/*#__PURE__*/React.createElement("button",{onClick:onBack,style:s.secondaryBtn},'\u0631\u062C\u0648\u0639'))));}function Onboarding({onStart}){const uiLang=useEzLang();const[name,setName]=useState('');const[birthYear,setBirthYear]=useState('');const[gender,setGender]=useState(null);const toLatinDigits=str=>String(str||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));// Neutral age screen (step 4a): we ask the BIRTH YEAR — a fact with no "right" answer —
// never "are you an adult?". Age is DERIVED from it and passed on unchanged; the band
// thresholds and profile shape stay untouched (startChat re-derives the same birthYear).
const CUR_YEAR=new Date().getFullYear();const yearNum=parseInt(toLatinDigits(birthYear),10);const derivedAge=CUR_YEAR-yearNum;const ageValid=Number.isInteger(yearNum)&&derivedAge>=4&&derivedAge<=99;const canStart=!!(name.trim()&&gender&&ageValid);// D92: the parental gate is NOT an entry condition for anyone. Onboarding hands the derived
// age straight to startChat -- no arithmetic at boot, on the chat, or for a teen/adult profile
// at any point. The gate itself is untouched and still stands at the one real boundary a child
// profile can cross: an external URL leaving the app (see SourceCard).
const requestStart=n=>{onStart(name,n,gender);};const submit=()=>{if(canStart)requestStart(derivedAge);};return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezonb",style:s.welcomeContainer},/*#__PURE__*/React.createElement("div",{style:s.welcomeInner},/*#__PURE__*/React.createElement("div",{className:"ezonb-card",style:s.welcomeCard},/*#__PURE__*/React.createElement(EzLangControl,{variant:"onboarding"}),/*#__PURE__*/React.createElement("div",{className:"ezonb-crest",style:s.welcomeLogoSquare},/*#__PURE__*/React.createElement("svg",{width:"42",height:"42",viewBox:"0 0 24 24",fill:"none",stroke:"var(--a3-blue)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},/*#__PURE__*/React.createElement("path",{d:"M4 19.5A2.5 2.5 0 0 1 6.5 17H20"}),/*#__PURE__*/React.createElement("path",{d:"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"}))),/*#__PURE__*/React.createElement("div",{style:s.welcomeTitle},"عزك"),/*#__PURE__*/React.createElement("div",{style:s.welcomeGreeting},ezT('onboarding.welcome')),/*#__PURE__*/React.createElement("input",{value:name,onChange:e=>setName(e.target.value),placeholder:"الاسم",...(uiLang==='ar'?null:{placeholder:ezT('onboarding.name')}),style:s.welcomeInput,autoFocus:true}),/*#__PURE__*/React.createElement("div",{className:"ezonb-row"},/*#__PURE__*/React.createElement("button",{onClick:()=>setGender('male'),style:{...s.welcomePrimaryBtn,background:gender==='male'?'var(--accent-fill)':'var(--a3-ice)',color:gender==='male'?'var(--on-accent)':'var(--a3-ink)'}},ezT('onboarding.male')),/*#__PURE__*/React.createElement("button",{onClick:()=>setGender('female'),style:{...s.welcomePrimaryBtn,background:gender==='female'?'var(--accent-fill)':'var(--a3-ice)',color:gender==='female'?'var(--on-accent)':'var(--a3-ink)'}},ezT('onboarding.female'))),/*#__PURE__*/React.createElement("input",{value:birthYear,onChange:e=>setBirthYear(e.target.value),onKeyDown:e=>{if(e.key==='Enter')submit();},placeholder:"سنة الميلاد — مثال ٢٠١٥",...(uiLang==='ar'?null:{placeholder:ezT('onboarding.birthYear')}),type:"text",inputMode:"numeric",pattern:"[0-9]*",maxLength:4,style:s.welcomeInput}),birthYear.trim()&&!ageValid&&/*#__PURE__*/React.createElement("div",{className:"ezgate-err"},ezT('onboarding.yearError')),/*#__PURE__*/React.createElement("button",{onClick:submit,disabled:!canStart,className:"welcome-primary",style:{...s.welcomePrimaryBtn,opacity:canStart?1:0.4}},ezT('onboarding.start')))));}function ParentGate({pinInput,setPinInput,pinError,setPinError,onSuccess,onBack}){// 'probing' يُعرَضُ كوضعِ تحقُّق: فشلٌ آمنٌ للإغلاق. تعذُّرُ سؤالِ الخادمِ لا يفتحُ بابَ الإنشاءِ أبدًا،
// وإلا لكان قطعُ الشبكةِ طريقًا إلى وضعِ رمزٍ جديدٍ فوقَ لوحةِ أهلٍ قائمة.
const[mode,setMode]=useState('probing');// 'probing' | 'verify' | 'create'
const[adultOk,setAdultOk]=useState(false);const[challenge]=useState(()=>({a:2+Math.floor(Math.random()*8),b:2+Math.floor(Math.random()*8)}));// single digit, same as the welcome gate
const[confirmPin,setConfirmPin]=useState('');const[busy,setBusy]=useState(false);const[errMsg,setErrMsg]=useState('رمز خاطئ');const fail=msg=>{setErrMsg(msg);setPinError(true);setTimeout(()=>setPinError(false),1800);};useEffect(()=>{let alive=true;(async()=>{let serverHas=null;// null = لم نعرف ⇐ نُعامِلُه معاملةَ «عنده رمز»
try{const r=await parentCodeCall({action:'status'});const d=await r.json().catch(()=>({}));if(r.ok&&d&&typeof d.hasCode==='boolean')serverHas=d.hasCode;}catch(e){}// سجلٌّ في الخادمِ ⇐ البصمةُ القديمةُ لا معنى لها بعدَ اليوم، فتُمحى هنا لا بعدَ نجاحٍ فقط.
if(serverHas===true)clearLegacyParentHash();// جهازٌ يحملُ بصمةً قديمةً ولا سجلَّ له ⇐ وضعُ تحقُّقٍ لتجريَ الهجرةُ الصامتة، لا وضعُ
// إنشاءٍ يطلبُ رمزًا جديدًا من أهلٍ يحفظونَ رمزَهم.
const needVerify=serverHas!==false||!!readLegacyParentHash();if(alive)setMode(needVerify?'verify':'create');})();return()=>{alive=false;};},[]);const verify=async()=>{if(busy||mode==='probing')return;setBusy(true);try{const legacyHash=readLegacyParentHash();const r=await parentCodeCall(Object.assign({action:'verify',pin:pinInput},legacyHash?{legacyHash}:{}));const d=await r.json().catch(()=>({}));setBusy(false);if(r.ok&&d&&d.ok){clearLegacyParentHash();setPinInput('');onSuccess();return;}// الخادمُ يملكُ الصياغة: رمزٌ خاطئ، وقفلُ محاولاتِ اليوم، وتعذُّرُ التحقُّقِ ثلاثُ حقائقَ
// مختلفة، وهو وحدَه يعرفُ أيَّها وقع — فتُعرَضُ رسالتُه كما هي.
fail(d&&d.message||'رمز خاطئ');}catch(e){setBusy(false);// انقطاعُ الشبكةِ لا يحملُ رسالةَ خادم، ولومُ الأهلِ بـ«رمزٍ خاطئ» كذبٌ عليهم.
fail('تعذّر التحقّق الآن. جرّب بعد قليل.');}};const create=async()=>{if(busy)return;if(!/^[0-9]{4,}$/.test(pinInput))return fail('اختر ٤ أرقام على الأقل');if(pinInput!==confirmPin)return fail('الرمزان غير متطابقان');setBusy(true);try{const r=await parentCodeCall({action:'set',pin:pinInput});const d=await r.json().catch(()=>({}));setBusy(false);if(r.ok&&d&&d.ok){clearLegacyParentHash();setConfirmPin('');onSuccess();return;}fail(d&&d.message||'تعذّر الحفظ');}catch(e){setBusy(false);fail('تعذّر الحفظ');}};const hasPin=mode!=='create';// D92: unchanged for a child profile -- this is a real boundary (the parents-only panel) and the
// gate belongs here. An adult or teen profile setting its own PIN meets no arithmetic, per the
// ruling that no teen or adult profile faces a challenge at any point.
if(mode==='create'&&!adultOk&&PARENTAL_GATE_ENABLED&&childProfileActive())return/*#__PURE__*/React.createElement(AdultGate,{a:challenge.a,b:challenge.b,onPass:()=>setAdultOk(true),onCancel:onBack});return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate",style:s.onboardingContainer},/*#__PURE__*/React.createElement("div",{className:"ezgate-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},"🔒")),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},hasPin?'لوحة الأهل':'إنشاء رمز لوحة الأهل'),/*#__PURE__*/React.createElement("div",{style:s.onboardingSubtitle},hasPin?'أدخل رمز الدخول':'اختر رمزاً من ٤ أرقام على الأقل — لن يُعرض، فاحفظه في مكان آمن'),/*#__PURE__*/React.createElement("input",{type:"password",inputMode:"numeric",value:pinInput,onChange:e=>setPinInput(e.target.value),onKeyDown:e=>e.key==='Enter'&&hasPin&&verify(),placeholder:"••••",style:{...s.onboardingInput,textAlign:'center',letterSpacing:'0.5em',borderColor:pinError?'var(--a3-cyan)':'var(--a3-line)'},autoFocus:true}),!hasPin&&/*#__PURE__*/React.createElement("input",{type:"password",inputMode:"numeric",value:confirmPin,onChange:e=>setConfirmPin(e.target.value),onKeyDown:e=>e.key==='Enter'&&create(),placeholder:"أعد الرمز",style:{...s.onboardingInput,textAlign:'center',letterSpacing:'0.5em',borderColor:pinError?'var(--a3-cyan)':'var(--a3-line)'}}),pinError&&/*#__PURE__*/React.createElement("div",{className:"ezgate-err"},errMsg),/*#__PURE__*/React.createElement("button",{onClick:hasPin?verify:create,disabled:busy||mode==='probing',style:{...s.primaryBtn,opacity:busy||mode==='probing'?0.5:1}},hasPin?'دخول':'حفظ الرمز'),/*#__PURE__*/React.createElement("button",{onClick:onBack,style:s.secondaryBtn},"رجوع"))));}// قفل الإنفاق — مطالبةٌ بسيطة على نمط لوحة الأهل. تُقارَن بصمة SHA-256 للرمز المُدخَل
// بالثابت SPEND_GATE_SHA256؛ لا يُخزَّن الرمز نفسه أبداً. النجاح يفتح القفل ويُحفَظ لهذا الجهاز.
function SpendGate({onUnlock,onExit}){const[code,setCode]=useState('');const[err,setErr]=useState(false);const submit=async()=>{try{if((await hashPin(code))===SPEND_GATE_SHA256){onUnlock();return;}}catch(e){}setErr(true);setTimeout(()=>setErr(false),1800);};return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezgate",style:s.onboardingContainer},/*#__PURE__*/React.createElement("div",{className:"ezgate-wrap"},/*#__PURE__*/React.createElement("div",{className:"ezgate-card",style:s.onboardingCard},/*#__PURE__*/React.createElement("div",{className:"ezgate-crest","aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:s.bigEmoji},"🔒")),/*#__PURE__*/React.createElement("div",{style:s.onboardingTitle},"رمز الدخول"),/*#__PURE__*/React.createElement("div",{style:s.onboardingSubtitle},"أدخل رمز الدخول لتفعيل المحادثة"),/*#__PURE__*/React.createElement("input",{type:"password",inputMode:"numeric",value:code,onChange:e=>setCode(e.target.value),onKeyDown:e=>e.key==='Enter'&&submit(),placeholder:"••••",style:{...s.onboardingInput,textAlign:'center',letterSpacing:'0.5em',borderColor:err?'var(--a3-cyan)':'var(--a3-line)'},autoFocus:true}),err&&/*#__PURE__*/React.createElement("div",{className:"ezgate-err"},"رمز خاطئ"),/*#__PURE__*/React.createElement("button",{onClick:submit,style:s.primaryBtn},"دخول"),/*#__PURE__*/React.createElement("button",{onClick:onExit,style:s.secondaryBtn},"رجوع"))));}// D88 -- the settings sheet. It carries .theme-dark itself so it is themed by the same scoped
// palette the chat uses; reached from the drawer's gear. The choice is written through
// applyTheme, the one code path that also runs at boot, and persisted immediately.
// ---- S105 ISTANA SHELL START --------------------------------------------------------------
// THE SHARED ISTANA SHELL. Presentation only, and deliberately empty of judgement: it owns no
// navigation state, reads no storage, holds no screen logic and invents no handler. A screen
// hands it a title, its OWN back handler and whatever action buttons it already had; the shell
// decides only where those sit and how wide the column is.
//
// The root carries .ezhome, which is what puts the --a3-* token set in scope for everything
// inside -- the same scope the home and the adhkar screens use, so a screen adopting the shell
// gets the identity and the dark palette without declaring a colour of its own.
function EzShell({title,onBack,backLabel,actions,children}){return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome",style:s.ezshContainer},/*#__PURE__*/React.createElement("div",{className:"ezsh-nav"},/*#__PURE__*/React.createElement("div",{className:"ezsh-nav-inner"},/*#__PURE__*/React.createElement("div",{className:"ezsh-nav-side"},onBack?/*#__PURE__*/React.createElement("button",{type:"button",className:"ezhome-focus",onClick:onBack,style:s.ezshNavBtn,"aria-label":backLabel},A2_ICON_BACK):null),/*#__PURE__*/React.createElement("span",{className:"ezsh-brand"},/*#__PURE__*/React.createElement("span",{className:"ezsh-brand-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",null,title)),/*#__PURE__*/React.createElement("div",{className:"ezsh-nav-side is-end"},actions||null))),/*#__PURE__*/React.createElement("div",{style:s.ezshScroll},/*#__PURE__*/React.createElement("div",{className:"ezsh-wrap"},children)));}// One group inside the shell: a heading, a bounded Iznik marker, the screen's own controls,
// and the hint the screen already showed. `wide` is the only layout choice a tenant makes.
// ============================================================
// ITEM 107 — مواقيتُ الصلاة، حسابًا موضعيًّا
// ============================================================
// THE RULING THIS IMPLEMENTS: accuracy comes from THE METHOD AND THE COORDINATES, not from a
// server. So there is no request, no key, no daily call ceiling and no day on which the times
// stop arriving because a service went away. The whole calculation is a few dozen lines of
// spherical trigonometry over the sun's position, and it works with the aeroplane switch on.
//
// THE ASTRONOMY. The sun's declination and the equation of time are taken from the standard
// low-precision solar position (mean anomaly, mean longitude, ecliptic longitude, obliquity),
// then each prayer is the hour angle at which the sun sits at that prayer's altitude:
//     T(angle) = acos( (−sin(angle) − sin(decl)·sin(lat)) / (cos(decl)·cos(lat)) ) / 15
// Fajr and sunrise are before solar noon, asr, maghrib and isha after it. Asr uses the shadow
// rule rather than an altitude: the altitude at which an object's shadow is its own length plus
// «factor» times its height — factor 1 for the majority, 2 for the Hanafi reckoning.
// Every time is solved TWICE, the second pass evaluating the sun at the fraction of the day the
// first pass produced, because the declination moves measurably between dawn and dusk.
//
// AND WHERE THE SUN NEVER REACHES THE ANGLE, THE ANSWER IS NOTHING. Above roughly 48° of
// latitude in midsummer the acos argument leaves [−1, 1]; that prayer returns null and the row
// is drawn as «—». A number invented for a latitude that cannot produce one would be worse than
// an admission.
//
// THE METHODS ARE WRITTEN OUT, BY NAME AND BY VALUE, in prayerMethodTable() below. Nothing is
// fetched and nothing is defaulted from a table living elsewhere.
//
// 🔴 NOTHING HERE IS CLAIMED TO MATCH THE KUWAITI AWQAF CALENDAR. The reference table was not in
// hand. The default is «الكويت» because it is the method named for this app's own city — NOT
// because it was compared against anything. The batch report prints thirty days at Kuwait City
// coordinates for every method offered, so the owner can make that comparison and then choose.
//
// 🔴 ZERO ADHAN, ZERO NOTIFICATION, ZERO SOUND. A call at the right moment needs a scheduled
// notification in a native shell; that rides with the store release (item 67). Nothing here
// plays, schedules, or hints in the interface that it might.
const PRAYER_PREFS_KEY='ezik_prayer_prefs_v1';const PRAYER_METHOD_DEFAULT='kuwait';const PRAYER_ASR_DEFAULT='standard';const PRAYER_OFFSET_MIN=-15;const PRAYER_OFFSET_MAX=15;const PRAYER_KEYS=['fajr','sunrise','dhuhr','asr','maghrib','isha'];const PRAYER_OFFSETTABLE=['fajr','dhuhr','asr','maghrib','isha'];const PRAYER_LABELS={fajr:'الفجر',sunrise:'الشروق',dhuhr:'الظهر',asr:'العصر',maghrib:'المغرب',isha:'العشاء'};const PRAYER_ASR_LABELS={standard:'الجمهور (ظلُّ المثل)',hanafi:'الحنفيّ (ظلُّ المثلين)'};const PRAYER_HORIZON=0.833;// THE METHODS, each with the angles it is defined by. «ishaMin» above zero means that method
// fixes isha as a fixed interval after maghrib instead of by an angle, which is what Umm al-Qura
// and Qatar do; the angle is then unused and written as 0 rather than as a number that lies.
function prayerMethodTable(){return{kuwait:{name:'الكويت',fajr:18,isha:17.5,ishaMin:0},mwl:{name:'رابطة العالم الإسلاميّ',fajr:18,isha:17,ishaMin:0},egypt:{name:'الهيئة المصريّة العامّة للمساحة',fajr:19.5,isha:17.5,ishaMin:0},makkah:{name:'أمّ القرى',fajr:18.5,isha:0,ishaMin:90},karachi:{name:'جامعة العلوم الإسلاميّة بكراتشي',fajr:18,isha:18,ishaMin:0},isna:{name:'أمريكا الشماليّة (ISNA)',fajr:15,isha:15,ishaMin:0},qatar:{name:'قطر',fajr:18,isha:0,ishaMin:90}};}function prayerMethodIds(){const t=prayerMethodTable();const out=[];for(const k in t)if(Object.prototype.hasOwnProperty.call(t,k))out.push(k);return out;}function prayerMethodOf(id){const t=prayerMethodTable();return Object.prototype.hasOwnProperty.call(t,id)?t[id]:t[PRAYER_METHOD_DEFAULT];}// The sun, at a Julian date. Declination in degrees, equation of time in hours wrapped into
// (−12, 12] so that a mean longitude near the wrap cannot produce a day-long error.
function prayerSunPosition(jd){const R=Math.PI/180;const D=jd-2451545.0;const g=((357.529+0.98560028*D)%360+360)%360;const q=((280.459+0.98564736*D)%360+360)%360;const L=((q+1.915*Math.sin(g*R)+0.020*Math.sin(2*g*R))%360+360)%360;const e=23.439-0.00000036*D;let ra=Math.atan2(Math.cos(e*R)*Math.sin(L*R),Math.cos(L*R))/R/15;ra=(ra%24+24)%24;const decl=Math.asin(Math.sin(e*R)*Math.sin(L*R))/R;let eqt=q/15-ra;eqt=((eqt+12)%24+24)%24-12;return{decl:decl,eqt:eqt};}// Hours from solar noon at which the sun stands at «angle» below the horizon, or null where it
// never does. The null is the whole high-latitude answer and it is deliberate.
function prayerSunAngleTime(angle,decl,lat){const R=Math.PI/180;const den=Math.cos(decl*R)*Math.cos(lat*R);if(den===0)return null;const c=(-Math.sin(angle*R)-Math.sin(decl*R)*Math.sin(lat*R))/den;if(!isFinite(c)||c>1||c<-1)return null;return Math.acos(c)/R/15;}// The shadow rule, expressed as the altitude it corresponds to.
function prayerAsrAngle(factor,decl,lat){const R=Math.PI/180;return-Math.atan(1/(factor+Math.tan(Math.abs(lat-decl)*R)))/R;}// EVERY TIME, IN MINUTES FROM LOCAL MIDNIGHT, or null. The offsets are applied here, each to its
// own prayer and to nothing else, and each clamped on the way out as well as on the way in.
function prayerTimesFor(y,m,d,lat,lng,tzMinutes,methodId,asrMode,offsets){const out={fajr:null,sunrise:null,dhuhr:null,asr:null,maghrib:null,isha:null};if(typeof lat!=='number'||typeof lng!=='number')return out;if(!isFinite(lat)||!isFinite(lng))return out;if(lat<-90||lat>90||lng<-180||lng>180)return out;const tz=typeof tzMinutes==='number'&&isFinite(tzMinutes)?tzMinutes:0;const M=prayerMethodOf(methodId);const factor=asrMode==='hanafi'?2:1;const jd0=hijriJdnFromCivil(y,m,d)-0.5-lng/360;const shift=tz/60-lng/15;const at=hours=>prayerSunPosition(jd0+hours/24);// Two passes: the guess only has to be inside the right half of the day.
const solve=(angleAt,before,guess)=>{let t=guess;for(let i=0;i<2;i++){const p=at(t);const h=prayerSunAngleTime(angleAt(p.decl),p.decl,lat);if(h===null)return null;t=before?12-p.eqt-h:12-p.eqt+h;}return t;};const noon=at(12);const dhuhr=12-noon.eqt;const fajr=solve(()=>M.fajr,true,5);const sunrise=solve(()=>PRAYER_HORIZON,true,6);const maghrib=solve(()=>PRAYER_HORIZON,false,18);const asr=solve(decl=>prayerAsrAngle(factor,decl,lat),false,15);const isha=M.ishaMin>0?maghrib===null?null:maghrib+M.ishaMin/60:solve(()=>M.isha,false,19);const raw={fajr:fajr,sunrise:sunrise,dhuhr:dhuhr,asr:asr,maghrib:maghrib,isha:isha};for(let i=0;i<PRAYER_KEYS.length;i++){const k=PRAYER_KEYS[i];if(raw[k]===null||!isFinite(raw[k])){out[k]=null;continue;}let off=0;if(offsets&&PRAYER_OFFSETTABLE.indexOf(k)!==-1){const v=offsets[k];if(typeof v==='number'&&isFinite(v)&&Math.trunc(v)===v){off=v<PRAYER_OFFSET_MIN?PRAYER_OFFSET_MIN:v>PRAYER_OFFSET_MAX?PRAYER_OFFSET_MAX:v;}}const mins=Math.round(((raw[k]+shift)%24+24)%24*60)+off;out[k]=(mins%1440+1440)%1440;}return out;}// A twelve-hour clock in Arabic-Indic digits. Null draws an em dash, never a zero.
function prayerClock(mins){if(typeof mins!=='number'||!isFinite(mins))return'—';const t=(Math.round(mins)%1440+1440)%1440;const h24=Math.floor(t/60);const mm=t%60;const h12=h24%12===0?12:h24%12;const two=mm<10?'٠'+toArabicDigits(mm):toArabicDigits(mm);return toArabicDigits(h12)+':'+two+' '+(h24<12?'ص':'م');}// THE PREFERENCES. One record, every field checked, and a broken store reads as the shipped
// defaults rather than as an exception on a screen.
function readPrayerPrefs(){const out={method:PRAYER_METHOD_DEFAULT,asr:PRAYER_ASR_DEFAULT,off:{}};for(let i=0;i<PRAYER_OFFSETTABLE.length;i++)out.off[PRAYER_OFFSETTABLE[i]]=0;let raw=null;try{raw=localStorage.getItem(PRAYER_PREFS_KEY);}catch(e){return out;}if(typeof raw!=='string'||!raw)return out;let rec=null;try{rec=JSON.parse(raw);}catch(e){return out;}if(!rec||typeof rec!=='object'||Array.isArray(rec))return out;if(typeof rec.method==='string'&&prayerMethodIds().indexOf(rec.method)!==-1)out.method=rec.method;if(rec.asr==='hanafi'||rec.asr==='standard')out.asr=rec.asr;const o=rec.off;if(o&&typeof o==='object'&&!Array.isArray(o)){for(let i=0;i<PRAYER_OFFSETTABLE.length;i++){const k=PRAYER_OFFSETTABLE[i];const v=o[k];if(typeof v==='number'&&isFinite(v)&&Math.trunc(v)===v&&v>=PRAYER_OFFSET_MIN&&v<=PRAYER_OFFSET_MAX)out.off[k]=v;}}return out;}function writePrayerPrefs(next){const cur=readPrayerPrefs();if(!next||typeof next!=='object')return cur;const rec={method:cur.method,asr:cur.asr,off:cur.off};if(typeof next.method==='string'&&prayerMethodIds().indexOf(next.method)!==-1)rec.method=next.method;if(next.asr==='hanafi'||next.asr==='standard')rec.asr=next.asr;if(next.off&&typeof next.off==='object'){for(let i=0;i<PRAYER_OFFSETTABLE.length;i++){const k=PRAYER_OFFSETTABLE[i];const v=next.off[k];if(typeof v==='number'&&isFinite(v)&&Math.trunc(v)===v&&v>=PRAYER_OFFSET_MIN&&v<=PRAYER_OFFSET_MAX)rec.off[k]=v;}}try{localStorage.setItem(PRAYER_PREFS_KEY,JSON.stringify(rec));}catch(e){return readPrayerPrefs();}return rec;}// One prayer's offset moved by one step, clamped. It returns the WHOLE record, so the control
// can set its state from what was actually stored rather than from what it asked for.
function prayerNudgeOffset(prefs,key,step){const base=readPrayerPrefs();const cur=prefs&&prefs.off&&typeof prefs.off[key]==='number'?prefs.off[key]:base.off[key];if(PRAYER_OFFSETTABLE.indexOf(key)===-1)return base;let v=(typeof cur==='number'&&isFinite(cur)?Math.trunc(cur):0)+(Math.trunc(Number(step))||0);if(v<PRAYER_OFFSET_MIN)v=PRAYER_OFFSET_MIN;if(v>PRAYER_OFFSET_MAX)v=PRAYER_OFFSET_MAX;const off={};off[key]=v;return writePrayerPrefs({off:off});}const PRAYER_TITLE='مواقيت الصلاة';const PRAYER_SETTINGS_TITLE='الصلاة';const PRAYER_METHOD_LABEL='المنهج';const PRAYER_ASR_LABEL='مذهب العصر';const PRAYER_OFFSET_LABEL='إزاحة يدويّة بالدقائق';const PRAYER_HINT='تُحسَب على هذا الجهاز من المنهج والإحداثيّات، بلا إنترنت. قابِلْها بتقويمك وعدِّلْ بالدقائق إن لزم.';const PRAYER_NONE='لا يبلغُ الشفقُ هذه الزاويةَ في هذا الموضع اليوم.';const PRAYER_MINUS='−';const PRAYER_PLUS='+';function PrayerTimesPanel({loc}){const[prefs,setPrefs]=useState(readPrayerPrefs);const now=new Date();const tz=-now.getTimezoneOffset();const t=prayerTimesFor(now.getFullYear(),now.getMonth()+1,now.getDate(),loc.lat,loc.lng,tz,prefs.method,prefs.asr,prefs.off);const anyMissing=PRAYER_KEYS.some(k=>t[k]===null);return/*#__PURE__*/React.createElement(EzShellGroup,{title:PRAYER_TITLE},PRAYER_KEYS.map(k=>/*#__PURE__*/React.createElement("div",{key:k,style:s.prayerRow},/*#__PURE__*/React.createElement("span",{style:s.prayerName},PRAYER_LABELS[k]),/*#__PURE__*/React.createElement("span",{style:s.prayerTime},prayerClock(t[k])))),anyMissing?/*#__PURE__*/React.createElement("div",{style:s.qiblaNote},PRAYER_NONE):null,/*#__PURE__*/React.createElement("div",{style:s.a11yGroupLabel},PRAYER_OFFSET_LABEL),PRAYER_OFFSETTABLE.map(k=>/*#__PURE__*/React.createElement("div",{key:k,style:s.prayerRow},/*#__PURE__*/React.createElement("span",{style:s.prayerName},PRAYER_LABELS[k]),/*#__PURE__*/React.createElement("span",{className:"ez-hit",style:s.prayerStep},/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>setPrefs(prayerNudgeOffset(prefs,k,-1)),"aria-label":PRAYER_LABELS[k]+' '+PRAYER_MINUS,className:"ezik-focus",style:s.prayerStepBtn},PRAYER_MINUS),/*#__PURE__*/React.createElement("span",{style:s.prayerOffVal},(prefs.off[k]>0?PRAYER_PLUS:prefs.off[k]<0?PRAYER_MINUS:'')+toArabicDigits(Math.abs(prefs.off[k]))),/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>setPrefs(prayerNudgeOffset(prefs,k,1)),"aria-label":PRAYER_LABELS[k]+' '+PRAYER_PLUS,className:"ezik-focus",style:s.prayerStepBtn},PRAYER_PLUS)))));}// ITEM 121: preferences move as one intact unit. The storage record, option builders and
// handlers above are unchanged; only this owner moved from the reading sheet to Settings.
function PrayerSettingsControl(){const[prefs,setPrefs]=useState(readPrayerPrefs);return/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{style:s.a11yGroupLabel},PRAYER_METHOD_LABEL),/*#__PURE__*/React.createElement("div",{className:"ez-hit",style:s.prayerOptRow,role:"radiogroup","aria-label":PRAYER_METHOD_LABEL},prayerMethodIds().map(id=>/*#__PURE__*/React.createElement("button",{key:id,type:"button",role:"radio","aria-checked":prefs.method===id?'true':'false',onClick:()=>setPrefs(writePrayerPrefs({method:id})),"data-ezik-prayer-setting":"method",className:"ezik-focus",style:prefs.method===id?{...s.prayerOpt,...s.themeOptActive}:s.prayerOpt},prayerMethodOf(id).name))),/*#__PURE__*/React.createElement("div",{style:s.a11yGroupLabel},PRAYER_ASR_LABEL),/*#__PURE__*/React.createElement("div",{className:"ez-hit",style:s.prayerOptRow,role:"radiogroup","aria-label":PRAYER_ASR_LABEL},['standard','hanafi'].map(mode=>/*#__PURE__*/React.createElement("button",{key:mode,type:"button",role:"radio","aria-checked":prefs.asr===mode?'true':'false',onClick:()=>setPrefs(writePrayerPrefs({asr:mode})),"data-ezik-prayer-setting":"asr",className:"ezik-focus",style:prefs.asr===mode?{...s.prayerOpt,...s.themeOptActive}:s.prayerOpt},PRAYER_ASR_LABELS[mode]))));}// ============================================================
// ITEM 108-أ — اتّجاه القبلة
// ============================================================
// THE NUMBER. The initial bearing of the great circle from the reader to the Kaaba, which is the
// direction a straight walk to Mecca starts in. It is not the bearing of a line on a flat map:
// on a Mercator projection Kuwait would point south-west by a different angle, and the further
// from the equator the reader is the worse that error becomes.
//
// MEASURED AGAINST PUBLISHED VALUES rather than trusted: Cairo 136.14°, Istanbul 151.62°,
// London 118.99°, Jakarta 295.15°, New York 58.48°, Kuwait City 224.62°. Two degenerate cases
// pin the formula's orientation from the other side — a point due north of the Kaaba answers
// exactly 180.00, and a point due east answers 270.18 (a great circle, not a rhumb line).
//
// THE COMPASS IS THE HALF THAT HAD TO BE MEASURED, and the measurement changed the design.
// Chrome 151 on Windows, on a secure origin, reports:
//     DeviceOrientationEvent           = "function"
//     'ondeviceorientationabsolute' in window = TRUE
//     AbsoluteOrientationSensor        = "function"
//     DeviceOrientationEvent.requestPermission = not a function
//     webkitCompassHeading on prototype = FALSE
//     event arriving within 2s: headless "relative:alpha=null" · headed "none"
// So FEATURE DETECTION SAYS YES AND THERE IS NO HEADING. A screen that decided "the sensor
// exists, draw a needle" from 'ondeviceorientationabsolute' in window would draw a needle that
// never moves and is not pointing anywhere — the still needle that lies, which this item forbids
// by name. Therefore the needle is drawn ONLY after a reading with a usable, absolute, numeric
// heading has actually arrived. Until then the reader gets the degree and a sentence saying why
// nothing is turning.
//
// iOS WAS NOT MEASURED — there is no device here, and this file states nothing about it that was
// not measured. What the code does is the only shape that is correct either way: the sensor is
// never started until the reader presses a button, and DeviceOrientationEvent.requestPermission
// -- which does not exist on the engine measured above -- is called only from inside that press,
// so a permission prompt raised there is raised from a gesture. A gesture requirement is
// therefore satisfied if it exists and costs nothing if it does not.
//
// ZERO NETWORK. The bearing is arithmetic, the default coordinates are two numbers in this file,
// and the device position — which is never asked for until the reader asks for it — comes from
// the platform's own geolocation, not from a lookup service.
const KAABA_LAT=21.422487;const KAABA_LNG=39.826206;const QIBLA_DEFAULT_LAT=29.3759;const QIBLA_DEFAULT_LNG=47.9774;const QIBLA_DEFAULT_PLACE='مدينة الكويت';const QIBLA_LOC_KEY='ezik_qibla_loc_v1';const QIBLA_DIRS=['الشمال','الشمال الشرقيّ','الشرق','الجنوب الشرقيّ','الجنوب','الجنوب الغربيّ','الغرب','الشمال الغربيّ'];// Degrees clockwise from true north, 0 <= b < 360, or null when the position is not a position.
function qiblaBearing(lat,lng){if(typeof lat!=='number'||typeof lng!=='number')return null;if(!isFinite(lat)||!isFinite(lng))return null;if(lat<-90||lat>90||lng<-180||lng>180)return null;const R=Math.PI/180;const p1=lat*R;const p2=KAABA_LAT*R;const dl=(KAABA_LNG-lng)*R;const y=Math.sin(dl)*Math.cos(p2);const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);if(x===0&&y===0)return null;return(Math.atan2(y,x)/R+360)%360;}// The eight-point name, so the number is never the only thing said. The bands are 45° wide and
// centred on their point, which is why the offset is 22.5 rather than 0.
function qiblaDirName(deg){if(typeof deg!=='number'||!isFinite(deg))return'';const i=Math.floor(((deg%360+360)%360+22.5)/45)%8;return QIBLA_DIRS[i];}function qiblaDegreeText(deg){if(typeof deg!=='number'||!isFinite(deg))return'';const one=Math.round((deg%360+360)%360*10)/10;const whole=Math.floor(one);const tenth=Math.round((one-whole)*10);return toArabicDigits(whole)+'٫'+toArabicDigits(tenth);}// A HEADING, OR NOTHING. Three refusals, and the middle one is the measured lesson: an event that
// is not absolute is a relative gyroscope reading, and a relative reading pointed at a compass
// rose is a lie with a needle on it.
function qiblaHeadingOf(ev){if(!ev)return null;const wk=ev.webkitCompassHeading;if(typeof wk==='number'&&isFinite(wk)&&wk>=0&&wk<=360)return(wk%360+360)%360;if(ev.absolute!==true)return null;const a=ev.alpha;if(typeof a!=='number'||!isFinite(a))return null;return((360-a%360)%360+360)%360;}// How far to turn the needle: the qibla, seen from a device that is itself pointing somewhere.
function qiblaNeedleAngle(bearing,heading){if(typeof bearing!=='number'||!isFinite(bearing))return null;if(typeof heading!=='number'||!isFinite(heading))return null;return((bearing-heading)%360+360)%360;}// THE POSITION. Default Kuwait, always readable, never written by a read. `by` says which it is,
// so no line on the screen can call the default a measurement.
function readQiblaLoc(){let raw=null;try{raw=localStorage.getItem(QIBLA_LOC_KEY);}catch(e){raw=null;}if(typeof raw==='string'&&raw){let rec=null;try{rec=JSON.parse(raw);}catch(e){rec=null;}if(rec&&typeof rec==='object'&&!Array.isArray(rec)&&typeof rec.lat==='number'&&typeof rec.lng==='number'&&isFinite(rec.lat)&&isFinite(rec.lng)&&rec.lat>=-90&&rec.lat<=90&&rec.lng>=-180&&rec.lng<=180){return{lat:rec.lat,lng:rec.lng,by:'device'};}}return{lat:QIBLA_DEFAULT_LAT,lng:QIBLA_DEFAULT_LNG,by:'default'};}function writeQiblaLoc(lat,lng){if(typeof lat!=='number'||typeof lng!=='number')return readQiblaLoc();if(!isFinite(lat)||!isFinite(lng))return readQiblaLoc();if(lat<-90||lat>90||lng<-180||lng>180)return readQiblaLoc();try{localStorage.setItem(QIBLA_LOC_KEY,JSON.stringify({lat:lat,lng:lng}));}catch(e){return readQiblaLoc();}return{lat:lat,lng:lng,by:'device'};}function clearQiblaLoc(){try{localStorage.removeItem(QIBLA_LOC_KEY);}catch(e){}return readQiblaLoc();}const QIBLA_TITLE='القبلة';const QIBLA_SECTION='اتّجاه القبلة';const QIBLA_DEG_SUFFIX='درجةً عن الشمال';const QIBLA_TOWARD='نحوَ';const QIBLA_PLACE_LABEL='الموضع:';const QIBLA_PLACE_DEFAULT_NOTE='افتراضيّ';const QIBLA_DEVICE_PLACE='موقعُ هذا الجهاز';const QIBLA_USE_DEVICE='استخدمْ موقعَ هذا الجهاز';const QIBLA_USE_DEFAULT='عُدْ إلى الموضع الافتراضيّ';const QIBLA_LOC_ASKING='يُطلَبُ الإذنُ بالموقع الآن…';const QIBLA_LOC_DENIED='لم يُمنَحِ الإذنُ بالموقع، والموضعُ الافتراضيُّ باقٍ كما هو.';const QIBLA_COMPASS_START='شغِّلِ البوصلة';const QIBLA_COMPASS_WAIT='بانتظارِ قراءةٍ من حسّاسِ الاتّجاه…';const QIBLA_COMPASS_NONE='لا تدورُ البوصلةُ على هذا الجهاز: لم تصلْ قراءةٌ صالحةٌ من حسّاسِ الاتّجاه، فالدرجةُ وحدَها هي المعروضة.';const QIBLA_COMPASS_LIVE='البوصلةُ تدورُ مع الجهاز.';const QIBLA_BACK='رجوع';// ITEM 107: the sheet now holds both readings, so it is named for both. The tile that opens it
// is renamed with it -- one tile, one sheet, one position.
const PRAYER_SHEET_TITLE='الصلاة والقبلة';const QIBLA_NEEDLE_MS=4000;function QiblaPanel({loc,onLoc}){const setLoc=onLoc;const[locState,setLocState]=useState('');// 'off' before the reader asks; 'wait' while listening; 'live' once a real heading arrived;
// 'none' when the listening window closed with nothing usable in it.
const[compass,setCompass]=useState('off');const[heading,setHeading]=useState(null);const stopRef=useRef(null);useEffect(()=>()=>{if(stopRef.current){stopRef.current();stopRef.current=null;}},[]);const bearing=qiblaBearing(loc.lat,loc.lng);// EXPLICIT TOUCH, THEN THE PERMISSION. Nothing on this path runs at mount.
const askLocation=()=>{if(typeof navigator==='undefined'||!navigator.geolocation){setLocState('denied');return;}setLocState('asking');try{navigator.geolocation.getCurrentPosition(pos=>{const c=pos&&pos.coords;if(!c){setLocState('denied');return;}setLoc(writeQiblaLoc(c.latitude,c.longitude));setLocState('');},()=>{setLocState('denied');},{enableHighAccuracy:false,timeout:10000,maximumAge:600000});}catch(e){setLocState('denied');}};const useDefault=()=>{setLoc(clearQiblaLoc());setLocState('');};const startCompass=()=>{if(compass==='wait'||compass==='live')return;setCompass('wait');const onEvent=ev=>{const h=qiblaHeadingOf(ev);if(h===null)return;// a reading with nothing in it is not a reading
setHeading(h);setCompass('live');};let timer=null;const attach=()=>{try{window.addEventListener('deviceorientationabsolute',onEvent);window.addEventListener('deviceorientation',onEvent);}catch(e){setCompass('none');return;}timer=setTimeout(()=>{setCompass(c=>c==='live'?c:'none');},QIBLA_NEEDLE_MS);stopRef.current=()=>{if(timer){clearTimeout(timer);timer=null;}try{window.removeEventListener('deviceorientationabsolute',onEvent);window.removeEventListener('deviceorientation',onEvent);}catch(e){}};};// The gesture requirement, satisfied where it exists: this whole function runs inside the
// press, so a permission prompt raised here is raised from a user gesture.
const DOE=typeof window!=='undefined'?window.DeviceOrientationEvent:null;if(DOE&&typeof DOE.requestPermission==='function'){let p=null;try{p=DOE.requestPermission();}catch(e){setCompass('none');return;}if(p&&typeof p.then==='function'){p.then(r=>{if(r==='granted')attach();else setCompass('none');},()=>setCompass('none'));return;}setCompass('none');return;}attach();};const needle=qiblaNeedleAngle(bearing,heading);const placeName=loc.by==='device'?QIBLA_DEVICE_PLACE:QIBLA_DEFAULT_PLACE;return/*#__PURE__*/React.createElement(EzShellGroup,{title:QIBLA_SECTION},bearing===null?null:/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{style:s.qiblaDeg},qiblaDegreeText(bearing)," ",QIBLA_DEG_SUFFIX),/*#__PURE__*/React.createElement("div",{style:s.qiblaDir},QIBLA_TOWARD," ",qiblaDirName(bearing))),compass==='live'&&needle!==null?/*#__PURE__*/React.createElement("div",{style:s.qiblaDialWrap},/*#__PURE__*/React.createElement("svg",{width:"132",height:"132",viewBox:"0 0 100 100",role:"img","aria-label":QIBLA_SECTION},/*#__PURE__*/React.createElement("circle",{cx:"50",cy:"50",r:"46",fill:"none",stroke:"var(--line)",strokeWidth:"2"}),/*#__PURE__*/React.createElement("g",{style:{transform:'rotate('+needle+'deg)',transformOrigin:'50px 50px'}},/*#__PURE__*/React.createElement("path",{d:"M50 8 L58 54 L50 48 L42 54 Z",fill:"var(--red)"}),/*#__PURE__*/React.createElement("circle",{cx:"50",cy:"50",r:"4",fill:"var(--ink)"})))):null,/*#__PURE__*/React.createElement("div",{style:s.qiblaNote},compass==='live'?QIBLA_COMPASS_LIVE:compass==='wait'?QIBLA_COMPASS_WAIT:compass==='none'?QIBLA_COMPASS_NONE:''),compass==='off'||compass==='none'?/*#__PURE__*/React.createElement("button",{type:"button",onClick:startCompass,className:"ezik-focus",style:s.qiblaBtn},QIBLA_COMPASS_START):null,/*#__PURE__*/React.createElement("div",{style:s.qiblaPlace},QIBLA_PLACE_LABEL," ",placeName,loc.by==='device'?'':' ('+QIBLA_PLACE_DEFAULT_NOTE+')'),locState==='asking'?/*#__PURE__*/React.createElement("div",{style:s.qiblaNote},QIBLA_LOC_ASKING):null,locState==='denied'?/*#__PURE__*/React.createElement("div",{style:s.qiblaNote},QIBLA_LOC_DENIED):null,loc.by==='device'?/*#__PURE__*/React.createElement("button",{type:"button",onClick:useDefault,className:"ezik-focus",style:s.qiblaBtn},QIBLA_USE_DEFAULT):/*#__PURE__*/React.createElement("button",{type:"button",onClick:askLocation,className:"ezik-focus",style:s.qiblaBtn},QIBLA_USE_DEVICE));}// THE SHEET, AND WHY IT IS A SHEET RATHER THAN A SCREEN. index.html's screen inventory is a
// CROSS-FILE contract: theme-coverage-guard reads EZIK-THEME-33-HANDOFF.md and requires its
// table and its Arabic screen count to match the set of `screen === '...'` branches in this
// file. That document belongs to a different owner and is not this batch's to edit, so adding a
// route would have broken a gate for a reason that has nothing to do with the qibla. It opens
// from the home, over the home, on the home's own screen key, and its back button returns there.
function PrayerSheet({onClose}){// ONE POSITION FOR BOTH PANELS. The times and the qibla are two readings of the same place,
// so the place is state here and the controls that change it stay where item 108-أ put them.
const[loc,setLoc]=useState(readQiblaLoc);return/*#__PURE__*/React.createElement(EzShell,{title:PRAYER_SHEET_TITLE,onBack:onClose,backLabel:QIBLA_BACK},/*#__PURE__*/React.createElement(PrayerTimesPanel,{loc:loc}),/*#__PURE__*/React.createElement(QiblaPanel,{loc:loc,onLoc:setLoc}));}// ============================================================
// ITEM 109 — التاريخ الهجريّ، محسوبًا على تقويمٍ مسمًّى
// ============================================================
// THE FAULT: an arithmetical Hijri calendar drifts from the calendar people actually live by.
// The tabular rule inserts its leap day on a 30-year cycle; a real calendar is fixed by a
// decision about a crescent. Measured against Umm al-Qura across the dates below, the tabular
// value ran 0 to 2 days early — which is exactly the size of error that makes a date line worse
// than no date line at all.
//
// SO THE CONVERSION IS PINNED TO A CALENDAR THAT IS NAMED HERE BY ITS NAME. `islamic-umalqura`
// is a real calendar with real tabulated month lengths, and it ships with the browser: this is
// a local lookup through Intl, not a request. Two things are asserted before its answer is used:
// the formatter must RESOLVE to that calendar (an engine that quietly substitutes islamic-civil
// is refused rather than believed), and the fields must be a possible Hijri date.
//
// AND WHEN IT IS NOT THERE, THE FALLBACK IS NAMED TOO. `tabular-civil-IIa` is the arithmetical
// calendar — civil epoch (JDN 1948440 = 1 Muharram 1 AH), leap years {2,5,7,10,13,16,18,21,24,
// 26,29} of each 30-year cycle. It is the thing the item calls insufficient, so it is the
// fallback and never the answer: every returned record carries `by`, so which calendar spoke is
// never a guess.
//
// ZERO NETWORK. Intl is in the engine, the arithmetic is arithmetic, and the offset is one
// number in localStorage. Nothing on this path fetches, and nothing on it is a model call.
//
// THE OFFSET IS THE READER'S, AND IT IS SMALL ON PURPOSE. −2..+2 days, default 0, stored under a
// key that carries its version. It is applied to the CIVIL day before conversion — so a +1 that
// crosses a Hijri month end rolls the month properly instead of producing a 31st — and it is
// clamped on the way OUT as well as on the way in, so a hand-edited store cannot move the date
// by a week.
//
// WHAT IS NOT CLAIMED. This is not asserted to match the Kuwaiti Ministry of Awqaf calendar. The
// reference calendar was not in hand, so no agreement with it is claimed anywhere in this code,
// this comment or the interface. The thirty-day table in the batch report exists to be checked
// against it by hand.
const HIJRI_CALENDAR='islamic-umalqura';const HIJRI_FALLBACK_CALENDAR='tabular-civil-IIa';const HIJRI_OFFSET_KEY='ezik_hijri_offset_v1';const HIJRI_OFFSET_MIN=-2;const HIJRI_OFFSET_MAX=2;const HIJRI_MONTHS=['المحرَّم','صفر','ربيع الأوّل','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوّال','ذو القعدة','ذو الحجّة'];const HIJRI_SUFFIX='هـ';// Julian Day Number for a proleptic-Gregorian civil date. Integer in, integer out, and it is the
// ONLY place a calendar date becomes a number — the offset, the conversion and the inverse all
// meet here, so they cannot disagree about what a day is.
function hijriJdnFromCivil(y,m,d){const a=Math.floor((14-m)/12);const yy=y+4800-a;const mm=m+12*a-3;return d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;}function hijriCivilFromJdn(jdn){const a=jdn+32044;const b=Math.floor((4*a+3)/146097);const c=a-Math.floor(146097*b/4);const dd=Math.floor((4*c+3)/1461);const e=c-Math.floor(1461*dd/4);const mi=Math.floor((5*e+2)/153);return{y:100*b+dd-4800+Math.floor(mi/10),m:mi+3-12*Math.floor(mi/10),d:e-Math.floor((153*mi+2)/5)+1};}// THE ARITHMETICAL CALENDAR, and it is the fallback rather than the answer.
function hijriTabularFromJdn(jdn){let l=jdn-1948440+10632;const n=Math.floor((l-1)/10631);l=l-10631*n+354;const j=Math.floor((10985-l)/5316)*Math.floor(50*l/17719)+Math.floor(l/5670)*Math.floor(43*l/15238);l=l-Math.floor((30-j)/15)*Math.floor(17719*j/50)-Math.floor(j/16)*Math.floor(15238*j/43)+29;const m=Math.floor(24*l/709);return{y:30*n+j-30,m:m,d:l-Math.floor(709*m/24)};}// Umm al-Qura, through the engine's own tables. It is handed a TIMESTAMP rather than a Date, so
// this function needs no clock at all: noon UTC of the civil day the JDN names.
function hijriUmalquraFromJdn(jdn){try{if(typeof Intl==='undefined'||typeof Intl.DateTimeFormat!=='function')return null;const fmt=new Intl.DateTimeFormat('en-u-ca-'+HIJRI_CALENDAR,{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'});if(typeof fmt.resolvedOptions!=='function')return null;if(fmt.resolvedOptions().calendar!==HIJRI_CALENDAR)return null;if(typeof fmt.formatToParts!=='function')return null;const parts=fmt.formatToParts((jdn-2440588)*86400000+43200000);let y=0,m=0,d=0;for(let i=0;i<parts.length;i++){const p=parts[i];if(p.type==='year')y=parseInt(String(p.value).replace(/[^0-9]/g,''),10);else if(p.type==='month')m=parseInt(String(p.value).replace(/[^0-9]/g,''),10);else if(p.type==='day')d=parseInt(String(p.value).replace(/[^0-9]/g,''),10);}if(!(y>0&&m>=1&&m<=12&&d>=1&&d<=30))return null;return{y:y,m:m,d:d};}catch(e){return null;}}function hijriFromJdn(jdn){const named=hijriUmalquraFromJdn(jdn);if(named){named.by=HIJRI_CALENDAR;return named;}const t=hijriTabularFromJdn(jdn);t.by=HIJRI_FALLBACK_CALENDAR;return t;}// THE OFFSET IS CLAMPED HERE TOO. Not only when it is written: a store edited by hand, or one
// carrying a value from a future version, may not move the date further than the pair allows.
function hijriForCivilDay(y,m,d,offset){let k=Math.trunc(Number(offset));if(!isFinite(k))k=0;if(k<HIJRI_OFFSET_MIN)k=HIJRI_OFFSET_MIN;if(k>HIJRI_OFFSET_MAX)k=HIJRI_OFFSET_MAX;const out=hijriFromJdn(hijriJdnFromCivil(y,m,d)+k);out.offset=k;return out;}// ANYTHING UNUSABLE READS AS ZERO AND NEVER THROWS. A storage that denies reads, a value that is
// not a number, a number outside the pair — all of them are "no offset", which is the app as it
// was before this item.
function readHijriOffset(){let raw=null;try{raw=localStorage.getItem(HIJRI_OFFSET_KEY);}catch(e){return 0;}if(typeof raw!=='string'||!/^-?[0-9]+$/.test(raw))return 0;const n=Number(raw);if(n<HIJRI_OFFSET_MIN||n>HIJRI_OFFSET_MAX)return 0;return n;}// IT RETURNS WHAT IS NOW IN EFFECT, never what was asked for. A refused value and a store that
// denied the write both come back as the value the next read would give -- so the control can
// set its own state from this return and cannot end up showing a choice that was not stored.
function writeHijriOffset(n){if(typeof n!=='number'||!isFinite(n)||Math.trunc(n)!==n||n<HIJRI_OFFSET_MIN||n>HIJRI_OFFSET_MAX)return readHijriOffset();try{localStorage.setItem(HIJRI_OFFSET_KEY,String(n));}catch(e){return readHijriOffset();}return n;}function hijriLabel(h){if(!h||!(h.m>=1)||!(h.m<=12))return'';return toArabicDigits(h.d)+' '+HIJRI_MONTHS[h.m-1]+' '+toArabicDigits(h.y)+' '+HIJRI_SUFFIX;}// The one place the clock is read. Three local getters and nothing else — no UTC getter and no
// toISOString, so a reader east of Greenwich sees their own day and not London's.
function hijriTodayLabel(){try{const now=new Date();return hijriLabel(hijriForCivilDay(now.getFullYear(),now.getMonth()+1,now.getDate(),readHijriOffset()));}catch(e){return'';}}// THE OFFSET CONTROL, in Settings. It owns its own value: it is a device-local preference of the
// same family as the wird target, it is read once when the sheet opens and written on the press,
// and nothing above it has to carry it. Five buttons, one radiogroup, the shipped a11y row style.
const HIJRI_SET_TITLE='التاريخ الهجريّ';const HIJRI_SET_LABEL='إزاحة يدويّة بالأيّام';const HIJRI_SET_HINT='يُحسَب على هذا الجهاز بلا إنترنت، على تقويم أمّ القرى. إن خالفَ التقويمَ المعمولَ به عندك بيومٍ أو يومين فعدِّلْه من هنا.';const HIJRI_SET_NOW='اليوم عندك:';function HijriOffsetControl(){const[off,setOff]=useState(()=>readHijriOffset());const choose=v=>{setOff(writeHijriOffset(v));};const today=(()=>{try{const now=new Date();return hijriLabel(hijriForCivilDay(now.getFullYear(),now.getMonth()+1,now.getDate(),off));}catch(e){return'';}})();const opts=[];for(let v=HIJRI_OFFSET_MIN;v<=HIJRI_OFFSET_MAX;v++)opts.push(v);return/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("div",{style:s.a11yGroupLabel},HIJRI_SET_LABEL),/*#__PURE__*/React.createElement("div",{style:s.themeRow,role:"radiogroup","aria-label":HIJRI_SET_LABEL},opts.map(v=>/*#__PURE__*/React.createElement("button",{key:v,type:"button",role:"radio","aria-checked":off===v?'true':'false',onClick:()=>choose(v),"data-ezik-prayer-setting":"hijri",className:"ezik-focus",style:{...s.a11yOpt,...(off===v?s.themeOptActive:{})}},v===0?toArabicDigits(0):(v>0?'+':'−')+toArabicDigits(Math.abs(v))))),/*#__PURE__*/React.createElement("div",{style:s.hijriNow},HIJRI_SET_NOW," ",today));}// ============================================================
// ITEM 93-ج — THE CHANNEL THE WORKER OPENED NOW HAS A LISTENER
// ============================================================
// MEASURED FIRST, from sw.js, which is read here and written nowhere: at the end of install the
// worker calls announceInstall(), which posts installSummary() to every connected client. The
// shape is not assumed — it is the object literal in sw.js:
//
//   { ezik: 'precache-report', failed: <number>, entries: [{url, reason}],
//     skipped: null | 'quota', persist, evicted, retried }
//
// «ezik» is the tag, «failed» is the count the worker itself says is "the only field a consumer
// can branch on without parsing", and «skipped» separates "seven files failed" from "nothing was
// even attempted because the disk could not hold CORE". Those two ask opposite things of the
// reader, so they are the two sentences below and there is no third.
//
// WHAT THIS IS NOT, and each absence is a rule of the item rather than an omission:
//   * no retry — nothing here re-registers, re-installs, or asks the worker to try again;
//   * no network — this path has no fetch, no request and no model call of any kind;
//   * no recovery surface — there is no "fix it" button, because there is nothing this page
//     could press that would make room on a full disk;
//   * no raw browser text — «entries[].reason» is a word this app chose ('quota' | 'network' |
//     'other') and even that is not shown; a reader told "TypeError: Failed to fetch" has been
//     told nothing they can act on, which is the very silence item 93 set out to end.
//   * and a SUCCESSFUL brief draws nothing at all. The overwhelmingly common install is the
//     healthy one, and a banner that appears on it would train the reader to dismiss the one
//     that matters.
//
// ONCE PER SESSION. «ezikSwNoticeSpent» is module-level, not component state, so «حسنًا» closes
// it for the tab and not merely for this mount: a worker that re-announces after an update, or a
// second listener attached across a remount, cannot bring the same sentence back.
const EZIK_SW_REPORT_TAG='precache-report';const EZIK_SW_MSG_PARTIAL='لم يكتملْ حفظُ بعضِ الملفّاتِ للعملِ بلا إنترنت.';const EZIK_SW_MSG_NONE='لم يُحفَظْ شيءٌ للعملِ بلا إنترنت: مساحةُ الجهازِ لا تكفي.';const EZIK_SW_MSG_TAIL='والتطبيقُ يعملُ كما هو ما دامَ الإنترنتُ متّصلًا.';const EZIK_SW_OK='حسنًا';const EZIK_SW_ARIA='إشعارُ الحفظِ للعملِ بلا إنترنت';// PURE. It takes the message and returns the sentence to draw, or null for "draw nothing". No
// storage, no clock, no DOM and no state — which is what lets the guard drive every branch of it
// with a literal object rather than with a browser.
function ezikPrecacheNotice(report){if(!report||typeof report!=='object')return null;if(report.ezik!==EZIK_SW_REPORT_TAG)return null;if(report.skipped==='quota')return EZIK_SW_MSG_NONE;const failed=report.failed;if(typeof failed!=='number'||!isFinite(failed)||failed<=0)return null;return EZIK_SW_MSG_PARTIAL;}let ezikSwNoticeSpent=false;function EzikPrecacheNotice(){const[text,setText]=useState(null);useEffect(()=>{if(typeof navigator==='undefined'||!navigator.serviceWorker)return undefined;const onMessage=e=>{if(ezikSwNoticeSpent)return;const line=ezikPrecacheNotice(e&&e.data);if(!line)return;ezikSwNoticeSpent=true;setText(line);};try{navigator.serviceWorker.addEventListener('message',onMessage);}catch(err){return undefined;}return()=>{try{navigator.serviceWorker.removeEventListener('message',onMessage);}catch(err){}};},[]);if(!text)return null;return/*#__PURE__*/React.createElement("div",{role:"status","aria-label":EZIK_SW_ARIA,style:s.swNote},/*#__PURE__*/React.createElement("span",{style:s.swNoteText},text," ",EZIK_SW_MSG_TAIL),/*#__PURE__*/React.createElement("span",{className:"ez-hit",style:s.swNoteHit},/*#__PURE__*/React.createElement("button",{type:"button",onClick:()=>setText(null),className:"ezik-focus",style:s.swNoteBtn},EZIK_SW_OK)));}function EzShellGroup({title,hint,wide,children}){return/*#__PURE__*/React.createElement("section",{className:wide?'ezsh-group is-wide':'ezsh-group'},/*#__PURE__*/React.createElement("div",{className:"adhkar3",style:s.ezshGroup},/*#__PURE__*/React.createElement("div",{style:s.ezshGroupHead},/*#__PURE__*/React.createElement("span",{style:s.ezshGroupMark,"aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{style:s.settingsLabel},title)),children,hint?/*#__PURE__*/React.createElement("div",{style:s.settingsHint},hint):null));}// ---- S105 ISTANA SHELL END ----------------------------------------------------------------
// ============================================================
// SETTINGS -- الخصوصية والذكاء الاصطناعي
// ============================================================
// The permanent home of the consent decision, so a reader who agreed on day one can find, read
// and undo it on day two. Apple 5.1.1(i) requires the withdrawal to be as reachable as the grant.
const EZ_AIS_TITLE='الخصوصية والذكاء الاصطناعي';const EZ_AIS_ON='الحالة: مُفعَّلة — تمت الموافقة على مشاركة البيانات مع خدمات الذكاء الاصطناعي.';const EZ_AIS_OFF='الحالة: غير مفعَّلة — لم تتم الموافقة، ولا تُرسَل أيّ بيانات إلى خدمات الذكاء الاصطناعي.';const EZ_AIS_BY_GUARDIAN='المُوافِق: ولي الأمر.';const EZ_AIS_BY_USER='المُوافِق: المستخدم.';// Same bidi lesson as the version line, seen in the same screenshot: a long Latin run inside an
// RTL sentence pushes the Arabic full stop to the paragraph's logical end, so the last line read
// ".Search". The vendor names are one LTR run and are isolated as one; the sentence keeps its
// Arabic label and drops the trailing stop, which had nowhere correct to sit.
const EZ_AIS_PROVIDERS_LABEL='الجهات:';const EZ_AIS_PROVIDERS_NAMES='Anthropic (Claude) — ElevenLabs — Brave Search';const EZ_AIS_PROVIDERS=EZ_AIS_PROVIDERS_LABEL+' '+EZ_AIS_PROVIDERS_NAMES;const EZ_AIS_WITHDRAW='سحب الموافقة وإيقاف ميزات الذكاء الاصطناعي';const EZ_AIS_REVIEW='مراجعة الموافقة وتشغيل ميزات الذكاء الاصطناعي';const EZ_AIS_KEEP='سحب الموافقة يوقف الإرسال المستقبليّ فوراً، ولا يحذف محادثاتك المحفوظة على هذا الجهاز.';function SettingsSheet({theme,onTheme,onBack,onOpenControl,a11y,onA11y,onA11yReset,aiConsent,aiConsentBy,onWithdrawAI,onReviewAI}){// S90 -- التحكم. The single row that leads to the parental area, and the ONLY thing left in
// the app that opens the PIN gate. Everything above it -- the theme/dark choice and the
// interface style -- is reached without a PIN, which is the whole point of this screen: a
// parent's lock is not a lock on the appearance of the app. The label is built from escapes in
// a JS expression, never a quoted JSX attribute, so the file stays ASCII-safe either side.
const A_CONTROL=ezT('settings.control');// S105: the screen title and the appearance heading, lifted to constants so the shell and
// the guard name the same strings the screen already showed.
const A_SETTINGS=ezT('settings.title');const A_APPEARANCE=ezT('settings.appearance');// U+0627 U+0644 U+062A U+062D U+0643 U+0645
// D89: this entry is rendered ONLY while a valid founder token is held. hasFounderToken() is
// read here, at render, and never from a cached flag -- the rule every other gate in this file
// follows. It is a VISIBILITY rule, not the lock: api/unlock.js refuses a set-pin call that
// arrives without a token no matter what this UI chooses to draw.
const canSetPin=hasFounderToken();// Read ONCE, at mount, from the one reader -- the same rule pin1/pin2 below follow. The value
// only ever changes through applyWatermarkOpacity, so what is on screen, what is on the
// document root and what is in the store cannot disagree.
const[wmOpacity,setWmOpacity]=useState(readWatermarkOpacity);const[wmHide,setWmHide]=useState(readWatermarkAutoHide);// Read once at mount from the one reader, written through the one writer -- the watermark
// rule exactly. The switch shows the RESOLVED behaviour, so an `auto` device shows the
// state it is actually in rather than a third word the reader never chose.
const[enterPref,setEnterPref]=useState(readEnterPref);const enterIsTouch=ezikComposerIsTouch();const enterSendsNow=ezikEnterSends(enterPref,enterIsTouch);const[pin1,setPin1]=useState('');const[pin2,setPin2]=useState('');const[pinMsg,setPinMsg]=useState('');const[pinBusy,setPinBusy]=useState(false);const savePin=async()=>{if(pinBusy)return;// The ONLY check made here, because the server is sent one value and never sees the second
// field. Length, shape and authorisation are the server's to judge and the server's to word.
if(pin1!==pin2){setPinMsg(ezT('pin.mismatch'));return;}setPinBusy(true);setPinMsg('');try{const r=await fetch('/api/unlock',{method:'POST',headers:{'Content-Type':'application/json',...capHeaders()},// carries the founder token
credentials:'same-origin',body:JSON.stringify({action:'set-pin',pin:pin1,deviceId:getDeviceId()})});const d=await r.json().catch(()=>({}));const good=r.ok&&d&&d.ok===true;// The SERVER owns every refusal's wording: a missing token, a short code and an
// unreachable store are three different truths and only it knows which.
setPinMsg(good?ezT('pin.changed'):d&&d.message||'');if(good){setPin1('');setPin2('');}}catch(e){setPinMsg('');// a network failure carries no server message; do not invent one
}setPinBusy(false);};const Opt=({value,label})=>/*#__PURE__*/React.createElement("button",{onClick:()=>onTheme(value),"aria-pressed":theme===value,style:{...s.themeOpt,...(theme===value?s.themeOptActive:{})}},/*#__PURE__*/React.createElement("span",{style:{...s.themeSwatch,background:value==='dark'?'#171B24':'#FFFFFF',borderColor:value==='dark'?'#2A313D':'#E5EBF5'}}),/*#__PURE__*/React.createElement("span",null,label));// S102 -- THE ACTIVE APPLICATION DESIGN. This is a STATEMENT, not a chooser: there is one
// reachable design in this correction stage, so there is no radiogroup, no aria-checked, no
// click handler and nothing focusable here. qibla_13 appears once, as a disabled line that
// says it is coming -- it is a <div>, it is aria-disabled, it cannot be tabbed to and there
// is no code path from this card that could write it. Journey and Deck appear nowhere.
const visualTheme=useEzikVisualTheme();return/*#__PURE__*/React.createElement(EzShell,{title:A_SETTINGS,onBack:onBack,backLabel:A2_BACK},/*#__PURE__*/React.createElement("div",{className:"ezsh-grid"},/*#__PURE__*/React.createElement(EzShellGroup,{title:A_APPEARANCE,hint:ezT('settings.savedOnDevice')},/*#__PURE__*/React.createElement("div",{style:s.themeRow},/*#__PURE__*/React.createElement(Opt,{value:"light",label:ezT('settings.themeLight')}),/*#__PURE__*/React.createElement(Opt,{value:"dark",label:ezT('settings.themeDark')}))),/*#__PURE__*/React.createElement(EzShellGroup,{title:ezT('settings.language')},/*#__PURE__*/React.createElement("div",{className:"ezlang-row"},/*#__PURE__*/React.createElement(EzLangControl,{variant:"settings"}))),/*#__PURE__*/React.createElement(EzShellGroup,{title:EZ_VT_TITLE},visualTheme===EZIK_VISUAL_THEME_ISTANA&&/*#__PURE__*/React.createElement("div",{style:s.vtActiveRow},/*#__PURE__*/React.createElement("span",{style:s.vtActiveMark,"aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{style:s.vtActiveBody},/*#__PURE__*/React.createElement("span",{style:s.vtActiveName},EZ_VT_ISTANA),/*#__PURE__*/React.createElement("span",{style:s.vtActiveState},EZ_VT_ACTIVE))),/*#__PURE__*/React.createElement("div",{style:s.vtSoonRow,"aria-disabled":"true"},/*#__PURE__*/React.createElement("span",{style:s.vtSoonName},EZ_VT_QIBLA),/*#__PURE__*/React.createElement("span",{style:s.vtSoonTag},EZ_VT_SOON))),/*#__PURE__*/React.createElement(EzShellGroup,{title:EZIK_A11Y_TITLE,hint:ezT('settings.savedOnDevice')},/*#__PURE__*/React.createElement("div",{style:s.a11yGroupLabel},EZIK_A11Y_FS_LABEL),/*#__PURE__*/React.createElement("div",{style:s.themeRow,role:"radiogroup","aria-label":EZIK_A11Y_FS_LABEL},[['normal',EZIK_A11Y_FS_NORMAL],['large',EZIK_A11Y_FS_LARGE],['xlarge',EZIK_A11Y_FS_XLARGE]].map(([v,label])=>/*#__PURE__*/React.createElement("button",{key:v,type:"button",role:"radio","aria-checked":a11y.fontSize===v?'true':'false',onClick:()=>onA11y({fontSize:v}),className:"ez-a11y-opt",style:{...s.a11yOpt,...(a11y.fontSize===v?s.themeOptActive:{})}},label))),/*#__PURE__*/React.createElement("button",{type:"button",role:"switch","aria-checked":a11y.reading?'true':'false',onClick:()=>onA11y({reading:!a11y.reading}),className:"ez-a11y-opt",style:s.a11ySwitchRow},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchText},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchTitle},EZIK_A11Y_READ),/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchHint},EZIK_A11Y_READ_HINT)),/*#__PURE__*/React.createElement("span",{style:{...s.a11ySwitch,...(a11y.reading?s.a11ySwitchOn:{})},"aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:{...s.a11yKnob,...(a11y.reading?s.a11yKnobOn:{})}}))),/*#__PURE__*/React.createElement("button",{type:"button",role:"switch","aria-checked":a11y.reduceMotion?'true':'false',onClick:()=>onA11y({reduceMotion:!a11y.reduceMotion}),className:"ez-a11y-opt",style:s.a11ySwitchRow},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchText},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchTitle},EZIK_A11Y_MOTION),/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchHint},EZIK_A11Y_MOTION_HINT)),/*#__PURE__*/React.createElement("span",{style:{...s.a11ySwitch,...(a11y.reduceMotion?s.a11ySwitchOn:{})},"aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:{...s.a11yKnob,...(a11y.reduceMotion?s.a11yKnobOn:{})}}))),/*#__PURE__*/React.createElement("button",{type:"button",onClick:onA11yReset,className:"ez-a11y-opt",style:s.a11yReset},EZIK_A11Y_RESET)),/*#__PURE__*/React.createElement(EzShellGroup,{title:ezT('settings.enter'),hint:ezT('settings.savedOnDevice')},/*#__PURE__*/React.createElement("button",{type:"button",role:"switch","aria-checked":enterSendsNow?'true':'false',onClick:()=>setEnterPref(writeEnterPref(enterSendsNow?'newline':'send')),className:"ezik-focus",style:s.a11ySwitchRow},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchText},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchTitle},ezT('settings.enter.sends')),/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchHint},enterSendsNow?ezT('settings.enter.sendsHint'):ezT('settings.enter.newlineHint'))),/*#__PURE__*/React.createElement("span",{style:{...s.a11ySwitch,...(enterSendsNow?s.a11ySwitchOn:{})},"aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:{...s.a11yKnob,...(enterSendsNow?s.a11yKnobOn:{})}})))),/*#__PURE__*/React.createElement(EzShellGroup,{title:ezT('settings.watermark'),hint:ezT('settings.savedOnDevice')},/*#__PURE__*/React.createElement("div",{style:s.themeRow,role:"radiogroup","aria-label":ezT('settings.watermark')},[[0,ezT('settings.watermark.none')],[EZIK_WM_PRESETS[0],ezT('settings.watermark.light')],[EZIK_WM_PRESETS[1],ezT('settings.watermark.medium')],[EZIK_WM_PRESETS[2],ezT('settings.watermark.bold')]].map(([v,label])=>/*#__PURE__*/React.createElement("button",{key:v,type:"button",role:"radio","aria-checked":wmOpacity===v?'true':'false',onClick:()=>setWmOpacity(applyWatermarkOpacity(v)),className:"ezik-focus",style:{...s.a11yOpt,...(wmOpacity===v?s.themeOptActive:{})}},label))),/*#__PURE__*/React.createElement("div",{style:s.a11yGroupLabel},ezT('settings.watermark.fine')),/*#__PURE__*/React.createElement("input",{type:"range",min:EZIK_WM_MIN,max:1,step:0.01,value:wmOpacity,onChange:e=>setWmOpacity(applyWatermarkOpacity(e.target.value)),"aria-label":ezT('settings.watermark.fine'),className:"ezik-focus",style:s.wmSlider}),/*#__PURE__*/React.createElement("button",{type:"button",role:"switch","aria-checked":wmHide?'true':'false',onClick:()=>setWmHide(writeWatermarkAutoHide(!wmHide)),className:"ezik-focus",style:s.a11ySwitchRow},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchText},/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchTitle},ezT('settings.watermark.quiet')),/*#__PURE__*/React.createElement("span",{style:s.a11ySwitchHint},ezT('settings.watermark.quietHint'))),/*#__PURE__*/React.createElement("span",{style:{...s.a11ySwitch,...(wmHide?s.a11ySwitchOn:{})},"aria-hidden":"true"},/*#__PURE__*/React.createElement("span",{style:{...s.a11yKnob,...(wmHide?s.a11yKnobOn:{})}})))),/*#__PURE__*/React.createElement(EzShellGroup,{title:EZ_AIS_TITLE},/*#__PURE__*/React.createElement("div",{style:s.aicStatusRow},aiConsent===EZ_AI_CONSENT_GRANTED?EZ_AIS_ON:EZ_AIS_OFF),aiConsent===EZ_AI_CONSENT_GRANTED&&/*#__PURE__*/React.createElement("div",{style:s.aicNote},aiConsentBy==='guardian'?EZ_AIS_BY_GUARDIAN:EZ_AIS_BY_USER),/*#__PURE__*/React.createElement("div",{style:s.aicNote},EZ_AIS_PROVIDERS_LABEL+' ',/*#__PURE__*/React.createElement("span",{style:s.aicProvider},EZ_AIS_PROVIDERS_NAMES)),/*#__PURE__*/React.createElement(AIConsentVersion,{style:s.aicNote}),/*#__PURE__*/React.createElement(AIConsentLinks,null),aiConsent===EZ_AI_CONSENT_GRANTED?/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("button",{type:"button",onClick:onWithdrawAI,style:s.aicWithdrawBtn},EZ_AIS_WITHDRAW),/*#__PURE__*/React.createElement("div",{style:s.aicNote},EZ_AIS_KEEP)):/*#__PURE__*/React.createElement("button",{type:"button",onClick:onReviewAI,style:s.aicWithdrawBtn},EZ_AIS_REVIEW)),/*#__PURE__*/React.createElement(EzShellGroup,{title:A_CONTROL},/*#__PURE__*/React.createElement("button",{type:"button",onClick:onOpenControl,style:s.settingsNavBtn,"aria-label":A_CONTROL},/*#__PURE__*/React.createElement("span",null,A_CONTROL),/*#__PURE__*/React.createElement("span",{style:s.settingsNavChev,"aria-hidden":"true"},'\u2039'))),canSetPin&&/*#__PURE__*/React.createElement(EzShellGroup,{title:ezT('pin.groupTitle')},/*#__PURE__*/React.createElement("input",{type:"password",inputMode:"numeric",autoComplete:"new-password",value:pin1,onChange:e=>setPin1(e.target.value),placeholder:ezT('pin.new'),style:s.settingsInput}),/*#__PURE__*/React.createElement("input",{type:"password",inputMode:"numeric",autoComplete:"new-password",value:pin2,onChange:e=>setPin2(e.target.value),onKeyDown:e=>{if(e.key==='Enter')savePin();},placeholder:ezT('pin.confirm'),style:s.settingsInput}),pinMsg&&/*#__PURE__*/React.createElement("div",{style:s.settingsMsg},pinMsg),/*#__PURE__*/React.createElement("button",{onClick:savePin,disabled:pinBusy||!pin1||!pin2,style:{...s.settingsSaveBtn,opacity:pinBusy||!pin1||!pin2?0.5:1}},ezT('common.save'))),/*#__PURE__*/React.createElement(EzShellGroup,{title:PRAYER_SETTINGS_TITLE,hint:PRAYER_HINT},/*#__PURE__*/React.createElement(PrayerSettingsControl,null),/*#__PURE__*/React.createElement("div",{style:s.ezshGroupHead},/*#__PURE__*/React.createElement("span",{style:s.ezshGroupMark,"aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{style:s.settingsLabel},HIJRI_SET_TITLE)),/*#__PURE__*/React.createElement(HijriOffsetControl,null),/*#__PURE__*/React.createElement("div",{style:s.settingsHint},HIJRI_SET_HINT))));}function ParentDashboard({profile,messages,onBack,onReset,directConvoLocked,onToggleDirectConvo}){// The direct-conversation lock is only meaningful for young accounts (teen/adult are never
// parent-gated for it), so the toggle is shown only for young. profile is already in scope.
const isYoung=deriveCaps(profile?.age).band==='young';return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezparent",style:s.dashboardContainer},/*#__PURE__*/React.createElement("div",{className:"ezparent-rail"},/*#__PURE__*/React.createElement("div",{className:"ezparent-rail-inner"},/*#__PURE__*/React.createElement("button",{onClick:onBack,className:"ezparent-back"},"← رجوع"),/*#__PURE__*/React.createElement("span",{className:"ezparent-brand"},/*#__PURE__*/React.createElement("span",{className:"ezparent-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",null,"لوحة الأهل")))),/*#__PURE__*/React.createElement("div",{style:s.dashboardContent},/*#__PURE__*/React.createElement("div",{className:"ezparent-wrap"},/*#__PURE__*/React.createElement("div",{style:s.dashboardCard},/*#__PURE__*/React.createElement("div",{className:"ezparent-head"},/*#__PURE__*/React.createElement("span",{className:"ezparent-mark","aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{style:s.dashboardLabel},"الطفل")),/*#__PURE__*/React.createElement("div",{style:s.dashboardValue},profile?.name," — ",profile?.age," سنة")),/*#__PURE__*/React.createElement("div",{style:s.dashboardCard},/*#__PURE__*/React.createElement("div",{className:"ezparent-head"},/*#__PURE__*/React.createElement("span",{className:"ezparent-mark","aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{style:s.dashboardLabel},"عدد الرسائل")),/*#__PURE__*/React.createElement("div",{style:s.dashboardValue},messages.length," رسالة")),isYoung&&/*#__PURE__*/React.createElement("div",{style:s.dashboardCard},/*#__PURE__*/React.createElement("div",{className:"ezparent-head"},/*#__PURE__*/React.createElement("span",{className:"ezparent-mark","aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{style:s.dashboardLabel},"المحادثة المباشرة")),/*#__PURE__*/React.createElement("div",{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}},/*#__PURE__*/React.createElement("div",{style:s.dashboardValue},directConvoLocked?'🔒 مقفلة':'🔓 مفتوحة'),/*#__PURE__*/React.createElement("button",{onClick:onToggleDirectConvo,style:{background:directConvoLocked?'var(--red-lift)':'var(--accent-fill)',color:directConvoLocked?'var(--a3-navy)':'var(--on-accent)',border:'none',borderRadius:12,padding:'10px 16px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}},directConvoLocked?'فتح المحادثة المباشرة':'قفل المحادثة المباشرة'))),/*#__PURE__*/React.createElement("div",{style:s.dashboardCard},/*#__PURE__*/React.createElement("div",{className:"ezparent-head"},/*#__PURE__*/React.createElement("span",{className:"ezparent-mark","aria-hidden":"true"}),/*#__PURE__*/React.createElement("div",{style:s.dashboardLabel},"سجل المحادثات")),/*#__PURE__*/React.createElement("div",{style:s.conversationLog},messages.length===0?/*#__PURE__*/React.createElement("div",{style:s.dashboardEmpty},"لا توجد محادثات بعد"):messages.map((m,i)=>/*#__PURE__*/React.createElement("div",{key:i,style:{...s.logEntry,backgroundColor:m.role==='user'?'var(--a3-ice)':'var(--a3-soft)'}},/*#__PURE__*/React.createElement("div",{style:s.logRole},m.role==='user'?`👶 ${profile?.name}`:profile?.gender==='female'?'👩‍🏫 عزك':'👨‍🏫 عزك'),/*#__PURE__*/React.createElement("div",{style:s.logContent},m.role==='assistant'?formatForLog(m.content):contentToText(m.content)),/*#__PURE__*/React.createElement("div",{style:s.logTime},new Date(m.timestamp).toLocaleString('ar-SA')))))),/*#__PURE__*/React.createElement("button",{onClick:onReset,style:s.dangerBtn},/*#__PURE__*/React.createElement(ResetIcon,{size:16,color:"var(--red-lift)"}),/*#__PURE__*/React.createElement("span",{style:{marginRight:8}},"حذف كل البيانات وإعادة البدء")))));}// ============================================================
// Live call screen (Layer 2 — one automatic turn; presentational, driven by App state)
// ============================================================
// callState is owned by App and driven by real audio events (tap → listening → thinking →
// speaking → idle). The avatar is tap-to-talk; Mute gates the mic. No audio logic lives here.
//
// S113 -- THE WORDS THIS SCREEN SAYS, gathered in one place so a redesign cannot quietly invent
// one. Every string below is byte-for-byte a string this screen already shipped; not a word was
// added, removed or reworded, and nothing devotional appears here at all.
const CALL_TXT={TITLE:'مكالمة مع عزك',DISCLAIMER:'تتحدّث إلى ذكاءٍ اصطناعيّ — لا إلى إنسان.',MUTED_HINT:'الميكروفون مكتوم',MUTE_ON:'مكتوم',MUTE_OFF:'كتم',END:'إنهاء'};function CallScreen({profileName,gender,callState,heard,isMuted,error,onToggleMute,onTalk,onExit}){// Accessibility: respect reduced-motion — fall back to a static (non-pulsing) ring.
const reduceMotion=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)').matches:false;// S113: the four labels are the ones that shipped. They were COMPUTED and never drawn -- `cs`
// was read for its ring and its speed only, so the screen never said what it was doing. The
// state title below is that shipped label, rendered; it is not a new string and it is never a
// fixed word: `callState` is App's, driven by real audio events. The ring colours moved from
// literals to tokens, which is what lets this room have a light face at all.
const STATES={idle:{label:'اضغط للتحدّث',ring:'var(--a3-line)',speed:'3.6s'},listening:{label:'أستمع إليك...',ring:'var(--a3-cyan)',speed:'2.4s'},thinking:{label:'لحظة...',ring:'var(--a3-muted)',speed:'3.2s'},speaking:{label:gender==='female'?'عزك تتحدّث...':'عزك يتحدّث...',ring:'var(--a3-blue)',speed:'1.2s'}};const cs=STATES[callState]||STATES.idle;const ringStyle={...s.callRing,borderColor:cs.ring,animation:reduceMotion?'none':`callPulse ${cs.speed} ease-in-out infinite`};// Layer 3: the avatar stays tappable while the tutor is thinking/speaking — tapping there is the
// manual interrupt ("my turn"). Disabled only when muted, or during 'listening' (no-op as before).
const canTalk=!isMuted&&(callState==='idle'||callState==='thinking'||callState==='speaking');// The one line under the emblem, and it is the SAME line that shipped: the interim transcript
// while actually listening, or the muted notice. It is rendered only when it has something to
// say, so an idle call shows the state instead of an empty band. Nothing that was hidden for
// privacy is revealed by it -- the condition is byte-for-byte the shipped one.
const hint=callState==='listening'&&heard?heard:isMuted?CALL_TXT.MUTED_HINT:'';return/*#__PURE__*/React.createElement("div",{className:"theme-dark ezhome ezcall",style:s.callContainer},/*#__PURE__*/React.createElement("div",{className:"ezcall-rail"},/*#__PURE__*/React.createElement("div",{className:"ezcall-rail-inner"},/*#__PURE__*/React.createElement("button",{onClick:onExit,className:"ezcall-icon","aria-label":CALL_TXT.END},A2_ICON_BACK),/*#__PURE__*/React.createElement("span",{className:"ezcall-brand"},/*#__PURE__*/React.createElement("span",{className:"ezcall-brand-arch","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{className:"ezcall-brand-text"},CALL_TXT.TITLE)))),/*#__PURE__*/React.createElement("div",{className:"ezcall-body"},/*#__PURE__*/React.createElement("div",{className:"ezcall-stage"},/*#__PURE__*/React.createElement("div",{style:{...s.callAvatarWrap,cursor:canTalk?'pointer':'default'},onClick:canTalk?onTalk:undefined},/*#__PURE__*/React.createElement("div",{style:ringStyle}),/*#__PURE__*/React.createElement("div",{style:s.callAvatar},/*#__PURE__*/React.createElement(MoonStarsIcon,{size:56,color:"var(--a3-blue)"}))),/*#__PURE__*/React.createElement("div",{style:s.callStatusLabel},cs.label),/*#__PURE__*/React.createElement("span",{className:'ezcall-mark is-'+callState,"aria-hidden":"true"}),profileName&&/*#__PURE__*/React.createElement("div",{style:s.callSubLabel},profileName),hint?/*#__PURE__*/React.createElement("div",{style:s.callHint},hint):null,/*#__PURE__*/React.createElement("div",{className:"ezcall-note"},CALL_TXT.DISCLAIMER),error?/*#__PURE__*/React.createElement("div",{style:s.callErrorBanner,className:"ezcall-alert",role:"alert"},error):null)),/*#__PURE__*/React.createElement("div",{className:"ezcall-dock"},/*#__PURE__*/React.createElement("div",{className:"ezcall-dock-inner",style:s.callControls},/*#__PURE__*/React.createElement("button",{onClick:onToggleMute,className:"ezcall-btn",style:s.callMuteBtn},isMuted?/*#__PURE__*/React.createElement(MicOffIcon,{size:22,color:"var(--a3-blue)"}):/*#__PURE__*/React.createElement(MicIcon,{size:22,color:"var(--a3-blue)"}),/*#__PURE__*/React.createElement("span",{style:s.callBtnLabel},isMuted?CALL_TXT.MUTE_ON:CALL_TXT.MUTE_OFF)),/*#__PURE__*/React.createElement("button",{onClick:onExit,className:"ezcall-btn",style:s.callEndBtn},/*#__PURE__*/React.createElement(PhoneOffIcon,{size:22,color:"var(--a3-navy)"}),/*#__PURE__*/React.createElement("span",{style:{...s.callBtnLabel,color:'var(--a3-navy)'}},CALL_TXT.END)))));}// ============================================================
// Memorization screen (المحفّظ) — Layer A: full-mushaf surah picker + progressive reveal.
// ============================================================
// Quran text is read ONLY from the canonical mushaf via getVerseText — never model output
// (honors the guarantee at the loadQuran definition). No AI / prompt branch, no persistence,
// no continuous live-ASR, and no error/red-highlight detection in this layer.
const MEM={TITLE:'المُحفّظ',PICKER_HEADING:'اختر سورةً لتبدأ الحفظ',START_LABEL:'ابدأ من آية',START_BTN:'ابدأ',REVEAL_BTN:'افتح عليّ',LISTEN_BTN:'استمع',LISTEN_RANGE_BTN:'استمع للمقطع',REVEAL_LABEL:'الكشف',GRAN_AYAH:'آية',GRAN_WORD:'كلمة',CHANGE_SURAH:'سورة أخرى',HIDE:'إخفاء',BACK_BTN:'رجوع',LOADING:'لحظة، يُحضَّر المصحف…',PRAISE_M:'أحسنتَ، تابِع.',PRAISE_F:'أحسنتِ، تابِعي.',FINISH_M:'أتممتَ المقطع، بارك الله فيك.',FINISH_F:'أتممتِ المقطع، بارك الله فيكِ.',MODE_MANUAL:'تلقين يدوي',MODE_ADNAN:'استماع وترديد',ADNAN_START:'ابدأ',ADNAN_STOP:'إيقاف',ADNAN_REPEAT:'أعد الآية',ADNAN_AYAH_LABEL:'آية',MODE_RECITE:'سمِّعني',RECITE_HINT:'هذا تمرينٌ يعينك على الحفظ، والتسميع الحقيقيّ يكون عند شيخك أو والديك.',RECITE_START:'ابدأ التسميع',RECITE_STOP:'إيقاف',RECITE_DONE:'أحسنت، تابِع حفظك.',RECITE_NEXT:'الآية التالية'};/* 14.1 */// Standalone mushaf reader. NOT part of MemorizeScreen -- separate tile, separate screen.
// Reuses SurahCard verbatim: it already loads the mushaf, sources the basmalah from
// getVerseText(1,1) (never hand-written), skips it for al-Fatiha (it IS ayah 1) and
// at-Tawbah (it has none), stamps every ayah with U+06DD + its Arabic-Indic number, and
// carries the full-surah recitation button. No new Quran-text path is introduced here.
/* 14.2 */// صفحةٌ واحدةٌ من المصحف. كلُّ خانةٍ في التخطيط تُجلب كلمتَها من المصحف المحروس.
/* 14.2f2 */// ضبطُ السطر — وهو ما يجعل الصفحة مصحفاً لا نصّاً.
// كلُّ كلمةٍ عنصرُ flex مستقلّ، و justify-content:space-between يفرد ما بينها حتى
// يمتدّ السطرُ من حافةٍ لحافة. وكان لنا حجمٌ واحدٌ للصفحة يُقاس بأضيقِ سطرٍ فيها،
// فيَنقُص ما سواه عن عرضه ويُملأ الفارقُ فراغاً. الآن لكلِّ سطرٍ حجمُه: يفي بعرضه
// بحروفه لا بفراغه، والتفاوتُ بين أسطر الصفحة محصورٌ بـ+١٨٪ فوق أصغرها — فلا
// يصغر سطرٌ عمّا كان، ولا تتبعثر الصفحة. ولا يلتفّ سطرٌ أبداً، ولا يُقصّ حرف.
// القياس يجري قبل الرسم (useLayoutEffect) فلا تُرى قفزة. ولو فشل القياس لأيّ
// سبب، نرسم بحجم الأساس — مقروءاً. لا نُخفي المصحف أبداً.
const PG_BASE_FS=22;// حجمُ القياس. النتيجة تُشتقّ منه ولا يُستعمل كما هو.
const PG_GAP_EM=0.22;// أدنى فجوةٍ بين كلمتين، نسبةً للخطّ (تكبر وتصغر معه)
const PG_LINE_H=1.75;// ارتفاعُ السطر. يدخل في حساب السقف الرأسيّ وفي النمط معاً.
// خطُّ المصحف في موضعٍ واحد: يستعمله النمطُ المرسوم والقياسُ الخفيّ معاً. لو افترقا
// بحرفٍ لقِسنا خطّاً ورسمنا آخر، وسقط الثابتُ العالميّ كلُّه بصمت. لا خطَّ جديداً هنا.
const PG_FONT="'Amiri Quran', 'Amiri', serif";/* Session 51 -- ONE font size for all 604 pages.
 * ---------------------------------------------------------------------------
 * الحجمُ كان يُشتقّ من أضيق سطرٍ *داخل الصفحة الواحدة*، فاختلف من صفحةٍ لصفحة:
 * النساء ٧٩ كبيرةٌ والتين ٥٩٧ صغيرة. والمصحفُ المطبوع حجمُه واحدٌ في الـ٦٠٤.
 * فصار المقياسُ عالمياً: أعرضُ أسطر المصحف كلِّه تُقاس مرّةً واحدة، ومنها ثابتٌ
 * واحد K يحكم كلَّ صفحة. القياسُ مرّةٌ لكلّ جلسةٍ (ولكلّ عرضِ حاوية)، لا مرّةً
 * لكلّ صفحة: فتحُ صفحةٍ لا يقيس مئةً وخمسين سطراً، بل يقرأ K المخزَّن.
 */const PG_CAND_N=150;// عددُ المرشّحين. ١٥٠ لا ٤٠: تقديرُ المحارف تقريبيٌّ للعربية
const PG_AVG_CH=0.5;// عرضُ المحرف الوسطيّ بالـem — لتحويل الفجوة إلى «محارف»
let PG_K=null;// الثابتُ العالميّ: أكبرُ تكبيرٍ يسعه أعرضُ سطرٍ في المصحف
let PG_K_BOX=0;// العرضُ الذي قيس عنده. اختلافُه ⟹ إبطالٌ وإعادةُ قياس
let PG_K_MS=0;// كلفةُ القياس الأولى بالمللي ثانية — للتقرير لا للمنطق
const PG_GUARD_PAGES=new Set();// صفحاتٌ اضطرّ فيها حارسُ الفيض لتصغيرٍ خاصّ
// العلاماتُ لا تُقدّم القلم، فلا تدخل في كلفة السطر. (الحركاتُ · الصغرى · علاماتُ الوقف)
const pgAdvChars=t=>{let n=0;for(const ch of t){const u=ch.codePointAt(0);if(!(u>=0x064b&&u<=0x065f||u===0x0670||u>=0x06d6&&u<=0x06ed))n++;}return n;};// خاناتُ السطر ← ما يُرسم فيه فعلاً. مصدرٌ واحدٌ للتصيير وللقياس معاً: لو افترقا
// لقِسنا سطراً غيرَ الذي نرسم. كلُّ حرفٍ من __quranData وحده — لا نصَّ بأيدينا.
const pgLineTokens=ln=>{const parts=[];if(!ln||!ln.w)return parts;for(const loc of ln.w){const a=loc.split(':');const sn=parseInt(a[0],10),an=parseInt(a[1],10),wi=parseInt(a[2],10);const words=wordsOfAyah(sn,an);const w=words[wi-1];if(w===undefined)continue;// لا يقع — ٧٧٤٢٩/٧٧٤٢٩ مبرهَنة
parts.push(w);if(wi===words.length)parts.push('۝'+toArabicDigits(an));// آخرُ كلمةٍ ← رقمُ الآية
}return parts;};// (أ) المرشّحون — من البيانات وحدها، بلا DOM. كلفةُ السطر = محارفُه ذواتُ العرض
// زائدَ فجواتِه محسوبةً بالمحارف. تقديرٌ تقريبيّ يُرتّب فقط؛ الحكمُ للقياس الحقيقيّ
// بعده، ولذا نأخذ ١٥٠ لا الأعرضَ وحده: خطأُ الترتيب يُبتلع في الهامش.
let __pgCands=null;const pgCandidates=()=>{if(__pgCands)return __pgCands;if(!__layoutData||!__layoutData.p||!__quranData)return null;const gapCh=PG_GAP_EM/PG_AVG_CH;const all=[];for(const pg of __layoutData.p){for(const ln of pg.l){if(ln.t!=='t')continue;const parts=pgLineTokens(ln);if(!parts.length)continue;let cost=(parts.length-1)*gapCh;for(const p of parts)cost+=pgAdvChars(p);all.push({cost,parts});}}if(!all.length)return null;all.sort((a,b)=>b.cost-a.cost);__pgCands=all.slice(0,PG_CAND_N).map(x=>x.parts);return __pgCands;};// (ب) القياسُ الحقيقيّ — مرّةً واحدة. المرشّحون يُصيَّرون خارج الشاشة بعرض الصفحة
// نفسِه وبأنماط السطر والكلمة نفسِها وبحجم الأساس، فيؤخذ أضيقُ نسبةٍ فيهم.
// خارج الشاشة لا مخفيّاً بـdisplay:none — المخفيُّ لا يُقاس أصلاً.
const pgMeasureK=box=>{if(PG_K!==null&&PG_K_BOX===box)return PG_K;if(!(box>0)||typeof document==='undefined')return null;const cands=pgCandidates();if(!cands)return null;const t0=typeof performance!=='undefined'&&performance.now?performance.now():0;const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.style.cssText='position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;width:'+box+'px;';const rows=[];for(let i=0;i<cands.length;i++){const row=document.createElement('div');row.style.cssText='display:flex;flex-direction:row;align-items:baseline;justify-content:space-between;width:100%;direction:rtl;white-space:nowrap;line-height:'+PG_LINE_H+';font-size:'+PG_BASE_FS+'px;font-family:'+PG_FONT+';';const parts=cands[i];for(let j=0;j<parts.length;j++){const sp=document.createElement('span');sp.style.cssText='flex-shrink:0;white-space:nowrap;';sp.textContent=parts[j];row.appendChild(sp);}host.appendChild(row);rows.push(row);}document.body.appendChild(host);let k=Infinity;try{for(let i=0;i<rows.length;i++){const kids=rows[i].children;if(!kids.length)continue;let content=0;for(let j=0;j<kids.length;j++)content+=kids[j].offsetWidth;content+=(kids.length-1)*(PG_BASE_FS*PG_GAP_EM);if(content>0){const r=box/content;if(r<k)k=r;}}}finally{if(host.parentNode)host.parentNode.removeChild(host);}if(!isFinite(k)||!(k>0))return null;PG_K=k;PG_K_BOX=box;PG_K_MS=(typeof performance!=='undefined'&&performance.now?performance.now():0)-t0;return k;};// إبطالٌ صريح: تدويرُ الشاشة (تغيّرُ العرض) أو وصولُ الخطّ بعد قياسٍ بخطٍّ بديل.
// كلاهما يجعل K المخزَّن كذباً — والكذبُ هنا يعمّ الـ٦٠٤ لا صفحةً واحدة.
const pgInvalidateK=()=>{PG_K=null;PG_K_BOX=0;PG_GUARD_PAGES.clear();};// نافذةُ فحصٍ للمالك وحدها: قراءةٌ محضة، لا يقرأها منطقُ التطبيق ولا يتفرّع عليها.
try{window.__mushafFit={k:()=>PG_K,box:()=>PG_K_BOX,ms:()=>PG_K_MS,guard:()=>Array.from(PG_GUARD_PAGES)};}catch(e){}/* 14.6 */// Session 74 -- PHASE ONE: the official Madinah mushaf page, drawn as one image.
// Session 76 -- PUBLISHED: this is now what a first-time visitor sees.
// ---------------------------------------------------------------------------
// ON BY DEFAULT. A device that has never touched the key gets the official page, and that
// single line is the whole of what session 76 changed. The escape did not move: opening
// the app with ?mushafsvg=0 writes '0' to the key and that device keeps the text reader
// for good. When the flag is off MushafSheet returns <MushafPage> with the same four
// props and nothing else happens: no image element, no request, no style, no prefetch.
//
// Phase one is a STILL PAGE. No ayah tap, no highlight, no selection, no audio. An <img>
// has no words in it, so there is no mapping layer here and mushaf-layout.json is not
// consulted by this path at all.
//
// The origin lives in ONE named const so moving it is a one-line edit. Measured live on
// 2026-07-30: mushaf.almurabbi.app serves 001.svg at 200, image/svg+xml, Content-Encoding
// br, Cache-Control public/max-age=31536000/immutable, ACAO *, and the decoded body SHA-256
// equals the local asset byte for byte. It is our own domain, so nothing is owed here later.
const MUSHAF_SVG_ORIGIN='https://mushaf.almurabbi.app';const MUSHAF_SVG_KEY='mushaf_svg_v1';// device key. '0' = off, absent/anything = on
// The viewBox, measured over all 604 local pages: one distinct value, 0 0 382.68 547.09.
// Held as a ratio so the sheet never re-flows and never changes shape between phones.
const MUSHAF_SVG_RATIO=382.68/547.09;const MUSHAF_SVG_AR='382.68 / 547.09';const MUSHAF_VB_W=382.68;const MUSHAF_VB_H=547.09;// Session 75/C -- THE SAFE CROP. The pages carry a wide inner margin of their own, and that
// margin was the largest single cause of the cramped look: 6.99% of the width on the left,
// 7.04% on the right, 2.18% at the top, 4.20% at the bottom, all of it blank.
//
// This box is MEASURED, not chosen. It is the UNION of the ink bounding boxes of ALL 604
// pages -- never an average, which would silently behead the pages whose ink reaches
// furthest. Each box is the exact extent of every path on the page, solved from the cubic
// beziers analytically; the corpus has one viewBox, no transforms and no strokes, so the
// geometric extent is the painted extent. The parser was checked against Chrome's own
// getBBox() on 15 pages including all three that set these bounds, worst disagreement
// 0.0003 units.
//
//   union over all 604 = 26.730, 11.914, 355.741, 524.100
//   x_min from 563.svg (sura-name header)   y_min from 177.svg (sura-name header)
//   x_max from 004.svg (juz-name header)    y_max from 004.svg (page number)
//
// The constants below round OUTWARD from that union, so the shipped box can never be tighter
// than what was measured. Sajda, sakta, hizb/juz margin marks, both headers, the page number
// and the juz stars were each measured as their own sub-box across every page that carries
// one, and all seven lie inside this box -- three of them ARE its edges.
//
// Proof, witness and method: _mushaf-probe-71/75-skin-recon.md. The assertion runs on all
// 604 pages and it fires when the box is deliberately shrunk; a check that cannot fail on a
// bad input is not a check.
const MUSHAF_CROP_X0=26.73;const MUSHAF_CROP_Y0=11.91;const MUSHAF_CROP_X1=355.75;const MUSHAF_CROP_Y1=524.11;const MUSHAF_CROP_W=MUSHAF_CROP_X1-MUSHAF_CROP_X0;// 329.02 viewBox units
const MUSHAF_CROP_H=MUSHAF_CROP_Y1-MUSHAF_CROP_Y0;// 512.20 viewBox units
const MUSHAF_CROP_AR=MUSHAF_CROP_W+' / '+MUSHAF_CROP_H;// Session 75/D -- OUR OWN ORNAMENT. Nothing here is copied, traced or derived from the King
// Fahd Complex, from nourelquran, or from any other publisher: a thin double rule, a diamond
// corner motif, a warm paper tone and a soft edge shadow, all drawn in CSS and inline SVG in
// this file. No image file, no font, no external asset.
//
// Every pixel of frame shrinks the Quran directly, so the cost is spelled out here and paid
// once. The directive's budget is 3% of the container width per side; this band is 6.25px,
// which at a 360-wide viewport is 1.736% per side.
//
// THE BAND, from the ink outward:
//     2.00px   paper breathing room, so that no rule ever touches a letter
//     0.75px   the inner rule, lighter
//     2.00px   the gap between the two rules
//     1.50px   the outer rule, heavier
//     ------
//     6.25px   per side
//
// The band is paid for by the slot's padding and by nothing else. The two rules and the four
// corner motifs are absolutely positioned on negative insets, so they add no layout width of
// their own -- and that is also what makes them provably clear of the ink. The crop window's
// edge IS the union of all 604 ink boxes (see 75/C above), so anything painted outside that
// edge cannot touch a letter on any page. Every painted part of this ornament is outside it.
const MUSHAF_FRAME_INSET=2;const MUSHAF_FRAME_INNER=0.75;const MUSHAF_FRAME_GAP=2;const MUSHAF_FRAME_OUTER=1.5;const MUSHAF_FRAME_BAND=MUSHAF_FRAME_INSET+MUSHAF_FRAME_INNER+MUSHAF_FRAME_GAP+MUSHAF_FRAME_OUTER;// Where the inner rule hangs: just outside the breathing room.
const MUSHAF_FRAME_INNER_AT=MUSHAF_FRAME_INSET+MUSHAF_FRAME_INNER;// The two warm tones, and they are the only new colours. The app palette is cool blue
// throughout, and against it the page read as a screenshot pasted on grey. These are
// near-white and warm, so the paper reads as paper.
const MUSHAF_PAPER='#FDFBF6';// the sheet, and the band around it
// S95: the desk is the one part of the reader that DOES follow the theme. The sheet on it never
// inverts (see .mushaf-paper), so in dark the page stays a page and the desk goes dark under it,
// which is what a reading lamp looks like. Light value unchanged: #EDE7DB.
const MUSHAF_DESK='var(--mushaf-desk)';// the surface the page sits on, outside the frame
// The corner motif's rendered size. Its widest reach from the corner point is 6/16 of this,
// so at 10px it reaches 3.75px -- leaving it 2.50px clear of the crop window's edge.
const MUSHAF_CORNER_PX=10;// Session 75/E -- ZOOM, AND IT IS CONTAINER-LOCAL. The app-wide viewport meta at line 5 is NOT
// touched and must not be: it governs every screen in the app, and widening it to let the mushaf
// zoom would let every other screen zoom too -- a cross-cutting change to a product in closed
// testing. All of the magnification below is one CSS transform on one element inside the page
// container, and it is gated by the flag like everything else in this session.
const MUSHAF_ZOOM_K=2.2;// the single fixed magnification a double tap goes to
const MUSHAF_TAP_MS=300;// the double-tap window
const MUSHAF_TAP_SLOP=32;// how far the second tap may land from the first, in px
// The pan clamp. Kept as a pure function of numbers on purpose: it is the one piece of Part E
// with arithmetic worth getting wrong, and this way it can be lifted out of the file and tested
// without a browser. You may pan only as far as the magnified page overflows its window, so no
// gap can ever open at an edge and the page cannot be dragged off screen. When the page is
// smaller than the window on an axis the limit is 0, so that axis simply does not pan.
const mushafClampPan=(tx,ty,k,fw,fh,sw,sh)=>{const mx=Math.max(0,(fw*k-sw)/2);const my=Math.max(0,(fh*k-sh)/2);return{tx:Math.min(mx,Math.max(-mx,tx)),ty:Math.min(my,Math.max(-my,ty))};};// Upstream naming, verified against 604/604 files: three digits always, 001.svg .. 604.svg.
const mushafSvgUrl=n=>MUSHAF_SVG_ORIGIN+'/pages/'+String(n).padStart(3,'0')+'.svg';// The switch. Read ONCE at startup: the parameter writes the device key and then no longer
// matters, so it does not need to stay in the URL afterwards. The parameter still writes
// '1'/'0' exactly as it did, and every localStorage touch is still in a try/catch.
// THE DEFAULT IS ON, and only an explicit refusal turns it off. The test is against '0'
// rather than for '1', so all three ways of holding no answer -- an absent key, a value
// we do not recognise, and a storage that throws -- land on the official page. No input
// produces a blank screen, and the one input that produces the text reader is the one a
// person typed on purpose.
const readMushafSvgFlag=()=>{try{const p=new URLSearchParams(window.location.search).get('mushafsvg');if(p==='1'||p==='0')localStorage.setItem(MUSHAF_SVG_KEY,p);}catch(e){}try{return localStorage.getItem(MUSHAF_SVG_KEY)!=='0';}catch(e){return true;}};const MUSHAF_SVG_ON=readMushafSvgFlag();/* 14.7 */// Session 79 -- THE WHOLE MUSHAF: the real printed Madina page, as a page image, on
// every printed page 1 to 604.
// ---------------------------------------------------------------------------
// 81 -- ON BY DEFAULT. All 604 printed pages passed the asset guard and the owner's
// visual acceptance on a real phone, so the printed Madina page is now the Quran reader
// the app opens with, and the parameter is a rollback switch rather than an opt-in:
//
//   no madinaimg parameter -> ON      (unless this device stored an explicit refusal)
//   ?madinaimg=1           -> ON
//   ?madinaimg=0           -> OFF     (immediate rollback, and it sticks on this device)
//
// The test is now against '0' rather than for '1', so an absent key, a value we do not
// recognise and a storage that throws all land on the printed page. This is the same
// shape as MUSHAF_SVG_ON above, and now for the same reason: both are shipped.
//
// The 604 files are OURS, served from our own origin as ordinary static assets. No page
// image is fetched from any other host at runtime, and there is no image CDN here.
// Provenance, licence status, hashes and crop geometry: data/madina-hafs-pages.json
// and MUSHAF-MADINA-ASSET-NOTICE.md, both pinned by madina-hafs-guard.cjs.
//
// The URL is COMPUTED, never listed. 604 asset paths as a table would be 604 strings in
// the bundle and a map to walk; as one line of arithmetic it is neither. Nothing here
// holds a page, an Image or a blob for any page but the one being read and its two
// neighbours -- see prefetchMushafSvg below, which is the only prefetch in the reader
// and stays two deep whichever renderer is running.
const MADINA_IMG_KEY='madina_img_v1';// device key. '0' = off, anything else = on
const MADINA_IMG_PAGES=604;// printed pages 1..604, and no other page
// ITEM 33. The service worker keeps these pages in a store of their own and holds at most
// this many, evicting the least recently used. The number is repeated here because a page
// cannot read a worker's constants, and theme-coverage-guard.cjs asserts the two are equal,
// so the repetition cannot drift into a lie. The prefetch below is bounded by it: warming
// more pages than the store can hold would evict the reader's current neighbourhood to make
// room for a guess about where they are going next.
const MADINA_PAGE_CACHE_CAP=60;// Root-absolute, like the icons and the manifest: the app is served from '/' and nothing
// rewrites it, so this path is the file itself and never a route.
//
// 81 -- the parameter ANSWERS, it does not merely write. An explicit '1' or '0' returns
// straight from the URL and never consults storage at all, so a stale key, a value some
// other build wrote, a quota-full setItem or a storage that throws cannot make ?madinaimg=0
// keep the image reader on or ?madinaimg=1 keep it off. The write is still attempted, in
// its own try/catch, so the answer survives the next visit without the parameter -- but
// the write failing changes nothing about THIS visit.
const readMadinaImgFlag=()=>{let p=null;try{p=new URLSearchParams(window.location.search).get('madinaimg');}catch(e){p=null;}if(p==='1'||p==='0'){try{localStorage.setItem(MADINA_IMG_KEY,p);}catch(e){}return p==='1';}// No parameter: the default is ON, and only a stored, well-formed refusal turns it off.
try{return localStorage.getItem(MADINA_IMG_KEY)!=='0';}catch(e){return true;}};const MADINA_IMG_ON=readMadinaImgFlag();const madinaImgUrl=n=>{if(!MADINA_IMG_ON)return null;// A page outside 1..604 is not touched by any of this: this returns null, MushafSheet
// takes the SVG branch on its first render, and no image element for this path is ever
// created. There is no probe, no 404 and no flash.
if(!(n>=1&&n<=MADINA_IMG_PAGES))return null;return'/assets/madina-hafs/page-'+String(n).padStart(3,'0')+'.webp';};// The surface behind the printed page. The scanned page's own margin is #FDFDFD, so on any
// device where the page does not paint to the very last subpixel the seam reads as more
// paper rather than as a mount. In the full-height mode below there is no band left to fill,
// so this is now a backstop rather than a mount.
const MADINA_DESK='var(--madina-desk)';// S95: theme-following desk; light value was #FDFDFD
// The printed page is the whole reading surface: no card, no rule, no shadow, no maxWidth
// cap, no aspect-ratio box.
//
// 80 -- FULL-HEIGHT MODE, and it is a deliberate, owner-approved departure.
// object-fit contain filled the phone's width and then left large white bands above and
// below the page, because the printed sheet is taller in proportion than the reading box.
// The owner tested it on a real device and rejected the bands. The two ways to remove them
// are to crop the sheet or to stretch it, and cropping is not available here: it would eat
// the floral frame or the Quran text itself. So the page is stretched to the box.
//
//   width 100% + height 100% + object-fit FILL
//
// The source aspect ratio is NOT preserved on this path, on purpose. The vertical
// lengthening this produces is the accepted cost -- it is uniform across the sheet, it
// distorts no glyph relative to its neighbours, and the alternative was losing print.
// Nothing is cropped in CSS: `fill` scales both axes to the box and discards no pixel.
//
// This is also why the asset build makes every printed page's crop rectangle the same
// shape: the floral frame occupies the same percentage of every output image, so stretching
// each of them into the same box lands the frame at the same size on every page. A page is
// never smaller merely because the source sheet carried a side ornament.
//
// The box itself is the full reading viewport and does not move: the header and the pager
// are absolutely positioned overlays (see contSt/headSt/barSt), so toggling the chrome
// changes no box this image is measured against.
//
// 81 -- and the stretch is now scoped to the screen it was accepted for. The bands the
// owner rejected are a PORTRAIT PHONE problem: there the reading box is far taller in
// proportion than the sheet, so contain wastes the top and bottom of a small screen. Turn
// the same phone sideways, or open the app on a desktop, and the box is WIDER than the
// sheet -- fill would then stretch the page horizontally, which nobody accepted and which
// looks broken at size. So:
//
//   portrait phone      -> object-fit FILL     (the approved rendering, unchanged)
//   landscape / desktop -> object-fit CONTAIN  (printed aspect ratio kept, centred)
//
// Neither value crops: contain letterboxes and fill scales, and both keep every pixel of
// the Quran text and the floral frame. The box is the full reading viewport in both cases,
// and the overlays do not enter it.
const MADINA_SHEET_ST={flex:1,minHeight:0,width:'100%',display:'flex',background:MADINA_DESK};const MADINA_IMG_ST={width:'100%',height:'100%',objectFit:'fill',display:'block',pointerEvents:'none',userSelect:'none',WebkitUserSelect:'none'};// The same box, the same element, one property different. The element still fills the
// reading viewport; contain then letterboxes the page inside it and object-position defaults
// to 50% 50%, so the sheet sits dead centre and the paper tone fills what is left. margin
// auto is written anyway so the centring survives a box that is ever allowed to shrink.
const MADINA_IMG_ST_FIT={...MADINA_IMG_ST,objectFit:'contain',margin:'auto'};// A portrait phone, and nothing else: portrait alone would catch a tall desktop window, and
// a width alone would catch a landscape phone. 700px is above every phone and small foldable
// in portrait and below every tablet and desktop window.
const MADINA_FILL_Q='(orientation: portrait) and (max-width: 700px)';const madinaFillNow=()=>{try{return window.matchMedia(MADINA_FILL_Q).matches;}catch(e){return true;}};// Rotation must not need a reload: matchMedia fires `change` when the device turns and when
// a desktop window crosses the boundary, and never otherwise -- no resize listener, no
// polling, no re-render on every pixel of a drag. The subscription is per-sheet and torn
// down with it, and the initial read is taken synchronously so the first paint is already
// correct on whichever orientation the reader opened in.
// The hook itself is called unconditionally by every sheet so that hook order is the same
// on all three renderers, but only the image path subscribes: with madinaimg=0 the SVG and
// text readers must re-render on exactly the occasions they did before this change, and a
// rotation was not one of them.
function useMadinaFill(){const[fill,setFill]=useState(madinaFillNow);useEffect(()=>{if(!MADINA_IMG_ON)return;let mq=null;try{mq=window.matchMedia(MADINA_FILL_Q);}catch(e){return;}const on=()=>setFill(mq.matches);on();// the orientation may have turned before this ran
if(mq.addEventListener)mq.addEventListener('change',on);else if(mq.addListener)mq.addListener(on);return()=>{if(mq.removeEventListener)mq.removeEventListener('change',on);else if(mq.removeListener)mq.removeListener(on);};},[]);return fill;}// The reading box, inset by the REAL safe area. The app-wide viewport meta is not
// viewport-fit=cover and must not be touched from here, so today these insets resolve to
// 0px and the layout viewport is already inside the notch and the home indicator. The
// declaration is written anyway so the page stays clear of them the day that meta changes.
const MADINA_SAFE_PAD='env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)';// Latency, not bytes: transfer is 0.01-0.05s and time-to-first-byte is ~0.30s, so the win
// is a warm connection and a page already in cache. Two Image objects, next and previous,
// nothing more -- no cache API, no service worker, no waterfall. Fired ONLY from the current
// sheet's onLoad, and the `warm` latch means a page's neighbours are prefetched once, not on
// every drag, resize or re-render.
// 79 -- the same two-deep prefetch, now pointed at whichever renderer is actually on
// screen: the printed image when madinaimg is on, the official SVG otherwise. Still two
// Image objects, next and previous, and still nothing else -- no cache API, no service
// worker, no waterfall, and never a third page. Neither branch holds a reference once
// the request is in flight, so nothing accumulates across a reading session.
let __mushafSvgWarm=0;const prefetchMushafSvg=n=>{if(!MUSHAF_SVG_ON&&!MADINA_IMG_ON||n===__mushafSvgWarm)return;__mushafSvgWarm=n;try{// ITEM 33. The worker keeps at most MADINA_PAGE_CACHE_CAP pages and evicts the least
// recently used, so warming more than it can hold would evict the page being READ to make
// room for a guess about where the reader is going next. The ceiling bounds this warm as
// well as its own depth. At two deep against a ceiling of sixty it does not bind today;
// it is what keeps a future widening of either number safe.
//
// IT IS COUNTED INSIDE THE LOOP, not sliced off its header, because the header is pinned
// verbatim by tools/madina-hafs-guard.cjs -- "the prefetch stays two deep" -- and that
// guard is not this screen's to edit. Two guards, one line, and the line stays as written.
let warmed=0;for(const d of[1,-1]){if(warmed>=MADINA_PAGE_CACHE_CAP)break;const t=n+d;if(t<1||t>604)continue;const url=madinaImgUrl(t)||(MUSHAF_SVG_ON?mushafSvgUrl(t):null);if(!url)continue;const im=new Image();im.decoding='async';im.src=url;warmed++;}}catch(e){}};// One sheet of the reader. This is the ONLY place that decides which renderer runs, and it
// is the fallback too. Two ways back to the current reader, and both return the identical
// element with the identical four props:
//   • the flag is off  -> MUSHAF_SVG_ON is false, first branch, no image is ever created
//   • the image failed  -> onError latches `broke`, and the next render takes that branch
// Offline, 404, origin down, decode failure: all of them arrive as onError, and all of them
// land on the reader that ships today. The reader never shows a blank or a broken image.
// `broke` is per-sheet state and the key at the call site is page + epoch, so a page that
// failed once gets a fresh attempt when it is paged back to -- one bad response does not
// poison the session.
// useState runs before the branch, so hook order is identical on every render either way.
// Session 75/D -- our own corner motif: two nested diamonds, geometric, drawn here and nowhere
// else. Each is centred exactly on the outer rule's corner, so it reads as a knot where the two
// rules meet. Its outer diamond is filled with the paper tone so the rules do not show through
// it. pointerEvents none throughout -- the page drag belongs to the viewport and passes
// straight through the ornament, exactly as PageDecor does for the fallback reader.
function SheetCorners(){const at=extra=>/*#__PURE__*/React.createElement("svg",{viewBox:"0 0 16 16",width:MUSHAF_CORNER_PX,height:MUSHAF_CORNER_PX,"aria-hidden":"true",style:{position:'absolute',pointerEvents:'none',...extra}},/*#__PURE__*/React.createElement("path",{d:"M8 2 L14 8 L8 14 L2 8 Z",fill:MUSHAF_PAPER,stroke:"var(--red-deep)",strokeWidth:"1.4"}),/*#__PURE__*/React.createElement("path",{d:"M8 5.6 L10.4 8 L8 10.4 L5.6 8 Z",fill:"var(--red-lift)"}));// Centre the motif on the outer rule's corner: half its own size beyond the band.
const off=-(MUSHAF_FRAME_BAND+MUSHAF_CORNER_PX/2);return/*#__PURE__*/React.createElement(React.Fragment,null,at({top:off,left:off}),at({top:off,right:off}),at({bottom:off,left:off}),at({bottom:off,right:off}));}function MushafSheet({page,headerSurah,needHeader,needBasmala,onSheetLoad}){const[broke,setBroke]=useState(false);// 78 -- the prototype's own latch, and it is a SECOND one on purpose. The fallback chain
// is three deep and each step owns its own failure:
//   printed page image  --onError-->  official SVG page  --onError-->  verified text
// Both useState calls run before every branch, so hook order is identical on all three.
const[imgBroke,setImgBroke]=useState(false);// 81 -- unconditional, and before every branch, exactly like the two latches above: the
// hook order is identical on all three renderers whichever one this sheet takes.
const fill=useMadinaFill();const madina=madinaImgUrl(page.n);if(madina&&!imgBroke)return/*#__PURE__*/React.createElement("div",{style:MADINA_SHEET_ST},/*#__PURE__*/React.createElement("img",{src:madina,alt:"",decoding:"async",loading:"lazy",draggable:"false","data-mushaf-page":page.n,style:fill?MADINA_IMG_ST:MADINA_IMG_ST_FIT,onLoad:()=>{if(onSheetLoad)onSheetLoad(page.n);},onError:()=>setImgBroke(true)}));if(!MUSHAF_SVG_ON||broke)return/*#__PURE__*/React.createElement(MushafPage,{page:page,headerSurah:headerSurah,needHeader:needHeader,needBasmala:needBasmala});// No interaction of any kind: pointerEvents none lets the strip keep the drag (the touch
// handlers sit on pgViewport and the events pass straight through), draggable false kills
// the native image drag. No onClick, no ayah tap, no selection. Phase one is a still page.
// 75/D -- the frame is the positioning anchor and the ratio holder; the sheet inside it is the
// crop window. The two rules come FIRST in DOM order on purpose: their paper tone is then
// painted BEHIND the page image and can never sit over it. The corner motifs come last, and
// they paint only outside the crop window.
return/*#__PURE__*/React.createElement("div",{className:"mushaf-paper",style:s.svgFrame},/*#__PURE__*/React.createElement("div",{style:s.svgRuleOuter}),/*#__PURE__*/React.createElement("div",{style:s.svgRuleInner}),/*#__PURE__*/React.createElement("div",{style:s.svgSheet},/*#__PURE__*/React.createElement("img",{src:mushafSvgUrl(page.n),alt:"",decoding:"async",draggable:"false",style:s.svgImg,onLoad:()=>{if(onSheetLoad)onSheetLoad(page.n);},onError:()=>setBroke(true)})),/*#__PURE__*/React.createElement(SheetCorners,null));}function MushafPage({page,headerSurah,needHeader,needBasmala}){const ref=useRef(null);const[fit,setFit]=useState(null);// null = لم يُقَس بعد
React.useLayoutEffect(()=>{if(fit)return;const el=ref.current;if(!el)return;// (أ) عرضُ الخانة من الصفحة نفسِها، ثمّ الثابتُ العالميّ. لا يُقاس هنا سطرٌ
// واحدٌ لأجل الحجم: K محسوبٌ مرّةً لكلّ الجلسة، وفتحُ الصفحة يقرأه فحسب.
const rows=el.querySelectorAll('[data-l]');let box=0;for(let r=0;r<rows.length;r++){const b=rows[r].clientWidth;if(b>box)box=b;}if(!box)return;// لم تُقَس خانةٌ ← ابقَ على الأساس
const K=pgMeasureK(box);if(K===null)return;// عجز القياسُ ← ابقَ على الأساس
// (ب) حجمٌ واحدٌ للمصحف كلِّه. الـ٠٫٩٩ هامشُ التقريب نفسُه الذي كان.
let uni=Math.max(8,Math.min(40,Math.floor(PG_BASE_FS*K*0.99)));// (ج) حارسُ الفيض — الثابتُ الذي لا يُخرَق. أضيقُ نسبةٍ في هذه الصفحة بعينها،
// مقيسةً من الـDOM لا مقدَّرة. إن كانت دون العالميّ فالسطرُ سيفيض بالعالميّ،
// فتُصغَّر هذه الصفحةُ وحدَها إلى ما يسعها. K لا يُمَسّ: صفحةٌ شاذّةٌ لا تحكم ٦٠٤.
let guard=Infinity;for(let r=0;r<rows.length;r++){const kids=rows[r].children;const b=rows[r].clientWidth;if(!b||!kids.length)continue;let content=0;for(let k=0;k<kids.length;k++)content+=kids[k].offsetWidth;content+=(kids.length-1)*(PG_BASE_FS*PG_GAP_EM);if(!(content>0))continue;const f=PG_BASE_FS*(b/content);if(f<guard)guard=f;}if(isFinite(guard)&&guard>0){const g=Math.max(8,Math.min(40,Math.floor(guard*0.99)));if(g<uni){uni=g;PG_GUARD_PAGES.add(page.n);}}// (د) الملاءمة الرأسيّة: مجموعُ الأسطر بالحجم الواحد، مضافاً إليه ارتفاعُ ما ليس
// سطراً (رأسٌ · بسملةٌ · فاصل) كما قيس من الـDOM. فإن فاض ضُرب الحجمُ بنسبةٍ
// واحدة — والصفحةُ تصغر معاً ولا ينكسر تناسبُها.
const kidsPage=el.children;let otherH=0;for(let c=0;c<kidsPage.length;c++)if(!kidsPage[c].hasAttribute('data-l'))otherH+=kidsPage[c].offsetHeight;const room=el.clientHeight;const total=rows.length*uni*PG_LINE_H*1.06+otherH;if(room>0&&total>room)uni=Math.max(8,Math.min(40,Math.floor(uni*(room/total)*0.99)));// (هـ) الفائضُ الرأسيّ — كما استقرّ في c4393fe بلا تغيير في جوهره. الحجمُ يُقاس
// بالعرض وحده، فيبقى في الطول فائضٌ في أكثر الصفحات. توزيعُه فراغاً يبعثر السطور،
// وتكويمُه فوق وتحت يترك الإطارَ خاوياً — والوجهُ استهلاكُه: يرتفع تباعدُ السطر
// وحدَه حتى يملأ النصُّ إطارَه، ولا يُمَسّ الحجم.
// السقفُ ٢٫٠× قاطعٌ — رُفع من ١٫٥× في ١٤٫٥. الورقةُ لمّا صارت تملأ خانتَها اتّسع
// ما تحتها من فائض، وكان السقفُ القديم يردُّه فراغاً مكوَّماً داخل الإطار؛ فرفعُه
// يصرفه تباعداً بين السطور. ولا يُجاوز ٢٫٠ بحال: بلا سقفٍ تنفرط الصفحةُ الشحيحة —
// سطران في خانةٍ كاملة — إلى سطرين متباعدين لا يُقرآن نصّاً واحداً.
// avail يطرح حشوةَ الصفحة، بخلاف room أعلاه: زيادةُ التباعد لا تصغّر حجماً، أمّا
// مسُّ room فيغيّر ما تحكم به الملاءمةُ الرأسيّة.
let lead=PG_LINE_H;let pad=0;try{const cs=window.getComputedStyle(el);pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);}catch(e){pad=0;}const avail=room-pad;const textH=rows.length*uni*PG_LINE_H*1.06+otherH;if(avail>0&&textH>0&&textH<avail)lead=Math.min(PG_LINE_H*2.0,PG_LINE_H*(avail/textH));// البسملةُ تتبع الحجمَ الواحد — ولم يعد ثَمَّ وسيطٌ تتبعه، فالأسطرُ كلُّها سواء.
setFit({uni,lead,basmala:Math.round(uni*0.92)});},[fit]);// قبل القياس تُرسم الصفحة كلُّها بحجم الأساس مفرودةً — وهي حالةُ القياس نفسها.
const basmalaFs=fit?fit.basmala:Math.round(PG_BASE_FS*0.92);const out=[];const done={};/* 14.2f4 */// رأسٌ حُقن لهذه السورة على هذه الصفحة — فلا يُحقن مرّتين
for(let i=0;i<page.l.length;i++){const ln=page.l[i];if(ln.t==='t'){// سطرٌ يفتتح سورةً بلا بسملةٍ في المصدر (٨١ و٨٥) ← الرأسُ ثمّ البسملةُ فوقه.
// أمّا السور التي للمصدر بسملتُها (١٠ و٨٢ و٨٦) فرأسُها يُحقن عند سطر البسملة
// نفسِه، فوقَه — لا هنا. وإلّا نزل الرأسُ تحت البسملة، وانقلب ترتيبُ المصحف.
const op=ln.w[0].split(':');if(op[1]==='1'&&op[2]==='1'){const sn0=parseInt(op[0],10);if(needHeader&&needHeader[sn0]&&!done[sn0]){done[sn0]=1;out.push(/*#__PURE__*/React.createElement("div",{key:'h'+i,style:s.pgHeader},'سُورَةُ '+SURAH_NAMES[sn0]));}if(needBasmala&&needBasmala[sn0])out.push(/*#__PURE__*/React.createElement("div",{key:'b'+i,style:{...s.pgBasmala,fontSize:basmalaFs}},getVerseText(1,1)||''));}// نفسُ الدالّة التي بها اختير المرشّحون وقيسوا — فلا يفترق المرسومُ عن المقيس.
const parts=pgLineTokens(ln);// حجمٌ واحدٌ لكلّ سطرٍ في الصفحة، وهو نفسُه في الـ٦٠٤ إلا حيث عمل الحارس.
// و space-between دائماً بلا استثناء: السطرُ يمتدّ من حافةٍ لحافة كالمطبوع.
const lfs=fit?fit.uni:PG_BASE_FS;out.push(/*#__PURE__*/React.createElement("div",{key:i,"data-l":i,style:{...s.pgLine,fontSize:lfs,lineHeight:fit?fit.lead:PG_LINE_H,gap:PG_GAP_EM+'em'}},parts.map((p,j)=>/*#__PURE__*/React.createElement("span",{key:j,style:s.pgWord},p))));}else if(ln.t==='h'){const sn=headerSurah[page.n+':'+ln.n];out.push(/*#__PURE__*/React.createElement("div",{key:i,style:sn?s.pgHeader:s.pgBlank},sn?'سُورَةُ '+SURAH_NAMES[sn]:''));}else{// ترتيبُ المصحف لا يُقلب: الرأسُ، ثمّ البسملةُ، ثمّ أوّلُ آية.
// فإن كانت هذه بسملةَ سورةٍ أسقط المصدرُ رأسَها (١٠ يونس · ٨٢ الانفطار · ٨٦ الطارق)
// حُقن الرأسُ هنا — فوقها. سورةُ البسملة تُشتقّ من أوّل خانةٍ بعدها، لا من لافتة.
let sb=0;for(let j=i+1;j<page.l.length;j++){const nx=page.l[j];if(nx.t!=='t'||!nx.w||!nx.w.length)continue;const b0=nx.w[0].split(':');if(b0[1]==='1'&&b0[2]==='1')sb=parseInt(b0[0],10);break;}if(sb&&needHeader&&needHeader[sb]&&!done[sb]){done[sb]=1;out.push(/*#__PURE__*/React.createElement("div",{key:'h'+i,style:s.pgHeader},'سُورَةُ '+SURAH_NAMES[sb]));}// البسملة من getVerseText(1,1) — لا نكتب نصّاً قرآنياً بيدنا أبداً.
out.push(/*#__PURE__*/React.createElement("div",{key:i,style:{...s.pgBasmala,fontSize:basmalaFs}},getVerseText(1,1)||''));}}// 14.5 — الورقةُ تملأ خانتَها ولا تعانق نصَّها. عناقُ الأمس كان يهبط بالإطار إلى طول
// المحتوى فيترك فوقه وتحته شريطَين من لون الخلفيّة — ١٠٩px فوق و١٠٤px تحت في ٥٠٦
// صفحاتٍ من الـ٦٠٤. فالإطارُ الآن ١٠٠٪ في الحالين، والفراغُ يسكن داخلَه لا حولَه:
// justifyContent:center يوسّط الكتلةَ بين حاشيتين متساويتين، والمعيَّنُ مسمورٌ في القدم.
// ولأنّ الطولَ لم يعد يتبدّل بعد القياس، فحالةُ القياس هي حالةُ العرض نفسُها — وهذا
// أمتنُ ممّا كان: room يُقرأ من الخانة التي سيسكنها النصُّ فعلاً، لا من خانةٍ ستنكمش.
const frameSt=s.pgFrame;const pageSt=s.pgPage;return/*#__PURE__*/React.createElement("div",{style:frameSt},/*#__PURE__*/React.createElement("div",{ref:ref,style:pageSt},out),/*#__PURE__*/React.createElement(PageDecor,{n:page.n}));}// Session 51 -- the page dressing: four corner brackets and the page medallion.
// It hangs off the frame WRAPPER, never off pgPage. The fit measurement divides by
// pgPage's element-child count (byHeight, ~4900), so a decorative child inside the page
// would silently shrink the Quran text on every page. pointerEvents:none throughout --
// the page drag belongs to the viewport and must pass straight through the ornament.
function PageDecor({n}){const corner=extra=>/*#__PURE__*/React.createElement("svg",{viewBox:"0 0 14 14",width:"14",height:"14",fill:"none",stroke:"var(--red-lift)",strokeWidth:"1.2",strokeLinecap:"round","aria-hidden":"true",style:{position:'absolute',pointerEvents:'none',...extra}},/*#__PURE__*/React.createElement("path",{d:"M13 1H4a3 3 0 0 0-3 3v9"}));return/*#__PURE__*/React.createElement(React.Fragment,null,corner({top:3,left:3}),corner({top:3,right:3,transform:'scaleX(-1)'}),corner({bottom:3,left:3,transform:'scaleY(-1)'}),corner({bottom:3,right:3,transform:'scale(-1,-1)'}),/*#__PURE__*/React.createElement("div",{style:s.pgMedal},toArabicDigits(n)));}// Session 51 -- the mushaf bookmark (the thread). One flat device key: the child profile
// carries no stable identifier, and adding one for this feature is out of scope. The key is
// cleared alongside the other three in resetAll, so a wiped profile inherits no bookmark.
const MUSHAF_BOOKMARK_KEY='mushaf_bookmark_v1';// Returns null on the slightest doubt -- missing key, damaged JSON, non-integer or
// out-of-range page or surah -- and never surfaces an error to the reader.
function readMushafBookmark(){try{const raw=localStorage.getItem(MUSHAF_BOOKMARK_KEY);if(!raw)return null;const o=JSON.parse(raw);if(!o||typeof o!=='object')return null;if(!Number.isInteger(o.p)||o.p<1||o.p>604)return null;if(!Number.isInteger(o.s)||o.s<1||o.s>114)return null;return{p:o.p,s:o.s};}catch(e){return null;}}function writeMushafBookmark(pg,sr){try{localStorage.setItem(MUSHAF_BOOKMARK_KEY,JSON.stringify({p:pg,s:sr}));}catch(e){}}// ---------------------------------------------------------------------------
// Session 82 -- THE THREAD THAT PLACES ITSELF, and the daily wird beside it.
//
// Three device-local keys, and all three are device-local ONLY. Nothing below is read by
// any request builder, no value here is ever attached to a prompt, a header or a body, and
// no network call exists anywhere in this block. resetAll removes all three.
//
// The manual bookmark above is UNTOUCHED and stays the reader's own deliberate mark: it is
// written by one button and by nothing else. The last page is the opposite kind of thing --
// the app remembers where you were whether you asked it to or not -- so it gets its own key,
// its own reader, its own writer and its own row. The two never share storage or a glyph.
// ---------------------------------------------------------------------------
const MUSHAF_LAST_PAGE_KEY='mushaf_last_page_v1';// Same shape as the bookmark and the same refusal to guess: any doubt at all -- no key,
// damaged JSON, a non-object, a non-integer or an out-of-range page or surah -- returns
// null, and the resume row simply is not drawn. Read and parse are wrapped SEPARATELY so a
// storage that throws on getItem is answered before JSON is ever asked anything.
function readMushafLastPage(){let raw=null;try{raw=localStorage.getItem(MUSHAF_LAST_PAGE_KEY);}catch(e){return null;}if(!raw)return null;let o=null;try{o=JSON.parse(raw);}catch(e){return null;}if(!o||typeof o!=='object')return null;if(!Number.isInteger(o.p)||o.p<1||o.p>604)return null;if(!Number.isInteger(o.s)||o.s<1||o.s>114)return null;return{p:o.p,s:o.s};}// Validated BEFORE the write, so a bad pair is never persisted for the reader above to have
// to reject later. A storage that throws costs nothing: the page is still on the screen.
function writeMushafLastPage(pg,sr){if(!Number.isInteger(pg)||pg<1||pg>604)return;if(!Number.isInteger(sr)||sr<1||sr>114)return;try{localStorage.setItem(MUSHAF_LAST_PAGE_KEY,JSON.stringify({p:pg,s:sr}));}catch(e){}}// The daily target: a decimal integer string, 1..604, and ABSENCE IS A REAL ANSWER. "No
// target" is not a broken state to be repaired on the next read -- it is the state the
// reader gets by default and the state the picker can return them to for good.
const WIRD_TARGET_KEY='mushaf_wird_target_v1';// Canonical decimal only. ' 5', '5 ', '5.0', '-5', '05', '', 'abc' and Arabic-Indic digits
// as STORED text are all refused: the picker normalises before it writes, so anything
// non-canonical in the key was not written by this build and is not trusted.
function readWirdTarget(){let raw=null;try{raw=localStorage.getItem(WIRD_TARGET_KEY);}catch(e){return null;}if(typeof raw!=='string'||!/^[0-9]+$/.test(raw))return null;const n=parseInt(raw,10);if(!(n>=1&&n<=604))return null;if(String(n)!==raw)return null;return n;}function writeWirdTarget(n){if(!Number.isInteger(n)||n<1||n>604)return;try{localStorage.setItem(WIRD_TARGET_KEY,String(n));}catch(e){}}function clearWirdTarget(){try{localStorage.removeItem(WIRD_TARGET_KEY);}catch(e){}}// Today's completed pages: { d: 'YYYY-MM-DD', pages: [distinct 1..604] }.
const WIRD_DAY_KEY='mushaf_wird_day_v1';// 8 seconds on the page, continuously, or it did not count. Short enough that ordinary
// reading credits every page; long enough that paging past twenty sheets looking for a
// surah credits none of them but the one you stopped on.
const WIRD_DWELL_MS=8000;const WIRD_TARGET_PRESETS=[1,2,5,10,20];// DEVICE-LOCAL, and deliberately not toISOString. The day boundary a reader lives by is
// their own midnight, not UTC's: east of Greenwich toISOString would roll the wird over in
// the middle of the evening, and west of it the small hours would still count as yesterday.
// getFullYear/getMonth/getDate are the local calendar and nothing else is consulted.
function wirdDayKey(d){const t=d||new Date();const y=t.getFullYear();const m=t.getMonth()+1;const day=t.getDate();return String(y)+'-'+(m<10?'0':'')+String(m)+'-'+(day<10?'0':'')+String(day);}// Anything that is not today's well-formed record reads as TODAY'S EMPTY RECORD -- a record
// from another local date, damaged JSON, a missing key, a non-array `pages`, a storage that
// throws. Yesterday's wird is never today's progress and never an error message either.
// Pages are filtered, range-checked and de-duplicated on the way out, so the count can only
// be the number of distinct real pages and can never exceed 604.
function readWirdDay(){const today=wirdDayKey();let raw=null;try{raw=localStorage.getItem(WIRD_DAY_KEY);}catch(e){return{d:today,pages:[]};}if(!raw)return{d:today,pages:[]};let o=null;try{o=JSON.parse(raw);}catch(e){return{d:today,pages:[]};}if(!o||typeof o!=='object')return{d:today,pages:[]};if(o.d!==today)return{d:today,pages:[]};if(!Array.isArray(o.pages))return{d:today,pages:[]};const seen=Object.create(null);const pages=[];for(const v of o.pages){if(!Number.isInteger(v)||v<1||v>604)continue;if(seen[v])continue;seen[v]=1;pages.push(v);}return{d:today,pages:pages};}// The only writer of the daily key. A page already credited today writes NOTHING, so
// returning to it -- or paging back and forth over it all afternoon -- cannot inflate the
// count. An invalid page writes nothing either. localStorage only: no request, no beacon.
function markWirdPageRead(pg){const rec=readWirdDay();if(!Number.isInteger(pg)||pg<1||pg>604)return rec;if(rec.pages.indexOf(pg)!==-1)return rec;const next={d:rec.d,pages:rec.pages.concat([pg])};try{localStorage.setItem(WIRD_DAY_KEY,JSON.stringify(next));}catch(e){}return next;}// The picker's own normalisation. Character for character the acceptance the page-jump box
// uses -- Arabic-Indic and Latin digits, whitespace stripped -- but its OWN function, so
// that jumpGo below is left exactly as it is and the page jump cannot change behaviour.
function wirdNormalizeDigits(v){return String(v==null?'':v).replace(/\s+/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));}// القارئ المُصفَّح — صفحةٌ لكلّ شاشة، ٦٠٤ صفحة، بأسطر مصحف المدينة.
// الاتّجاه: المصحفُ يُقلب من اليسار إلى اليمين، فجرُّ الورقة يميناً يكشف التالية.
function PagedMushaf({startSurah,startPage,onExit}){const[state,setState]=useState('loading');// loading | ok | fail
const[page,setPage]=useState(1);const[drag,setDrag]=useState(0);const[slide,setSlide]=useState(0);const[anim,setAnim]=useState(false);// 75/B2 -- immersive chrome: two bars the page can take the whole screen from.
// 77 -- but they INTRODUCE THEMSELVES BEFORE THEY HIDE. They start VISIBLE for everybody,
// so a reader opening the mushaf for the first time sees the sura name, the bookmark, the
// page bar and the way back -- and they collapse ONCE, after that reader turns the first
// page. The gesture teaches itself: you see the furniture, you turn a page, it makes room,
// and a tap brings it back. Before 77 the flag decided the initial value, so from 7a4a2aa
// -- when the flag became everybody -- a first-time reader met a page with no way back on it.
//
// Unconditional `true` is SAFER for the fallback, not riskier. With the flag off the tap
// toggle is gated (see onEnd) and readerTurnedPage refuses to write, so the initialiser
// remains the only writer the fallback ever reaches and its bars stay pinned visible
// exactly as they are today.
const[chromeOn,setChromeOn]=useState(true);// The one-shot latch is a REF, not state: a re-render cannot re-fire it, and it is never
// read during rendering so it cannot be stale. commit() lands twice on purpose (the
// transitionend and the fallback timer both call land), and the latch is what makes the
// second landing free.
//
// It is called from the two places the READER moves the page and from nowhere else:
// land() for a committed swipe and for the prev/next buttons, and jumpTo() for a jump.
// Deliberately NOT a useEffect on `page`. There is a third writer of `page` -- the load
// effect above, which sets the opening page from the surah index -- and an effect on
// `page` would fire for it, collapsing the bars before the reader had touched anything,
// which is the defect this replaces. The epoch bump from a screen rotation or a font load
// never touches `page` at all, so it cannot reach this either.
const chromeAuto=useRef(false);// 78 -- the image prototype is a page reader too, so it collapses the bars after the
// first turn exactly as the SVG reader does. With the prototype off the condition is
// character for character what it was.
const readerTurnedPage=()=>{if(!MUSHAF_SVG_ON&&!MADINA_IMG_ON||chromeAuto.current)return;chromeAuto.current=true;setChromeOn(false);};// 75/E -- null means FIT, and fit means no transform on the element at all rather than a
// scale of 1. That is what makes "a second double tap returns to fit, exactly" true by
// construction: there is nothing left to accumulate a rounding error in.
const[zoom,setZoom]=useState(null);// null | { k, tx, ty }
const idx=useRef(null);const tapRef=useRef({t:0,x:0,y:0,timer:null});const slotRef=useRef(null);const touch=useRef({x:0,y:0,on:false,lock:null});const timer=useRef(null);// الثابتُ العالميّ يُبطَل في حالتين لا ثالثة، وكلتاهما تجعله كذباً يعمّ الـ٦٠٤:
//   • تغيّرُ عرض النافذة (تدويرُ الشاشة) — الخانةُ صارت غيرَها.
//   • وصولُ خطّ المصحف بعد قياسٍ جرى بخطٍّ بديل — الحروفُ صارت غيرَها.
// ارتفاعُ النافذة وحده لا يُبطل شيئاً: شريطُ المتصفّح يطلع وينزل فيغيّره بلا سبب.
// الإبطالُ يرفع epoch، وهي في مفاتيح الصفحات الثلاث، فتُعاد ملاءمتُها وحدها.
const[epoch,setEpoch]=useState(0);useEffect(()=>{let alive=true;let w=window.innerWidth;const redo=()=>{if(!alive)return;pgInvalidateK();setEpoch(e=>e+1);};const onResize=()=>{if(window.innerWidth!==w){w=window.innerWidth;redo();}};window.addEventListener('resize',onResize);// لو كان الخطُّ حاضراً سلفاً (مخزَّناً) فلا إبطالَ ولا إعادةَ قياسٍ بلا سبب.
try{if(document.fonts&&document.fonts.ready&&document.fonts.status!=='loaded')document.fonts.ready.then(redo);}catch(e){}return()=>{alive=false;window.removeEventListener('resize',onResize);};},[]);useEffect(()=>{let alive=true;Promise.all([loadQuran(),loadLayout()]).then(()=>{if(!alive)return;idx.current=buildLayoutIndex();setPage(startPage||idx.current.startPage[startSurah]||1);setState('ok');}).catch(()=>{if(alive)setState('fail');});return()=>{alive=false;};},[startSurah,startPage]);useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(tapRef.current.timer)clearTimeout(tapRef.current.timer);},[]);// 75/E -- the zoom belongs to the page being looked at and never outlives it. Paging, jumping
// and the prev/next buttons all return to fit, so no page inherits the previous page's
// transform. Leaving the surah unmounts PagedMushaf outright (MushafScreen renders it only
// while `selected` is set, index.html:6027), so leaving the screen cannot leave a transform
// behind either -- the state does not survive to be restored.
useEffect(()=>{setZoom(null);},[page]);// Session 51 -- the bookmark is placed by hand and only by hand: this button is the sole
// writer in the file. Paging, dragging and entering a surah move nothing. `markPage` is
// read once at mount purely to light the button when the reader is standing on it.
const[markPage,setMarkPage]=useState(()=>{const b=readMushafBookmark();return b?b.p:null;});const marked=markPage===page;const putMark=()=>{writeMushafBookmark(page,startSurah);setMarkPage(page);};// 14.4 — القفز إلى صفحةٍ برقمها. null = الشريط يعرض اللافتة، ونصٌّ = الخانة مفتوحة.
const[jump,setJump]=useState(null);// Session 82 -- the wird. Three pieces of state and one measurement, and every hook below
// is UNCONDITIONAL and sits above the `state !== 'ok'` return, so the hook order of this
// component is the same on the loading render, the failed render and the reading render.
const[wirdDay,setWirdDay]=useState(readWirdDay);const[wirdTarget,setWirdTarget]=useState(readWirdTarget);const[picker,setPicker]=useState(false);const[pickerText,setPickerText]=useState('');// The measured height of the pager, taken off the pager itself rather than assumed from
// its style object -- padding, safe area and font all feed it and none of them are ours to
// predict. barSt is untouched; this is a ref at the use site and nothing more.
const barRef=useRef(null);const[barH,setBarH]=useState(0);// THE LAST PAGE, and it is deliberately NOT coupled to the dwell timer. Wherever the
// reader is standing once the mushaf is open is where they will be returned to, whether
// they stood there long enough for it to count towards the wird or not. Swipe, jump,
// prev/next: they all land in `page`, and this effect follows every one of them.
useEffect(()=>{if(state!=='ok')return;writeMushafLastPage(page,startSurah);},[state,page,startSurah]);// THE DWELL. A page is credited only after it has been the current page continuously for
// WIRD_DWELL_MS with the document visible. The timer is armed by this effect and torn
// down by its cleanup, so a page change, an unmount or the reader leaving the surah all
// cancel it by construction -- there is no path that credits a page you have left, and a
// jump across twenty sheets credits the one you landed on and none of the twenty.
// Backgrounding the tab cancels it too (reading is not happening), and coming back arms a
// fresh eight seconds rather than resuming a stale one.
useEffect(()=>{if(state!=='ok')return;let t=null;const disarm=()=>{if(t){clearTimeout(t);t=null;}};const visible=()=>{try{return document.visibilityState!=='hidden';}catch(e){return true;}};const arm=()=>{disarm();if(!visible())return;t=setTimeout(()=>{t=null;setWirdDay(markWirdPageRead(page));},WIRD_DWELL_MS);};const onVis=()=>{if(!visible()){disarm();return;}// A tab left open across midnight comes back to today's empty record, not yesterday's.
setWirdDay(readWirdDay());arm();};arm();try{document.addEventListener('visibilitychange',onVis);}catch(e){}return()=>{disarm();try{document.removeEventListener('visibilitychange',onVis);}catch(e){}};},[state,page]);// The pager's height, re-measured whenever it appears, disappears or is re-laid out by a
// rotation (epoch). A measurement that cannot be taken is 0, which puts the strip on the
// bottom edge -- the same place it lives when the chrome is hidden. Never a guess.
// The measurement is KEPT when the chrome hides rather than zeroed, because `chromeOn` is
// what decides the position and barH only says how tall the pager is when it is there.
// Keeping it means the strip is already in the right place on the first frame after the
// chrome is tapped back on, instead of sitting on the pager for one paint.
useEffect(()=>{if(!MADINA_IMG_ON)return;if(state!=='ok'||!chromeOn)return;let h=0;try{const el=barRef.current;h=el&&el.offsetHeight||0;}catch(e){h=0;}setBarH(h);},[state,chromeOn,epoch]);// Escape closes the picker, alongside the backdrop and the explicit close button.
useEffect(()=>{if(!picker)return;const onKey=e=>{if(e.key==='Escape')setPicker(false);};try{window.addEventListener('keydown',onKey);}catch(e){}return()=>{try{window.removeEventListener('keydown',onKey);}catch(e){}};},[picker]);if(state!=='ok'){return/*#__PURE__*/React.createElement("div",{style:s.memContainer},/*#__PURE__*/React.createElement("div",{className:"ezhome ezmr-rail is-static"},/*#__PURE__*/React.createElement("div",{className:"ezmr-bar"},/*#__PURE__*/React.createElement("div",{className:"ezmr-title",style:s.ezmrTitle},"المصحف"),/*#__PURE__*/React.createElement("button",{onClick:onExit,className:"ezmr-btn",style:s.ezmrJump},"السور"))),/*#__PURE__*/React.createElement("div",{style:s.mushafHint},state==='fail'?'تعذّر فتح المصحف':'جارٍ فتح المصحف…'));}const L=__layoutData.p;const cur=L[page-1];const nxt=page<604?L[page]:null;// التالية — يسارَ الحالية
const prv=page>1?L[page-2]:null;// السابقة — يمينَها
// الهبوط: يُستدعى من transitionend، أو من مؤقّتٍ احتياطيّ لو خان.
// بلا هذا المؤقّت، انتقالٌ لا يُطلق transitionend (تبويبةٌ في الخلفية، أو
// prefers-reduced-motion) يُجمّد المُصفَّح إلى الأبد. الهبوط مرّتين آمن: الثانية لا تجد slide.
const land=sl=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}setAnim(false);// 77 -- inside the `if`, so a swipe that bounced at page 1 or 604 arrives with sl === 0
// and is correctly not a page turn. commit() is what the prev/next buttons call too, so
// both reader-driven paths arrive here.
if(sl){setPage(page+sl);setSlide(0);readerTurnedPage();}};const commit=d=>{const n=page+d;const eff=n>=1&&n<=604?d:0;// خارج المدى ← ارتدّ في مكانك
setDrag(0);setAnim(true);setSlide(eff);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{timer.current=null;land(eff);},420);};const onTransEnd=()=>land(slide);// 14.4 — القفزةُ البعيدة لا تمرُّ بـ commit: انزياحُ الشريط هو slide*100% وخاناتُه ثلاثٌ فقط،
// فقفزةٌ بمقدار ٥٨٥ صفحةً تعني انزياحاً بـ ٥٨٥٠٠٪ — لا شيء. فالمسلكُ هو مهبطُ commit نفسُه:
// نفسُ التنظيف الذي يفعله land ونفسُ setPage، بصفحةٍ مطلقةٍ بدل page + sl.
const jumpTo=n=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}setDrag(0);setAnim(false);setSlide(0);setPage(n);if(n!==page)readerTurnedPage();};/* 77 -- jumping to the page you are already on is not a page change */// التطبيع: تُقبل الأرقامُ الهنديّة واللاتينيّة معاً. وما بقي بعد نزع الفراغ وليس رقماً — تُردُّ الخانةُ كلُّها.
const jumpGo=()=>{const raw=String(jump==null?'':jump).replace(/\s+/g,'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));setJump(null);if(!/^[0-9]+$/.test(raw))return;const n=parseInt(raw,10);if(n>=1&&n<=604)jumpTo(n);};// 75/E -- one tap recalls the chrome, two taps zoom. A single tap therefore waits out the
// double-tap window before it acts: without that wait, the first tap of every double tap
// would flash the chrome on and then off again. MUSHAF_TAP_MS is the whole price of telling
// the two gestures apart, and it is paid only on the single tap.
const onTap=(x,y)=>{const R=tapRef.current;const now=Date.now();if(R.timer&&now-R.t<=MUSHAF_TAP_MS&&Math.abs(x-R.x)<=MUSHAF_TAP_SLOP&&Math.abs(y-R.y)<=MUSHAF_TAP_SLOP){clearTimeout(R.timer);R.timer=null;R.t=0;setZoom(z=>z?null:{k:MUSHAF_ZOOM_K,tx:0,ty:0});return;}R.t=now;R.x=x;R.y=y;if(R.timer)clearTimeout(R.timer);R.timer=setTimeout(()=>{R.timer=null;setChromeOn(v=>!v);},MUSHAF_TAP_MS);};// The window the pan is clamped against: the slot's CONTENT box, and the frame's unscaled box.
// Both are read from the DOM rather than assumed, so a maxWidth cap or a short screen is
// accounted for without this code knowing about either.
const panBox=()=>{const el=slotRef.current;const fr=el&&el.firstElementChild;if(!el||!fr)return null;// 78 -- the image path pays no frame band, and its slot padding is the safe area rather
// than a constant this code could subtract. So the window is MEASURED off the sheet,
// which fills the slot's content box exactly. Same clamp, same units, read not assumed.
if(MADINA_IMG_ON){const w=fr.offsetWidth,h=fr.offsetHeight;return{sw:w,sh:h,fw:w,fh:h};}return{sw:el.clientWidth-2*MUSHAF_FRAME_BAND,sh:el.clientHeight-2*MUSHAF_FRAME_BAND,fw:fr.offsetWidth,fh:fr.offsetHeight};};const onStart=e=>{if(slide)return;// ورقةٌ في الطيران — لا تلمسها
const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY,on:true,lock:null};setAnim(false);};const onMove=e=>{const T=touch.current;if(!T.on)return;const t=e.touches[0];// 75/E -- magnified: one finger pans, clamped, and the page flip does not get a look in.
// The deltas are taken incrementally and T is re-based every move, so the pan needs no
// separate gesture-start baseline and cannot drift away from the finger.
if(zoom){const b=panBox();const ddx=t.clientX-T.x,ddy=t.clientY-T.y;setZoom(z=>{if(!z)return z;if(!b)return z;const p=mushafClampPan(z.tx+ddx,z.ty+ddy,z.k,b.fw,b.fh,b.sw,b.sh);return{k:z.k,tx:p.tx,ty:p.ty};});T.x=t.clientX;T.y=t.clientY;T.lock='z';return;}const dx=t.clientX-T.x,dy=t.clientY-T.y;if(T.lock===null&&(Math.abs(dx)>8||Math.abs(dy)>8))T.lock=Math.abs(dx)>Math.abs(dy)?'x':'y';if(T.lock==='x')setDrag(dx);};const onEnd=()=>{const T=touch.current;if(!T.on)return;T.on=false;// 75/B2 -- lock is set on the first move past 8px in either axis, so lock === null means the
// finger never really moved: a TAP. With the flag on, a tap recalls the chrome or hides it
// again. This is still a still page -- it toggles our own two bars and touches nothing in
// the sheet: no ayah tap, no highlight, no selection.
if(T.lock==='z')return;// 75/E -- that was a pan, not a tap or a flip
if(T.lock===null){setDrag(0);if(MUSHAF_SVG_ON||MADINA_IMG_ON)onTap(T.x,T.y);return;}/* 78 -- the tap gestures belong to the image path too */if(T.lock!=='x'){setDrag(0);return;}if(drag>55)commit(1);else if(drag<-55)commit(-1);else{setDrag(0);setAnim(true);}};/* 14.2f1 */// الشريط الآن موضوعٌ وضعاً مطلقاً، والخانات بإزاحاتٍ صريحة (-100% / 0 / +100%).
// لا يعتمد على ترتيب flex ولا على جهة الفيض — وكلاهما ينقلب مع direction:rtl.
// انزياح +100% ⇒ الشريط يتحرّك يميناً ⇒ تدخل الخانة التي على اليسار = الصفحة التالية.
// وهذا هو قلبُ ورقة المصحف بعينه.
// 75/B1 -- with the flag on the slot gives up its 6px inset so the page reaches the edges of
// the viewport: 348px of drawn width at a 360 viewport becomes 360px. pgSlot is SHARED with
// the fallback MushafPage, so the padding is dropped here at the use site and the style object
// is left alone -- the reader that ships today keeps its inset exactly.
// 78 -- and with the image prototype on, the slot gives up the frame band as well: the
// printed page IS the surface, so its only inset is the real safe area. s.pgSlot is
// shared with both other readers, so this too is decided here and the object is untouched.
const slotSt=MADINA_IMG_ON?{...s.pgSlot,padding:MADINA_SAFE_PAD}:MUSHAF_SVG_ON?{...s.pgSlot,padding:MUSHAF_FRAME_BAND}:s.pgSlot;// 75/D -- the warm surface the page sits on. pgViewport is SHARED with the fallback reader, so
// the tone is applied here at the use site and the style object is left alone. Behind the page,
// never over it: this is the background of the box the page is centred in.
const vpSt=MADINA_IMG_ON?{...s.pgViewport,background:MADINA_DESK,...(zoom?{touchAction:'none'}:{})}:MUSHAF_SVG_ON?{...s.pgViewport,background:MUSHAF_DESK,...(zoom?{touchAction:'none'}:{})}:s.pgViewport;// 78 -- THE FULL-SCREEN CONTRACT, and all of it is these three objects.
// pgViewport is `flex:1` inside a `100dvh` column, so the reading box is whatever the two
// bars leave behind. Lift both bars out of the column -- absolute, pinned to the two edges
// -- and they leave behind ALL of it: the page owns the whole 100dvh and nothing else has
// any layout height. That is also why toggling the chrome cannot resize or move the page:
// an overlay appearing and disappearing changes no box the page is measured against.
// The bars carry the safe-area insets in their own padding so their buttons stay clear of
// the notch and the home indicator without pushing the page down.
const contSt=MADINA_IMG_ON?{...s.memContainer,position:'relative'}:s.memContainer;// S111 -- the rollback branch reads memHeaderFb, whose BOX is memHeader's box property for
// property and whose paint is istana. The image branch is untouched: it is not drawn from
// either object any more (S110 gave it .ezmr-rail), and this const survives only because the
// rollback bar is still an in-flow flex child and must stay one.
const headSt=MADINA_IMG_ON?{...s.memHeader,position:'absolute',top:0,left:0,right:0,zIndex:4,paddingTop:'calc(14px + env(safe-area-inset-top, 0px))',paddingLeft:'calc(18px + env(safe-area-inset-left, 0px))',paddingRight:'calc(18px + env(safe-area-inset-right, 0px))'}:s.memHeaderFb;const barSt=MADINA_IMG_ON?{...s.pgBar,position:'absolute',bottom:0,left:0,right:0,zIndex:4,paddingBottom:'calc(8px + env(safe-area-inset-bottom, 0px))',paddingLeft:'calc(14px + env(safe-area-inset-left, 0px))',paddingRight:'calc(14px + env(safe-area-inset-right, 0px))'}:s.pgBarFb;// 82 -- THE PROGRESS STRIP, and it obeys the same contract as the other two overlays.
// Absolute, a sibling of the header, the viewport and the pager, and NEVER a flex child of
// the column: it therefore consumes zero layout height and the page is measured against
// exactly the box it was measured against before this existed. Showing or hiding the
// chrome ADDS OR REMOVES the strip -- it does not resize or move the page, because
// nothing here is in the page's box at all.
//
// ITEM 22+104 -- THE STRIP LEAVES WITH THE CHROME. It used to outlive it, on the stated
// reasoning that knowing how much of your wird is left was the one thing worth keeping on
// an otherwise bare page. The owner has overruled that reasoning by name: the wird is the
// FIRST thing that should go from the eye while reading. So the strip is gated on
// `chromeOn` at its render site and is ABSENT FROM THE DOM in reading mode -- not faded,
// not hidden, not present at zero height. Gone.
//
// THE COUNT DOES NOT STOP WITH IT. The dwell timer is keyed on [state, page] and names
// `chromeOn` nowhere, so the page being read is credited whether or not anything is drawn
// to say so. Hiding the chrome hides the REPORTING of the wird, never the counting of it.
//
// Where it sits: directly above the pager when the pager is on screen (barH is measured,
// never assumed), and on the bottom safe-area edge when that measurement is 0. `chromeOn`
// is no longer a term in the position: the strip renders only WITH the chrome, so the
// branch that put it on the bottom edge for a HIDDEN chrome is unreachable and is gone.
// At a visible chrome the value is what it always was, which is why the position is
// unchanged byte for byte on every frame the strip is actually drawn.
const wirdBottomMost=!(barH>0);const wirdSt={...s.wirdWrap,bottom:wirdBottomMost?0:barH,paddingBottom:wirdBottomMost?'calc(6px + env(safe-area-inset-bottom, 0px))':6};const wirdDone=wirdDay&&wirdDay.pages?wirdDay.pages.length:0;// Numerically the reader may pass their target -- twelve pages against a target of ten is
// twelve, and it says twelve. The FILL is what caps: a bar cannot be more than full.
const wirdPct=wirdTarget?Math.min(100,Math.round(wirdDone/wirdTarget*100)):0;const setTarget=n=>{writeWirdTarget(n);setWirdTarget(n);setPickerText('');setPicker(false);};const dropTarget=()=>{clearWirdTarget();setWirdTarget(null);setPickerText('');setPicker(false);};const pickerGo=()=>{const raw=wirdNormalizeDigits(pickerText);if(!/^[0-9]+$/.test(raw)){setPickerText('');return;}const n=parseInt(raw,10);if(n>=1&&n<=604)setTarget(n);else setPickerText('');};// 75/E -- the whole of the zoom, and it lives on one element inside the page container. scale
// is rightmost so it applies FIRST, which leaves the pan in unscaled pixels and keeps the
// clamp arithmetic in a single unit. At fit this is null, so the style carries no transform
// key at all and the element is exactly what it was before the first zoom.
const zoomSt=zoom?{transform:'translate('+zoom.tx+'px, '+zoom.ty+'px) scale('+zoom.k+')',willChange:'transform'}:null;const strip={...s.pgStrip,transform:'translateX(calc('+slide*100+'% + '+drag+'px))',transition:anim?'transform .26s cubic-bezier(.22,.61,.36,1)':'none'};const firstText=cur.l.find(x=>x.t==='t'&&x.w&&x.w.length);const curSurah=firstText?parseInt(firstText.w[0].split(':')[0],10):null;const hs=idx.current.headerSurah;const nh=idx.current.needHeader;const nb=idx.current.needBasmala;return/*#__PURE__*/React.createElement("div",{className:"ezmr-scope",style:contSt},chromeOn&&(MADINA_IMG_ON?/*#__PURE__*/React.createElement("div",{className:"ezhome ezmr-rail"},/*#__PURE__*/React.createElement("div",{className:"ezmr-bar"},/*#__PURE__*/React.createElement("button",{onClick:putMark,title:marked?'علامتك هنا':'ضع العلامة',"aria-label":marked?'علامتك هنا':'ضع العلامة',className:marked?'ezmr-btn is-on':'ezmr-btn'},/*#__PURE__*/React.createElement("svg",{viewBox:"0 0 24 24",width:"20",height:"20",fill:marked?'var(--red)':'none',stroke:marked?'var(--red-deep)':'currentColor',strokeWidth:marked?1.5:1.8,strokeLinejoin:"round","aria-hidden":"true"},/*#__PURE__*/React.createElement("path",{d:"M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"}))),/*#__PURE__*/React.createElement("div",{className:"ezmr-title",style:s.ezmrTitle},curSurah?SURAH_NAMES[curSurah]:'المصحف'," · صفحة ",toArabicDigits(page)),/*#__PURE__*/React.createElement("button",{onClick:onExit,className:"ezmr-btn",style:s.ezmrJump},"السور"))):/*#__PURE__*/React.createElement("div",{className:"ezhome",style:headSt},/*#__PURE__*/React.createElement("div",{className:"ezmr-fb-inner"},/*#__PURE__*/React.createElement("div",{style:s.memTitleFb},curSurah?SURAH_NAMES[curSurah]:'المصحف'),/*#__PURE__*/React.createElement("div",{style:{display:'flex',alignItems:'center',gap:8}},/*#__PURE__*/React.createElement("button",{onClick:putMark,title:marked?'علامتك هنا':'ضع العلامة',"aria-label":marked?'علامتك هنا':'ضع العلامة',className:marked?'ezmr-fb-btn is-on':'ezmr-fb-btn',style:{...s.memBtnFb,padding:'0 10px',display:'inline-flex',alignItems:'center'}},/*#__PURE__*/React.createElement("svg",{viewBox:"0 0 24 24",width:"20",height:"20",fill:marked?'var(--red)':'none',stroke:marked?'var(--red-deep)':'currentColor',strokeWidth:marked?1.5:1.8,strokeLinejoin:"round","aria-hidden":"true"},/*#__PURE__*/React.createElement("path",{d:"M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"}))),/*#__PURE__*/React.createElement("button",{onClick:onExit,className:"ezmr-fb-btn",style:s.memBtnFb},"السور"))))),/*#__PURE__*/React.createElement("div",{style:vpSt,onTouchStart:onStart,onTouchMove:onMove,onTouchEnd:onEnd,onTouchCancel:onEnd},/*#__PURE__*/React.createElement("div",{style:strip,onTransitionEnd:onTransEnd},/*#__PURE__*/React.createElement("div",{style:{...slotSt,left:'-100%'}},nxt&&/*#__PURE__*/React.createElement(MushafSheet,{key:nxt.n+':'+epoch,page:nxt,headerSurah:hs,needHeader:nh,needBasmala:nb})),/*#__PURE__*/React.createElement("div",{ref:slotRef,style:{...slotSt,left:'0%',...zoomSt}},/*#__PURE__*/React.createElement(MushafSheet,{key:cur.n+':'+epoch,page:cur,headerSurah:hs,needHeader:nh,needBasmala:nb,onSheetLoad:prefetchMushafSvg})),/*#__PURE__*/React.createElement("div",{style:{...slotSt,left:'100%'}},prv&&/*#__PURE__*/React.createElement(MushafSheet,{key:prv.n+':'+epoch,page:prv,headerSurah:hs,needHeader:nh,needBasmala:nb})))),chromeOn&&(MADINA_IMG_ON?/*#__PURE__*/React.createElement("div",{ref:barRef,className:"ezhome ezmr-dockwrap"},/*#__PURE__*/React.createElement("div",{className:"ezmr-bar"},/*#__PURE__*/React.createElement("button",{onClick:()=>commit(-1),disabled:page<=1,className:"ezmr-btn",style:s.ezmrNav},"›"),/*#__PURE__*/React.createElement("div",{style:s.pgJumpWrap},jump==null?/*#__PURE__*/React.createElement("button",{onClick:()=>setJump(String(page)),"aria-label":"اذهب إلى صفحة",className:"ezmr-btn",style:s.ezmrJump},"صفحة ",toArabicDigits(page)," من ٦٠٤"):/*#__PURE__*/React.createElement("input",{type:"text",inputMode:"numeric",enterKeyHint:"go",maxLength:4,autoFocus:true,"aria-label":"رقم الصفحة",value:toArabicDigits(jump),onChange:e=>setJump(e.target.value),onFocus:e=>e.target.select(),onKeyDown:e=>{if(e.key==='Enter')jumpGo();else if(e.key==='Escape')setJump(null);},onBlur:()=>setJump(null),style:s.pgJumpInput})),/*#__PURE__*/React.createElement("button",{onClick:()=>commit(1),disabled:page>=604,className:"ezmr-btn",style:s.ezmrNav},"‹"))):/*#__PURE__*/React.createElement("div",{ref:barRef,className:"ezhome",style:barSt},/*#__PURE__*/React.createElement("div",{className:"ezmr-fb-inner"},/*#__PURE__*/React.createElement("button",{onClick:()=>commit(-1),disabled:page<=1,className:"ezmr-fb-btn",style:s.pgNavBtnFb},"›"),/*#__PURE__*/React.createElement("div",{style:s.pgJumpWrap},jump==null?/*#__PURE__*/React.createElement("button",{onClick:()=>setJump(String(page)),"aria-label":"اذهب إلى صفحة",className:"ezmr-fb-btn",style:{...s.pgMetaFb,...s.pgJumpBtn}},"صفحة ",toArabicDigits(page)," من ٦٠٤"):/*#__PURE__*/React.createElement("input",{type:"text",inputMode:"numeric",enterKeyHint:"go",maxLength:4,autoFocus:true,"aria-label":"رقم الصفحة",value:toArabicDigits(jump),onChange:e=>setJump(e.target.value),onFocus:e=>e.target.select(),onKeyDown:e=>{if(e.key==='Enter')jumpGo();else if(e.key==='Escape')setJump(null);},onBlur:()=>setJump(null),style:s.pgJumpInput})),/*#__PURE__*/React.createElement("button",{onClick:()=>commit(1),disabled:page>=604,className:"ezmr-fb-btn",style:s.pgNavBtnFb},"‹")))),MADINA_IMG_ON&&chromeOn&&/*#__PURE__*/React.createElement("div",{style:wirdSt},/*#__PURE__*/React.createElement("button",{onClick:()=>setPicker(true),"aria-label":"وردُ اليوم",style:s.wirdBtn},wirdTarget?/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("span",{style:s.wirdText},"وردك ",toArabicDigits(wirdDone)," / ",toArabicDigits(wirdTarget)),/*#__PURE__*/React.createElement("span",{style:s.wirdTrack},/*#__PURE__*/React.createElement("span",{style:{...s.wirdFill,width:wirdPct+'%'}}))):/*#__PURE__*/React.createElement("span",{style:s.wirdText},"اليوم ",toArabicDigits(wirdDone)," · حدّد وردك"))),MADINA_IMG_ON&&picker&&/*#__PURE__*/React.createElement("div",{style:s.wirdBack,onClick:()=>setPicker(false)},/*#__PURE__*/React.createElement("div",{style:s.wirdSheet,onClick:e=>e.stopPropagation()},/*#__PURE__*/React.createElement("div",{style:s.wirdSheetHead},/*#__PURE__*/React.createElement("div",{style:s.wirdSheetTitle},"وردُ اليوم"),/*#__PURE__*/React.createElement("button",{onClick:()=>setPicker(false),"aria-label":"إغلاق",style:{...s.pgNavBtn,width:36}},"×")),/*#__PURE__*/React.createElement("div",{style:s.wirdChips},WIRD_TARGET_PRESETS.map(n=>/*#__PURE__*/React.createElement("button",{key:n,onClick:()=>setTarget(n),style:{...s.wirdChip,...(wirdTarget===n?s.wirdChipOn:{})}},toArabicDigits(n)))),/*#__PURE__*/React.createElement("div",{style:s.wirdFree},/*#__PURE__*/React.createElement("input",{type:"text",inputMode:"numeric",enterKeyHint:"done",maxLength:4,"aria-label":"عدد الصفحات",placeholder:"عدد الصفحات",value:pickerText,onChange:e=>setPickerText(e.target.value),onKeyDown:e=>{if(e.key==='Enter')pickerGo();},style:s.pgJumpInput}),/*#__PURE__*/React.createElement("button",{onClick:pickerGo,style:{...s.wirdChip,...s.wirdChipOn}},"تثبيت")),/*#__PURE__*/React.createElement("button",{onClick:dropTarget,style:s.wirdNone},"بلا ورد"))));}function MushafScreen({selected,setSelected,onBack,onPlaySurah,onStopAudio}){const[ready,setReady]=useState(!!__quranData);const[counts,setCounts]=useState(null);// { [surah]: ayahCount } -- ONE pass
// Session 51 -- the bookmark, read once. Nothing on this screen writes it; the bar only
// opens it or removes it. Opening goes through `selected`, the same door a surah tap uses,
// so the back button still peels back to the index instead of leaving the mushaf.
const[bookmark,setBookmark]=useState(readMushafBookmark);const[openAt,setOpenAt]=useState(null);// set only by tapping the bar
// 14.3 — صفوفُ الفهرس (١١٤ سورة + ٣٠ جزءاً) حين يصل التخطيط، وإلّا null.
const[nav,setNav]=useState(__mushafNav);const openBookmark=()=>{if(bookmark){setOpenAt(bookmark);setSelected(bookmark.s);}};const clearBookmark=()=>{try{localStorage.removeItem(MUSHAF_BOOKMARK_KEY);}catch(e){}setBookmark(null);};// Session 82 -- the last page, alongside the bookmark and never instead of it. Its own
// state, its own reader and its own opener; the bookmark two lines above is untouched.
//
// ITEM 87 REVERSED THE RULE ABOVE THIS LINE. It read: "Reading it here does NOT open it:
// entering the mushaf still lands on the index, and the reader resumes by tapping a row --
// one tap, chosen, never automatic." The owner asked for the opposite: a mushaf opens where
// it was left. The row is KEPT -- it is what the reader taps after choosing to go back to
// the index -- and the auto-open is added beside it, not in place of it.
const[lastPage,setLastPage]=useState(readMushafLastPage);const openLastPage=()=>{if(lastPage){setOpenAt(lastPage);setSelected(lastPage.s);}};// ITEM 87 -- THE MUSHAF OPENS WHERE IT WAS LEFT, and it opens there through the SAME door a
// tap uses: openAt carries the page and `selected` carries the surah, exactly as the resume
// row sets them. Nothing new decides what "the last page" is -- readMushafLastPage is the
// one reader of the one contracted key, mushaf_last_page_v1, and it refuses anything it does
// not recognise, so a damaged or absent record lands on the index as before.
//
// ONCE PER MOUNT, and the ref is the whole of that. MushafScreen does NOT unmount when the
// reader leaves a surah -- only `selected` drops to null -- so without this the effect would
// re-open the page the instant «السور» took them back to the index, and the index would be
// unreachable. Leaving the mushaf entirely and returning is a new mount, and resumes again.
//
// THE WAY BACK IS ONE TAP AND IT IS ALREADY THERE: the reader's own «السور» in the top rail
// calls onExit, which is the same route the hardware back button takes.
const autoResumedRef=useRef(false);useEffect(()=>{if(autoResumedRef.current)return;autoResumedRef.current=true;const lp=readMushafLastPage();if(!lp)return;setOpenAt(lp);setSelected(lp.s);},[]);// خطأ ٤٦: `selected` (السورة المفتوحة) رُفعت إلى App لتُقشَر بزر الرجوع؛ تصل عبر props بلا تغيير سلوك
useEffect(()=>{let alive=true;loadQuran().then(()=>{if(!alive)return;const c={};for(const k in __quranData){const n=parseInt(k.split(':')[0],10);c[n]=(c[n]||0)+1;}setCounts(c);setReady(true);}).catch(()=>{});return()=>{alive=false;};},[]);// 14.3 — التخطيطُ لا يحبس الفهرس: السورُ تُرسَم فوراً بلا أرقام، ثمّ تُحقن أرقامُ
// الصفحات وتُدسّ صفوفُ الأجزاء حين يصل. وإن لم يصل بقيت القائمةُ كما كانت.
useEffect(()=>{let alive=true;loadLayout().then(()=>{if(alive)setNav(buildMushafNav());}).catch(()=>{});return()=>{alive=false;};},[]);// Session 51 -- MushafScreen never unmounts when a surah is left (only `selected` drops to
// null), so the bar would keep showing a bookmark read at mount. Re-read whenever we are back
// on the index -- that is the only moment the bar is about to be drawn.
useEffect(()=>{if(selected==null)setBookmark(readMushafBookmark());},[selected]);// 82 -- the same lifecycle for the last page, in its own effect so the bookmark's is left
// exactly as it was. Coming back from the reader is precisely when this has just moved.
useEffect(()=>{if(selected==null)setLastPage(readMushafLastPage());},[selected]);// Leaving the screen must silence a running recitation.
useEffect(()=>()=>{if(onStopAudio)onStopAudio();},[]);const leaveSurah=()=>{if(onStopAudio)onStopAudio();setOpenAt(null);setSelected(null);};const leaveScreen=()=>{if(onStopAudio)onStopAudio();onBack();};// S87: the open surah IS this screen's nested layer, so a hardware/browser back peels it back
// to the index through the SAME closer the reader's own back button calls -- one behaviour,
// one place, and the recitation is silenced either way. Back from the index is leaveScreen.
useEzikBackLayer(selected!=null,leaveSurah);// 14.2 — الفهرس يفتح على صفحة السورة في المصحف المُصفَّح.
// SurahCard انسحبت من هنا وبقيت في المحادثة، حيث وُلدت — ومعها قِشرتها.
// S91: same route as the device button -- the pop spends the entry this open surah took, and
// the registry then runs leaveSurah, so the recitation is silenced exactly as before.
if(selected)return/*#__PURE__*/React.createElement(PagedMushaf,{startSurah:selected,startPage:openAt&&openAt.s===selected?openAt.p:null,onExit:ezikGoBack});// S110 -- ONE array, split once, right here. buildMushafNav still owns the data and the order;
// this only asks each row which of the two lists it belongs to, so the surah grid holds surah
// cards alone. Nothing is sorted, added or dropped -- 30 + 114 out, 144 in. The fallback carries
// no juz at all, so before the layout lands juzRows is simply empty and the surahs draw as they
// always did. The split is OUTSIDE the returned tree on purpose: the index itself still maps.
const navRows=nav||MUSHAF_NAV_FALLBACK;const juzRows=navRows.filter(r=>r.k==='j');const surahRows=navRows.filter(r=>r.k==='s');return(/*#__PURE__*/// S109 -- the INDEX only. The reader below is untouched: pressing a surah still runs the
// same setOpenAt/setSelected pair and lands in the same PagedMushaf.
React.createElement(EzShell,{title:'\u0627\u0644\u0645\u0635\u062d\u0641',onBack:leaveScreen,backLabel:'\u0631\u062c\u0648\u0639'},/*#__PURE__*/React.createElement("div",null,(lastPage||bookmark)&&/*#__PURE__*/React.createElement("section",{className:"ezq-masthead is-strip"},lastPage&&/*#__PURE__*/React.createElement("button",{onClick:openLastPage,style:s.mushafRow},/*#__PURE__*/React.createElement("svg",{viewBox:"0 0 24 24",width:"18",height:"18",fill:"none",stroke:"var(--red-deep)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",style:{flexShrink:0}},/*#__PURE__*/React.createElement("path",{d:"M3.5 12a8.5 8.5 0 1 0 2.7-6.2"}),/*#__PURE__*/React.createElement("path",{d:"M3.1 4.4v4.3h4.3"}),/*#__PURE__*/React.createElement("path",{d:"M12 7.5V12l3 1.8"})),/*#__PURE__*/React.createElement("div",{style:s.mushafName},"تابِع القراءة · صفحة ",toArabicDigits(lastPage.p))),bookmark&&/*#__PURE__*/React.createElement("div",{style:{display:'flex',gap:8}},/*#__PURE__*/React.createElement("button",{onClick:openBookmark,style:{...s.mushafRow,flex:1}},/*#__PURE__*/React.createElement("svg",{viewBox:"0 0 24 24",width:"18",height:"18",fill:"var(--red)",stroke:"var(--red-deep)",strokeWidth:"1.5",strokeLinejoin:"round","aria-hidden":"true",style:{flexShrink:0}},/*#__PURE__*/React.createElement("path",{d:"M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"})),/*#__PURE__*/React.createElement("div",{style:s.mushafName},"علامتك · صفحة ",toArabicDigits(bookmark.p))),/*#__PURE__*/React.createElement("button",{onClick:clearBookmark,title:"إزالة العلامة",style:{...s.pgNavBtn,height:'auto'}},"×"))),!ready&&/*#__PURE__*/React.createElement("div",{style:s.mushafHint},"جارٍ تحميل المصحف…"),ready&&juzRows.length>0&&/*#__PURE__*/React.createElement(React.Fragment,null,/*#__PURE__*/React.createElement("h2",{className:"ezm-sec"},"الانتقال إلى جزء"),/*#__PURE__*/React.createElement("div",{className:"ezm-juzgrid"},juzRows.map(r=>/*#__PURE__*/React.createElement("button",{key:'j'+r.n,onClick:()=>{setOpenAt({p:r.p,s:r.s});setSelected(r.s);},style:s.mushafJuzRow},/*#__PURE__*/React.createElement("div",{style:s.mushafJuzName},"الجزء ",toArabicDigits(r.n)),/*#__PURE__*/React.createElement("div",{style:s.mushafJuzPage},"صفحة ",toArabicDigits(r.p)))))),ready&&/*#__PURE__*/React.createElement("h2",{className:"ezm-sec"},"السور"),ready&&/*#__PURE__*/React.createElement("div",{className:"ezq-cat"},surahRows.map(r=>/*#__PURE__*/React.createElement("button",{key:'s'+r.n,className:"ezhome-focus ezq-card","data-ezm-surah":r.n,onClick:()=>{setOpenAt(null);setSelected(r.n);},style:s.ezmCard},/*#__PURE__*/React.createElement("span",{className:"ezq-crest","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{style:s.ezmTop},/*#__PURE__*/React.createElement("span",{style:s.ezmNum},toArabicDigits(r.n)),/*#__PURE__*/React.createElement("span",{style:s.ezmReveal},revelationLabel(r.n))),/*#__PURE__*/React.createElement("span",{style:s.ezmName},SURAH_NAMES[r.n]),/*#__PURE__*/React.createElement("span",{style:s.ezmFoot},/*#__PURE__*/React.createElement("span",{style:s.ezmCount},toArabicDigits(counts&&counts[r.n]?counts[r.n]:0)," آية"),/*#__PURE__*/React.createElement("span",{style:s.ezmGo,"aria-hidden":"true"},EZH_ICON_GO)),/*#__PURE__*/React.createElement("span",{style:s.ezmPage},r.p?'صفحة '+toArabicDigits(r.p):'')))))));}function MemorizeScreen({profile,onExit,onPlayVerse,onPlaySurah,onStopAudio}){const[ready,setReady]=useState(!!__quranData);// true once the mushaf JSON is in memory
const[counts,setCounts]=useState(null);// { [surahNum]: ayahCount } — built once, single pass
const[view,setView]=useState('picker');// 'picker' | 'drill'
const[selectedSurah,setSelectedSurah]=useState(null);// 1..114
const[startAyah,setStartAyah]=useState(1);const[granularity,setGranularity]=useState('word');// 'ayah' | 'word' (default word — one word per reveal)
const[revealedCount,setRevealedCount]=useState(0);// Layer C — عدنان listen-and-repeat audio talqin (alongside the manual reveal).
const[drillMode,setDrillMode]=useState('manual');// 'manual' | 'adnan'
const[adnanAyah,setAdnanAyah]=useState(null);// current ayah playing in the loop
const[adnanRunning,setAdnanRunning]=useState(false);const adnanTimeoutRef=useRef(null);// pending repeat-pause timer
const runIdRef=useRef(0);// local loop cancel token (sequenceIdRef is App-owned, not in scope)
// Layer B — سمِّعني recite-from-memory (own recognizer; transcript NEVER rendered/stored).
const[reciteListening,setReciteListening]=useState(false);const[reciteStates,setReciteStates]=useState([]);// per-expected-word: matched|mismatch|pending
const[reciteErr,setReciteErr]=useState('');// graceful-fail note (no SR / mic denied)
const reciteRecognitionRef=useRef(null);// own SpeechRecognition (separate from chat/call refs)
const reciteRunIdRef=useRef(0);// cancel token so a stale onend can't reopen the mic
const reciteHeardRef=useRef('');// transient transcript — never rendered, never saved
const[reciteAyah,setReciteAyah]=useState(null);// current recite ayah; current = reciteAyah || startAyah
const[reciteFinished,setReciteFinished]=useState(false);// whole range done → show finish line
const reciteAyahRef=useRef(null);// live mirror so onresult reads the current ayah synchronously
const isFemale=profile?.gender==='female';// Load the mushaf once, then tally ayah counts per surah in a SINGLE pass over all keys
// (keys are "surahNum:ayah" — the same prefix shape getSurahAyahCount relies on). This
// avoids calling getSurahAyahCount 114 times (= 114 full scans).
useEffect(()=>{let alive=true;loadQuran().then(()=>{if(!alive)return;const c={};for(const k in __quranData){const colon=k.indexOf(':');if(colon<1)continue;const sn=parseInt(k.slice(0,colon),10);if(sn>=1)c[sn]=(c[sn]||0)+1;}setCounts(c);setReady(true);}).catch(()=>{/* fail-safe: stay on the loading string; never fall back to model text */});return()=>{alive=false;};},[]);// Layer C teardown — runs on MemorizeScreen unmount (leaving the memorize screen). cancelAudio
// does NOT clear timers, so we clear the pending repeat-pause; we also bump runIdRef so a loop
// mid-ayah bails after the App-level [screen] cleanup pauses its audio (instead of advancing).
useEffect(()=>()=>{runIdRef.current++;if(adnanTimeoutRef.current)clearTimeout(adnanTimeoutRef.current);// Layer B: stop the recite recognizer on unmount (the App [screen] cleanup doesn't know it).
reciteRunIdRef.current++;ezKillRecognizer(reciteRecognitionRef.current);reciteRecognitionRef.current=null;},[]);const surahCount=counts&&selectedSurah?counts[selectedSurah]||0:0;// last ayah of range
// Ordered reveal units for [startAyah .. last ayah]. Ayah text is canonical only.
// ayah granularity → one unit per ayah; word granularity → one unit per word, grouped by ayah.
const buildUnits=()=>{if(!ready||!selectedSurah||!surahCount)return[];const out=[];for(let a=startAyah;a<=surahCount;a++){const text=getVerseText(selectedSurah,a)||'';if(granularity==='word'){const words=text.split(/\s+/).filter(Boolean);words.forEach((w,wi)=>out.push({ayah:a,text:w,firstInAyah:wi===0}));}else{out.push({ayah:a,text,firstInAyah:true});}}return out;};const units=view==='drill'?buildUnits():[];const allRevealed=units.length>0&&revealedCount>=units.length;// Focus ayah for the single-ayah "listen": the ayah holding the next hidden unit, else the last.
const focusAyah=units.length===0?startAyah:revealedCount<units.length?units[revealedCount].ayah:units[units.length-1].ayah;// Light, occasional praise — every few units while drilling, NOT on every press.
const showPraise=!allRevealed&&granularity==='ayah'&&revealedCount>0&&revealedCount%4===0;const openPicker=()=>{setView('picker');setRevealedCount(0);};const startDrill=()=>{setView('drill');setRevealedCount(0);};const setGran=g=>{setGranularity(g);setRevealedCount(0);};// switching re-hides the range
// ---------- عدنان listen-and-repeat loop ----------
// Cancellation uses a LOCAL runIdRef (App's sequenceIdRef/cancelAudio are not in scope, and
// playVerseManual bumps the sequence token every call so it can't be our stable loop token).
// Audio is stopped via the onStopAudio prop (App cancelAudio). The pause between ayat is
// proportional to the ayah's measured playback time, clamped to a sane floor/ceiling.
const ADNAN_PAUSE_FACTOR=1.15,ADNAN_PAUSE_FLOOR=1500,ADNAN_PAUSE_CEIL=9000;// ms
const stopAdnan=()=>{runIdRef.current++;// invalidate the running loop so it bails at its next guard
if(adnanTimeoutRef.current){clearTimeout(adnanTimeoutRef.current);adnanTimeoutRef.current=null;}if(onStopAudio)onStopAudio();// App cancelAudio: pause current ayah + bump sequenceIdRef
setAdnanRunning(false);};const startAdnan=async()=>{if(!ready||!selectedSurah||!surahCount)return;if(onStopAudio)onStopAudio();// clear any prior audio before starting fresh
if(adnanTimeoutRef.current){clearTimeout(adnanTimeoutRef.current);adnanTimeoutRef.current=null;}const myRun=++runIdRef.current;// local cancel token for THIS run
setAdnanRunning(true);for(let a=startAyah;a<=surahCount;a++){if(runIdRef.current!==myRun)return;// stopped / mode switched / screen left / restarted
setAdnanAyah(a);const t0=performance.now();try{await onPlayVerse(selectedSurah,a);}catch(e){}// resolves when the ayah audio ENDS
if(runIdRef.current!==myRun)return;const elapsed=performance.now()-t0;const pause=Math.min(ADNAN_PAUSE_CEIL,Math.max(ADNAN_PAUSE_FLOOR,elapsed*ADNAN_PAUSE_FACTOR));await new Promise(r=>{adnanTimeoutRef.current=setTimeout(r,pause);});if(runIdRef.current!==myRun)return;}if(runIdRef.current===myRun){setAdnanRunning(false);setAdnanAyah(null);}// natural completion
};const repeatAyah=async()=>{const a=adnanAyah||startAyah;stopAdnan();// halt the loop + audio + pending pause first
try{await onPlayVerse(selectedSurah,a);}catch(e){}// replay this ayah once; user presses ابدأ to continue
};// ---------- سمِّعني recite-from-memory ----------
// Own ar-SA recognizer, mirroring the call handler's cumulative-finals prefix-merge. On each
// onresult we re-match the WHOLE heard-so-far against the WHOLE expected ayah (cheap; ayat are
// short) and recolor. The transcript lives only in reciteHeardRef — never rendered, never saved.
const stopRecite=()=>{reciteRunIdRef.current++;// invalidate: a stale onend can't restart the mic
setReciteListening(false);ezKillRecognizer(reciteRecognitionRef.current);reciteRecognitionRef.current=null;// leave reciteStates as-is so the last result stays visible after stop
};const startRecite=()=>{if(childVoiceBlocked()){setReciteErr(CHILD_VOICE_NOTICE);return;}// غ‑٣: لا ميكروفونَ لسمِّعني
// «سمِّعني» LOOKS local and is not: Web Speech ships the recitation audio to Google on Chrome
// and to Apple on Safari. That is a third-party voice send, so it needs the same consent as
// ElevenLabs -- and refusing it must not touch the rest of the memorizer, which really is
// local. Checked BEFORE the engine is constructed, so no microphone permission is requested.
if(!hasValidAIConsent()){setReciteErr(EZ_SPEECH_NO_CONSENT);return;}if(!ezSpeechAvailable()){setReciteErr(RECITE_NO_SR);return;}// graceful fail, same message as chat/call
setReciteErr('');setReciteFinished(false);setReciteAyah(startAyah);reciteAyahRef.current=startAyah;reciteHeardRef.current='';setReciteStates([]);// Cumulative EXPECTED (Option C): expected = tokens of ayat startAyah..targetAyah, with the
// CURRENT ayah's offset/length so we can slice its states out of the full alignment. No
// heard-text reset on advance — heard stays cumulative and aligns against the growing expected
// (robust to ar-SA cumulative re-segmentation; no mic teardown).
const buildExpected=toAyah=>{const tokens=[];let curOffset=0,curLen=0;for(let a=startAyah;a<=toAyah;a++){const at=tokenizeForRecite(getVerseText(selectedSurah,a)||'');if(a===toAyah){curOffset=tokens.length;curLen=at.length;}for(let t=0;t<at.length;t++)tokens.push(at[t]);}return{tokens,curOffset,curLen};};const rec=ezNewRecognition();if(!rec){setReciteErr(hasValidAIConsent()?RECITE_NO_SR:EZ_SPEECH_NO_CONSENT);return;}rec.lang='ar-SA';rec.continuous=true;rec.interimResults=true;const myRun=++reciteRunIdRef.current;rec.onresult=event=>{// Cumulative-finals prefix-merge — identical to the call recognizer.
let finalText='',interim='';for(let i=0;i<event.results.length;i++){const t=event.results[i][0].transcript;if(event.results[i].isFinal){const seg=t.trim();if(!seg)continue;if(!finalText)finalText=seg;else if(seg.startsWith(finalText))finalText=seg;else if(finalText.startsWith(seg)){/* covered */}else finalText=finalText+' '+seg;}else{interim+=t;}}reciteHeardRef.current=(finalText+' '+interim).trim();// Match FULL cumulative heard vs FULL cumulative expected (up to the current ayah), then
// display + completion-check only the CURRENT ayah's slice of states.
const cur=reciteAyahRef.current||startAyah;const{tokens,curOffset,curLen}=buildExpected(cur);const fullStates=alignRecite(tokens,tokenizeForRecite(reciteHeardRef.current));const currentSlice=fullStates.slice(curOffset,curOffset+curLen);// TEMP (error-flagging disabled): treat 'mismatch' as reached/black so red never renders and a
// tashkeel/madd slip can't block progression. 'pending' (not-yet-reached) still gates advance.
// alignRecite is untouched — we only reinterpret its output here. Revisit when tashkeel/madd is handled.
const shown=currentSlice.map(x=>x==='mismatch'?'matched':x);const allMatched=shown.length>0&&shown.every(x=>x==='matched');if(allMatched&&cur<surahCount){// Auto-advance. Set the ref synchronously so a rapid follow-up onresult can't re-advance the
// same completion; blank the slice so the new ayah renders dim until the next onresult fills it.
const next=cur+1;reciteAyahRef.current=next;setReciteAyah(next);setReciteStates([]);}else{setReciteStates(shown);if(allMatched&&cur>=surahCount){setReciteFinished(true);stopRecite();}// last ayah → finish
}};rec.onend=()=>{// Auto-restart only if this run is still current (stopRecite/unmount bumped the id otherwise).
if(childVoiceBlocked()){// غ‑٣: لا إعادةَ فتحٍ بعد الحجب — أوقفِ الحلقة
reciteRunIdRef.current++;setReciteListening(false);return;}// Withdrawal mid-recitation ends the loop here as well as at the registry: this callback
// was armed while consent was held, and it is the one thing that would otherwise re-open
// the microphone by itself, forever, on a screen the reader thinks is offline.
if(!hasValidAIConsent()){reciteRunIdRef.current++;setReciteListening(false);setReciteErr(EZ_SPEECH_NO_CONSENT);ezKillRecognizer(rec);return;}if(reciteRunIdRef.current===myRun){ezStartRecognition(rec);}};rec.onerror=e=>{const fatal=['not-allowed','audio-capture','service-not-allowed'];if(fatal.includes(e.error)){reciteRunIdRef.current++;setReciteListening(false);setReciteErr(RECITE_NO_SR);}};reciteRecognitionRef.current=rec;setReciteListening(true);if(!ezStartRecognition(rec)){reciteRunIdRef.current++;setReciteListening(false);}};// Manual advance — freeze-proof fallback so a missed/substituted last word can't lock progress.
const advanceReciteManual=()=>{const cur=reciteAyahRef.current||startAyah;if(cur<surahCount){const next=cur+1;reciteAyahRef.current=next;setReciteAyah(next);setReciteStates([]);// new ayah starts dim; recomputed on the next onresult
}else{setReciteFinished(true);stopRecite();}};const setMode=m=>{if(m===drillMode)return;stopAdnan();stopRecite();if(m==='recite'){// fresh recite session from the start of the range
setReciteStates([]);reciteHeardRef.current='';setReciteErr('');setReciteAyah(startAyah);reciteAyahRef.current=startAyah;setReciteFinished(false);}setDrillMode(m);};// ===== THE MEMORIZER'S NESTED CLOSER =====
// S87: the drill is the INNER activity and the picker is the memorizer's parent screen, so a
// back taken in the drill lands on the picker -- never straight out of the memorizer. It stops
// exactly what switching mode stops (the listen-and-repeat loop, its pending pause, its audio,
// and the recite recognizer), then shows the picker through the screen's own openPicker. Leaving the
// memorizer altogether is the picker's own back, one level up. The same closer answers the
// hardware/browser button while the drill is open.
const leaveDrill=()=>{stopAdnan();stopRecite();openPicker();};useEzikBackLayer(view==='drill',leaveDrill);// ---------- PICKER ----------
if(view==='picker'){return/*#__PURE__*/React.createElement(EzShell,{title:MEM.TITLE,onBack:onExit,backLabel:MEM.BACK_BTN},/*#__PURE__*/React.createElement("section",{className:"ezq-masthead"},/*#__PURE__*/React.createElement("div",{style:s.ezqMastTitle},MEM.PICKER_HEADING),selectedSurah?/*#__PURE__*/React.createElement("div",{style:s.ezqMastPick},SURAH_NAMES[selectedSurah]):null,!ready&&/*#__PURE__*/React.createElement("div",{style:s.ezqMastHint},MEM.LOADING)),/*#__PURE__*/React.createElement("div",{className:"ezq-cat"},Array.from({length:114},(_,i)=>i+1).map(n=>{const active=selectedSurah===n;return/*#__PURE__*/React.createElement("button",{key:n,type:"button",className:"ezhome-focus ezq-card","data-ezq-surah":n,"aria-pressed":active?'true':'false',onClick:()=>{setSelectedSurah(n);setStartAyah(1);},style:{...s.ezqCard,...(active?s.ezqCardOn:null)}},/*#__PURE__*/React.createElement("span",{className:"ezq-crest","aria-hidden":"true"}),/*#__PURE__*/React.createElement("span",{style:s.ezqCardTop},/*#__PURE__*/React.createElement("span",{style:active?{...s.ezqNum,...s.ezqNumOn}:s.ezqNum},toArabicDigits(n)),/*#__PURE__*/React.createElement("span",{style:s.ezqReveal},revelationLabel(n))),/*#__PURE__*/React.createElement("span",{style:s.ezqName},SURAH_NAMES[n]),/*#__PURE__*/React.createElement("span",{style:s.ezqCount},counts&&counts[n]?toArabicDigits(counts[n])+' '+MEM.GRAN_AYAH:''));})),selectedSurah&&/*#__PURE__*/React.createElement("div",{style:s.ezqStartBar},/*#__PURE__*/React.createElement("span",{style:s.ezqStartLabel},MEM.START_LABEL),/*#__PURE__*/React.createElement("select",{value:startAyah,onChange:e=>setStartAyah(parseInt(e.target.value,10)||1),style:s.memAyahSelect,disabled:!ready||!surahCount},Array.from({length:surahCount||1},(_,i)=>i+1).map(a=>/*#__PURE__*/React.createElement("option",{key:a,value:a},toArabicDigits(a)))),/*#__PURE__*/React.createElement("button",{onClick:startDrill,style:{...s.memStartBtn,opacity:!ready||!surahCount?0.5:1},disabled:!ready||!surahCount},MEM.START_BTN)));}// ---------- DRILL ----------
const praiseLine=isFemale?MEM.PRAISE_F:MEM.PRAISE_M;const finishLine=isFemale?MEM.FINISH_F:MEM.FINISH_M;return(/*#__PURE__*/// S107 -- the drill is on the SAME shell as the picker, and its back is the SAME back:
// ezikGoBack, which spends the drill's own history entry and runs leaveDrill through the
// registry, so عدنان and the recogniser are stopped before the picker is shown. The three
// mode blocks below this masthead are untouched by this commit.
React.createElement(EzShell,{title:MEM.TITLE,onBack:ezikGoBack,backLabel:MEM.BACK_BTN},/*#__PURE__*/React.createElement("section",{className:"ezq-masthead"},/*#__PURE__*/React.createElement("div",{style:s.ezqDrillSurah},SURAH_NAMES[selectedSurah]),/*#__PURE__*/React.createElement("div",{style:s.ezqDrillRow},/*#__PURE__*/React.createElement("span",{style:s.ezqDrillBadge},`${MEM.GRAN_AYAH} ${toArabicDigits(startAyah)}`),/*#__PURE__*/React.createElement("button",{onClick:ezikGoBack,style:s.ezqDrillChange},MEM.CHANGE_SURAH))),/*#__PURE__*/React.createElement("div",{style:s.memToggleRow},/*#__PURE__*/React.createElement("button",{onClick:()=>setMode('manual'),style:{...s.memGranBtn,...(drillMode==='manual'?s.memGranBtnActive:{})}},MEM.MODE_MANUAL),/*#__PURE__*/React.createElement("button",{onClick:()=>setMode('adnan'),style:{...s.memGranBtn,...(drillMode==='adnan'?s.memGranBtnActive:{})}},MEM.MODE_ADNAN),/*#__PURE__*/React.createElement("button",{onClick:()=>setMode('recite'),style:{...s.memGranBtn,...(drillMode==='recite'?s.memGranBtnActive:{})}},MEM.MODE_RECITE)),drillMode==='manual'&&/*#__PURE__*/React.createElement("div",{style:s.memToggleRow},/*#__PURE__*/React.createElement("span",{style:s.memToggleLabel},MEM.REVEAL_LABEL),/*#__PURE__*/React.createElement("button",{onClick:()=>setGran('ayah'),style:{...s.memGranBtn,...(granularity==='ayah'?s.memGranBtnActive:{})}},MEM.GRAN_AYAH),/*#__PURE__*/React.createElement("button",{onClick:()=>setGran('word'),style:{...s.memGranBtn,...(granularity==='word'?s.memGranBtnActive:{})}},MEM.GRAN_WORD)),drillMode==='manual'&&/*#__PURE__*/React.createElement("div",{className:"ezq-read",style:s.memDrillArea},/*#__PURE__*/React.createElement("div",{style:s.memDrillText},units.map((u,i)=>{const revealed=i<revealedCount;const isNext=i===revealedCount;if(!revealed&&!isNext)return null;// beyond the next unit stays fully hidden
return/*#__PURE__*/React.createElement("span",{key:i,style:s.memUnit},u.firstInAyah&&/*#__PURE__*/React.createElement("span",{style:s.memAyahBadge},toArabicDigits(u.ayah)),revealed?/*#__PURE__*/React.createElement("span",{style:s.memWord},u.text):/*#__PURE__*/React.createElement("span",{style:s.memPlaceholder},granularity==='word'?'—':'— — —'));})),showPraise&&/*#__PURE__*/React.createElement("div",{style:s.memMsg},praiseLine),allRevealed&&/*#__PURE__*/React.createElement("div",{style:s.memMsg},finishLine)),drillMode==='manual'&&/*#__PURE__*/React.createElement("div",{className:"ezq-drill-acts",style:s.memControls},/*#__PURE__*/React.createElement("button",{onClick:()=>onPlayVerse&&onPlayVerse(selectedSurah,focusAyah),style:s.memListenBtn},MEM.LISTEN_BTN),/*#__PURE__*/React.createElement("button",{onClick:()=>setRevealedCount(c=>Math.min(c+1,units.length)),style:{...s.memRevealBtn,opacity:allRevealed?0.5:1},disabled:allRevealed},MEM.REVEAL_BTN),/*#__PURE__*/React.createElement("button",{onClick:()=>setRevealedCount(0),style:s.memListenBtn},MEM.HIDE)),drillMode==='adnan'&&/*#__PURE__*/React.createElement("div",{className:"ezq-read",style:s.memDrillArea},/*#__PURE__*/React.createElement("div",{style:s.memSurahTitle},`${SURAH_NAMES[selectedSurah]} · ${MEM.ADNAN_AYAH_LABEL} ${toArabicDigits(adnanAyah||startAyah)}`),/*#__PURE__*/React.createElement("div",{style:s.memDrillText},/*#__PURE__*/React.createElement("span",{style:s.memWord},getVerseText(selectedSurah,adnanAyah||startAyah)||''))),drillMode==='adnan'&&/*#__PURE__*/React.createElement("div",{className:"ezq-drill-acts",style:s.memControls},/*#__PURE__*/React.createElement("button",{onClick:()=>adnanRunning?stopAdnan():startAdnan(),style:s.memRevealBtn},adnanRunning?MEM.ADNAN_STOP:MEM.ADNAN_START),/*#__PURE__*/React.createElement("button",{onClick:repeatAyah,style:s.memListenBtn},MEM.ADNAN_REPEAT)),drillMode==='recite'&&/*#__PURE__*/React.createElement("div",{className:"ezq-read",style:s.memDrillArea},/*#__PURE__*/React.createElement("div",{style:s.memReciteHint},MEM.RECITE_HINT),/*#__PURE__*/React.createElement("div",{style:s.memSurahTitle},`${SURAH_NAMES[selectedSurah]} · ${MEM.ADNAN_AYAH_LABEL} ${toArabicDigits(reciteAyah||startAyah)}`),/*#__PURE__*/React.createElement("div",{style:s.memDrillText},(()=>{// Display the CURRENT recite ayah (original diacritized words), colored by its slice of
// states. Standalone ornament/pause glyphs normalize to '' — render dim, don't consume a
// state, so the state index stays aligned with the matchable words. Child's words never shown.
const displayWords=(getVerseText(selectedSurah,reciteAyah||startAyah)||'').split(/\s+/).filter(Boolean);let wordIdx=0;return displayWords.map((dw,i)=>{if(!normalizeForRecite(dw))return/*#__PURE__*/React.createElement("span",{key:i,style:s.memWordPending},dw);const st=reciteStates[wordIdx];wordIdx++;const wstyle=st==='matched'?s.memWord:st==='mismatch'?s.memWordWrong:s.memWordPending;return/*#__PURE__*/React.createElement("span",{key:i,style:wstyle},dw);});})()),reciteErr&&/*#__PURE__*/React.createElement("div",{style:s.memMsg},reciteErr),reciteFinished&&/*#__PURE__*/React.createElement("div",{style:s.memMsg},finishLine)),drillMode==='recite'&&/*#__PURE__*/React.createElement("div",{className:"ezq-drill-acts",style:s.memControls},/*#__PURE__*/React.createElement("button",{onClick:()=>reciteListening?stopRecite():startRecite(),style:s.memRevealBtn},reciteListening?MEM.RECITE_STOP:MEM.RECITE_START),/*#__PURE__*/React.createElement("button",{onClick:advanceReciteManual,style:s.memListenBtn},MEM.RECITE_NEXT))));}// ============================================================
// الأنماط
// ============================================================
const s={// ITEM 107: the times table and its two choosers. Type and tokens only.
prayerRow:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'7px 0',borderBottom:'1px solid var(--line)'},prayerName:{fontSize:15,lineHeight:1.7,color:'var(--ink)'},prayerTime:{fontSize:16,lineHeight:1.7,fontWeight:700,color:'var(--ink)'},prayerOptRow:{display:'flex',flexWrap:'wrap',gap:6,margin:'2px 0 4px'},prayerOpt:{background:'none',border:'1px solid var(--line)',borderRadius:10,padding:'6px 10px',fontSize:13,fontFamily:'inherit',color:'inherit',cursor:'pointer'},prayerStep:{display:'inline-flex',alignItems:'center',gap:8},prayerStepBtn:{background:'none',border:'1px solid var(--line)',borderRadius:8,padding:'2px 10px',fontSize:15,fontFamily:'inherit',color:'inherit',cursor:'pointer'},prayerOffVal:{minWidth:28,textAlign:'center',fontSize:14,color:'var(--muted)'},// ITEM 108-أ: the qibla panel. Type and one dial, every colour a token.
qiblaDeg:{fontSize:26,lineHeight:1.4,fontWeight:700,color:'var(--ink)'},qiblaDir:{marginTop:2,fontSize:15,lineHeight:1.7,color:'var(--ink)'},qiblaDialWrap:{display:'flex',justifyContent:'center',padding:'10px 0'},qiblaNote:{marginTop:6,fontSize:13,lineHeight:1.8,color:'var(--muted)'},qiblaPlace:{marginTop:10,fontSize:14,lineHeight:1.7,color:'var(--ink)'},qiblaBtn:{marginTop:8,alignSelf:'flex-start',background:'none',border:'1px solid var(--line)',borderRadius:10,padding:'8px 14px',fontSize:14,fontFamily:'inherit',color:'inherit',cursor:'pointer'},// ITEM 109: the Hijri line under the name, and the live preview in Settings. Type only —
// no box, no surface, no border, so the masthead's shape is untouched to the pixel.
ezistHijri:{marginTop:6,fontSize:13,lineHeight:1.6,color:'var(--a3-muted)',fontWeight:500},hijriNow:{marginTop:8,fontSize:13,lineHeight:1.7,color:'var(--muted)'},// ITEM 93-ج: the offline-store notice. Every colour is a token, so it follows the theme and
// the identity like everything else; it is a strip at the foot of the viewport rather than a
// modal, because it interrupts nothing and the reader may ignore it entirely.
swNote:{position:'fixed',insetInlineStart:12,insetInlineEnd:12,insetBlockEnd:12,zIndex:60,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',boxSizing:'border-box',padding:'10px 14px',borderRadius:12,border:'1px solid var(--warn-line)',background:'var(--warn-bg)',color:'var(--warn-ink)',boxShadow:'var(--a3-lift)'},swNoteText:{flex:'1 1 200px',minWidth:0,fontSize:13,lineHeight:1.7},swNoteHit:{display:'inline-flex',flexShrink:0},swNoteBtn:{background:'none',border:'1px solid var(--warn-line)',borderRadius:8,padding:'4px 14px',fontSize:13,fontFamily:'inherit',color:'inherit',cursor:'pointer'},// S115: the boot mark keeps its key and its animation -- only the 48px emoji it used to size is
// gone, so reduced motion, the keyframe and the duration are all untouched.
loadingScreen:{minHeight:'100vh',background:'var(--boot-bg)',display:'flex',alignItems:'center',justifyContent:'center'},loadingSpinner:{animation:'pulse 1.5s ease-in-out infinite'},// S95. Onboarding was written entirely in literals, so it stayed light for a user who had
// already chosen dark -- and it is the FIRST screen they see. Every literal below is replaced
// by the token whose LIGHT value is that exact literal, so light renders byte-for-byte as it
// did. The container's gradient is literally --boot-bg, the same paint the pre-React boot uses.
onboardingContainer:{height:'100dvh',overflowY:'auto',WebkitOverflowScrolling:'touch',boxSizing:'border-box',background:'var(--boot-bg)'},onboardingInner:{minHeight:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'safe center',alignItems:'center',padding:20},// S115: THE CARD FAMILY. The rounded white box with the 20px navy drop shadow and the 64px
// glyph above it is gone; .ezgate-card in <style> owns the surface, the arch and the bounds,
// and these keys are what is left -- the type inside it, every value a token. The glyph each
// gate shipped with is kept and bounded inside the arch, at a size that belongs to a card.
// No width and no max-width here ON PURPOSE: .ezgate-card bounds the card to 420px (360 for the
// two modals) and an inline width would beat that at every viewport -- which is exactly the
// defect the wide-screen pass caught before this line was written.
onboardingCard:{padding:0,textAlign:'center',background:'transparent',border:'none'},bigEmoji:{fontSize:26,lineHeight:1,animation:'fadeIn 0.5s ease-out'},onboardingTitle:{fontSize:24,fontWeight:800,color:'var(--a3-ink)',marginBottom:10},onboardingSubtitle:{fontSize:15.5,color:'var(--a3-muted)',marginBottom:20,lineHeight:1.8},// AI-CONSENT SCREEN. Reading text, not chrome: it is read start-aligned rather than centred,
// because a five-item list of what leaves the device is read, not glanced at. Every colour is
// an existing token -- no new colour enters the app and the theme is untouched.
aicBody:{textAlign:'start',marginBottom:18},aicLead:{fontSize:15,color:'var(--a3-ink)',lineHeight:1.9,marginBottom:10},aicSubhead:{fontSize:15,fontWeight:800,color:'var(--a3-ink)',lineHeight:1.9,margin:'14px 0 6px'},aicList:{margin:'0 0 6px',padding:0,paddingInlineStart:20,listStyle:'disc'},aicItem:{fontSize:14.5,color:'var(--a3-muted)',lineHeight:1.9,marginBottom:4},aicProvider:{fontWeight:800,color:'var(--a3-ink)',direction:'ltr',unicodeBidi:'isolate'},aicGuardian:{fontSize:14.5,fontWeight:700,color:'var(--a3-ink)',lineHeight:1.9,border:'1px solid var(--a3-line)',borderRadius:12,padding:'10px 12px',margin:'14px 0 4px'},aicLinks:{display:'flex',flexWrap:'wrap',gap:14,margin:'14px 0 6px'},aicLink:{fontSize:14.5,fontWeight:700,color:'var(--a3-ink)',textDecoration:'underline'},aicVersion:{fontSize:13,color:'var(--a3-muted)',lineHeight:1.8,direction:'rtl'},// The version identifier itself, isolated LTR. Without this the neutral hyphens let the digit
// groups reorder inside the RTL paragraph and "2026-08-06-1" is displayed as "1-06-08-2026".
aicVersionNum:{direction:'ltr',unicodeBidi:'isolate',fontWeight:700},// The Settings privacy group: the current answer, stated as a sentence, above the one control
// that changes it.
aicStatusRow:{fontSize:14.5,fontWeight:700,color:'var(--a3-ink)',lineHeight:1.9,marginBottom:4,textAlign:'start'},aicNote:{fontSize:13.5,color:'var(--a3-muted)',lineHeight:1.9,textAlign:'start'},aicWithdrawBtn:{width:'100%',boxSizing:'border-box',marginTop:12,padding:'12px',borderRadius:12,border:'1px solid var(--a3-line)',background:'transparent',color:'var(--a3-ink)',fontFamily:'inherit',fontSize:15,fontWeight:700,cursor:'pointer'},onboardingInput:{width:'100%',padding:'15px 18px',fontSize:18,borderRadius:16,border:'2px solid var(--a3-line)',background:'var(--a3-ice)',color:'var(--a3-ink)',fontFamily:'var(--ez-ui-font)',direction:'rtl',marginBottom:16,boxSizing:'border-box'},ageGrid:{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:10,marginBottom:20},ageBtn:{padding:'14px',fontSize:20,fontWeight:700,borderRadius:14,border:'2px solid var(--line)',background:'var(--page)',color:'var(--accent-ink)',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},ageBtnActive:{background:'var(--red-deep)',color:'var(--on-accent)',borderColor:'var(--red-deep)',transform:'scale(1.05)'},ageBtnWide:{gridColumn:'1 / -1',fontSize:17},// Session 13.1 - Welcome/Onboarding reskin (Boubyan black+red). Scoped to the first-run flow only.
welcomeContainer:{minHeight:'100dvh',height:'100dvh',overflowY:'auto',WebkitOverflowScrolling:'touch',boxSizing:'border-box',background:'var(--welcome-bg)'},welcomeInner:{minHeight:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'safe center',alignItems:'center',padding:24},welcomeCard:{width:'100%',maxWidth:380,textAlign:'center'},// S115: the red square is an arch now, and .ezonb-crest in <style> owns its geometry -- the key
// stays because it is what the mark is spread from, and it declares no colour any more.
welcomeLogoSquare:{display:'flex',alignItems:'center',justifyContent:'center'},welcomeTitle:{fontSize:32,fontWeight:800,color:'var(--welcome-ink)',marginBottom:14,letterSpacing:'-0.5px'},welcomeGreeting:{fontSize:16,fontWeight:500,color:'var(--welcome-ink2)',marginBottom:28},welcomeEmoji:{fontSize:56,marginBottom:14,animation:'fadeIn 0.5s ease-out'},welcomeStepTitle:{fontSize:25,fontWeight:800,color:'var(--welcome-ink)',marginBottom:12},welcomeSubtitle:{fontSize:15.5,color:'var(--welcome-ink2)',marginBottom:22,lineHeight:1.6},welcomeInput:{width:'100%',padding:'15px 18px',fontSize:18,borderRadius:16,border:'1px solid var(--a3-line)',background:'var(--a3-ice)',color:'var(--a3-ink)',fontFamily:'var(--ez-ui-font)',direction:'rtl',marginBottom:16,boxSizing:'border-box'},welcomePrimaryBtn:{width:'100%',padding:'15px',fontSize:17,fontWeight:700,borderRadius:'22px 22px 15px 15px',background:'var(--accent-fill)',color:'var(--on-accent)',border:'1px solid var(--a3-line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},welcomeAgeGrid:{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:10,marginBottom:20},welcomeAgeBtn:{padding:'14px',fontSize:20,fontWeight:700,borderRadius:14,border:'1px solid var(--line)',background:'var(--white)',color:'var(--ink)',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},welcomeAgeBtnActive:{background:'var(--red)',color:'var(--on-accent)',borderColor:'var(--red)',transform:'scale(1.05)'},welcomeAgeBtnWide:{gridColumn:'1 / -1',fontSize:17},// ============================================================
// SESSION 86 -- THE APPLICATION HOME, BOTH STYLES. The twenty S13.2 home* keys that used to
// stand here are gone: the blue morning banner they drew (homeHero/homeHeroIcon/homeHeroText)
// does not exist in either style, and every other one of them was read by the old Home body
// and by nothing else in this file, so this refactor is the only thing that made them
// unreachable. Nothing else was removed -- V1, chat, mushaf and every unrelated key stand.
//
// Every key below reads its colour from the .ezhome token set declared in <style>, which is
// why not one of them names a hex: light is pure #FFFFFF cards and a pure #FFFFFF bottom bar
// on a very pale ice-blue page, with royal blue #2454D7, navy #0B2455 and a restrained cyan
// #20C7E8; dark is the same structure on cool navy surfaces. There is no beige, ivory, cream,
// tan, gold, brown or green in this block, and no large filled blue rectangle anywhere in it.
// Three rules run through all of it: every interactive key is at least 44x44 CSS px, the
// scroll and the bottom bar both carry the safe-area inset, and the shadows are the cool
// blue-tinted tokens rather than warm ones. .ezhome is carried only by the two home
// components, so nothing here can reach the chat screen, the call screen or DhikrCard.
// ============================================================
// ============================================================
// S101 -- THE ISTANA_33 HOME. Every colour is an --a3-* token, which under this identity
// maps to the approved istana values (surface #FFFDFC, surface2 #EEF6F7, ink #10364E,
// muted #647780, accent #0B5F8E, accent2 #C43E38, line #C8DDE2) and, in dark, to the same
// structure on the accessible dark palette. Not one literal colour appears below. Every
// fontSize is a NUMBER so the text-size preference scales it, every tappable surface is at
// least 44px, and there is no animation or transition anywhere in this block.
// ============================================================
ezistContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--a3-page)'},// S105 -- the shared shell. Every colour is an --a3-* token, so a tenant screen inherits the
// identity and the dark palette without declaring one; sizes are numbers so text scaling
// reaches them; nothing animates.
ezshContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--a3-page)'},// The fatwa search is a shell tenant with its own reachable-screen key. One numeric base size
// lets the existing accessibility scaler resize every em-based label inside it as one unit.
ezfContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--a3-page)',fontSize:15},// S106 -- the Quran catalogue. --a3-* tokens only, numeric font sizes, no animation.
ezqMastTitle:{fontSize:17,fontWeight:800,color:'var(--a3-ink)',lineHeight:1.6},ezqMastPick:{marginTop:6,fontSize:14,fontWeight:700,color:'var(--a3-blue)'},ezqMastHint:{marginTop:6,fontSize:12.5,fontWeight:600,color:'var(--a3-muted)'},ezqCard:{display:'flex',flexDirection:'column',gap:4,width:'100%',minHeight:96,padding:'26px 10px 10px',borderRadius:14,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},ezqCardOn:{border:'1px solid var(--a3-blue)',background:'var(--a3-ice)'},ezqCardTop:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6},ezqNum:{minWidth:26,height:22,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 6px',borderRadius:999,background:'var(--a3-ice)',color:'var(--a3-blue)',fontSize:12,fontWeight:800},ezqNumOn:{background:'var(--a3-blue)',color:'var(--a3-on-blue)'},ezqReveal:{flexShrink:0,fontSize:10.5,fontWeight:700,color:'var(--a3-cyan)'},ezqName:{minWidth:0,fontSize:14.5,fontWeight:800,color:'var(--a3-ink)',lineHeight:1.5},ezqCount:{fontSize:11.5,fontWeight:600,color:'var(--a3-muted)'},ezqStartBar:{position:'sticky',bottom:0,display:'flex',alignItems:'center',gap:10,marginTop:14,padding:'10px 12px',borderRadius:16,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-lift)'},ezqStartLabel:{flexShrink:0,fontSize:13,fontWeight:700,color:'var(--a3-ink)'},// S109 -- the mushaf surah card. Tokens only; no colour varies by surah.
ezmCard:{display:'flex',flexDirection:'column',gap:4,width:'100%',minHeight:104,padding:'26px 10px 10px',borderRadius:14,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},ezmTop:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6},ezmNum:{minWidth:26,height:22,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 6px',borderRadius:999,background:'var(--a3-ice)',color:'var(--a3-blue)',fontSize:12,fontWeight:800},ezmReveal:{flexShrink:0,fontSize:10.5,fontWeight:700,color:'var(--a3-cyan)'},ezmName:{minWidth:0,fontSize:14.5,fontWeight:800,color:'var(--a3-ink)',lineHeight:1.5},ezmFoot:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6},ezmCount:{fontSize:11.5,fontWeight:600,color:'var(--a3-muted)'},ezmGo:{flexShrink:0,display:'inline-flex',color:'var(--a3-muted)'},ezmPage:{fontSize:11,fontWeight:600,color:'var(--a3-blue)'},// S107 -- the drill masthead. Layout only; it sits ABOVE the reading area and never over it.
ezqDrillSurah:{fontSize:19,fontWeight:800,color:'var(--a3-ink)'},ezqDrillRow:{display:'inline-flex',alignItems:'center',gap:10,marginTop:10},ezqDrillBadge:{padding:'4px 10px',borderRadius:999,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',color:'var(--a3-blue)',fontSize:12.5,fontWeight:800},ezqDrillChange:{minHeight:36,padding:'0 12px',borderRadius:12,background:'transparent',border:'1px solid var(--a3-line)',color:'var(--a3-muted)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:12.5,fontWeight:700},ezshScroll:{flex:1,minHeight:0,overflowY:'auto',WebkitOverflowScrolling:'touch'},ezshNavBtn:{width:44,height:44,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,borderRadius:14,background:'transparent',border:'1px solid transparent',color:'var(--a3-muted)',cursor:'pointer'},ezshGroup:{display:'flex',flexDirection:'column',gap:10,padding:'14px 14px 16px',borderRadius:18,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)'},ezshGroupHead:{display:'flex',alignItems:'center',gap:9},ezshGroupMark:{width:12,height:15,flexShrink:0,border:'2px solid var(--a3-blue)',borderRadius:'60% 60% 12% 12%',borderBottomColor:'transparent'},// ============================================================
// S103 -- THE ISTANA ADHKAR CATALOGUE AND READER. Every colour is an --a3-* token, which
// under istana_33 resolves to the approved values and, in dark, to the accessible dark ones.
// No literal colour, every fontSize a number so the text-size preference scales it, every
// tappable surface at least 44px, and no animation or transition anywhere in this block.
// ============================================================
eziaContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--a3-page)'},// the reader paints the same page; it is its own key so each screen has its own root.
eziaReadContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--a3-page)'},eziaScroll:{flex:1,minHeight:0,overflowY:'auto',WebkitOverflowScrolling:'touch'},eziaNavBtn:{width:44,height:44,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,borderRadius:14,background:'transparent',border:'1px solid transparent',color:'var(--a3-muted)',cursor:'pointer'},eziaNavBtnOn:{background:'var(--a3-ice)',border:'1px solid var(--a3-line)',color:'var(--a3-blue)'},eziaRingBox:{position:'relative',width:76,height:76,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center'},eziaRingNums:{position:'absolute',fontSize:14,fontWeight:800,color:'var(--a3-ink)',fontFamily:'var(--ez-ui-font)'},eziaMastText:{display:'flex',flexDirection:'column',gap:4,minWidth:0,textAlign:'right'},eziaMastTitle:{fontSize:19,fontWeight:800,color:'var(--a3-ink)'},eziaMastHint:{fontSize:12.5,fontWeight:600,color:'var(--a3-muted)'},// ITEM 43-أ. The chain row and the goal chooser. Every colour is a token this screen already
// declares in both modes, so the row inherits dark exactly as the masthead above it does, and
// NOTHING here is red: a lapsed chain is drawn in the same ink as a standing one.
eziaChainRow:{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,marginTop:12},eziaChainNum:{fontSize:19,fontWeight:800,color:'var(--a3-ink)',fontFamily:'var(--ez-ui-font)'},eziaChainWord:{fontSize:12.5,fontWeight:600,color:'var(--a3-muted)'},eziaGoalRow:{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:10},eziaGoalLabel:{fontSize:12.5,fontWeight:700,color:'var(--a3-muted)'},eziaGoalChip:{minWidth:44,minHeight:44,padding:'0 12px',borderRadius:14,border:'1px solid var(--a3-line)',background:'var(--a3-surface)',color:'var(--a3-ink)',fontSize:14,fontWeight:800,fontFamily:'var(--ez-ui-font)',cursor:'pointer'},eziaGoalChipOn:{background:'var(--a3-blue)',color:'var(--a3-on-blue)',border:'1px solid var(--a3-blue)'},eziaSecTitle:{flexShrink:0,fontSize:13,fontWeight:800,color:'var(--a3-blue)',fontFamily:'var(--ez-ui-font)'},// the catalogue card: a crest, an emblem row, the title, then the standing and the chevron.
eziaCard:{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',gap:8,width:'100%',minHeight:132,padding:'32px 12px 12px',borderRadius:16,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},eziaCardDone:{background:'var(--a3-ice)'},eziaCardHead:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8},eziaEmblem:{width:34,height:34,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:10,background:'var(--a3-ice)',color:'var(--a3-blue)'},eziaEmblemLg:{width:44,height:44,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:12,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',color:'var(--a3-blue)'},eziaEmblemDone:{color:'var(--a3-cyan)'},eziaCount:{flexShrink:0,padding:'3px 9px',borderRadius:999,background:'var(--a3-ice)',color:'var(--a3-blue)',fontSize:12,fontWeight:800},eziaCardTitle:{flex:1,minWidth:0,fontSize:14,fontWeight:700,lineHeight:1.65,color:'var(--a3-ink)'},eziaCardFoot:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8},eziaStanding:{minWidth:0,fontSize:12,fontWeight:700,color:'var(--a3-muted)'},eziaGo:{flexShrink:0,display:'inline-flex',color:'var(--a3-muted)'},// the featured card: the same parts, an arch crest and more room.
eziaFeature:{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',gap:10,width:'100%',minHeight:148,padding:'16px 14px 14px',borderRadius:'44px 44px 16px 16px',background:'var(--a3-ice)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},eziaFeatureTop:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8},eziaFeatureTitle:{flex:1,minWidth:0,fontSize:16,fontWeight:800,lineHeight:1.6,color:'var(--a3-ink)'},// the reader shell
eziaReadOuter:{flex:1,minHeight:0,display:'flex',flexDirection:'column'},eziaReadScroll:{flex:1,minHeight:0,overflowY:'auto',WebkitOverflowScrolling:'touch'},eziaReadTitle:{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:15,fontWeight:800,color:'var(--a3-ink)'},eziaReadHead:{display:'inline-flex',alignItems:'center',gap:10,marginBottom:6},eziaReadPos:{fontSize:12.5,fontWeight:800,color:'var(--a3-blue)'},eziaReadRepeat:{padding:'3px 9px',borderRadius:999,background:'var(--a3-ice)',color:'var(--a3-blue)',fontSize:12,fontWeight:800},eziaReadText:{color:'var(--a3-ink)',fontSize:20,lineHeight:2.15,textAlign:'center',fontFamily:"'Amiri', serif",margin:'10px 0 8px'},eziaReadSource:{color:'var(--a3-muted)',fontSize:12,fontWeight:600,textAlign:'center'},eziaRail:{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'12px 0 2px'},eziaRailMark:{width:7,height:7,borderRadius:'50%',background:'var(--a3-line)'},eziaRailMarkNow:{background:'var(--a3-blue)',width:9,height:9},eziaRailMarkDone:{background:'var(--a3-cyan)'},eziaNote:{minHeight:20,textAlign:'center',fontSize:12.5,fontWeight:600,color:'var(--a3-blue)'},// The completion strip. Ice under blue is exactly the pair eziaReadRepeat above it already
// uses, and blue under on-blue is the pair the counter button uses -- no new colour enters
// the screen and both palettes already answer for all four.
eziaDoneRow:{display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:10,margin:'10px 0 0',padding:'8px 12px',borderRadius:14,background:'var(--a3-ice)',border:'1px solid var(--a3-line)',color:'var(--a3-blue)',fontSize:13,fontWeight:800},eziaDoneMark:{display:'inline-flex',flexShrink:0,color:'var(--a3-blue)'},eziaDoneNext:{minHeight:40,padding:'8px 16px',borderRadius:999,background:'var(--a3-blue)',color:'var(--a3-on-blue)',border:'none',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:13,fontWeight:800},eziaDock:{flexShrink:0,background:'var(--a3-surface)',borderTop:'1px solid var(--a3-line)',paddingBottom:'env(safe-area-inset-bottom, 0px)'},eziaDockBtn:{width:46,height:46,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,borderRadius:14,background:'var(--a3-ice)',border:'1px solid var(--a3-line)',color:'var(--a3-ink)',cursor:'pointer'},eziaDockBtnOn:{background:'var(--a3-blue)',color:'var(--a3-on-blue)',border:'1px solid var(--a3-blue)'},eziaDockBtnOff:{color:'var(--a3-muted)',cursor:'default'},eziaCountBtn:{flex:1,minWidth:0,maxWidth:240,minHeight:52,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,padding:'4px 10px',borderRadius:16,background:'var(--a3-blue)',color:'var(--a3-on-blue)',border:'none',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},eziaCountBtnDone:{background:'var(--a3-cyan)',color:'var(--a3-navy)',cursor:'default'},eziaCountNums:{fontSize:15,fontWeight:800},eziaCountLabel:{display:'inline-flex',alignItems:'center',gap:4,fontSize:11.5,fontWeight:700},ezistScroll:{flex:1,minHeight:0,overflowY:'auto',WebkitOverflowScrolling:'touch'},ezistNavBtn:{width:44,height:44,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,borderRadius:14,background:'transparent',border:'1px solid transparent',color:'var(--a3-muted)',cursor:'pointer'},ezistNavOn:{width:44,height:44,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,borderRadius:14,background:'var(--a3-ice)',border:'1px solid var(--a3-line)',color:'var(--a3-blue)',cursor:'default'},// THE GREETING STRIP. The words are the ones the app already picked and not one of them
// moved; what moved is their size and the space around them. The name gets an ellipsis
// because it now shares a row rather than owning a line.
ezistSalam:{fontSize:11.5,fontWeight:700,color:'var(--a3-muted)',letterSpacing:'.2px',lineHeight:1.4},ezistName:{fontSize:17,fontWeight:800,color:'var(--a3-ink)',margin:0,lineHeight:1.35,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},// The prompt chip keeps its 44px tap target -- a strip is not a reason to shrink a thing a
// thumb has to hit -- and loses the 14px that pushed it away from the line above it, because
// there is no line above it any more.
ezistPrompt:{display:'inline-flex',alignItems:'center',gap:8,minHeight:44,marginTop:0,padding:'6px 12px',borderRadius:999,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',color:'var(--a3-ink)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',textAlign:'right',maxWidth:'100%',flexShrink:0},// ITEM 97 -- THE FLOOR THAT STOPS THE PILL SHIVERING. Only the DAY line is given it, so the
// morning and evening pills keep s.ezistPrompt byte for byte. Measured on the real button in
// the real face (700 13px Noto Naskh Arabic), at 430x932 dpr 2, the button is:
//   94.88 for the label, 93.02 / 97.67 / 107.67 / 108.42 / 110.84 / 145.64 / 146.31 for the
//   seven dhikr in list order, and 157.75 for the English label.
// 158 is the smallest whole pixel at or above every one of them, so the pill is 158px wide
// in every state of both languages and no press moves an edge. justifyContent centres the
// icon and the words inside that floor; without it they would sit at the start of a box
// wider than they are. No colour, no face, no radius and no padding is touched.
ezistPromptDay:{minWidth:158,justifyContent:'center'},ezistPromptFlat:{display:'inline-flex',alignItems:'center',gap:8,minHeight:44,marginTop:0,padding:'6px 12px',borderRadius:999,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',color:'var(--a3-ink)',maxWidth:'100%',flexShrink:0},ezistPromptIcon:{display:'inline-flex',flexShrink:0,color:'var(--a3-blue)'},ezistPromptText:{minWidth:0,fontSize:13,fontWeight:700,color:'var(--a3-ink)',lineHeight:1.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},// the chat entry: a surface panel with one bounded accent affordance, never a filled slab.
ezistAsk:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,width:'100%',minHeight:76,padding:'14px 16px',borderRadius:18,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},ezistAskGo:{width:46,height:46,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:14,background:'var(--a3-blue)',color:'var(--a3-on-blue)'},// the five module cards. One base, four id-specific accents, one wide feature.
ezistCard:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,width:'100%',minHeight:84,padding:'14px',borderRadius:18,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},ezistCard_adhkar:{borderTop:'3px solid var(--a3-cyan)'},ezistCard_memorize:{borderRight:'3px solid var(--a3-blue)'},ezistCard_treasure:{background:'var(--a3-ice)'},ezistCard_fatwa:{borderLeft:'3px solid var(--a3-cyan)'},// Item 64: padding and gap are the MOSAIC'S values, not this card's own. Measured at 430x932
// before the change: every card declared 14px and a gap of 12 except this one, which declared
// '16px 18px' and 14 -- so the mushaf section carried 2px more air above and below its content
// than its four neighbours, which is the gap the owner reported. minHeight and the arched
// radius are SIZE and IDENTITY, not spacing, and are deliberately left as they were.
ezistFeature:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,width:'100%',minHeight:104,padding:'14px',borderRadius:'40px 40px 18px 18px',background:'var(--a3-ice)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},ezistCardIcon:{width:42,height:42,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:12,background:'var(--a3-ice)',color:'var(--a3-blue)'},ezistFeatureIcon:{width:50,height:50,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:14,background:'var(--a3-surface)',color:'var(--a3-blue)',border:'1px solid var(--a3-line)'},ezistCardBody:{display:'flex',flexDirection:'column',gap:3,minWidth:0,flex:1},ezistCardTitle:{fontSize:15.5,fontWeight:800,color:'var(--a3-ink)'},ezistFeatureTitle:{fontSize:18,fontWeight:800,color:'var(--a3-ink)'},ezistCardSub:{fontSize:12.5,fontWeight:600,color:'var(--a3-muted)',lineHeight:1.6},ezistGo:{flexShrink:0,display:'inline-flex',color:'var(--a3-muted)'},ezistMeta:{flexShrink:0,padding:'5px 10px',borderRadius:999,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',color:'var(--a3-blue)',fontSize:12.5,fontWeight:800},// the featured Quran panel. The marks sit in the head row, never over the text.
ezistQuran:{padding:'16px 18px 18px',borderRadius:18,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)'},// 105: the dot that used to lead this row is gone. `paddingInlineStart` is exactly what it
// occupied -- its own 8px plus the 8px gap it stood in -- so the title's leading edge stays
// at the pixel it has always been at. MEASURED before and after: 346. The `gap` is kept
// because it still describes the row, and is simply inert while one child is left.
ezistQuranHead:{display:'flex',alignItems:'center',gap:8,paddingInlineStart:16},ezistQuranLabel:{fontSize:12.5,fontWeight:800,color:'var(--a3-blue)',letterSpacing:'.2px'},// ITEM 99 -- THE TOP MARGIN, AND ONLY THE TOP MARGIN. Measured at 430x932 dpr 2 on cfb73ca:
// the verse box began 43.00px below the panel top and 14.00px below the label row. Item 64
// (spacing) did not touch this panel -- it moved the mosaic gap and the mushaf card, and
// nothing else -- so the gap the owner is still seeing is this one and it was measured, not
// assumed. Item 98 took 6.00px of it with the hairline; this takes the remaining 8.00px,
// which is the whole of what stood between the label row and the verse.
// WHAT IS NOT TOUCHED, and each deliberately: the 6px BELOW the verse, which separates it
// from its own reference line; the 2.1 line height, which is the Amiri face’s leading and is
// typography rather than spacing; and the panel’s own 2px top padding, which belongs to the
// top bar and not to the verse. This is the smallest edit that answers «ارفعها فوق».
ezistQuranText:{color:'var(--a3-ink)',fontSize:19,lineHeight:2.1,textAlign:'center',fontFamily:"'Amiri', serif",margin:'0 0 6px'},ezistQuranMeta:{color:'var(--a3-muted)',fontSize:12.5,fontWeight:600,textAlign:'center'},// The compact greeting row. A line profile icon in a white 44px button -- no face, no avatar.
// THE CALLOUT that replaced the banner: a short white row, a line icon on a soft chip and a
// small cyan dot. It is a surface and a hairline; it is not a filled rectangle.
// The module chip, shared by the route nodes, the deck cards and the quick row.
// THE ROUTE. One hairline down the middle; each row is a three-column grid whose middle
// column holds the mark, so the cards alternate around it without a transform -- and on a
// wide display the same alternation IS the balanced two-column journey.
// THE DECK. Each card is offset EZH_DECK_OFF from the one in front of it, which is exactly
// why every card in the stack keeps a 56px tappable strip with its icon and its label in it.
// S87: ezhSection / ezhSectionTitle / ezhQuickBtn / ezhQuickLabel are deleted with the
// duplicated quick row they dressed. Nothing else in this file referenced them.
// THE BOTTOM BAR: pure white, 44px floors, and the safe-area inset so it clears a home bar.
// Session 13.3-A - Adhkar browse screen (Boubyan). Reuses DhikrCard for content/audio.
adhkarContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--page)'},adhkarHeader:{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'var(--white)',borderBottom:'1px solid var(--line)'},adhkarBackBtn:{height:36,padding:'0 14px',borderRadius:'var(--radius-btn)',background:'var(--white)',color:'var(--ink)',border:'1px solid var(--line)',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:'var(--ez-ui-font)',flexShrink:0},adhkarTitle:{flex:1,textAlign:'center',fontSize:18,fontWeight:800,color:'var(--ink)'},adhkarScroll:{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'16px 16px 24px',boxSizing:'border-box'},adhkarList:{display:'flex',flexDirection:'column',gap:10},adhkarRow:{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:'var(--radius-card)',background:'var(--white)',border:'1px solid var(--line)',cursor:'pointer',width:'100%',textAlign:'right',fontFamily:'var(--ez-ui-font)'},adhkarRowTitle:{flex:1,fontSize:16,fontWeight:700,color:'var(--ink)'},adhkarCount:{minWidth:28,height:24,padding:'0 8px',borderRadius:999,background:'var(--red-soft)',color:'var(--red)',fontSize:13,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0},adhkarEmpty:{textAlign:'center',color:'var(--muted)',fontSize:15,padding:'32px 0'},// Session 84 - Adhkar UI V2 (ADHKAR_UI_V2_ON). ADDITIVE: every key below is new and not one
// key above it changed, so ?adhkarui=0 renders the S13.3-A screen out of its own untouched
// style keys. Colours are tokens, so V2 follows the palette rather than pinning hexes. The
// only literals are rgba(255,255,255,a) -- white at a fraction, sitting ON the accent band --
// and the shadow rgba(18,50,122,a), which is --red-deep at a fraction. Neither has a token,
// and both are written the same way by homeHero, the chat header and the drawer already.
adhkar2Container:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--page)'},// Session 85. THE ROYAL-BLUE BAND AND ITS TWELVE KEYS ARE REMOVED -- header, head row, head
// text, round back button, brand, title, small title, subtitle, seal, search wrap, search
// icon and search input all existed only to dress a large filled blue rectangle that neither
// new design draws. Nothing else referenced one of them: V1 has its own keys three screens
// up, and the chat, the mushaf and the home screen never named one.
// SAFE AREA at the other end: the last control -- the nav row, or the last tile -- clears the
// home indicator instead of sitting under it. Same env() fallback to 0.
adhkar2Scroll:{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'16px 16px calc(28px + env(safe-area-inset-bottom, 0px))',boxSizing:'border-box'},adhkar2List:{display:'flex',flexDirection:'column',gap:10},adhkar2Row:{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'13px 14px',borderRadius:18,background:'var(--white)',border:'1px solid var(--line)',boxShadow:'0 2px 10px rgba(18,50,122,0.05)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},adhkar2RowIcon:{width:42,height:42,flexShrink:0,borderRadius:13,background:'var(--red-soft)',color:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center'},adhkar2RowTitle:{flex:1,minWidth:0,fontSize:16,fontWeight:700,lineHeight:1.55,color:'var(--ink)'},adhkar2Count:{minWidth:30,height:26,flexShrink:0,padding:'0 9px',borderRadius:999,background:'var(--tint)',color:'var(--accent-ink)',fontSize:13,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'},adhkar2Chevron:{display:'flex',flexShrink:0,color:'var(--nav-off)'},adhkar2Empty:{textAlign:'center',color:'var(--muted)',fontSize:15,padding:'32px 0'},adhkar2Cards:{display:'flex',flexDirection:'column',gap:12},adhkar2Card:{position:'relative',overflow:'hidden',background:'var(--white)',border:'1px solid var(--line)',borderRadius:20,padding:'14px 16px',boxShadow:'0 3px 14px rgba(18,50,122,0.06)'},// The accent rule down the START edge of the card. RTL, so the start edge is the right one,
// and `right` here is the physical side the reading eye meets first.
adhkar2CardEdge:{position:'absolute',top:14,bottom:14,right:0,width:3,borderRadius:'3px 0 0 3px',background:'linear-gradient(180deg, var(--red) 0%, var(--red-lift) 100%)'},adhkar2CardTop:{display:'flex',alignItems:'center',gap:10,marginBottom:10},adhkar2Index:{width:28,height:28,flexShrink:0,borderRadius:10,background:'var(--tint)',color:'var(--accent-ink)',fontSize:13,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center'},adhkar2Rule:{flex:1,height:1,background:'var(--line)'},// Amiri, already loaded in <head> for the ayah text, at a reading size and a wide leading:
// the tashkeel in the stored text needs the room, and it is the difference between a UI
// string and a page one is meant to recite from. No new font, no new request.
adhkar2Text:{fontFamily:"'Amiri', serif",fontSize:21,lineHeight:2.05,color:'var(--ink)'},adhkar2CardBottom:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:12},adhkar2Repeat:{display:'inline-flex',alignItems:'center',padding:'6px 12px',borderRadius:999,background:'var(--tint)',color:'var(--accent-ink)',fontSize:12.5,fontWeight:700},adhkar2PlayBtn:{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:999,background:'var(--accent-fill)',color:'var(--on-accent)',border:'none',fontSize:12.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},adhkar2PlayBtnOn:{background:'var(--red-deep)'},// Session 84, second pass. Additive again: the keys above are untouched, and V1's are three
// screens away. Two rules run through everything below. (1) TOUCH SIZE -- every interactive
// key here is at least 44x44 CSS px, which is why the chips, the actions and the nav buttons
// all carry a minHeight/minWidth of 44 rather than padding that happens to add up. (2) THEME
// -- everything is a token except the reading page, which is pinned ivory-on-ink so it keeps
// its contrast under both themes; the containers carry .theme-dark so the tokens follow the
// stored theme instead of staying light behind a dark app.
adhkar2Goal:{background:'var(--white)',border:'1px solid var(--line)',borderRadius:18,padding:'13px 15px',marginBottom:14,boxShadow:'0 2px 10px rgba(18,50,122,0.05)'},adhkar2GoalTop:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:9},adhkar2GoalTitle:{fontSize:14.5,fontWeight:800,color:'var(--ink)'},adhkar2GoalCount:{fontSize:13.5,fontWeight:800,color:'var(--red)'},// RTL flex: the fill is the first child, so it grows from the RIGHT edge -- the direction the
// reader's eye already runs. No transform, no absolute positioning to get it there.
adhkar2Bar:{display:'flex',height:8,borderRadius:999,background:'var(--tint)',overflow:'hidden'},adhkar2BarFill:{height:'100%',borderRadius:999,background:'linear-gradient(90deg, var(--red-lift) 0%, var(--red) 100%)',transition:'width 200ms ease'},adhkar2Section:{marginBottom:14},adhkar2SectionTitle:{fontSize:13,fontWeight:800,color:'var(--muted)',marginBottom:8},adhkar2Chips:{display:'flex',flexWrap:'wrap',gap:8},adhkar2Chip:{display:'inline-flex',alignItems:'center',gap:8,minHeight:44,maxWidth:'100%',padding:'0 14px',borderRadius:999,background:'var(--white)',border:'1px solid var(--line)',color:'var(--ink)',fontFamily:'var(--ez-ui-font)',fontSize:14,fontWeight:700,cursor:'pointer',textAlign:'right'},adhkar2ChipTitle:{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},adhkar2ChipNum:{minWidth:22,height:22,flexShrink:0,padding:'0 7px',borderRadius:999,background:'var(--tint)',color:'var(--accent-ink)',fontSize:12,fontWeight:800,display:'inline-flex',alignItems:'center',justifyContent:'center'},// The grid TILE. The grid itself is the .adhkar2-grid class in <style> (a media query cannot
// live in an inline style); the tile is the cell that class lays out.
adhkar2Tile:{display:'flex',flexDirection:'column',alignItems:'stretch',gap:10,minHeight:116,padding:'13px 13px',borderRadius:18,background:'var(--white)',border:'1px solid var(--line)',boxShadow:'0 2px 10px rgba(18,50,122,0.05)',cursor:'pointer',textAlign:'right',fontFamily:'var(--ez-ui-font)'},adhkar2TileTop:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8},adhkar2TileIcon:{width:38,height:38,flexShrink:0,borderRadius:12,background:'var(--red-soft)',color:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center'},adhkar2TileTitle:{fontSize:14.5,fontWeight:700,lineHeight:1.55,color:'var(--ink)'},adhkar2Pos:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:8},adhkar2PosText:{fontSize:14,fontWeight:800,color:'var(--ink)'},adhkar2PosDone:{fontSize:12.5,fontWeight:700,color:'var(--muted)'},adhkar2Slim:{display:'flex',height:5,borderRadius:999,background:'var(--tint)',overflow:'hidden',marginBottom:14},adhkar2SlimFill:{height:'100%',borderRadius:999,background:'var(--red)',transition:'width 200ms ease'},// Session 85. THE IVORY READING PAGE IS REMOVED. Its six keys pinned #FBF6EA paper, #EFE4CC
// chips, an #E2D6BB rule and #171512 ink -- the only warm values in the adhkar surface, and
// the last of them. Both new readers recite from pure white in the light theme and from a
// cool navy card in the dark one, so no beige, cream, tan, gold, brown or green is left
// anywhere in this UI. The MUSHAF still pins its own paper; that block is untouched.
// The counter: full width, 68px tall, and the only thing at that size on the screen -- it is
// meant to be found by a thumb without looking, which is how a tally is actually kept.
adhkar2Counter:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,width:'100%',minHeight:68,marginTop:14,padding:'10px 16px',borderRadius:22,background:'var(--accent-fill)',color:'var(--on-accent)',border:'none',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},adhkar2CounterDone:{background:'var(--red-deep)',cursor:'default'},adhkar2CounterNums:{fontSize:24,fontWeight:800},adhkar2CounterLabel:{display:'inline-flex',alignItems:'center',gap:6,fontSize:12.5,fontWeight:700,color:'rgba(255,255,255,0.88)'},adhkar2Actions:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:12},adhkar2Act:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,minHeight:44,minWidth:44,padding:'0 15px',borderRadius:999,background:'var(--white)',border:'1px solid var(--line)',color:'var(--ink)',fontFamily:'var(--ez-ui-font)',fontSize:13,fontWeight:700,cursor:'pointer'},adhkar2ActOn:{background:'var(--red-soft)',border:'1px solid var(--red)',color:'var(--red)'},adhkar2Note:{minHeight:19,marginTop:10,textAlign:'center',fontSize:12.5,fontWeight:700,color:'var(--red)'},adhkar2Nav:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:12},adhkar2NavBtn:{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,minHeight:44,minWidth:44,padding:'0 16px',borderRadius:999,background:'var(--white)',border:'1px solid var(--line)',color:'var(--ink)',fontFamily:'var(--ez-ui-font)',fontSize:13.5,fontWeight:700,cursor:'pointer'},adhkar2NavBtnOff:{opacity:0.42,cursor:'default'},// ============================================================
// SESSION 85 -- THE TWO ADHKAR DESIGNS. Every key below reads its colour from the .adhkar3
// token set declared in <style>, which is why not one of them names a hex: light is pure
// #FFFFFF cards on a very pale ice-blue page with royal blue #2454D7, navy #0B2455 and a
// restrained cyan #20C7E8, and dark is the same structure on cool navy surfaces. There is no
// warm value in this block and no large filled blue rectangle in it. Two rules run through
// all of it: every interactive key is at least 44x44 CSS px, and every scroll and every dock
// carries the safe-area inset so nothing lands under a notch or a home indicator.
// ============================================================
// The deck reader is the one full-screen PURE WHITE surface: the card floats on the paper
// rather than on the page wash.
// The compact white top row, shared by all four screens. It is a surface, a hairline and
// line icons -- no band, no gradient, no pattern.
a3Bar:{flexShrink:0,display:'flex',alignItems:'center',gap:8,padding:'calc(6px + env(safe-area-inset-top, 0px)) 10px 6px',background:'var(--a3-surface)',borderBottom:'1px solid var(--a3-line)'},a3BarBtn:{width:44,height:44,flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,borderRadius:14,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',color:'var(--a3-ink)',cursor:'pointer'},a3BarBtnOn:{background:'var(--a3-soft)',border:'1px solid var(--a3-blue)',color:'var(--a3-blue)'},// The category title is content and may run long: it wraps rather than being truncated.
a3SearchRow:{flexShrink:0,display:'flex',alignItems:'center',gap:9,height:46,margin:'10px 12px 0',padding:'0 14px',borderRadius:999,background:'var(--a3-surface)',border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)'},a3SearchIcon:{display:'flex',flexShrink:0,color:'var(--a3-muted)'},a3SearchInput:{flex:1,minWidth:0,padding:0,border:'none',background:'transparent',outline:'none',fontFamily:'var(--ez-ui-font)',fontSize:15.5,color:'var(--a3-ink)',direction:'rtl'},// DESKTOP: the column stops widening, so a journey path and a deck keep a phone's reading
// measure on a large display instead of stretching across it.
a3Empty:{flex:1,width:'100%',textAlign:'center',color:'var(--a3-muted)',fontSize:15,padding:'32px 0'},// The daily ring. One stroked circle over one track circle; the digits inside are the real
// completion count over ADHKAR_DAILY_GOAL.
// THE PATH. The centre line is one hairline; each row is a three-column grid whose middle
// column holds the marker, so the summaries alternate around it without any transform.
// THE DECK. Each card is offset 44px from the one behind it, which is exactly why every card
// in the stack keeps a full 44px tappable strip -- the stack is a look, never a lost target.
// THE JOURNEY READER. The rail is absolutely positioned inside this box, on the RTL edge,
// and the scroll keeps a wider right padding so no word of the text runs under it.
// Amiri, already loaded in <head>, at a reading size and a wide leading -- the same treatment
// the text had before, on a white surface instead of an ivory one.
// THE DOCK. It is a laid-out row, not an overlay: it occupies its own space at the foot of
// the screen, so it cannot cover the text it sits under however long the dhikr is.
// THE DECK READER STAGE. The ghost is a DECORATIVE EMPTY EDGE -- a bordered strip with no
// children at all -- so the deck reads as a deck without any second dhikr being shown.
// THE SETTINGS CHOICE. Two selection cards, 44px floor, pure white when unselected; the
// selected one takes a thin royal-blue outline and a small cyan indicator dot. The previews
// are CSS boxes -- no image, no data URI, nothing fetched.
// S102 -- the ACTIVE-DESIGN card. A state row and a disabled preview line; no option, no
// dot, no chooser. The --vtp-* swatch tokens the old previews read are still declared in
// <style> and are still measured by the guard, because the next batch needs them back.
vtActiveRow:{display:'flex',alignItems:'center',gap:12,minHeight:56,padding:'10px 12px',borderRadius:14,background:'var(--a3-ice)',border:'1px solid var(--a3-blue)'},vtActiveMark:{width:10,height:10,flexShrink:0,borderRadius:'50%',background:'var(--a3-blue)'},vtActiveBody:{display:'flex',flexDirection:'column',gap:2,minWidth:0},vtActiveName:{fontSize:15,fontWeight:800,color:'var(--a3-ink)'},vtActiveState:{fontSize:12.5,fontWeight:600,color:'var(--a3-blue)'},vtSoonRow:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,minHeight:48,marginTop:8,padding:'10px 12px',borderRadius:14,background:'var(--a3-surface)',border:'1px dashed var(--a3-line)'},vtSoonName:{fontSize:14,fontWeight:700,color:'var(--a3-muted)'},vtSoonTag:{fontSize:12,fontWeight:700,color:'var(--a3-muted)'},// S100 -- the identity previews. Every colour is a --vtp-* token declared in <style>, not a
// literal, and none of these keys carries a text colour: they are swatches, not text.
vtpBox:{position:'relative',display:'block',width:'100%',height:62,borderRadius:12,overflow:'hidden',border:'1px solid var(--line)'},vtpQBox:{background:'var(--vtp-q-page)'},vtpIBox:{background:'var(--vtp-i-page)'},vtpQBar:{position:'absolute',top:7,left:9,right:9,height:7,borderRadius:4,background:'var(--vtp-q-accent)'},vtpIBar:{position:'absolute',top:7,left:9,right:9,height:7,borderRadius:4,background:'var(--vtp-i-accent)'},vtpQCard:{position:'absolute',top:20,left:9,right:9,bottom:8,borderRadius:10,background:'var(--vtp-q-surface)',border:'1px solid var(--vtp-q-line)'},// the signature arch, shown rather than described.
vtpICard:{position:'absolute',top:20,left:9,right:9,bottom:8,borderRadius:'22px 22px 10px 10px',background:'var(--vtp-i-surface)',border:'1px solid var(--vtp-i-line)'},// S115: the gradient pill and its 24px navy glow are gone. One flat accent surface, an arch at
// its outer edge, and a quiet second action beneath it -- both tokens, both in every mode.
primaryBtn:{width:'100%',padding:'15px',fontSize:17,fontWeight:700,borderRadius:'22px 22px 15px 15px',background:'var(--accent-fill)',color:'var(--on-accent)',border:'none',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},secondaryBtn:{width:'100%',padding:'13px',fontSize:15.5,fontWeight:700,borderRadius:15,background:'transparent',color:'var(--a3-muted)',border:'1px solid var(--a3-line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',marginTop:8},// ===== شاشة الدردشة — S112 ISTANA =====
// THE NAVY MASTHEAD IS GONE, KEYS AND ALL. `header`, `settingsBtn`, and the `headerContent` /
// `avatar` / `headerTitle` / `headerSubtitle` set that hung off it were the only things in this
// file that painted a full-width gradient slab over the chat; the bounded rail that replaced
// them is .ezc-rail in <style> and declares no colour of its own. Deleting the keys rather than
// orphaning them is deliberate: a slab nobody can spread cannot come back by accident.
// Every value left below is a token. There is not one literal colour on this screen any more.
// position + zIndex make this a STACKING CONTEXT, and nothing else asked for them: the
// watermark is a negative layer inside it, which is the one arrangement that puts an image
// over the page colour and under the rail, the transcript and the dock without positioning
// any of those three. Neither value paints anything.
chatContainer:{position:'relative',zIndex:0,height:'100vh',height:'100dvh',display:'flex',flexDirection:'column',background:'var(--page)'},// ===== S98 — the reply controls, the favourites screen and the local search =====
// Every value below is a token. Nothing here carries a literal colour, so the whole set moves
// with data-theme=dark exactly as the surfaces they sit on do. Every tappable element is at
// least 40px on its short side (44 where it is a standalone row), which is the phone target
// size the rest of the chat already uses (drawerChatRow minHeight 44, a3DockBtn 44).
foldToggle:{alignSelf:'flex-start',display:'inline-flex',alignItems:'center',gap:6,minHeight:40,marginTop:2,padding:'8px 12px',background:'var(--tint)',color:'var(--red)',border:'1px solid var(--line)',borderRadius:999,fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'},// The quick-action strip. It WRAPS rather than scrolling sideways, so five labels cannot push
// the page into a horizontal scroll at 320px.
// S112: the strip stretches to the bounded column and starts at the reading edge, under the
// sheet it belongs to, instead of hanging off the far side of an unbounded viewport.
quickRow:{display:'flex',flexWrap:'wrap',gap:8,alignSelf:'stretch',padding:'2px 0 4px'},// §٢ (C) — سطرُ «لم يكتمل»، فوقَ الشريطِ مباشرةً وبعرضِه. كلُّ لونٍ هنا رمزٌ من رموزِ السمة،
// فينتقلُ مع data-theme=dark كبقيّةِ ما يجاورُه. ليس زرّاً ولا يُنقَر: هو خبرٌ عن الجوابِ فوقَه.
incompleteNotice:{alignSelf:'stretch',padding:'8px 12px',marginTop:2,background:'var(--tint)',color:'var(--red)',border:'1px solid var(--line)',borderRadius:12,fontSize:13,fontWeight:700,lineHeight:1.6},quickBtn:{minHeight:40,padding:'8px 14px',background:'var(--a3-surface)',color:'var(--a3-blue)',border:'1px solid var(--a3-line)',borderRadius:999,fontSize:13.5,fontWeight:600,fontFamily:'inherit',cursor:'pointer'},// The search box in the drawer, and the favourites screen. Both draw on --white over --page,
// the same pair every other sheet in the app uses.
drawerSearchWrap:{padding:'2px 2px 8px'},drawerSearch:{width:'100%',minHeight:40,padding:'9px 12px',background:'var(--white)',color:'var(--ink)',border:'1px solid var(--line)',borderRadius:12,fontSize:14.5,fontFamily:'inherit',textAlign:'right',outline:'none'},drawerEmpty:{padding:'10px 12px',fontSize:13,color:'var(--muted)'},// A RESULT IS A BLOCK, not a one-line row. It carries a title, a snippet and a date, and the
// shared drawerChatRow (a centred flex line with a fixed 44px floor) let those three collide:
// the date of one result printed over the title of the next. Explicit line heights and a
// separator between rows are the fix; both were missing, not merely tight.
drawerResultRow:{borderBottom:'1px solid var(--line)'},drawerResultBtn:{display:'flex',flexDirection:'column',alignItems:'stretch',gap:3,width:'100%',minWidth:0,padding:'10px',background:'none',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:14.5,color:'var(--ink)',textAlign:'right'},drawerResultTitle:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%',fontWeight:600,lineHeight:1.5},drawerResultDate:{fontSize:11.5,lineHeight:1.5,color:'var(--muted)'},drawerSnippet:{display:'block',fontSize:12,lineHeight:1.6,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%'},drawerBadge:{minWidth:22,padding:'1px 7px',borderRadius:999,background:'var(--tint)',color:'var(--red)',fontSize:12,fontWeight:700,textAlign:'center'},// ===== شاشة المفضلة — S114 ISTANA =====
// The screen kept every one of its keys -- they are what the chat-ux gate measures -- and every
// one of them still reads a token. What changed is the SHAPE: the body no longer stacks one
// full-width card under another (the catalogue in <style> lays them in columns), and the card
// is no longer a padded box with a date floating at its top: it is a head band, a reading body
// and a foot, and those three bands are .ezfav-head / .ezfav-read / .ezfav-foot. So the values
// below are the SURFACES, and the structure that arranges them is CSS -- which is what lets a
// column count answer a media query at all.
favScreen:{height:'100dvh',display:'flex',flexDirection:'column',background:'var(--page)',color:'var(--a3-ink)'},favBody:{flex:1,minHeight:0,overflowY:'auto',padding:'10px 14px calc(18px + env(safe-area-inset-bottom, 0px))'},favCard:{display:'block',background:'var(--a3-surface)',border:'1px solid var(--a3-line)',borderRadius:'24px 24px 16px 16px',boxShadow:'var(--a3-shadow)'},favMeta:{flex:1,minWidth:0,fontSize:12,fontWeight:700,color:'var(--a3-muted)'},favText:{fontSize:14.5,lineHeight:1.85,color:'var(--a3-ink)',whiteSpace:'pre-wrap',overflowWrap:'anywhere'},favRow:{display:'flex',flexWrap:'wrap',gap:8},favBtn:{minHeight:40,padding:'8px 12px',background:'var(--a3-surface)',color:'var(--a3-blue)',border:'1px solid var(--a3-line)',borderRadius:12,fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'},favBtnOff:{color:'var(--a3-muted)',cursor:'default',opacity:0.5},// S112: the scrim and the panel are .ezc-drawer-ov / .ezc-drawer in <style>, because the panel
// has to CHANGE SHAPE at a desk -- an inset, bounded card instead of an edge-to-edge sheet --
// and an inline style cannot answer a media query. The two keys are gone rather than left
// behind: a panel nobody can spread cannot quietly become a full-screen slab again.
drawerTop:{display:'flex',flexDirection:'column',gap:4,flex:1,minHeight:0,overflowY:'auto'},drawerItem:{display:'flex',alignItems:'center',gap:12,width:'100%',minHeight:44,padding:'12px',background:'none',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:15.5,color:'var(--a3-ink)',textAlign:'right'},// S92: the saved-conversation rows. Every colour is an EXISTING variable -- --ink, --muted,
// --line, --tint, --red -- so both palettes already answer for them and no theme value is
// added, changed or overridden by any of this.
drawerSectionLabel:{padding:'14px 12px 6px',fontSize:12,color:'var(--muted)',borderTop:'1px solid var(--line)',marginTop:6},drawerChatRow:{display:'flex',alignItems:'center',gap:2,borderRadius:12,minHeight:44},drawerChatOpen:{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:0,padding:'11px 10px',background:'none',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:14.5,color:'var(--ink)',textAlign:'right'},drawerChatTitle:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0},drawerChatIcon:{width:32,height:32,flexShrink:0,borderRadius:10,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},drawerConfirmText:{flex:1,minWidth:0,padding:'0 8px',fontSize:13,color:'var(--ink)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},drawerConfirmYes:{flexShrink:0,padding:'7px 11px',borderRadius:10,background:'var(--red)',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:'var(--on-accent)'},drawerConfirmNo:{flexShrink:0,padding:'7px 11px',borderRadius:10,background:'var(--tint)',border:'1px solid var(--line)',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:'var(--ink)'},drawerPinned:{display:'flex',alignItems:'center',gap:8,paddingTop:10,borderTop:'1px solid var(--line)'},drawerProfile:{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0,padding:'10px 10px',background:'none',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:15,color:'var(--ink)',textAlign:'right'},drawerAvatar:{width:32,height:32,flexShrink:0,borderRadius:'50%',background:'var(--accent-fill)',display:'flex',alignItems:'center',justifyContent:'center'},drawerProfileName:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},// drawerGear NO LONGER DRAWS ANYTHING. Its button -- the ringed disc with eight rays beside
// the profile row -- was removed once it was measured to open the same destination as that
// row. The key stays because the chat's own inventory gate names it in the list of style keys
// the chat draws from and fails on a missing one; deleting it is a separate change to a gate,
// and this batch may not touch a gate. It is dead, it is named here as dead, and nothing in
// the file reads it.
drawerGear:{width:40,height:40,flexShrink:0,borderRadius:12,background:'var(--tint)',border:'1px solid var(--line)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},// D88 settings sheet. Every colour here is a token, so the sheet themes with the chat.
settingsContainer:{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--page)'},settingsHeader:{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'var(--white)',borderBottom:'1px solid var(--line)'},settingsTitle:{fontSize:17,fontWeight:800,color:'var(--ink)'},settingsBody:{flex:1,overflowY:'auto',padding:'16px 14px'},settingsCard:{background:'var(--white)',border:'1px solid var(--line)',borderRadius:'var(--radius-card)',padding:'14px 16px'},settingsLabel:{fontSize:13,fontWeight:700,color:'var(--muted)',marginBottom:10},settingsHint:{fontSize:12,color:'var(--muted)',marginTop:10},// S90 -- the التحكم row. Every value here is one the settings card above already uses: the same
// surface variable, the same border variable, the same radius token and the same padding. No
// colour, token or spacing is introduced, so both themes render it as they render that card.
settingsNavBtn:{width:'100%',boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:12,background:'var(--white)',border:'1px solid var(--line)',borderRadius:'var(--radius-card)',padding:'14px 16px',color:'var(--ink)',fontFamily:'inherit',fontSize:15,fontWeight:700,cursor:'pointer',textAlign:'right'},settingsNavChev:{fontSize:18,lineHeight:1,color:'var(--muted)'},// ===== S99 — سهولة الاستخدام. Every value is a token; every tappable row is at least 44px on
// its short side, which is the target size the rest of the settings screen already uses. =====
a11yGroupLabel:{fontSize:13,fontWeight:700,color:'var(--muted)',margin:'2px 0 8px'},// The three size options share themeOpt's shape so the card reads as one family, but carry
// their own key: themeOpt is the theme control's and must not drift with this one.
a11yOpt:{flex:1,minWidth:0,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 8px',borderRadius:14,border:'1px solid var(--line)',background:'var(--tint)',color:'var(--ink)',fontFamily:'inherit',fontSize:15,fontWeight:600,cursor:'pointer'},a11ySwitchRow:{display:'flex',alignItems:'center',gap:12,width:'100%',minHeight:56,marginTop:12,padding:'10px 2px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'right',color:'var(--ink)'},a11ySwitchText:{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:3},a11ySwitchTitle:{fontSize:15,fontWeight:600,color:'var(--ink)'},a11ySwitchHint:{fontSize:12.5,lineHeight:1.6,color:'var(--muted)'},a11ySwitch:{flexShrink:0,width:46,height:28,borderRadius:999,background:'var(--tint)',border:'1px solid var(--line)',display:'flex',alignItems:'center',padding:2},a11ySwitchOn:{background:'var(--red)',border:'1px solid var(--red)'},a11yKnob:{width:22,height:22,borderRadius:999,background:'var(--white)',marginInlineStart:0,marginInlineEnd:'auto'},a11yKnobOn:{marginInlineStart:'auto',marginInlineEnd:0,background:'var(--on-accent)'},a11yReset:{width:'100%',minHeight:44,marginTop:14,padding:'11px 12px',borderRadius:14,border:'1px solid var(--line)',background:'var(--white)',color:'var(--red)',fontFamily:'inherit',fontSize:14.5,fontWeight:600,cursor:'pointer'},// The slider carries no colour PAIR of its own -- accentColor tints the shipped native
// control from the identity's accent, and the track stays whatever the platform draws.
wmSlider:{width:'100%',margin:'2px 0 4px',accentColor:'var(--red)',cursor:'pointer'},themeRow:{display:'flex',gap:10},themeOpt:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 10px',borderRadius:14,border:'1px solid var(--line)',background:'var(--tint)',color:'var(--ink)',fontFamily:'inherit',fontSize:15,fontWeight:600,cursor:'pointer'},themeOptActive:{border:'2px solid var(--red)',background:'var(--red-soft)',color:'var(--red)'},themeSwatch:{width:18,height:18,borderRadius:'50%',border:'1px solid',flexShrink:0},settingsInput:{width:'100%',boxSizing:'border-box',padding:'12px 14px',marginBottom:8,borderRadius:12,border:'1px solid var(--line)',background:'var(--tint)',color:'var(--ink)',fontFamily:'inherit',fontSize:15,textAlign:'center',letterSpacing:'0.4em',direction:'ltr'},settingsMsg:{fontSize:13,lineHeight:1.8,color:'var(--red)',margin:'2px 0 8px'},settingsSaveBtn:{width:'100%',padding:'12px',borderRadius:12,border:'none',background:'var(--accent-fill)',color:'var(--on-accent)',fontFamily:'inherit',fontSize:15,fontWeight:700,cursor:'pointer'},// ===== منطقة الرسائل =====
// S112: THE MEASURE IS THE SCROLLER'S OWN PADDING and it lives in .ezc-scroll, not here --
// a max-width would have needed a wrapper element between this container and the messages, and
// that container is the one the S97 opening pin measures and positions. Padding bounds the
// column without touching the box the pin reads. No horizontal padding is declared here, so
// there is nothing inline for the class to have to beat.
messagesArea:{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:14},// ===== فقاعات الرسائل =====
// S112: TWO STRUCTURES, not two colours. The user card is held to a fraction of the column and
// sits on the reading edge with a marked side; the assistant sheet takes the whole measure and
// carries no tail at all. Neither is a gradient any more, and the alignment moved OUT of these
// objects onto .ezc-turn, so which side a turn stands on is a property of the turn and not
// something a spread can silently flip.
messageBubble:{maxWidth:'78%',padding:'12px 16px',borderRadius:'var(--radius-card)',fontSize:16,lineHeight:1.7,wordWrap:'break-word',whiteSpace:'pre-wrap'},// ~0.78 alpha on both bubbles, so the watermark behind the thread stays visible THROUGH a
// turn instead of being blanked out by it. color-mix keeps the colour a TOKEN -- there is no
// literal here for a palette to fail to reach, and each mode mixes its own surface.
userBubble:{background:'color-mix(in srgb, var(--a3-ice) 78%, transparent)',color:'var(--a3-ink)',border:'1px solid var(--a3-line)',borderInlineStart:'3px solid var(--a3-blue)',borderRadius:16,borderBottomRightRadius:6,padding:'10px 14px',fontSize:15},assistantBubble:{maxWidth:'100%',background:'color-mix(in srgb, var(--a3-surface) 78%, transparent)',color:'var(--answer-ink)',borderRadius:'var(--radius-card)',boxShadow:'var(--a3-shadow)',border:'1px solid var(--a3-line)',fontSize:15},bubbleText:{overflowWrap:'anywhere',/* 13.4-b2 */lineHeight:1.85,fontSize:15,color:'var(--answer-ink)'},// S93: the Markdown blocks. Every colour is an EXISTING variable -- --answer-ink, --muted,
// --line, --tint, --red -- so both palettes already answer for them and no theme value is
// added, changed or overridden. Sizes are relative to the bubble text they sit in.
//
// ITEM 63, VERIFIED AND FINISHED. Item 63 gave the answer its own ink and set it to black in
// light, and MEASURED AFTERWARDS the prose was rgb(0,0,0) at 21.00:1 -- but a heading inside
// the same answer painted rgb(16,54,78) at 12.65:1, because these three lines read --ink and
// not the answer’s token. Every one of them is INSIDE the reply and nowhere else -- the only
// two callers of EzikMarkdown are the streaming preview and the reply prose -- so «أسود
// حقيقيًّا» has to include them, and moving them moves nothing outside an answer.
mdP:{margin:0},mdH1:{margin:'2px 0 2px',fontSize:18,fontWeight:700,lineHeight:1.6,color:'var(--answer-ink)'},mdH2:{margin:'2px 0 2px',fontSize:16.5,fontWeight:700,lineHeight:1.6,color:'var(--answer-ink)'},mdH3:{margin:'2px 0 2px',fontSize:15.5,fontWeight:700,lineHeight:1.6,color:'var(--answer-ink)'},mdHr:{border:'none',borderTop:'1px solid var(--line)',margin:'10px 0'},mdUl:{margin:'2px 0',paddingInlineStart:22,listStyleType:'disc'},mdOl:{margin:'2px 0',paddingInlineStart:22},mdLi:{margin:'2px 0'},mdQuote:{margin:'2px 0',padding:'6px 12px',borderInlineStart:'3px solid var(--line)',color:'var(--muted)'},mdCode:{fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',fontSize:'0.92em',background:'var(--tint)',borderRadius:6,padding:'1px 5px',direction:'ltr',unicodeBidi:'embed',display:'inline-block'},mdPre:{margin:'4px 0',padding:'10px 12px',background:'var(--tint)',border:'1px solid var(--line)',borderRadius:10,overflowX:'auto',direction:'ltr',textAlign:'left',fontSize:13.5,lineHeight:1.6,whiteSpace:'pre'},// A wide table scrolls INSIDE its own box; the bubble itself must never scroll sideways.
mdTableWrap:{margin:'4px 0',overflowX:'auto',maxWidth:'100%'},mdTable:{borderCollapse:'collapse',width:'100%',fontSize:14.2},mdTh:{border:'1px solid var(--line)',background:'var(--tint)',padding:'7px 10px',fontWeight:700,whiteSpace:'nowrap'},mdTd:{border:'1px solid var(--line)',padding:'7px 10px',verticalAlign:'top'},typingDots:{display:'flex',gap:4,padding:'4px 0'},searchingHint:{display:'flex',alignItems:'center',gap:6,padding:'4px 0',fontSize:14,color:'var(--red)'},dot:{fontSize:10,color:'var(--red)',animation:'typing 1.4s infinite'},// ===== بطاقة الآية =====
verseCard:{background:'var(--red-soft)',border:'1px solid var(--line)',borderRadius:14,padding:'12px 14px'},verseCardLabel:{display:'inline-flex',alignItems:'center',gap:5,color:'var(--red)',fontSize:12,fontWeight:600,marginBottom:6},verseText:{fontSize:19,color:'var(--verse-ink)',textAlign:'center',fontFamily:"'Amiri Quran', 'Amiri', 'Tajawal', serif",lineHeight:2.1,margin:'6px 0 6px'},surahText:{fontSize:19,color:'var(--verse-ink)',textAlign:'justify',textAlignLast:'center',fontFamily:"'Amiri Quran', 'Amiri', 'Tajawal', serif",lineHeight:2.3,margin:'6px 2px 8px',direction:'rtl'},verseMeta:{fontSize:12,textAlign:'center',color:'var(--muted)',fontWeight:500},verseFooter:{display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap',marginTop:8},versePlayBtn:{display:'inline-flex',alignItems:'center',gap:6,background:'var(--accent-fill)',color:'var(--on-accent)',border:'none',borderRadius:999,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},verseAudioError:{fontSize:11,textAlign:'center',color:'#B4453A',marginTop:6},// ===== بطاقة الحديث =====
hadithCard:{background:'var(--white)',border:'1px solid var(--line)',borderRadius:14,padding:'12px 14px'},hadithCardLabel:{display:'inline-flex',alignItems:'center',gap:5,color:'var(--red)',fontSize:12,fontWeight:600,marginBottom:6},hadithText:{color:'var(--ink)',fontSize:15,lineHeight:1.9,margin:'4px 0'},hadithMeta:{fontSize:12,color:'var(--muted)',marginTop:4,fontWeight:500},// ===== بطاقة المصدر (شريحة عزوٍ قابلة للنقر) =====
sourceChip:{display:'inline-flex',alignItems:'center',gap:7,alignSelf:'flex-start',maxWidth:'100%',background:'var(--white)',border:'1px solid var(--line)',borderRadius:999,padding:'6px 12px',fontSize:12.5,fontWeight:500,color:'var(--ink)',fontFamily:'var(--ez-ui-font)',textDecoration:'none',boxSizing:'border-box'},sourceChipLink:{cursor:'pointer'},sourceChipSite:{display:'inline-flex',alignItems:'center',gap:4,color:'var(--red)',fontWeight:600,flexShrink:0},sourceChipText:{minWidth:0,/* 13.4-b2 */color:'var(--ink)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},sourceChipArrow:{color:'var(--red)',fontWeight:700,flexShrink:0,fontSize:13},// ===== شارةُ الوسم (XI-04) =====
// A footnote, not a pill: its body is a whole sentence, so it wraps and it is not clipped. It
// sits at the reading edge like the source chip and uses the same tokens, so it inverts with the
// theme and needs no colour of its own.
reviewNotice:{display:'flex',flexWrap:'wrap',alignItems:'baseline',gap:6,alignSelf:'flex-start',maxWidth:'100%',background:'var(--tint)',border:'1px solid var(--line)',borderRadius:12,padding:'8px 12px',fontSize:12.5,lineHeight:1.75,fontFamily:'var(--ez-ui-font)',boxSizing:'border-box'},reviewNoticeLabel:{color:'var(--red)',fontWeight:600,flexShrink:0},reviewNoticeText:{minWidth:0,color:'var(--muted)',fontWeight:500},// ===== بطاقة الخطوات =====
stepsCard:{background:'var(--red-soft)',border:'1px solid var(--line)',borderRadius:14,padding:'12px 14px'},stepsCardLabel:{display:'inline-flex',alignItems:'center',gap:5,color:'var(--red)',fontSize:12,fontWeight:600,marginBottom:8},stepsList:{margin:0,padding:'0 18px 0 0',color:'var(--ink)',listStyle:'decimal'},stepsItem:{marginBottom:6,fontSize:14.5,lineHeight:1.8},// ===== اقتراحات بعد رد الأستاذ =====
suggestionsInline:{display:'flex',flexWrap:'wrap',gap:6,paddingRight:4},suggestionChipSmall:{background:'var(--white)',border:'1px solid var(--line)',color:'var(--red)',borderRadius:999,padding:'6px 12px',fontSize:12.5,fontWeight:500,cursor:'pointer',fontFamily:'var(--ez-ui-font)'},// ===== شريط الإدخال =====
// S112: the dock owns the surface, the border and the safe area now (.ezc-dock-inner), so the
// rows inside it declare neither. maxHeight on the textarea is the SHIPPED 200px -- the growth
// bound did not move -- and the send/mic/tool controls keep their fixed square so the glyph
// inside them can never outgrow the box.
errorBanner:{margin:'0 0 2px',padding:'10px 14px',background:'var(--warn-bg)',border:'1px solid var(--warn-line)',borderRadius:12,fontSize:14,color:'var(--warn-ink)',fontWeight:500,textAlign:'center'},inputBar:{display:'flex',alignItems:'flex-end',gap:10},input:{resize:'none',maxHeight:200,overflowY:'auto',lineHeight:1.55,fontFamily:'inherit',flex:1,minWidth:0,/* 13.4-b */padding:'11px 16px',fontSize:15,borderRadius:16,border:'1px solid var(--a3-line)',background:'var(--a3-ice)',color:'var(--a3-ink)',fontFamily:'var(--ez-ui-font)',direction:'rtl',boxSizing:'border-box'},sendBtn:{width:46,height:46,borderRadius:'22px 22px 15px 15px',background:'var(--a3-blue)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},micBtn:{width:46,height:46,borderRadius:'22px 22px 15px 15px',border:'1px solid var(--a3-line)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},// D87: the tool row beneath the composer. space-between + RTL puts the first group on the
// RIGHT and the second on the LEFT, which is the order the row is specified in.
toolBar:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'0 2px'},toolGroup:{display:'flex',alignItems:'center',gap:8},// Same geometry as micBtn, tinted. The old [+] drew a var(--red) icon on the var(--red)
// sendBtn gradient -- blue on blue, invisible. The tool row draws all three circles alike.
toolBtn:{width:44,height:44,borderRadius:14,background:'var(--a3-ice)',border:'1px solid var(--a3-line)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},// ===== لوحة الأهل =====
// S115: the parents' panel. The strip header it shared with the favourites screen is gone --
// .ezparent-rail replaced it -- and every literal below became a token, so the panel has a real
// dark face for the first time. Not a row, not a value and not a reader moved.
dashboardContainer:{height:'100dvh',display:'flex',flexDirection:'column',background:'var(--page)'},dashboardEmpty:{color:'var(--a3-muted)',textAlign:'center',padding:20},// `dashboardHeader`, `backBtn` and `dashboardTitle` are GONE with the strip they drew. They were
// the last shared piece of the pre-identity chrome, borrowed by two screens; both have their own
// bounded rail now, and a strip nobody can spread cannot come back by accident.
dashboardContent:{flex:1,minHeight:0,overflowY:'auto',padding:'10px 14px calc(18px + env(safe-area-inset-bottom, 0px))'},dashboardCard:{background:'var(--a3-surface)',borderRadius:'24px 24px 16px 16px',padding:18,border:'1px solid var(--a3-line)',boxShadow:'var(--a3-shadow)',marginBottom:12},dashboardLabel:{fontSize:13,color:'var(--a3-muted)',fontWeight:700},dashboardValue:{fontSize:17,fontWeight:700,color:'var(--a3-ink)'},conversationLog:{maxHeight:400,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,marginTop:10},logEntry:{padding:12,borderRadius:12,fontSize:14},logRole:{fontWeight:700,color:'var(--a3-ink)',fontSize:13,marginBottom:6},logContent:{color:'var(--a3-ink)',lineHeight:1.6,whiteSpace:'pre-wrap'},logTime:{fontSize:11,color:'var(--a3-muted)',marginTop:6},dangerBtn:{width:'100%',padding:14,background:'transparent',color:'var(--red-lift)',border:'1px solid var(--red-lift)',borderRadius:'20px 20px 14px 14px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'var(--ez-ui-font)',display:'flex',alignItems:'center',justifyContent:'center',marginTop:8},// ===== Live call screen (Layer 1 — UI only) =====
// ===== شاشة المحفّظ =====
/* 14.1 -- Session 86: homeIconSquareDeep stood here and drew the old home screen's filled
     mushaf square. It was read by the old Home body and by nothing else, so it went with the
     other home* keys. No mushaf key was touched. */mushafBody:{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'14px 14px 24px',boxSizing:'border-box'},mushafHint:{textAlign:'center',color:'var(--muted)',fontSize:13,padding:'28px 0'},mushafList:{display:'flex',flexDirection:'column',gap:8},mushafRow:{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'12px 14px',borderRadius:'var(--radius-btn)',background:'var(--white)',border:'1px solid var(--line)',cursor:'pointer',textAlign:'right',fontFamily:'inherit'},mushafNum:{flexShrink:0,width:34,height:34,borderRadius:10,background:'var(--tint)',color:'var(--accent-ink)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700},mushafRowMain:{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:2},mushafName:{fontSize:16,fontWeight:700,color:'var(--ink)'},mushafSub:{fontSize:12,color:'var(--muted)',fontWeight:500},mushafPage:{flexShrink:0,minWidth:56,textAlign:'left',fontSize:11.5,fontWeight:600,color:'var(--muted)'},// S110 -- a juz is a CONTROL in a dense grid, no longer a full-width bar: the label sits over
// its page number instead of beside it, so the cell reads at a third of a phone's width.
mushafJuzRow:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,width:'100%',padding:'8px 4px',borderRadius:'var(--radius-btn)',background:'var(--tint)',border:'none',cursor:'pointer',textAlign:'center',fontFamily:'inherit'},mushafJuzName:{minWidth:0,fontSize:12.5,fontWeight:700,color:'var(--accent-ink)',whiteSpace:'nowrap'},mushafJuzPage:{minWidth:0,fontSize:11,fontWeight:600,color:'var(--accent-ink)',opacity:0.75,whiteSpace:'nowrap'},// 14.2f1 — النافذة والشريط ltr قسراً: موضعةٌ مطلقة بإزاحاتٍ فيزيائيّة صريحة، لا
// ترتيبَ flex ولا جهةَ فيض — فلا يقدر direction:rtl الوارث من memContainer أن يقلبها.
// والعربيّ يستعيد rtl داخل الخانة والصفحة، حيث يخصّه وحده.
// minHeight:0 — نفسُ عطل s.input الذي كلّفنا جلسةً: عنصرُ flex لا يتقلّص دونه.
pgViewport:{flex:1,minHeight:0,overflow:'hidden',position:'relative',touchAction:'pan-y',background:'var(--tint)',direction:'ltr'},pgStrip:{position:'absolute',top:0,left:0,right:0,bottom:0,willChange:'transform',direction:'ltr'},// 14.5 — لا حشوةَ رأسيّة: الورقةُ تملأ ما بين الرأس والشريط، فلا يبقى شريطُ لونٍ
// فوقها ولا تحتها. والحشوةُ الأفقيّةُ ٦ = مدى حلقات الإطار الخمس وزيادةُ شعرة،
// فالإطارُ يُرسم خارج صندوقه ولا يقصّه فيضُ الخانة.
pgSlot:{position:'absolute',top:0,bottom:0,width:'100%',boxSizing:'border-box',padding:'0 6px',direction:'rtl',display:'flex',flexDirection:'column',justifyContent:'center'},// maxWidth — صفحةُ المصحف لها نسبةٌ. بلا سقفٍ تتمدّد على الشاشة العريضة فتصير شريطاً.
// 14.5 — الإطارُ صار حلقاتِ ظلٍّ خالصةً بلا حافّة: الحافّةُ كانت تأكل ٢px من عرض
// السطر، والظلُّ لا يأكل شيئاً. والترتيبُ من الداخل: رفيعٌ ثمّ أبيضُ ثمّ غامق —
// هو منظرُ الأمس نفسُه حرفاً بحرف، لكنّه يُرسم خارج الصندوق فيُردّ العرضُ للنصّ.
// والحشوةُ الرأسيّة ٢٠ فوق و٢٠ تحت سواءً: كانت ١٢ و٢٠، فيهبط مركزُ الكتلة ٨px عن
// مركز الورقة. والـ٢٠ تحتُ مُبقاةٌ على حالها لأنّها خلوصُ المعيَّن، لا فراغٌ زائد.
pgPage:{height:'100%',width:'100%',maxWidth:560,marginLeft:'auto',marginRight:'auto',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center',background:'var(--white)',borderRadius:6,boxShadow:'0 0 0 1px var(--red-lift), 0 0 0 4px var(--white), 0 0 0 5px var(--red-deep)',padding:'20px 5px',overflow:'hidden',direction:'rtl'},// 51 -- the frame wrapper carries the ornaments so pgPage's child count stays exact.
pgFrame:{position:'relative',height:'100%',width:'100%',maxWidth:560,marginLeft:'auto',marginRight:'auto'},// Session 74 -- the flagged sheet only. Deliberately NOT added to pgFrame or pgPage: the
// fit measurement reads pgPage's clientHeight and its rows' clientWidth (index.html:5413,
// 5445), so pinning a ratio on the shared boxes would silently resize the drawn text on
// all 604 pages. The fallback keeps the old geometry exactly because these keys are unused
// by it. Width first, height from the ratio -- the page cannot re-flow or change shape.
// 75/B1 -- borderRadius was 6: with the inset gone the rounded white card read as a photograph
// pasted on the screen. The sheet is now square-edged and flush. This key is reached ONLY from
// the flagged branch of MushafSheet, so the fallback reader cannot see this change.
// 75/C -- the sheet is now the CROP WINDOW. Its ratio is the measured union box's ratio, not
// the viewBox's, and overflow:hidden is what does the cropping. position:relative anchors the
// oversized image inside it. The <img> is still an <img>: it is the security isolation and it
// does not change.
// 75/D -- the frame. It is a DIRECT child of the slot and it carries the three properties that
// used to sit on svgSheet -- width, aspectRatio, maxHeight -- so the ratio-versus-height
// behaviour is byte-for-byte the one that already shipped; only the element they sit on moved.
// overflow is left visible so the rules and the corner motifs can hang outside it.
svgFrame:{position:'relative',width:'100%',maxWidth:560,marginLeft:'auto',marginRight:'auto',aspectRatio:MUSHAF_CROP_AR,maxHeight:'100%'},// The outer rule, heavier, and the paper the whole band is painted on. The shadow lifts the
// page off the desk instead of letting it float in it. FIRST in DOM order, so this paper tone
// is painted behind the page image.
svgRuleOuter:{position:'absolute',top:-MUSHAF_FRAME_BAND,right:-MUSHAF_FRAME_BAND,bottom:-MUSHAF_FRAME_BAND,left:-MUSHAF_FRAME_BAND,border:MUSHAF_FRAME_OUTER+'px solid var(--red-deep)',background:MUSHAF_PAPER,boxShadow:'0 1px 2px rgba(18,50,122,0.10), 0 8px 24px rgba(18,50,122,0.12)',pointerEvents:'none'},// The inner rule, lighter, hanging just outside the breathing room.
svgRuleInner:{position:'absolute',top:-MUSHAF_FRAME_INNER_AT,right:-MUSHAF_FRAME_INNER_AT,bottom:-MUSHAF_FRAME_INNER_AT,left:-MUSHAF_FRAME_INNER_AT,border:MUSHAF_FRAME_INNER+'px solid var(--red-lift)',pointerEvents:'none'},// The crop window itself: it fills the frame exactly, and its overflow:hidden is what crops.
// The background is the paper tone, and a background is painted behind content by definition,
// so it is behind the page image and never over it.
svgSheet:{position:'absolute',top:0,right:0,bottom:0,left:0,background:MUSHAF_PAPER,overflow:'hidden'},// 75/C -- NOT object-fit: cover. Cover crops by ratio, blindly, and would cut letters on the
// pages whose ink reaches furthest. Instead the image is scaled by the viewBox-to-crop mapping
// and offset so the measured union box lands exactly on the wrapper's four edges:
//   viewBox x = MUSHAF_CROP_X0  ->  wrapper left edge      viewBox x = X1  ->  right edge
//   viewBox y = MUSHAF_CROP_Y0  ->  wrapper top edge       viewBox y = Y1  ->  bottom edge
// Width and height are scaled by the same mapping, so the <img> box keeps the SVG's own
// viewBox ratio (382.68/547.09) exactly. That matters: the pages carry
// preserveAspectRatio="xMidYMid meet", and because the box ratio still matches the viewBox
// ratio there is nothing for "meet" to letterbox. The mapping is exact, not approximate.
svgImg:{position:'absolute',display:'block',width:100*MUSHAF_VB_W/MUSHAF_CROP_W+'%',height:100*MUSHAF_VB_H/MUSHAF_CROP_H+'%',left:-100*MUSHAF_CROP_X0/MUSHAF_CROP_W+'%',top:-100*MUSHAF_CROP_Y0/MUSHAF_CROP_H+'%',pointerEvents:'none',userSelect:'none',WebkitUserSelect:'none'},pgMedal:{position:'absolute',left:'50%',bottom:4,transform:'translateX(-50%)',color:'var(--red-deep)',fontSize:11,fontWeight:700,lineHeight:1,pointerEvents:'none'},// السطر: عنصرُ flex أفقيّ. space-between يفرد ما بين الكلمات فيمتدّ من حافةٍ لحافة.
// fontSize و gap يُحقنان في الرسم — يُشتقّان من قياس أعرضِ سطرٍ في الصفحة.
pgLine:{display:'flex',flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',width:'100%',direction:'rtl',fontFamily:PG_FONT,lineHeight:PG_LINE_H,color:'var(--ink)',whiteSpace:'nowrap'},pgWord:{flexShrink:0,whiteSpace:'nowrap'},pgHeader:{fontFamily:"'Amiri', serif",fontSize:15,fontWeight:700,color:'var(--accent-ink)',textAlign:'center',background:'linear-gradient(180deg, var(--red-soft), var(--white))',borderTop:'1px solid var(--red-lift)',borderBottom:'1px solid var(--red-lift)',borderRadius:4,padding:'3px 0',margin:'2px 0'},pgBasmala:{fontFamily:"'Amiri Quran', 'Amiri', serif",color:'var(--accent-ink)',direction:'rtl',textAlign:'center',whiteSpace:'nowrap'},pgBlank:{minHeight:4},pgBar:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 14px',background:'var(--white)',borderTop:'1px solid var(--line)'},// direction:'ltr' — الحرفان › ‹ من المنعكسات ثنائيّة الاتّجاه (Bidi_Mirrored),
// فيقلبهما المتصفّح داخل سياق rtl ويشير كلٌّ منهما إلى عكس وجهته. العزلُ يوقف القلب.
pgNavBtn:{width:44,height:36,borderRadius:10,background:'var(--tint)',color:'var(--accent-ink)',border:'1px solid var(--line)',cursor:'pointer',fontSize:20,fontWeight:700,fontFamily:'inherit',lineHeight:1,direction:'ltr'},pgNavOff:{opacity:0.32,cursor:'default'},// S110 -- the reader chrome's type, and ONLY its type. Everything else about .ezmr-* lives in
// the stylesheet; these are numbers here so the reading-size preference scales them, which a
// px in a CSS rule cannot do.
ezmrTitle:{fontSize:15},ezmrNav:{fontSize:20},ezmrJump:{fontSize:13},// S111 -- THE ROLLBACK READER'S CHROME, repainted and not remeasured. ?madinaimg=0 draws its
// page as a FLEX CHILD of the same column, so these two bars' heights are inside the box the
// SVG paper is fitted to: 14+36+14+1 = 65 for the rail and 8+36+8+1 = 53 for the dock, and
// both were measured before this existed. Every geometric property below is the one the key it
// replaces carried -- display, padding, gap, border WIDTH, the 36px control height. What
// changed is paint: the navy gradient and the two base literals became istana tokens, read
// from the .ezhome scope the elements now carry. No !important anywhere; the legacy keys are
// simply not the ones the reader hands to its bars.
memHeaderFb:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',background:'var(--a3-surface)',borderBottom:'1px solid var(--a3-line)'},memTitleFb:{fontSize:18,fontWeight:800,color:'var(--a3-ink)',letterSpacing:'0.3px'},memBtnFb:{height:36,padding:'0 16px',borderRadius:12,background:'transparent',color:'var(--a3-ink)',border:'1px solid var(--a3-line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:14,fontWeight:600},pgBarFb:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 14px',background:'var(--a3-surface)',borderTop:'1px solid var(--a3-line)'},pgNavBtnFb:{width:44,height:36,borderRadius:10,background:'transparent',color:'var(--a3-ink)',border:'1px solid var(--a3-line)',cursor:'pointer',fontSize:20,fontWeight:700,fontFamily:'inherit',lineHeight:1,direction:'ltr'},pgMetaFb:{fontSize:13,fontWeight:600,color:'var(--a3-muted)'},pgMeta:{fontSize:13,fontWeight:600,color:'var(--muted)'},// 14.4 — غلافُ القفز: ارتفاعُه ٣٦ = ارتفاعُ زرّي التصفّح، فلا يتغيّر علوُّ الشريط بين اللافتة والخانة.
pgJumpWrap:{minWidth:128,height:36,display:'flex',alignItems:'center',justifyContent:'center'},pgJumpBtn:{background:'none',border:0,padding:0,cursor:'pointer',fontFamily:'inherit',lineHeight:1},pgJumpInput:{width:96,height:32,boxSizing:'border-box',textAlign:'center',fontSize:16,fontWeight:600,fontFamily:'inherit',color:'var(--ink)',background:'var(--page)',border:'1px solid var(--line)',borderRadius:10,padding:0,direction:'rtl'},// ===== 82: شريطُ الورد اليوميّ =====
// position absolute and NOT a flex child: `bottom` and the two safe-area paddings are
// supplied at the use site, and nothing here has any layout height in the reading column.
// pointerEvents on the wrapper is 'none' so the strip's margins never eat a swipe; the
// button itself takes them back, so only the pill is tappable.
wirdWrap:{position:'absolute',left:0,right:0,zIndex:5,display:'flex',justifyContent:'center',pointerEvents:'none',paddingTop:6,paddingLeft:'calc(14px + env(safe-area-inset-left, 0px))',paddingRight:'calc(14px + env(safe-area-inset-right, 0px))',boxSizing:'border-box'},wirdBtn:{pointerEvents:'auto',display:'flex',alignItems:'center',gap:8,maxWidth:'100%',minWidth:0,background:'var(--wird-pill)',border:'1px solid var(--line)',borderRadius:999,padding:'5px 12px',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 1px 6px rgba(0,0,0,0.10)'},wirdText:{fontSize:12.5,fontWeight:700,color:'var(--accent-ink)',whiteSpace:'nowrap'},wirdTrack:{width:72,height:4,borderRadius:999,background:'var(--tint)',overflow:'hidden',flexShrink:0,display:'block'},wirdFill:{display:'block',height:'100%',borderRadius:999,background:'var(--red)'},wirdBack:{position:'fixed',inset:0,zIndex:9,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center',padding:18,direction:'rtl'},wirdSheet:{width:'100%',maxWidth:330,background:'var(--white)',border:'1px solid var(--line)',borderRadius:16,padding:14,display:'flex',flexDirection:'column',gap:12,boxSizing:'border-box'},wirdSheetHead:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10},wirdSheetTitle:{fontSize:16,fontWeight:800,color:'var(--ink)'},wirdChips:{display:'flex',flexWrap:'wrap',gap:8},wirdChip:{minWidth:46,height:36,borderRadius:10,background:'var(--tint)',color:'var(--accent-ink)',border:'1px solid var(--line)',cursor:'pointer',fontSize:15,fontWeight:700,fontFamily:'inherit',padding:'0 12px'},wirdChipOn:{background:'var(--red)',color:'var(--on-accent)',borderColor:'var(--red-deep)'},wirdFree:{display:'flex',alignItems:'center',gap:8},wirdNone:{height:36,borderRadius:10,background:'none',color:'var(--muted)',border:'1px solid var(--line)',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:'inherit'},memContainer:{height:'100vh',height:'100dvh',display:'flex',flexDirection:'column',background:'var(--page)',direction:'rtl'},memHeader:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',background:'linear-gradient(180deg, var(--red) 0%, var(--red-deep) 100%)',borderBottom:'1px solid rgba(255,255,255,0.15)'},memTitle:{fontSize:18,fontWeight:800,color:'var(--on-accent)',letterSpacing:'0.3px'},memBackBtn:{height:36,padding:'0 16px',borderRadius:12,background:'rgba(255,255,255,0.12)',color:'var(--on-accent)',border:'1px solid rgba(255,255,255,0.2)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:14,fontWeight:600},memHeading:{fontSize:16,fontWeight:700,color:'var(--ink)',textAlign:'center',padding:'14px 16px 6px'},memLoading:{fontSize:14,color:'var(--muted)',textAlign:'center',padding:8},memList:{flex:1,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:8,padding:'8px 14px 16px',alignContent:'start'},memRow:{display:'flex',alignItems:'center',gap:8,minHeight:52,padding:'8px 10px',borderRadius:14,background:'var(--white)',border:'1px solid var(--line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',textAlign:'right'},memRowActive:{background:'var(--red)',borderColor:'var(--red)'},memRowNum:{flexShrink:0,minWidth:32,height:32,borderRadius:10,background:'var(--red-soft)',color:'var(--red)',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'},memRowNameWrap:{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:1,overflow:'hidden'},memRowName:{fontSize:15,fontWeight:600,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},memRowCount:{fontSize:11,color:'var(--muted)',fontWeight:500},memRowReveal:{flexShrink:0,fontSize:11,fontWeight:600,color:'var(--red)',background:'var(--red-soft)',borderRadius:8,padding:'2px 8px',whiteSpace:'nowrap'},memStartBar:{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'var(--white)',borderTop:'1px solid var(--line)'},memStartLabel:{fontSize:14,fontWeight:600,color:'var(--ink)',whiteSpace:'nowrap'},memAyahSelect:{flex:1,height:40,borderRadius:12,border:'2px solid var(--line)',background:'var(--page)',color:'var(--ink)',fontFamily:'var(--ez-ui-font)',fontSize:15,padding:'0 10px'},memStartBtn:{height:40,padding:'0 22px',borderRadius:12,background:'linear-gradient(135deg, var(--red) 0%, var(--red-deep) 100%)',color:'var(--on-accent)',border:'none',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:15,fontWeight:700},memSubBar:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 16px',background:'var(--red-soft)',borderBottom:'1px solid var(--line)'},memSurahTitle:{fontSize:16,fontWeight:700,color:'var(--ink)'},memRangeBadge:{fontSize:12,fontWeight:600,color:'var(--red)',background:'var(--white)',borderRadius:8,padding:'3px 10px'},memChangeBtn:{height:34,padding:'0 14px',borderRadius:10,background:'transparent',color:'var(--red)',border:'1px solid rgba(29,78,216,0.35)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:13,fontWeight:600},memToggleRow:{display:'flex',alignItems:'center',gap:8,padding:'10px 16px'},memToggleLabel:{fontSize:14,fontWeight:600,color:'var(--muted)'},memGranBtn:{height:34,padding:'0 18px',borderRadius:10,background:'var(--tint)',color:'var(--red)',border:'1px solid var(--line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:14,fontWeight:600},memGranBtnActive:{background:'var(--red)',color:'var(--on-accent)',borderColor:'var(--red)'},memDrillArea:{flex:1,overflowY:'auto',padding:'12px 18px 20px',display:'flex',flexDirection:'column',gap:14},memDrillText:{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'center',direction:'rtl',lineHeight:2.2},memUnit:{display:'inline-flex',alignItems:'center',gap:6},memAyahBadge:{minWidth:26,height:26,borderRadius:8,background:'var(--red-soft)',color:'var(--red)',fontSize:12,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--ez-ui-font)'},memWord:{fontFamily:"'Amiri', 'Tajawal', serif",fontSize:26,color:'var(--ink)',lineHeight:2},// Layer B — سمِّعني word states: wrong (red), not-yet-reached (dim), and the soft-framing hint.
memWordWrong:{fontFamily:"'Amiri', 'Tajawal', serif",fontSize:26,color:'#C0392B',fontWeight:600,lineHeight:2},memWordPending:{fontFamily:"'Amiri', 'Tajawal', serif",fontSize:26,color:'var(--nav-off)',lineHeight:2},memReciteHint:{fontSize:13,color:'var(--muted)',textAlign:'center',padding:'0 8px 6px',lineHeight:1.7},memPlaceholder:{fontFamily:'var(--ez-ui-font)',fontSize:18,color:'var(--nav-off)',background:'var(--tint)',borderRadius:8,padding:'2px 14px',letterSpacing:'2px'},memMsg:{fontSize:15,fontWeight:700,color:'var(--red)',textAlign:'center'},memControls:{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderTop:'1px solid var(--line)',background:'var(--white)'},memRevealBtn:{flex:1,height:50,borderRadius:14,background:'linear-gradient(135deg, var(--red) 0%, var(--red-deep) 100%)',color:'var(--on-accent)',border:'none',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:17,fontWeight:700},memListenBtn:{height:50,padding:'0 16px',borderRadius:14,background:'var(--tint)',color:'var(--red)',border:'1px solid var(--line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)',fontSize:14,fontWeight:600},memResetBtn:{width:50,height:50,borderRadius:14,background:'var(--tint)',color:'var(--red)',border:'1px solid var(--line)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},// ===== شاشة المكالمة — S113 ISTANA =====
// THE DARK ROOM IS GONE. This screen was the last place in the file that painted its own
// 160deg navy-to-black gradient across the whole viewport and then wrote white text on it --
// which is why every label here was a literal rgba(255,255,255,…) and why the mute pill had to
// be excused as "light on purpose" in the dark-mode gate. The page is --page now, plain white
// in light and the identity's deep navy in dark, and every value below is a token. Not one
// literal colour is left on this screen.
//
// The two controls came down from 76px to 56px: a 76px round button is a floating circle, and
// the room is a composition now rather than a target field. They keep their fixed square, so
// the text-size preference cannot grow a glyph out of a box that cannot grow with it.
callContainer:{height:'100vh',height:'100dvh',display:'flex',flexDirection:'column',background:'var(--page)',direction:'rtl'},// `callTopLabel` and `callCenter` are GONE with the slab they belonged to: the first was the
// white caption written on the navy gradient, the second the free-floating centre column. The
// rail and the stage that replaced them are .ezcall-rail-inner and .ezcall-stage, and they
// declare no colour of their own. Deleting the keys rather than orphaning them is deliberate:
// a caption nobody can spread cannot come back on a background nobody can paint.
// the emblem is an ARCH now, not a circle -- the ottoman note kept to a curve on a bounded
// element, never an ornament laid over the room.
callAvatarWrap:{position:'relative',width:152,height:172,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'},callRing:{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:'60% 60% 14% 14%',border:'3px solid var(--a3-blue)'},callAvatar:{width:108,height:122,borderRadius:'60% 60% 14% 14%',background:'var(--a3-ice)',border:'1px solid var(--a3-line)',display:'flex',alignItems:'center',justifyContent:'center'},callStatusLabel:{color:'var(--a3-ink)',fontSize:22,fontWeight:700,fontFamily:"'Amiri', 'Tajawal', serif",marginTop:6},callSubLabel:{color:'var(--a3-muted)',fontSize:14},callHint:{color:'var(--a3-muted)',fontSize:12.5,lineHeight:1.7,maxWidth:'100%',overflowWrap:'anywhere'},// Call-screen failure banner. It reads the SAME warning tokens the chat banner does now that
// the room is no longer a dark slab -- one warning surface, theme-aware, in both screens.
callErrorBanner:{width:'100%',maxWidth:420,margin:'6px 0 0',padding:'10px 14px',background:'var(--warn-bg)',border:'1px solid var(--warn-line)',borderRadius:12,color:'var(--warn-ink)',fontSize:13,lineHeight:1.6,fontWeight:500,textAlign:'center'},callControls:{display:'flex',gap:16,alignItems:'center',justifyContent:'center'},callMuteBtn:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,width:56,height:56,borderRadius:'18px 18px 14px 14px',background:'var(--a3-ice)',border:'1px solid var(--a3-line)',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},callEndBtn:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,width:56,height:56,borderRadius:'18px 18px 14px 14px',background:'var(--red-lift)',border:'1px solid var(--red-lift)',cursor:'pointer',fontFamily:'var(--ez-ui-font)'},callBtnLabel:{fontSize:11.5,fontWeight:700,color:'var(--a3-blue)'}};// ============================================================
// S99 — تكبير الخط، مركزيًّا وبمرّة واحدة (the text-size mechanism)
// ============================================================
// EVERY text size in this app is an inline number: `fontSize: 15` becomes `font-size: 15px`, and
// an inline style outranks any stylesheet rule that is not !important. So a stylesheet cannot
// scale this UI, and a `!important` sheet could only flatten every size to ONE value — which is
// not a text-size setting, it is a text-size demolition.
//
// The mechanism is therefore ONE pass over the styles object, here, before a single component has
// read it: each numeric fontSize becomes `calc(Npx * var(--ez-fs, 1))`. The number is preserved
// exactly, so at --ez-fs:1 the rendered size is byte-identical to what shipped; the preference
// then moves ONE custom property on :root and the whole interface follows. No component changed,
// no render site touched, no CSS zoom, and nothing to keep in sync.
//
// TWO EXCLUSIONS, both structural rather than aesthetic:
//   * a key that declares a NUMERIC width or height is a fixed-size control — a 44px round button,
//     a 76px call button, a swatch. Growing the glyph inside a box that cannot grow is how a
//     label escapes its button, so those keep their size.
//   * THE READER IS EXCLUDED BY SCOPE, and the exclusion is stated rather than assumed. The
//     Uthmani lines are built in JS at raw px (PG_BASE_FS and the per-page fit), so a page's
//     TEXT was never reachable from this object -- but the page surface and the reader bar are
//     ordinary style keys and they were being rewritten with the rest. MEASURED before the
//     exclusion existed: `.ezmr-title` rendered 15px / 17.1px / 19.2px across the three steps.
//     The fit divides by pgPage's element-child count and measures its rows, so anything that
//     grows inside that box moves the boundary the layout gate attests.
//
//     THE EXCLUSION IS NOT A LIST OF KEYS. Every size here still becomes a calc() -- the reader
//     is taken out one level down, by resetting `--ez-fs` to 1 on the reader's own root
//     (`.ezmr-scope`), so every calc() inside it evaluates at its original number. A scope
//     covers whatever is rendered inside it, including anything added later; a list of key
//     names covers only what someone remembered to add to it. The surah INDEX is outside that
//     scope and still scales, which is right: it is a list of names with no fit to break.
// AND IT RUNS ONLY FOR SOMEONE WHO ASKED FOR IT. Measured, interleaved against 7e5c608: making
// every size a calc() unconditionally cost +0.06 ms per keystroke in a 120-turn thread (0.41 ->
// 0.47 ms amortised over a 200-keystroke burst, past the 0.1 ms clamp that makes a single-keystroke
// median unreadable) and +0.5 ms on opening the menu — because `15px` is a trivial parse and
// `calc(15px * var(--ez-fs,1))` is not, and the menu re-parses fifty of them.
//
// Nobody who never opens this setting should pay for it. So the pass is CONDITIONAL: at the
// default size the styles object keeps its numbers and is byte-for-byte the object that shipped,
// which is why the default path measures identically to the commit before this phase. It is run
// once, at load, only when the stored preference is already a larger size, and once more the
// moment someone chooses one. The chat tree is unmounted while الإعدادات is on screen, so the
// switch is picked up when the chat mounts again — no forced re-render, no stale memoised bubble.
const EZIK_FS_SCALES={normal:1,large:1.14,xlarge:1.28};function ezikScaleStyleObject(obj){if(!obj||typeof obj!=='object')return;const fixed=typeof obj.width==='number'||typeof obj.height==='number';for(const k of Object.keys(obj)){const v=obj[k];if(v&&typeof v==='object'){ezikScaleStyleObject(v);continue;}if(k==='fontSize'&&typeof v==='number'&&!fixed){obj[k]='calc('+v+'px * var(--ez-fs, 1))';}}}let ezikStylesAreScalable=false;function ezikEnsureScalableStyles(){if(ezikStylesAreScalable)return false;ezikStylesAreScalable=true;Object.keys(s).forEach(k=>ezikScaleStyleObject(s[k]));return true;}// The boot script has already put data-ez-fs on <html> from the stored preference, so this reads
// the decision that was made before the first paint rather than opening the store a second time.
(function(){try{const chosen=document.documentElement.getAttribute('data-ez-fs');if(chosen&&chosen!=='normal')ezikEnsureScalableStyles();}catch(e){}})();function ErrorBoundary(props){React.Component.call(this,props);this.state={error:null,componentStack:''};this.retry=this.retry.bind(this);this.copyDetails=this.copyDetails.bind(this);}ErrorBoundary.prototype=Object.create(React.Component.prototype);ErrorBoundary.prototype.constructor=ErrorBoundary;ErrorBoundary.getDerivedStateFromError=function(error){return{error:error};};ErrorBoundary.prototype.componentDidCatch=function(error,info){this.setState({error:error,componentStack:info&&info.componentStack?info.componentStack:''});};ErrorBoundary.prototype.retry=function(){this.setState({error:null,componentStack:''});};ErrorBoundary.prototype.errorParts=function(){var error=this.state.error;var message='';var stack='';try{message=error&&typeof error.message!=='undefined'?String(error.message):String(error||'');}catch(ignored){message='(unavailable)';}try{stack=error&&error.stack?String(error.stack):'';}catch(ignored){stack='(unavailable)';}if(this.state.componentStack){stack+=(stack?'\n':'')+String(this.state.componentStack);}return{message:message,stack:stack};};ErrorBoundary.prototype.legacyCopy=function(text){var area=null;try{area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','readonly');area.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;';(document.body||document.documentElement).appendChild(area);area.focus();area.select();if(area.setSelectionRange)area.setSelectionRange(0,text.length);var copied=document.execCommand('copy');if(area.parentNode)area.parentNode.removeChild(area);return!!copied;}catch(ignored){try{if(area&&area.parentNode)area.parentNode.removeChild(area);}catch(cleanupIgnored){}return false;}};// ── ITEM 103: WHAT HAPPENED BEFORE REACT EXISTED, MADE COPYABLE ────────────────────────────
// The boundary can only ever describe a failure it caught, and it catches nothing that happened
// before it was mounted. Every boot failure -- the ones that matter most, because they leave a
// blank page and no way to say what went wrong -- is therefore invisible to `errorParts` above.
//
// The pre-<body> catcher DID witness those, and it now keeps them (see `window.__ezikDiag`), so
// «انسخ التفاصيل» carries them out with the React error instead of the React error alone. This
// is the whole of the connection: the panel's own words, its retry button and its layout are
// untouched -- only what the clipboard receives grows.
//
// It cannot throw and it cannot be required: a page where the catcher never ran, or where the
// store was replaced by something else, simply contributes nothing and the copy behaves exactly
// as it did before.
ErrorBoundary.prototype.preBootDetails=function(){try{var diag=window.__ezikDiag;if(!diag||typeof diag.text!=='function')return'';var body=diag.text();if(!body)return'';var n=typeof diag.count==='function'?diag.count():0;return'\n\nPRE-BOOT DIAGNOSTIC ('+String(n)+' of '+String(diag.max)+')\n'+body;}catch(ignored){return'';}};ErrorBoundary.prototype.copyDetails=function(){var parts=this.errorParts();var nav=window.navigator;var userAgent=nav&&nav.userAgent?String(nav.userAgent):'';var text=parts.message+'\n'+parts.stack+'\n'+userAgent+this.preBootDetails();try{if(nav&&nav.clipboard&&typeof nav.clipboard.writeText==='function'){var operation=nav.clipboard.writeText(text);if(operation&&typeof operation.then==='function'){var self=this;operation.then(function(){},function(){self.legacyCopy(text);});}}else{this.legacyCopy(text);}}catch(ignored){this.legacyCopy(text);}};ErrorBoundary.prototype.render=function(){if(!this.state.error)return this.props.children;var parts=this.errorParts();return React.createElement('main',{role:'alert',dir:'rtl',style:{minHeight:'100vh',height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:'var(--page)',color:'var(--ink)',fontFamily:'var(--ez-ui-font)'}},React.createElement('section',{style:{width:'100%',maxWidth:680,padding:24,borderRadius:18,border:'1px solid var(--line)',background:'var(--white)',color:'var(--ink)',boxShadow:'0 12px 40px rgba(0,0,0,0.12)'}},React.createElement('h1',{style:{margin:'0 0 20px',fontSize:22,lineHeight:1.5}},'\u062a\u0639\u0630\u0651\u0631\u0020\u0639\u0631\u0636\u0020\u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629'),React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:10}},React.createElement('button',{type:'button',onClick:this.retry,style:{minHeight:44,padding:'10px 16px',border:'1px solid var(--red)',borderRadius:12,background:'var(--red)',color:'var(--on-accent)',cursor:'pointer',fontWeight:700}},'\u0623\u0639\u062f\u0020\u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629'),React.createElement('button',{type:'button',onClick:this.copyDetails,style:{minHeight:44,padding:'10px 16px',border:'1px solid var(--line)',borderRadius:12,background:'var(--page)',color:'var(--ink)',cursor:'pointer',fontWeight:700}},'\u0627\u0646\u0633\u062e\u0020\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644')),React.createElement('pre',{dir:'ltr',style:{margin:'20px 0 0',padding:12,borderRadius:10,overflow:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere',textAlign:'left',background:'var(--page)',color:'var(--ink)',fontFamily:'monospace',fontSize:12,lineHeight:1.5}},parts.message+'\n\n'+parts.stack)));};const root=ReactDOM.createRoot(document.getElementById('root'));root.render(React.createElement(ErrorBoundary,null,React.createElement(App),React.createElement(EzikPrecacheNotice)));
