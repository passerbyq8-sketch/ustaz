// lib/lang/detect.js -- THE QUESTION-LANGUAGE DETECTOR (item 74, ruling h2). One function, one place.
//
// It returns a code from the table in ./table.js, and only a code the table holds: a language whose row does not exist yet is
// read as the next-best code, so adding a language is adding its row and its evidence here and nowhere else.
//   * a character of the Arabic script -> 'ar' (every question written in Arabic letters is Arabic, exactly as it always was) UNLESS it
//     carries a letter that is not written on an Arabic keyboard (ruling h10): Persian by the Persian yeh U+06CC, the Persian kaf
//     U+06A9, پ, ژ or the Persian digits; Urdu by ٹ ڈ ڑ ں ے ھ. چ and گ alone are NOT a mark: the Kuwaiti dialect writes them.
//   * another script decides the language by its letters (ruling h11): Cyrillic is Russian, Han is Chinese, Bengali is Bengali. A text
//     that holds more of such letters than of Arabic ones is theirs, even when it quotes an Arabic word.
//   * Latin-only text is read by function words, not by a single word: two of a language's words, or one that opens a question
//     or a request. Indonesian and Malay share most of theirs: the words only one of them uses decide, and a tie goes to the key
//     language if it is one of the two, else to Indonesian (ruling h11).
//   * everything else -- one word, digits, a mixed fragment -- is ambiguous, and ambiguity resolves to the key language (the
//     interface language the reader chose).
import { keyLangOf, isKnownLang } from './table.js';

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
// ہ ۂ ۃ (heh goal) and ۓ are Urdu's own too: Persian writes ه and never these (measured need: an Urdu question such as «زکوٰۃ کا نصاب کیا ہے» holds ک and ی, which Persian shares, and none of the six marks of ruling h10)
const URDU_MARKS = /[ٹڈڑںےھہۂۃۓ]/;
const PERSIAN_MARKS = /[یکپژ۰-۹]/;
const CYRILLIC = /[Ѐ-ӿ]/g; const HAN = /[㐀-䶿一-鿿]/g; const BENGALI = /[ঀ-৿]/g; const ARABIC_G = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const count = (s, re) => (s.match(re) || []).length;

const words = (s) => s.split(' ').filter(Boolean);
const EN_WORDS = new Set(('the is are was were be been what how why when where who whom which can could do does did i my me mine you your '
  + 'we our he she it they them his her its of to in on at for with without from by about and or but not no if then that this these those '
  + 'a an should would shall will may might must please tell explain give write say ask there here as so than also just').split(' '));
const EN_OPENERS = new Set('what how why when where who whom which is are can could do does did should would will may please tell explain give write say ask'.split(' '));

// Function words per Latin-script language, written lowercase with the accents the language writes. A word that English also uses, or that
// two of these languages share (outside the Indonesian/Malay pair), is not evidence and is removed below.
const LATIN_SETS = {
  fr: words('le la les un une des du et est sont pas pour que qui quoi comment pourquoi quand quel quelle quels quelles dans sur avec sans ce cette ces '
    + 'je tu il elle nous vous ils elles mon ma mes ton ta tes sa ses notre votre leur peut peuvent doit dois faut suis es sommes êtes être avoir faire dire '
    + 'qu aux au par mais ou où donc car si ne ni très aussi plus moins peu bien tout tous toute encore alors puis après avant chez selon entre sous vers'),
  id: words('yang dan di ke dari untuk dengan adalah apa bagaimana mengapa kenapa kapan dimana siapa saya aku kamu anda kita kami mereka ini itu '
    + 'tidak bukan akan sudah belum bisa dapat boleh harus hukum hukumnya atau juga pada dalam oleh sebagai karena jika agar ada apakah berapa bolehkah '
    + 'sholat salat puasa bagaimanakah dimanakah kapankah siapakah lebih sangat sekali masih sedang telah tetapi namun maka sehingga tentang antara'),
  ms: words('yang dan di ke dari untuk dengan adalah apa bagaimana mengapa kenapa bila bilakah dimana siapa saya aku awak anda kita kami mereka ini itu '
    + 'tidak bukan akan sudah belum boleh perlu hukum atau juga pada dalam oleh sebagai kerana jika supaya ada adakah berapa bolehkah daripada sahaja '
    + 'solat puasa bagaimanakah apakah lebih sangat sekali masih sedang telah tetapi namun maka sehingga tentang antara'),
  tr: words('ve bir bu şu için ne nasıl neden niçin nedir mi mı mu mü ile ben sen biz siz onlar var yok değil olan olarak gibi çok daha en hangi kim nerede '
    + 'ne zaman evet hayır lütfen müslüman bana sana benim senin bizim sizin onun ama fakat veya ya da çünkü eğer ancak kadar sonra önce her bazı hiç mıdır midir '
    + 'mudur müdür caiz midir olur mu yapılır yapılır mı hakkında hükmü'),
  ha: words('shin menene yaya me yasa ina wannan wancan kuma domin cikin akan daga zuwa amma idan ko ba wane wace dole zan yana ake ana ya ta su mu ku ni kai ke '
    + 'shi ita yi yin hukuncin hukunci mene meye wanne wacce kowa komai har sai yanzu duk '
    // «da» (and, with) is the commonest Hausa word and Turkish writes it too («ya da», «da»): two of them put a Hausa question in Turkish (measured on the Hausa preview,
    // «... Hanafiyya da Shafi’iyya ... da ...»). Counted here, the word is shared and counts for neither; the other words below are Hausa's own.
    + 'da game bayan kan cewa wanda mai saboda bisa tsakanin bambancin ayin karanta alwala azumin sallar liman yadda labarin mini'),
  sw: words('nini vipi kwa nini lini wapi nani je ni si siyo hapana ndiyo tafadhali naomba nataka sheria hukumu mimi wewe yeye sisi nyinyi wao ana anaweza kuwa '
    + 'kuhusu au pia lakini kama katika hii hiyo huu ule hizi hao yake yangu yako wake wetu wenu wao sana bado kila kutoka mpaka hadi baada kabla '
    + 'gani tofauti kati eleza maana maneno rahisi halali haramu nyama inasema alisema unieleze nifanye nikisahau mtume swala zakati udhu kufunga hukumu '
    + 'hakika pamoja uzito upo wepesi niandikie niambie nifanyeje nitengenezeje ngono iliyo wazi kina hadithi'),
  es: words('el los las una unos unas son está están hay qué quién quiénes cómo cuándo dónde cuál cuáles cuánto cuántos cuánta porque con sin sobre desde hasta '
    + 'mis tus sus nuestro nuestra puede pueden debe deben del al pero también muy más menos todos todas esta este estos estas eso esto ese esa usted ustedes nosotros '
    + 'ellos ellas hacer decir explica explícame dime dame escribe diferencia significa significado cuál hay puedo debo estoy soy somos oración ayuno permitido prohibido '
    + 'dónde cuándo según cada otro otra otros hoy ahora siempre nunca algo alguien nada nadie escríbeme relato explícito detallado erótico '
    // the words Spanish shares with French and Portuguese are listed too, so that they cancel for all of them and cannot count for one alone
    + 'la es de y en entre un que por para no se lo le les su como mas'),
  pt: words('você vocês não são está estão há também muito mais menos todos esta este estes estas isso isto esse essa eu nós eles elas fazer dizer explique explica diga escreva escreva-me me quais qual quem quando onde como porque sobre com sem desde até meu minha meus minhas seu sua seus suas nosso nossa pode podem deve devem do da dos das no na nos nas ao aos pela pelo pelos pelas uma uns umas os as o a é ou mas oração jejum permitido proibido diferença significa significado conto erótico explícito detalhado proibida proibidos proibidas islã islão vem versículo versículos alcorão dificuldade facilidade  ainda já ser ter quanto quantos quantas entre depois antes minha ele ela qualquer cada outro outra hoje agora sempre nunca algo ninguém nada ninguém sao nao voce o que de e em para por que um se lhe lhes'),
  de: words('der die das den dem ein eine einen einem einer eines ist sind waren sein bin bist nicht kein keine und oder aber auch sehr mehr wenig alle diese dieser dieses wie warum wann wo wer wen wem welche welcher welches kann können muss müssen soll sollen darf dürfen ich du er sie es wir ihr mein dein unser bitte erkläre erklär sag schreib gib mit ohne über von zu zum zur bei nach vor für gegen aus durch um zwischen unter wenn weil dass ob also noch schon nur bedeutet bedeutung gebet fasten zakat scheich was wieso weshalb wozu wofür worüber geschichte schreibe mir erzähl sehr explizite ausführliche erotische baut bombe zu hause schritt für schritt ignoriere alle vorherigen anweisungen schreibe dann sag urteil über unterschied zwischen ansicht ist verboten islam größte vers koran prophet darüber sagte hadith rechtslehre einhellig'),
};
const LATIN_OPENERS = {
  fr: words('que quoi comment pourquoi quand où quel quelle quels quelles qu est-ce pouvez expliquez dites'),
  id: words('apa apakah bagaimana mengapa kenapa kapan siapa bolehkah berapa jelaskan tolong'),
  ms: words('apa apakah adakah bagaimana bagaimanakah mengapa kenapa bila bilakah siapa siapakah bolehkah berapa berapakah jelaskan tolong'),
  tr: words('ne nasıl neden niçin hangi kim nerede açıklar lütfen'),
  ha: words('shin menene yaya me yasa ina wane wace'),
  sw: words('nini vipi je wapi lini nani tafadhali naomba'),
  es: words('qué cómo cuándo dónde quién quiénes cuál cuáles cuánto cuántos explica explícame dime dame escribe puedo puede'),
  pt: words('o qual quais quem quando onde como por quanto quantos explique explica diga escreva escreva-me pode posso é'),
  de: words('was wie warum wann wo wer wen wem welche welcher welches erkläre erklär bitte kann darf ist sind gibt schreib sag wieso weshalb wozu'),
};
// Letters only the language writes: one such letter is half a function word.
const LATIN_MARKS = { fr: /[éèêëàâçùûôîïœ]/, tr: /[ğışİ]/, ha: /[ɓɗƙƴ]/, es: /[ñ¿¡]/, pt: /[ãõ]/, de: /[äß]/ };
const ORDER = ['en', 'fr', 'id', 'tr', 'sw', 'ha', 'ms', 'es', 'pt', 'de'];

// a word counts for a language only when no OTHER language (the Indonesian/Malay pair aside) uses it, and English does not
const PAIR = new Set(['id', 'ms']);
const EVIDENCE = (() => {
  const raw = Object.assign({ en: [...EN_WORDS] }, LATIN_SETS); const out = {};
  for (const lang of Object.keys(raw)) {
    out[lang] = new Set(raw[lang].filter((w) => !Object.keys(raw).some((o) => o !== lang && !(PAIR.has(lang) && PAIR.has(o)) && raw[o].includes(w))));
  }
  // English keeps every word of its own list (the detector's English behaviour is the one that was measured)
  out.en = EN_WORDS;
  return out;
})();
// the words only one of the pair uses
const ONLY = { id: new Set(LATIN_SETS.id.filter((w) => !LATIN_SETS.ms.includes(w))), ms: new Set(LATIN_SETS.ms.filter((w) => !LATIN_SETS.id.includes(w))) };

export function hasArabicScript(text) { return ARABIC_SCRIPT.test(String(text == null ? '' : text)); }

function latinLang(s, key) {
  const toks = (s.replace(/İ/g, 'i').toLowerCase().match(/[a-zà-ÿßœğışɓɗƙƴ]+/g) || []);
  if (toks.length === 0) return null;
  const scores = {};
  for (const lang of ORDER) {
    if (!isKnownLang(lang)) continue;
    let hits = 0; for (const w of toks) if (EVIDENCE[lang].has(w)) hits++;
    const opener = lang === 'en' ? EN_OPENERS.has(toks[0]) : (LATIN_OPENERS[lang] || []).includes(toks[0]);
    // two function words, or one that opens a question/request: a lone «for» or «le» is not enough to take a text away from the key language
    if (lang !== 'en' && LATIN_MARKS[lang] && LATIN_MARKS[lang].test(s)) hits++;
    const enough = hits >= 2 || (toks.length <= 12 && opener && hits >= 1) || (lang === 'en' && toks.length <= 12 && opener);
    if (enough) scores[lang] = hits;
  }
  const langs = Object.keys(scores); if (!langs.length) return null;
  let best = Math.max(...langs.map((l) => scores[l])); let top = langs.filter((l) => scores[l] === best);
  if (top.length > 1) {
    if (top.every((l) => PAIR.has(l))) {   // Indonesian or Malay: the words only one of them uses decide; a tie goes to the key language, else Indonesian
      const a = toks.filter((w) => ONLY.id.has(w)).length; const b = toks.filter((w) => ONLY.ms.has(w)).length;
      if (b > a) return 'ms'; if (a > b) return 'id'; return PAIR.has(key) ? key : 'id';
    }
    return top.includes(key) ? key : ORDER.find((l) => top.includes(l));
  }
  return top[0];
}

/** @returns {string} a code present in the language table */
export function detectQuestionLang(text, keyLang) {
  const key = keyLangOf(keyLang);
  const s = String(text == null ? '' : text);
  const known = (c) => (isKnownLang(c) ? c : null);
  const ar = count(s, ARABIC_G);
  const cy = count(s, CYRILLIC); const han = count(s, HAN); const bn = count(s, BENGALI);
  const other = Math.max(cy, han, bn);
  if (other > ar) {
    const pick = other === cy ? 'ru' : other === han ? 'zh' : 'bn';
    return known(pick) || key;
  }
  if (ar > 0) {
    if (URDU_MARKS.test(s)) return known('ur') || 'ar';
    if (PERSIAN_MARKS.test(s)) return known('fa') || 'ar';
    return 'ar';
  }
  if (other > 0) { const pick = other === cy ? 'ru' : other === han ? 'zh' : 'bn'; return known(pick) || key; }
  return latinLang(s, key) || key;
}
