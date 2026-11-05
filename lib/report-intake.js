import crypto from 'node:crypto';
// SEC-017: accepted reports are never evicted by subsequent anonymous intake.
// Duplicate receipts are isolated from the protected list, bounded and short lived.
export const SAVE_REPORT_SCRIPT = `
local size = redis.call('LLEN', KEYS[1])
if redis.call('GET', KEYS[2]) then
  redis.call('LPUSH', KEYS[3], ARGV[2])
  redis.call('LTRIM', KEYS[3], 0, 199)
  redis.call('EXPIRE', KEYS[3], 86400)
  return 0
end
if size >= tonumber(ARGV[3]) then return -1 end
redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], '1', 'EX', 86400)
return 1
`;
export async function saveReport(redis, record, keep) {
  const { ts, ...content } = record;
  const digest = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return redis.eval(SAVE_REPORT_SCRIPT, ['reports', 'reports:dedup:' + digest, 'reports:quarantine'],
    [JSON.stringify(record), JSON.stringify({ digest, ts }), keep]);
}
