// ============================================================
// ElevenLabs Text-to-Speech Proxy — النسخة المُحسّنة v2
// ============================================================
// يحوّل نص الأستاذ إلى صوت طبيعي عربي
// المفتاح يُحفظ كـ ELEVENLABS_API_KEY في Vercel Environment Variables
// ============================================================
//
// التغييرات في هذه النسخة:
// ✅ الرجوع إلى نموذج eleven_multilingual_v2 (أسرع من v3 للمحادثات)
//    — v3 جودته أعلى لكنه أبطأ، v2 أنسب للحوار مع طفل
//    — الجودة لا تزال ممتازة، والاستجابة سريعة
//
// ✅ النص الذي يصلنا الآن مشكّل عبر api/tashkeel
//    — لذلك الجودة الصوتية ستكون أعلى بكثير من قبل
//
// ✅ language_code: 'ar' (مدعوم في v2 أيضاً)
//
// ✅ الإعدادات الرسمية الموصى بها من ElevenLabs:
//    stability: 0.50, similarity_boost: 0.75, style: 0.0
//
// ✅ use_speaker_boost: true (مدعوم في v2، يحسّن وضوح الصوت)
// ============================================================

// ============================================================
// اختيار الصوت حسب جنس الطفل
// ============================================================
const FEMALE_VOICE_ID = 'VwC51uc4PUblWEJSPzeo';  // صوت بناتي للبنات
const MALE_VOICE_ID   = 'G1QUjBCuRBbLbAmYlTgl';  // صوت رجالي للأولاد

const DEFAULT_VOICE_ID = FEMALE_VOICE_ID;

// ============================================================
// إعدادات النموذج
// ============================================================
// eleven_multilingual_v2 : التوازن الأمثل بين الجودة والسرعة
// (للجودة القصوى مع قبول التأخير: استبدل بـ 'eleven_v3')
const MODEL_ID = 'eleven_multilingual_v2';

// كود اللغة (ISO 639-1) — يقفل المخرجات على العربية
const LANGUAGE_CODE = 'ar';

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

  const { text, voiceId, gender } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'النص مطلوب' });
  }

  // ترتيب الأولويات لاختيار الصوت
  let useVoiceId = DEFAULT_VOICE_ID;
  if (voiceId) {
    useVoiceId = voiceId;
  } else if (gender === 'male') {
    useVoiceId = MALE_VOICE_ID;
  } else if (gender === 'female') {
    useVoiceId = FEMALE_VOICE_ID;
  }

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
            // (التَّشْرِيك = تّ+شْ) في eleven_multilingual_v2. رفعه يقلّل هذا الأثر.
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.0,
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
