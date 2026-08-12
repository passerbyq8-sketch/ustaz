// ============================================================
// Tashkeel Diacritization Proxy — المرجع اللغوي للتشكيل
// ============================================================
// يستخدم Claude Haiku 4.5 (السريع والاقتصادي) كمُشكِّل عربي متخصص
// يُستدعى قبل إرسال النص لـ ElevenLabs، فيُحسّن جودة النطق العربي
//
// السبب: Claude Sonnet (الذي يجيب على الطفل) ليس متخصصاً في التشكيل،
// لكن عندما نُسند مهمة التشكيل وحدها إلى Haiku بـ system prompt مُركَّز،
// نحصل على جودة تشكيل أعلى بكثير، بسرعة عالية وتكلفة قليلة.
//
// التكلفة التقريبية: ~$0.001 لكل رد (1000 رد بدولار واحد)
// التأخير المُضاف: ~0.5-1 ثانية فقط (Haiku سريع جداً)
// ============================================================

import { checkAudioLimit, applyCorsOrigin } from '../lib/ratelimit.js';
import { guardAIConsent, AI_CONSENT_ALLOW_HEADERS } from '../lib/ai-consent.js';

// Hard input cap: skip diacritization for oversized text so we never spend Haiku
// credits on abuse/bugs. Returns the original text (status 200) unchanged so the
// client's audio flow is unbroken; the tts endpoint enforces the real cost gate.
// Keep this ~1/1.6 of MAX_TTS_CHARS (diacritics expand the text). Raise if a real
// answer is ever skipped.
const MAX_TASHKEEL_CHARS = 5000;

// ONE SENTENCE, ALWAYS THE SAME ONE. Whatever the provider failed with, the client is told the
// same thing: the diacritization did not happen and the original text is being returned. The
// client reads `.text` and nothing else, so this is a diagnostic field for a developer reading a
// response — which is exactly why it must not carry the provider's own error string.
const TASHKEEL_FAILED_MESSAGE = 'تعذّر التشكيل — أُعيد النص كما هو.';

// A provider may add Arabic combining marks, and nothing else. Comparing the text with those
// marks removed pins every letter, digit, space and punctuation byte. The per-gap subsequence
// check then pins every mark the reader already supplied to the same position and order
// (including U+0670), while still allowing the provider to add another mark beside it.
const ARABIC_DIACRITIC_RANGE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u08D3-\u08FF]/u;
const COMBINING_MARK = /\p{M}/u;

function isArabicDiacritic(ch) {
  return COMBINING_MARK.test(ch) && ARABIC_DIACRITIC_RANGE.test(ch);
}

function structuralParts(value) {
  let base = '';
  const marks = [[]];
  for (const ch of String(value)) {
    if (isArabicDiacritic(ch)) {
      marks[marks.length - 1].push(ch);
    } else {
      base += ch;
      marks.push([]);
    }
  }
  return { base, marks };
}

export function isSafeDiacritization(original, candidate) {
  if (typeof original !== 'string' || typeof candidate !== 'string' || !candidate) return false;
  const before = structuralParts(original);
  const after = structuralParts(candidate);
  if (before.base !== after.base || before.marks.length !== after.marks.length) return false;

  for (let i = 0; i < before.marks.length; i++) {
    let originalMarkIndex = 0;
    for (const mark of after.marks[i]) {
      if (mark === before.marks[i][originalMarkIndex]) originalMarkIndex++;
    }
    if (originalMarkIndex !== before.marks[i].length) return false;
  }
  return true;
}

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + AI_CONSENT_ALLOW_HEADERS);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Apple 5.1.1(i): this route sends the reader's text to Anthropic. No consent, no send.
  if (!guardAIConsent(req, res)) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY غير مضبوط في Vercel'
    });
  }

  // THE BODY IS CHECKED BEFORE IT IS USED. Measured: a POST with no body at all destructured
  // `undefined` and threw HERE — outside the try below — so the reader's audio call died as an
  // unexplained 500 rather than a plain 400. api/stt.js:32 already writes `req.body || {}`; this
  // is the same guard, plus the string case, because a body may arrive unparsed.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'النص مطلوب' });
  }

  const { text, gender, band } = body;
  // Second layer -- NOT a lock. band is client-asserted, so this only raises the cost of a
  // casual bypass; real enforcement needs server-side identity, which this product has none
  // of by design (no accounts). Mirrors CHILD_VOICE_ENABLED=false at index.html:133 -- if
  // that flag is ever flipped to true this guard must be removed in the SAME commit and
  // Data Safety updated BEFORE deploy. A stale client sending no band is not blocked.
  if (band === 'young') {
    return res.status(403).json({ error: 'child voice disabled' });
  }
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'النص مطلوب' });
  }
  // Over cap: skip Haiku, return the original text (audio still proceeds; tts caps cost).
  if (text.length > MAX_TASHKEEL_CHARS) {
    return res.status(200).json({ text: text, warning: `Tashkeel skipped: input too long (${text.length} chars)` });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const rl = await checkAudioLimit(ip, 'tashkeel');
  if (!rl.ok) {
    return res.status(429).json({ error: 'audio rate limit exceeded' });
  }

  // تحضير تلميح الجنس لمساعدة المُشكِّل في تمييز المؤنث/المذكر
  const genderHint = gender === 'female'
    ? '\n\nملاحظة سياقية مهمة: النص موجَّه إلى طفلة (أنثى). استخدم صيغ المؤنث في الضمائر والأفعال (عَلَيْكِ، تَفْعَلِينَ، يَا حَبِيبَتِي، أَنْتِ).'
    : gender === 'male'
    ? '\n\nملاحظة سياقية مهمة: النص موجَّه إلى طفل (ذكر). استخدم صيغ المذكر في الضمائر والأفعال (عَلَيْكَ، تَفْعَلُ، يَا حَبِيبِي، أَنْتَ).'
    : '';

  const systemPrompt = `أنت مدقّق لغوي عربي متخصص في التشكيل التام (تشكيل كل حرف بحركته الصحيحة).
مهمتك الوحيدة: تستلم نصاً عربياً وتعيد إخراجه مشكّلاً بالكامل، حرفاً حرفاً، دون أي تغيير في الكلمات أو ترتيبها.

═══ قواعد صارمة لا تُكسر ═══

١. لا تغيّر أي كلمة. لا تُضِف ولا تحذف ولا تستبدل كلمة بأخرى.
٢. لا تكتب أي مقدمة أو خاتمة أو شرح. أعِد النص المشكّل فقط، مباشرة.
٣. كل حرف عربي يجب أن يحمل علامة تشكيل (فتحة، كسرة، ضمة، سكون، شدة، تنوين).
٤. الهمزات الخاصة (آ، أ، إ، ؤ، ئ، ى، ة) تحافظ على شكلها مع إضافة التشكيل المناسب.
٥. علامات الترقيم (، . ؟ !) والأرقام والإيموجي تبقى كما هي، بدون تشكيل.
٦. الأسماء الأعجمية (مثل: مِيسِي، رُونَالْدُو، بِيبْسِي) تُشكَّل صوتياً كما تُنطق بالعربية.
٧. تمييز الإعراب الصحيح: المرفوع بالضمة، المنصوب بالفتحة، المجرور بالكسرة، المجزوم بالسكون.
٨. الأفعال المضارعة المسندة للمؤنث: "تَفْعَلِينَ" (لام مكسورة + ياء ساكنة + نون مفتوحة).
٩. لا تستخدم الـ Markdown أو أي تنسيق. نصّ عربيّ نقيّ فقط.${genderHint}

═══ أمثلة مرجعية ═══

المدخل: السلام عليك يا حبيبتي اليوم
المخرج: السَّلَامُ عَلَيْكِ يَا حَبِيبَتِي الْيَوْمَ

المدخل: ميسي ورونالدو لاعبان مشهوران
المخرج: مِيسِي وَرُونَالْدُو لَاعِبَانِ مَشْهُورَانِ

المدخل: يا قمر، هذا أحلى شيء سمعته!
المخرج: يَا قَمَرُ، هَذَا أَحْلَى شَيْءٍ سَمِعْتُهُ!

المدخل: تنحنين كي تربطي حذاءك
المخرج: تَنْحَنِينَ كَيْ تَرْبِطِي حِذَاءَكِ

المدخل: بسم الله الرحمن الرحيم
المخرج: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ

ابدأ مباشرة بالنص المشكّل بدون أي مقدمة أو تعليق.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Haiku أسرع وأرخص بكثير من Sonnet، ومناسب للمهمة المركّزة
        model: process.env.TASHKEEL_MODEL || 'claude-haiku-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          // Existing marks are evidence, not disposable input. The validator below independently
          // rejects any output that moves or removes one of them.
          { role: 'user', content: text }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      // THE PROVIDER'S WORDS STAY ON THE SERVER. They were being handed to the client verbatim
      // (150 chars of them), and a provider's 4xx body is where a key, an org id or an account
      // detail turns up. The diagnosis is kept where a diagnosis belongs — the server log — and
      // the client gets a code and a fixed sentence.
      console.error('[tashkeel] upstream ' + response.status + ': ' + errorText.slice(0, 200));
      // عند الفشل، نُرجع النص الأصلي كاحتياط لكي لا ينقطع الصوت
      return res.status(200).json({
        text: text,
        code: 'TASHKEEL_UPSTREAM_FAILED',
        warning: TASHKEEL_FAILED_MESSAGE
      });
    }

    const data = await response.json();
    const diacritized = data.content
      .map(c => c.type === 'text' ? c.text : '')
      .filter(Boolean)
      .join('');

    // Fail closed to the exact input. No normalization or trimming is allowed on this path.
    return res.status(200).json({
      text: isSafeDiacritization(text, diacritized) ? diacritized : text
    });
  } catch (error) {
    console.error('[tashkeel] transport failed: ' + (error && error.message ? String(error.message).slice(0, 200) : 'unknown'));
    // أي خطأ → نرجع النص الأصلي حتى يستمر الصوت
    return res.status(200).json({
      text: text,
      code: 'TASHKEEL_UPSTREAM_FAILED',
      warning: TASHKEEL_FAILED_MESSAGE
    });
  }
}
