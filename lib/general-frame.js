// lib/general-frame.js -- THE GENERAL FRAME (order EZIK-SORTER-ORDER-2026-10-01, part 2).
//
// A turn whose FINAL runtime is GENERAL has no fiqh in it, so it is not held to the fiqh frame. The
// shari'a frame is built for every request before the question is classified (api/ask.js builds the
// system at the tier, the classifier comes after), so the frame is CHOSEN where the system is used,
// and this file is the whole difference between the two:
//
//   1. ONE LINE of the system prompt. lib/system-prompt.js says, under «المواد والمصادر التي يسلّمها
//      الخادم»: rely ONLY on the materials the server delivered. Said to a model that is formatting a
//      table, it reads as «refuse what no source covers». The general frame says only what the line
//      was written for -- do not name a source as available unless one was delivered.
//   2. THE DEPTH INSTRUCTION of the deep and scholar tiers (api/ask.js buildDepthInstruction). Those two
//      are written for rulings: evidence, differing scholars, «لم أقف عليه في المراجع المتاحة». The
//      general frame asks for the depth and for the whole task, nothing about fiqh or sources.
//
// WHAT STAYS: the identity and the persona, the red lines and the safety, the free brain's own
// instructions (UNLOCKS and PERSONA, with the line about songs), the reviewer and the finalizer, the
// tools as GENERAL shows them today. lib/system-prompt.js is NOT edited: it is sha-pinned in five
// fingerprints, and the shari'a frame must stay byte for byte what it is. The substitution is made on
// its OUTPUT, here, and only for the general frame.

/** The line of lib/system-prompt.js (607 at a038bd7) the general frame replaces. Letter for letter. */
export const SHARIA_SOURCE_LINE = 'اعتمدْ فقط على الموادِ والمصادرِ التي سلَّمها لك الخادمُ فعليًّا في هذا الطلب، ولا تسمِّ مصدرًا بوصفه متاحًا ما لم يكن ضمنها.';

/** What the general frame says in its place. Letter for letter as the order gives it. */
export const GENERAL_SOURCE_LINE = 'لا تذكرْ مصدرًا أو رابطًا أو كتابًا بوصفِه متاحًا لك ما لم يُسلَّمْ إليك في هذا الطلب.';

/**
 * The system prompt text in the general frame. If the line is not found exactly once the text is returned
 * untouched and `replaced` is false -- the caller then stays on the shari'a frame and says so.
 * @returns {{text:string, replaced:boolean}}
 */
export function generalizeSystemText(text) {
  const source = String(text == null ? '' : text);
  const parts = source.split(SHARIA_SOURCE_LINE);
  if (parts.length !== 2) return { text: source, replaced: false };
  return { text: parts[0] + GENERAL_SOURCE_LINE + parts[1], replaced: true };
}

export const GENERAL_DEPTH_DEEP = 'وسّعِ الجوابَ في هذا الوضع: تفصيلٌ أوفى وأمثلةٌ حيث تنفع، مع تنفيذِ المطلوبِ كاملًا.';
export const GENERAL_DEPTH_SCHOLAR = 'هذا وضعُ التعمّق: أجِبْ بدقّةٍ وترتيبٍ منهجيّ، مع تنفيذِ المطلوبِ كاملًا.';

/** The depth instruction of the general frame. The brief tier is empty, as it is today. */
export function buildGeneralDepthInstruction(depth) {
  if (depth === 'deep') return GENERAL_DEPTH_DEEP;
  if (depth === 'scholar') return GENERAL_DEPTH_SCHOLAR;
  return '';
}

/**
 * The same swap on the system the handler already built (an array of blocks: the cached prompt, then the
 * depth instruction when there is one, then the date block when that switch is on). The first block's one
 * line is swapped, the shari'a depth instruction is swapped for the general one (or dropped when that is empty),
 * every other block is kept as it is -- so the date block is not built a second time.
 * @returns {{blocks:Array, replaced:boolean}}  replaced is false (and blocks are the input) when the line is not
 *   found exactly once in the first block: the caller then stays on the shari'a frame.
 */
export function generalizeSystemBlocks(blocks, depthText, depth) {
  if (!Array.isArray(blocks) || blocks.length === 0 || !blocks[0] || typeof blocks[0].text !== 'string') return { blocks, replaced: false };
  const first = generalizeSystemText(blocks[0].text);
  if (!first.replaced) return { blocks, replaced: false };
  const general = buildGeneralDepthInstruction(depth);
  const out = [{ ...blocks[0], text: first.text }];
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (depthText && block && block.text === depthText) {
      if (general) out.push({ ...block, text: general });
    } else {
      out.push(block);
    }
  }
  return { blocks: out, replaced: true };
}
