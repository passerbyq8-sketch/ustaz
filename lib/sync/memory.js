// lib/sync/memory.js
// ITEM 58 -- THE MEMORY THE BRAIN KEEPS OF THE ASKER, AND IT IS ONE FIELD: the gender the asker
// wrote with their own hand in «ملفّك». Nothing is inferred from conversations, nothing is stored
// here, and two fields are refused by construction:
//
//   the NAME     never enters the answer (owner, 8 August: «لا يكتب في بداية الجواب اي شي ابدا،
//                فقط يجاوب»). This module never reads body.name.
//   the MADHHAB  never enters the memory: it would change the ruling. There is no field for it and
//                this module reads none.
//
// WHAT THE LINE CHANGES: THE ADDRESS AND NOTHING ELSE. It tells the brain to speak to the asker in
// the feminine or the masculine, and says in the same breath that the ruling, its evidence and its
// detail are exactly what they would be for anyone else.
//
// BEHIND THE SWITCH (lib/sync/flag.js): `all` opens it for every asker (the preview), `owner` for
// the owner's accounts, proved by the live session in the x-ezik-session header. When the switch is
// closed for this request, OR the profile says nothing about gender, this returns '' -- and the
// prompt the brain receives is then byte for byte the one it received before item 58.

import { syncSwitch, syncOpenFor } from './flag.js';
import { touchSession } from '../auth/account.js';

export const SESSION_HEADER = 'x-ezik-session';

export const ADDRESS_LINES = Object.freeze({
  female: 'خِطابُ السائل (من «ملفّك» الذي كتبه بيده): السائلةُ أنثى، فخاطِبْها بصيغة المؤنّث في كلّ ما توجّهه إليها (أنتِ، عليكِ، تفعلين). هذا يغيّر صيغةَ الخطاب وحدها: الحكمُ الشرعيّ ودليلُه وتفصيلُه هي هي بلا زيادةٍ ولا نقص. لا تذكر اسمَها ولا جنسَها في الجواب، ولا تبدأ بنداء.',
  male: 'خِطابُ السائل (من «ملفّك» الذي كتبه بيده): السائلُ ذكر، فخاطِبْه بصيغة المذكّر في كلّ ما توجّهه إليه (أنتَ، عليكَ، تفعل). هذا يغيّر صيغةَ الخطاب وحدها: الحكمُ الشرعيّ ودليلُه وتفصيلُه هي هي بلا زيادةٍ ولا نقص. لا تذكر اسمَه ولا جنسَه في الجواب، ولا تبدأ بنداء.',
});

/** The gender the profile states, or null. Only the two literal words count. */
export function statedGender(body) {
  const g = body && typeof body === 'object' ? body.gender : undefined;
  return g === 'female' || g === 'male' ? g : null;
}

function headerOf(req, name) {
  const h = (req && req.headers) || {};
  const v = h[name];
  return typeof v === 'string' ? v : '';
}

/** Is item 58 open for this request? `all` needs nothing; `owner` needs a live owner session. */
export async function memoryOpenFor(req) {
  const mode = syncSwitch();
  if (mode === 'all') return true;
  if (mode !== 'owner') return false;
  try {
    const session = headerOf(req, SESSION_HEADER);
    if (session.length < 16 || session.length > 128) return false;
    const rec = await touchSession(session);
    if (!rec || typeof rec.accountKey !== 'string') return false;
    return await syncOpenFor(rec.accountKey);
  } catch (e) { return false; }
}

/** 'female' | 'male' | null -- the addressee item 58 applies to this request, or null for none. */
export async function addresseeFor(req, body) {
  const g = statedGender(body);
  if (!g) return null;
  if (!(await memoryOpenFor(req))) return null;
  return g;
}

/** The line appended to the system prompt, or '' (the prompt is then exactly the base one). */
export function addressLineFor(addressee) {
  return addressee === 'female' || addressee === 'male' ? ADDRESS_LINES[addressee] : '';
}

/** The sentence added to the translator's instructions, or '' (instructions unchanged). */
export function translatorAddressLine(addressee) {
  if (addressee === 'female') return '8. The reader this answer speaks to is a woman: wherever the Arabic addresses the reader, use the grammatical forms for addressing a woman. This changes only the form of address, never the content.';
  if (addressee === 'male') return '8. The reader this answer speaks to is a man: wherever the Arabic addresses the reader, use the grammatical forms for addressing a man. This changes only the form of address, never the content.';
  return '';
}
