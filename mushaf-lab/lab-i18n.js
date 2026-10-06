// mushaf-lab/lab-i18n.js -- THE READER'S INTERFACE LANGUAGE (item 74). The lab is its own document, so it reads the same stored choice the app and the games
// read (the interface-language key, assembled here and not named whole: the guard i18nui holds its literal to three files) and shows the FRAME of the reader --
// its buttons, headings, messages and instructions -- in that language. It translates nothing else: the Mushaf (its words, its page images, its surah names),
// the tafsir texts, the published translations, the reciters' and the tafsir books' names are stored content and stay exactly as they are.
// An exact Arabic-text -> English-text dictionary on text nodes and accessible names, a few patterns for the strings that carry numbers, and nothing that reads
// the network. A language with no row is Arabic and nothing below runs.
(function () {
  'use strict';
  var EN = {
    // ---- the page itself
    'مصحف عزك — المختبر': 'Ezik Mushaf — Lab',
    'يُحمَّل المصحف…': 'Loading the Mushaf…',
    'تعذّر تحميل بيانات المصحف. تحقّقْ من الاتصال ثمّ أعِدْ فتحَ الصفحة.': 'The Mushaf data could not be loaded. Check the connection and open the page again.',
    'ضغطةٌ قصيرةٌ على الصفحة تُخفي القوائمَ أو تُظهرها. واضغطْ مطوّلًا على آيةٍ لتفتحَ قائمتَها: التفسير والتلاوة والنسخ وغيرها. واسحبْ يمينًا للصفحة التالية.': 'A short tap on the page hides or shows the menus. Press and hold on an ayah to open its menu: tafsir, recitation, copy and more. Swipe right for the next page.',
    'فهمت': 'Got it',
    'وضعُ التحديد: اضغطْ مطوّلًا على كلمةٍ واسحبْ، ثمّ انسخْ.': 'Selection mode: press and hold on a word and drag, then copy.',
    'إنهاء': 'Done',
    'الرجوع إلى عزك': 'Back to Ezik',
    'علامة على الصفحة': 'Bookmark this page',
    'التلاوة': 'Recitation',
    'الآية السابقة': 'Previous ayah',
    'الآية التالية': 'Next ayah',
    'السابقة': 'Previous',
    'التالية': 'Next',
    'إيقاف مؤقت': 'Pause',
    'متابعة': 'Resume',
    'الإعدادات': 'Settings',
    'القوائم': 'Menus',
    'الفهرس': 'Index',
    'البحث': 'Search',
    'انتقال': 'Go to',
    'المحفوظات': 'Saved',
    // ---- the ayah sheet
    'تشغيل من هنا': 'Play from here',
    'نسخ': 'Copy',
    'مشاركة': 'Share',
    'تحديد النصّ': 'Select text',
    'تحديد نطاق': 'Select a range',
    'علامة': 'Bookmark',
    'إزالة العلامة': 'Remove the bookmark',
    'مفضّلة': 'Favourite',
    'في المفضّلة': 'In favourites',
    'التفسير': 'Tafsir',
    'الترجمة': 'Translation',
    'وقفات': 'Reflections',
    'ملاحظتي': 'My note',
    'اختيار المفسّرين': 'Choose the tafsirs',
    'أصغر': 'Smaller',
    'أكبر': 'Larger',
    'يُحمَّل…': 'Loading…',
    'لم تخترْ مفسّرًا بعد.': 'You have not chosen a tafsir yet.',
    'اللغة': 'Language',
    'اختر ترجمة': 'Choose a translation',
    'اخترْ لغةً لتظهرَ الترجمة.': 'Choose a language to show the translation.',
    'ترجمة': 'Translation',
    'تعذّر الاتصال بمصدر النصّ. حاولْ لاحقًا.': 'The text source could not be reached. Try again later.',
    'لا يوجد في هذا المصدر نصٌّ لهذه الآية.': 'This source has no text for this ayah.',
    'نوعُ الوقفة': 'Kind of reflection',
    'تدبّر': 'Contemplation',
    'تساؤل': 'Question',
    'وقفة': 'Pause',
    'فائدة': 'Benefit',
    'اكتبْ وقفتَك. تُحفَظ على هذا الجهاز.': 'Write your reflection. It is kept on this device.',
    'حفظ الوقفة': 'Save the reflection',
    'وقفاتُ الآيةِ في المفضّلة': 'Favourite this ayah\'s reflections',
    'حفظُ هذه الوقفاتِ في المفضّلة': 'Save these reflections to favourites',
    'وقفاتي على هذه الآية': 'My reflections on this ayah',
    'لم تكتبْ وقفةً على هذه الآيةِ بعد.': 'You have not written a reflection on this ayah yet.',
    'ملاحظتك على هذه الآية. تُحفَظ على هذا الجهاز.': 'Your note on this ayah. It is kept on this device.',
    'حفظ': 'Save',
    'حذف': 'Delete',
    'تم': 'Done',
    'تراجع': 'Undo',
    'تعذّر الحفظ': 'Saving failed',
    'حُفظت الملاحظة': 'The note was saved',
    'حُذفت الملاحظة': 'The note was deleted',
    'حُفظت الوقفة': 'The reflection was saved',
    'حُذفت الوقفة': 'The reflection was deleted',
    'حُفظت العلامة': 'The bookmark was saved',
    'أُزيلت العلامة': 'The bookmark was removed',
    'حُذفت العلامة': 'The bookmark was deleted',
    'أُضيفت إلى المفضّلة': 'Added to favourites',
    'أُزيلت من المفضّلة': 'Removed from favourites',
    'اضغطْ الآن على آخرِ آيةٍ في النطاق': 'Now tap the last ayah of the range',
    'نُسخت الآية': 'The ayah was copied',
    'نُسخت الآيات': 'The ayahs were copied',
    'تعذّر النسخ على هذا الجهاز': 'Copying is not possible on this device',
    'المشاركة غير متاحة هنا، فنُسخ النصّ مع الرابط': 'Sharing is not available here, so the text was copied with the link',
    'تعذّرت المشاركة': 'Sharing failed',
    'تظهرُ التفاسيرُ المختارةُ تحتَ كلِّ آيةٍ بهذا الترتيب.': 'The chosen tafsirs appear under every ayah in this order.',
    'تشغيل النطاق': 'Play the range',
    'علامة على أوّله': 'Bookmark its start',
    'القائمة': 'Menu',
    'تشغيل': 'Play',
    // ---- saved
    'العلامات': 'Bookmarks',
    'المفضّلة': 'Favourites',
    'الملاحظات': 'Notes',
    'وقفاتي': 'My reflections',
    'الأخيرة': 'Recent',
    'النسخ الاحتياطي': 'Backup',
    'الوسوم': 'Tags',
    'بلا وسم': 'No tag',
    'الكل': 'All',
    'الترتيب: الأحدث': 'Order: newest',
    'الترتيب: حسب المصحف': 'Order: Mushaf order',
    'التجميع بالوسوم': 'Group by tags',
    'إدارة الوسوم': 'Manage tags',
    'إزالة': 'Remove',
    'لا علامات بعد. اضغطْ على آيةٍ ثمّ «علامة»، أو ضعْ علامةً على هذه الصفحة.': 'No bookmarks yet. Press an ayah and then “Bookmark”, or bookmark this page.',
    'لا شيءَ في المفضّلة بعد.': 'Nothing in favourites yet.',
    'لا ملاحظات بعد.': 'No notes yet.',
    'لا وقفات.': 'No reflections.',
    'ابحثْ في وقفاتك': 'Search your reflections',
    'لم تفتحْ صفحاتٍ بعد.': 'You have not opened any pages yet.',
    'كلُّ المحفوظاتِ على هذا الجهازِ فقط. احفظْ نسخةً لتنقلَها إلى جهازٍ آخر.': 'Everything saved is on this device only. Save a copy to move it to another device.',
    'حفظ نسخة احتياطية': 'Save a backup',
    'استعادة من نسخة': 'Restore from a backup',
    'تصدير العلامات جدولًا': 'Export the bookmarks as a table',
    'وسمٌ جديد': 'New tag',
    'مثلًا: للحفظ': 'For example: to memorise',
    'لا وسوم بعد.': 'No tags yet.',
    'حُفظت النسخة الاحتياطية': 'The backup was saved',
    'ستحلُّ النسخةُ محلَّ المحفوظاتِ الحاليّةِ على هذا الجهاز. هل تتابع؟': 'The backup will replace what is saved on this device now. Continue?',
    'استُعيدت النسخة': 'The backup was restored',
    'الملفُّ ليس نسخةً احتياطيّةً من هذه الصفحة': 'The file is not a backup of this page',
    'صُدِّرت العلامات': 'The bookmarks were exported',
    'النوع': 'Type',
    'السورة': 'Surah',
    'الآية': 'Ayah',
    'الصفحة': 'Page',
    'التاريخ': 'Date',
    'حُفظت علامة الصفحة': 'The page bookmark was saved',
    'أُزيلت علامة الصفحة': 'The page bookmark was removed',
    // ---- index, go, search
    'السور': 'Surahs',
    'الأجزاء والأحزاب': 'Juz and hizb',
    'الأحزاب والأرباع': 'Hizb and quarters',
    'مكّيّة': 'Meccan',
    'مدنيّة': 'Medinan',
    'الانتقال': 'Go to',
    'رقم الصفحة': 'Page number',
    'اذهبْ إلى الصفحة': 'Go to the page',
    'اذهبْ إلى الآية': 'Go to the ayah',
    'آخرُ صفحةٍ قرأتَها': 'The last page you read',
    'البحث في القرآن': 'Search the Quran',
    'اكتبْ كلمةً أو أكثر': 'Type one word or more',
    // ---- settings
    'المظهر': 'Appearance',
    'تلقائي': 'Automatic',
    'نهاري': 'Day',
    'ليلي': 'Night',
    'سطوعُ الصفحةِ في الوضع الليلي': 'Page brightness in night mode',
    'تباينُ الصفحةِ في الوضع الليلي': 'Page contrast in night mode',
    'لونُ الخلفية': 'Background colour',
    'أخضرُ هادئ': 'Calm green',
    'رمليّ': 'Sand',
    'رماديّ': 'Grey',
    'نوعُ صفحةِ المصحف': 'Kind of Mushaf page',
    'المطبوعة': 'Printed',
    'المرسومة': 'Drawn',
    'العرض': 'Display',
    'صفحتانِ متجاورتانِ في الشاشاتِ العريضة': 'Two facing pages on wide screens',
    'تلوينُ الآياتِ المعلَّمة': 'Colour the bookmarked ayahs',
    'حجمُ خطِّ التفسيرِ والترجمة': 'Font size of the tafsir and translation',
    'القارئ': 'Reciter',
    'دونَ اتّصال': 'Offline',
    'نزّلْ صفحاتِ جزءٍ أو المصحفَ كلَّه، أو ترجمةً أو تفسيرًا أو تلاوةَ سورة، فتفتحُها بعدَها دونَ إنترنت.': 'Download the pages of a juz or of the whole Mushaf, or a translation, a tafsir or the recitation of a surah, and open them afterwards without the internet.',
    'التنزيلات': 'Downloads',
    'إظهارُ الإرشاد': 'Show the guide',
    'صفحةُ مختبرٍ خارجَ عزك. صورُ الصفحات: مصحفُ المدينة النبويّة برواية حفص عن عاصم، مجمّعُ الملك فهد لطباعة المصحف الشريف. نصُّ الآياتِ هو النصُّ المعتمَدُ في عزك. التفاسير من مجموعة «tafsir_api» المفتوحة، والترجمات من «quran-api»، والتلاوات من «EveryAyah».': 'A lab page outside Ezik. The page images: the Madinah Mushaf, in the narration of Hafs from Asim, King Fahd Complex for the Printing of the Holy Quran. The text of the ayahs is the text Ezik relies on. The tafsirs are from the open “tafsir_api” collection, the translations from “quran-api” and the recitations from “EveryAyah”.',
    // ---- recitation settings
    'إعداداتُ التلاوة': 'Recitation settings',
    'السرعة': 'Speed',
    'تكرارُ كلِّ آية': 'Repeat each ayah',
    'تكرارُ النطاقِ كاملًا': 'Repeat the whole range',
    'النطاق': 'Range',
    'من سورة': 'From surah',
    'من آية': 'From ayah',
    'إلى سورة': 'To surah',
    'إلى آية': 'To ayah',
    'بلا نهاية': 'Without end',
    'اخترْ': 'Choose',
    'انتهت التلاوة': 'The recitation has ended',
    'تعذّر تشغيلُ التلاوة. تحقّقْ من الاتصال أو غيّرِ القارئ.': 'The recitation could not be played. Check the connection or change the reciter.',
    // ---- downloads
    'صفحات المصحف': 'Mushaf pages',
    'المصحف كاملًا': 'The whole Mushaf',
    'تنزيل الترجمة': 'Download the translation',
    'تنزيل التفسير': 'Download the tafsir',
    'تنزيل التلاوة': 'Download the recitation',
    'على هذا الجهاز': 'On this device',
    'يُقرأ المخزن…': 'Reading the storage…',
    'يُحسَبُ الحجم…': 'Working out the size…',
    'اخترْ ترجمةً أوّلًا.': 'Choose a translation first.',
    'اخترْ تفسيرًا أوّلًا.': 'Choose a tafsir first.',
    'تعذّرت قراءةُ جدولِ الأحجام. تحقّقْ من الاتصال ثمّ أعِدِ المحاولة.': 'The size table could not be read. Check the connection and try again.',
    'هذا المتصفّحُ لا يسمحُ بالتخزينِ للاستخدامِ دونَ اتّصال.': 'This browser does not allow storage for offline use.',
    'تعذّر قياسُ الحجم، فلم يبدأ التنزيل. تحقّقْ من الاتصال ثمّ أعِدِ المحاولة.': 'The size could not be measured, so the download did not start. Check the connection and try again.',
    'لا يُعرَفُ حجمُ هذا المصدر، فلا يبدأ تنزيلُه.': 'The size of this source is unknown, so its download does not start.',
    'ابدأ التنزيل': 'Start the download',
    'إلغاء': 'Cancel',
    'إيقاف': 'Stop',
    'أُوقف التنزيل': 'The download was stopped',
    'أُوقف التنزيل. ما نُزِّل يبقى، ويُكمَلُ الباقي إذا ضغطتَ التنزيلَ مرّةً أخرى.': 'The download was stopped. What was downloaded stays, and the rest is completed if you press download again.',
    'انتهى.': 'Finished.',
    'هذا كلُّه منزَّلٌ على الجهاز.': 'All of this is already downloaded to the device.',
    'لم تنزّلْ شيئًا بعد.': 'You have not downloaded anything yet.',
    'تعذّرت قراءةُ المخزن.': 'The storage could not be read.',
    'حذفُ كلِّ التنزيلات': 'Delete all downloads',
    'أوقفِ التنزيلَ الجاريَ أوّلًا': 'Stop the running download first',
    'ستُحذَفُ كلُّ التنزيلاتِ من هذا الجهاز. هل تتابع؟': 'All downloads will be deleted from this device. Continue?',
    'حُذف': 'Deleted',
    'هذا المتصفّحُ لا يدعمُ التنزيلَ للاستخدامِ دونَ اتّصال': 'This browser does not support downloading for offline use',
    'امتلأت المساحة': 'The storage is full',
    'الشبكة': 'The network',
    'المخزن': 'The storage',
    'تعذّر فتحه': 'could not be opened',
    'لا يُعرَف على هذا المتصفّح': 'Not known on this browser',
    'ملفّ الترجمة': 'Translation file',
    'البسملة': 'The basmalah',
    'مصحف عزك': 'Ezik Mushaf'
  };
  var ROWS = { ar: { strings: null }, en: { strings: EN, lang: 'en' } };
  var code = 'ar';
  try { var k = localStorage.getItem(['ezik', 'ui', 'lang', 'v1'].join('_')); if (Object.prototype.hasOwnProperty.call(ROWS, k)) code = k; } catch (e) {}
  var row = ROWS[code];
  if (!row.strings) return;
  try { document.documentElement.setAttribute('lang', row.lang); document.documentElement.setAttribute('data-ez-lab-lang', row.lang); } catch (e) {}
  // THE FRAME READS LEFT TO RIGHT, THE MUSHAF DOES NOT: the page area keeps its direction (the pages, their order and the Arabic words are right to left),
  // the menus, sheets, bars and messages that now hold English are laid out from the left.
  try {
    var st = document.createElement('style');
    st.textContent = 'html[data-ez-lab-lang] #sheet,html[data-ez-lab-lang] .nav,html[data-ez-lab-lang] .toast,html[data-ez-lab-lang] .hint,html[data-ez-lab-lang] .selbar,html[data-ez-lab-lang] .player,html[data-ez-lab-lang] .top{direction:ltr;text-align:left}'
      + 'html[data-ez-lab-lang] #sheet select,html[data-ez-lab-lang] #sheet option{direction:ltr}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  var NUM = '([0-9٠-٩]+)';
  function L(d) { return String(d).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); }); }
  var PATTERNS = [
    [new RegExp('^علامة على الصفحة ' + NUM + '$'), function (m) { return 'Bookmark page ' + L(m[1]); }],
    [new RegExp('^إزالة علامة الصفحة ' + NUM + '$'), function (m) { return 'Remove the bookmark of page ' + L(m[1]); }],
    [new RegExp('^صفحة ' + NUM + '$'), function (m) { return 'Page ' + L(m[1]); }],
    [new RegExp('^، صفحة ' + NUM + '$'), function (m) { return ', page ' + L(m[1]); }],
    [new RegExp('^الجزء ' + NUM + '$'), function (m) { return 'Juz ' + L(m[1]); }],
    [new RegExp('^الحزب ' + NUM + '$'), function (m) { return 'Hizb ' + L(m[1]); }],
    [new RegExp('^ربع الحزب ' + NUM + '$'), function (m) { return 'Quarter-hizb ' + L(m[1]); }],
    [new RegExp('^نصف الحزب ' + NUM + '$'), function (m) { return 'Half-hizb ' + L(m[1]); }],
    [new RegExp('^ثلاثة أرباع الحزب ' + NUM + '$'), function (m) { return 'Three-quarters of hizb ' + L(m[1]); }],
    [new RegExp('^(مكّيّة|مدنيّة)، ' + NUM + ' آية$'), function (m) { return (m[1] === 'مكّيّة' ? 'Meccan' : 'Medinan') + ', ' + L(m[2]) + ' ayahs'; }],
    [new RegExp('^' + NUM + '\\. سورة (.+)$'), function (m) { return L(m[1]) + '. Surah ' + m[2]; }],
    [new RegExp('^سورة (.+)، الآية ' + NUM + '$'), function (m) { return 'Surah ' + m[1] + ', ayah ' + L(m[2]); }],
    [new RegExp('^آيات الصفحة ' + NUM + '$'), function (m) { return 'Ayahs of page ' + L(m[1]); }],
    [new RegExp('^هذا الشرحُ يبدأ من الآية ' + NUM + ' ويشمل هذه الآية\\.$'), function (m) { return 'This explanation begins at ayah ' + L(m[1]) + ' and covers this ayah.'; }],
    [new RegExp('^النتائج: ' + NUM + '$'), function (m) { return 'Results: ' + L(m[1]); }],
    [new RegExp('^' + NUM + ' آية$'), function (m) { return L(m[1]) + ' ayahs'; }],
    [new RegExp('^تلاوة سورة (.+?) بصوت (.+)$'), function (m) { return 'Recitation of surah ' + m[1] + ' by ' + m[2]; }],
    [new RegExp('^' + NUM + ' ميغابايت$'), function (m) { return L(m[1]) + ' MB'; }]
  ];
  // the footer carries the build date after its fixed text
  var FOOT_AR = 'صفحةُ مختبرٍ خارجَ عزك.';
  function tr(s) {
    var t = String(s).replace(/\s+/g, ' ').trim();
    if (Object.prototype.hasOwnProperty.call(EN, t)) return EN[t];
    if (t.indexOf(FOOT_AR) === 0) { var core = t.replace(/ بُنيت البيانات: .*$/, ''); if (Object.prototype.hasOwnProperty.call(EN, core)) { var built = / بُنيت البيانات: (.*?).?$/.exec(t); return EN[core] + (built ? ' Data built: ' + L(built[1]) + '.' : ''); } }
    for (var i = 0; i < PATTERNS.length; i++) { var m = PATTERNS[i][0].exec(t); if (m) return PATTERNS[i][1](m); }
    return undefined;
  }
  // a bare number outside the pages (the page counter, a count) is written in Latin digits; the pages' own text is never touched
  var BARE = /^[٠-٩\s.,٫٬/:+−-]+$/;
  function inPages(el) { for (var e = el; e && e.nodeType === 1; e = e.parentNode) { if (e.id === 'spread' || e.id === 'main') return true; } return false; }
  function text(n) {
    var v = n.nodeValue; if (!v) return; var t = v.trim(); if (!t) return;
    var el = n.parentNode;
    if (el && inPages(el)) return;     // the pages (their words, their numbers) are never touched
    var out = tr(t);
    if (out === undefined && BARE.test(t)) out = L(t);
    if (out !== undefined) n.nodeValue = v.replace(t, out);
  }
  function attrs(el) { for (var i = 0; i < ATTRS.length; i++) { var v = el.getAttribute(ATTRS[i]); if (!v) continue; var out = tr(v); if (out !== undefined) el.setAttribute(ATTRS[i], out); } }
  function walk(n) {
    if (!n) return;
    if (n.nodeType === 3) { text(n); return; }
    if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    attrs(n);
    for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  function start() {
    walk(document.body);
    var tt = tr(document.title); if (tt !== undefined) document.title = tt;
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]); }
          else if (m.type === 'characterData') text(m.target);
          else if (m.type === 'attributes' && m.target.nodeType === 1) attrs(m.target);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
