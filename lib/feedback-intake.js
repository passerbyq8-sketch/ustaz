// SEC-039: the allowance check, save and both counters share one atomic operation.
// Validate all key types and numeric inputs before the first write. Saving comes
// first, so a rejected list write cannot spend a reader's allowance.
export const SAVE_FEEDBACK_SCRIPT = `
local device = tonumber(redis.call('GET', KEYS[1]) or '0')
local account = tonumber(redis.call('GET', KEYS[2]) or '0')
if device == nil or account == nil then return -1 end
if device < 0 or account < 0 then return -1 end
if device % 1 ~= 0 or account % 1 ~= 0 then return -1 end
if device >= tonumber(ARGV[2]) or account >= tonumber(ARGV[3]) then return 0 end
local kind = redis.call('TYPE', KEYS[3]).ok
if kind ~= 'none' and kind ~= 'list' then return -1 end
redis.call('LPUSH', KEYS[3], ARGV[1])
redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[5]) - 1)
redis.call('SET', KEYS[1], device + 1, 'EX', tonumber(ARGV[4]))
redis.call('SET', KEYS[2], account + 1, 'EX', tonumber(ARGV[4]))
return 1
`;
export function saveFeedback(redis, keys, record, deviceCap, accountCap, ttl, keep) {
  return redis.eval(SAVE_FEEDBACK_SCRIPT, keys, [JSON.stringify(record), deviceCap, accountCap, ttl, keep]);
}
