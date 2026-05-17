// ============================================================
// ElevenLabs Text-to-Speech Proxy
// ============================================================
// يحوّل نص الأستاذ إلى صوت طبيعي عربي
// المفتاح يُحفظ كـ ELEVENLABS_API_KEY في Vercel Environment Variables
// ============================================================

// صوت افتراضي — تم اختياره من ElevenLabs Voice Library
const DEFAULT_VOICE_ID = 'usjDi9nBY6UHvtKrL4ba';

// النموذج: multilingual_v2 (أفضل جودة) أو turbo_v2_5 (أسرع)
const MODEL_ID = 'eleven_multilingual_v2';

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

  const { text, voiceId } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'النص مطلوب' });
  }

  const useVoiceId = voiceId || DEFAULT_VOICE_ID;

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
          voice_settings: {
            // ----------------------------------------------------------------
            // إعدادات معدّلة لزيادة حيوية الصوت وتفاعله:
            // stability منخفض = تنويع أكثر في النبرة (لا روبوتي ثابت)
            // style مرتفع = تعبير عاطفي أكثر (يحمس مع المحتوى الحماسي)
            // similarity_boost = ثبات شخصية الصوت
            // ----------------------------------------------------------------
            stability: 0.30,         // كان 0.55 — تنويع أكبر في النبرة
            similarity_boost: 0.75,  // ثابت لحفظ هوية الصوت
            style: 0.60,             // كان 0.30 — تعبير عاطفي أوضح
            use_speaker_boost: true,
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
