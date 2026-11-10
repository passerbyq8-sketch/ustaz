import policy from './panel-policy.cjs';
export { policy };
export const PANEL_SETTINGS_KEY = 'panel:settings:v1';
// Revision compare-and-set prevents concurrent dashboard edits losing each other.
export const SAVE_PANEL_SETTINGS = `
local current = redis.call('GET', KEYS[1])
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'EX', 2592000)
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;
export async function readPanelSettings(redis) {
  const stored = await redis.get(PANEL_SETTINGS_KEY);
  if (stored == null) return { raw: null, document: policy.defaults() };
  const raw = typeof stored === 'string' ? stored : JSON.stringify(stored);
  const document = policy.validate(JSON.parse(raw));
  if (!document) throw Error('panel-settings-store');
  return { raw, document };
}
export async function savePanelSettings(redis, input) {
  const next = policy.validate(input);
  if (!next) return { ok: false, error: 'panel-settings-invalid' };
  const before = await readPanelSettings(redis);
  if (next.revision !== before.document.revision) return { ok: false, error: 'panel-settings-conflict' };
  next.revision++;
  // Redis GET of a missing key is false in Lua. Compare through a normalized empty value.
  const script = SAVE_PANEL_SETTINGS.replace("local current = redis.call('GET', KEYS[1])", "local current = redis.call('GET', KEYS[1]) or ''");
  const saved = await redis.eval(script, [PANEL_SETTINGS_KEY, PANEL_SETTINGS_KEY + ':previous'], [before.raw || '', JSON.stringify(next)]);
  return saved === 1 ? { ok: true, document: next } : { ok: false, error: 'panel-settings-conflict' };
}
