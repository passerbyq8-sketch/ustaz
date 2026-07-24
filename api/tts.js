// ============================================================
// ElevenLabs Text-to-Speech Proxy — النسخة المُحسّنة v2
// ============================================================
// يحوّل نص الأستاذ إلى صوت طبيعي عربي
// المفتاح يُحفظ كـ ELEVENLABS_API_KEY في Vercel Environment Variables
// ============================================================
//
// ملاحظات النسخة الحالية:
// ✅ النموذج: eleven_flash_v2_5 — نموذج ElevenLabs منخفض زمن الاستجابة،
//    مناسب لحوار فوريّ مع طفل، ويدعم العربية.
// ✅ النص يصل مشكّلاً عبر api/tashkeel — يرفع جودة النطق العربي كثيراً.
// ✅ language_code: 'ar' — يقفل المخرجات على العربية.
// ✅ voice_settings: stability 0.75 (فوق افتراضي ElevenLabs 0.50 — السبب في تعليق الإعدادات أدناه)،
//    similarity_boost 0.75، style 0.0، speed 1.1، use_speaker_boost: true.
// ============================================================

// ============================================================
// اختيار الصوت حسب جنس الطفل
// ============================================================
import { checkAudioLimit } from '../lib/ratelimit.js';

const FEMALE_VOICE_ID = 'qi4PkV9c01kb869Vh7Su';  // صوت بناتي للبنات
const MALE_VOICE_ID   = 'G1HOkzin3NMwRHSq60UI';  // صوت رجالي للأولاد

const DEFAULT_VOICE_ID = MALE_VOICE_ID; // fail-safe: missing/unknown gender → male tutor voice (never an unexpected female voice in a kids' app)

// ============================================================
// إعدادات النموذج
// ============================================================
// eleven_flash_v2_5 : أدنى زمن استجابة مع جودة عالية — الأنسب للحوار.
const MODEL_ID = 'eleven_flash_v2_5';
const TTS_SPEED = 1.1; // speech pace: 1.0 = default, range 0.7-1.2 (voice_settings.speed)

// كود اللغة (ISO 639-1) — يقفل المخرجات على العربية
const LANGUAGE_CODE = 'ar';

// Hard input cap: reject oversized text BEFORE spending ElevenLabs credits / quota.
// tts receives the DIACRITIZED text (post-tashkeel), which is ~1.5-1.6x the raw
// input, so this sits above MAX_TASHKEEL_CHARS x ~1.6. Any legit single answer
// (even a long worship card) is well under this; larger is abuse or a bug. If a
// real answer is ever clipped, raise this AND MAX_TASHKEEL_CHARS together.
const MAX_TTS_CHARS = 8000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY غير مضبوط في Vercel'
    });
  }

  const { text, gender, band } = req.body;
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
  if (text.length > MAX_TTS_CHARS) {
    return res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TTS_CHARS} حرف)` });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const rl = await checkAudioLimit(ip, 'tts');
  if (!rl.ok) {
    return res.status(429).json({ error: 'audio rate limit exceeded' });
  }

  // Server-authoritative: voice is chosen ONLY by gender. We intentionally ignore any
  // client-sent voiceId so a stale/cached old client cannot override with an outdated voice.
  let useVoiceId = DEFAULT_VOICE_ID;
  if (gender === 'female') useVoiceId = FEMALE_VOICE_ID;
  else if (gender === 'male') useVoiceId = MALE_VOICE_ID;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${useVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text,
          model_id: MODEL_ID,
          language_code: LANGUAGE_CODE,
          voice_settings: {
            // 0.75 بدل 0.50: الاستقرار المنخفض يُسبّب تأتأة على عناقيد الشدّة
            // (التَّشْرِيك = تّ+شْ). رفعه يقلّل هذا الأثر.
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.0,
            speed: TTS_SPEED,
            use_speaker_boost: true,  // مدعوم في v2، يحسّن وضوح الصوت
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `ElevenLabs error: ${errorText.slice(0, 200)}`
      });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    return res.send(Buffer.from(audioBuffer));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
