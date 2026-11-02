// Local BW2 path with explicit rows, judge and writer; no network or model.
import { runBw2Turn } from '../../lib/before-writing-v2.js';

export const ROW = Object.freeze({ kind: 'fatwa', title: 'المسح على الجوربين',
  url: 'https://binbaz.org.sa/fatwas/1234', publisher: 'ابن باز', recordId: '1234',
  text: 'يجوز المسح على الجوربين إذا كانا صفيقين. مدة المسح يوم وليلة للمقيم.' });
export async function turn({ question = 'ما حكم المسح على الجوربين؟', rows = [ROW],
  text = 'يجوز المسح على الجوربين إذا كانا صفيقين [[1]].', env = {},
  stop = 'end_turn', mode = 'brief', judge = 1, extraDeps = {}, extra = {}, run = runBw2Turn } = {}) {
  const calls = { writer: [], judge: [], tools: [] };
  const events = [];
  let sent = '';
  const wire = {
    status: (...args) => { events.push({ type: 'status', args, at: performance.now() }); return true; },
    delta: (delta) => { sent += delta; events.push({ type: 'delta', text: delta, at: performance.now() }); return true; },
    liveOffer: () => { events.push({ type: 'offer' }); return true; },
    finish: () => { events.push({ type: 'finish' }); },
    get sent() { return sent; },
  };
  const deps = {
    runTool: async (name, input, ctx) => {
      calls.tools.push({ name, input });
      return { text: '', added: name === 'search_fatawa' ? rows.map((r) => ctx.table.add({ ...r })) : [], calls: 1 };
    },
    encyclopediaReady: () => true,
    warmEncyclopedia: async () => true,
    searchStoredCorpus: async () => ({ records: [] }),
    scholarBooksOf: () => null,
    ask: async (body) => {
      calls.judge.push(body);
      const count = (body.user.match(/^\[\d+\] /gmu) || []).length;
      return JSON.stringify({ d: Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, judge])) });
    },
    callWriter: async ({ body, onText }) => {
      calls.writer.push(body); onText(text);
      return { usage: { input_tokens: 10, output_tokens: 10 }, content: [],
        stop_reason: typeof stop === 'function' ? stop(calls.writer.length) : stop };
    },
    ...extraDeps,
  };
  const out = await run({ question, messages: [{ role: 'user', content: question }], mode, band: 'adult',
    system: 'local proof', model: 'stub-writer', maxTokens: 6144, providerUrl: 'https://provider.invalid', headers: {},
    wire, env: { BW2_RETRIEVAL_MS: '400', BW2_JUDGE_MS: '400', ...env }, deps, ...extra });
  return { out, calls, events, sent };
}
