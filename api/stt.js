// ============================================================
// ElevenLabs Speech-to-Text proxy (Scribe) -- mirrors api/tts.js
// ============================================================
// The client records the turn itself (MediaRecorder) and posts base64 here.
// Reason this endpoint exists at all: on Android the Web Speech engine owns the
// microphone exclusively, so no client-side VAD can measure the user's silence,
// and every engine session plays Google's start/stop tone. Recording locally and
// transcribing here removes BOTH -- and the API key never reaches the device.
// ============================================================
import { checkAudioLimit, applyCorsOrigin } from '../lib/ratelimit.js';
import { guardAIConsent, AI_CONSENT_ALLOW_HEADERS } from '../lib/ai-consent.js';

const MODEL_IDS = ['scribe_v2', 'scribe_v1']; // second is a fallback if the first is rejected
const LANGUAGE_CODE = 'ara';                  // ISO 639-3, Arabic
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;      // one turn of opus is tens of KB; bigger is abuse or a bug

export default async function handler(req, res) {
  applyCorsOrigin(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ' + AI_CONSENT_ALLOW_HEADERS);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  // Apple 5.1.1(i): a recording of a reader's voice is the most sensitive thing this app can
  // forward, so the consent check runs before the base64 is even decoded.
  if (!guardAIConsent(req, res)) return;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY missing on Vercel' });

  const { audio, mime, band } = req.body || {};
  // Same second layer as tts.js: a child band never reaches the vendor at all.
  if (band === 'young') return res.status(403).json({ error: 'child voice disabled' });
  if (!audio || typeof audio !== 'string') return res.status(400).json({ error: 'no audio' });

  let buf;
  try { buf = Buffer.from(audio, 'base64'); } catch (e) { return res.status(400).json({ error: 'bad audio' }); }
  if (!buf.length) return res.status(400).json({ error: 'empty audio' });
  if (buf.length > MAX_AUDIO_BYTES) return res.status(413).json({ error: 'audio too large' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const rl = await checkAudioLimit(ip, 'tts'); // shares the audio budget on purpose: same vendor, same money
  if (!rl.ok) return res.status(429).json({ error: 'audio rate limit exceeded' });

  let lastStatus = 500;
  let lastText = 'unknown';
  for (const modelId of MODEL_IDS) {
    try {
      const form = new FormData();
      form.append('file', new Blob([buf], { type: mime || 'audio/webm' }), 'turn.webm');
      form.append('model_id', modelId);
      form.append('language_code', LANGUAGE_CODE);
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form,
      });
      if (response.ok) {
        const data = await response.json();
        const text = data && data.text ? String(data.text).trim() : '';
        return res.status(200).json({ text, model: modelId });
      }
      lastStatus = response.status;
      lastText = (await response.text()).slice(0, 200);
    } catch (error) {
      lastStatus = 500;
      lastText = error.message;
    }
  }
  return res.status(lastStatus).json({ error: 'ElevenLabs error: ' + lastText });
}