import { createHash } from 'node:crypto';
import { redisClient } from '@/lib/redis-client';
import { isClassroomCapacityEnabled } from './shared-classroom-reads';

// Keep waiting leases and admitted slots per classroom, independent of browser storage.
const RESERVE = `
local id = ARGV[1]
local batch = tonumber(ARGV[2])
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if redis.call('EXISTS', KEYS[4]) == 1 then return 0 end
for _, expired in ipairs(redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now)) do
  redis.call('ZREM', KEYS[2], expired)
end
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
local rank = redis.call('ZRANK', KEYS[2], id)
if not rank then
  if redis.call('ZCARD', KEYS[2]) >= 512 then return 7500 end
  redis.call('ZADD', KEYS[2], redis.call('HINCRBY', KEYS[1], 'sequence', 1), id)
  rank = redis.call('ZRANK', KEYS[2], id)
end
redis.call('ZADD', KEYS[3], now + 15000, id)
for i = 1, 3 do redis.call('PEXPIRE', KEYS[i], 30000) end
local slot = math.floor(now / 1000)
local used = 0
if tostring(slot) == redis.call('HGET', KEYS[1], 'slot') then
  used = tonumber(redis.call('HGET', KEYS[1], 'used') or 0)
end
if rank < batch - used then
  redis.call('HSET', KEYS[1], 'slot', slot, 'used', used + 1)
  redis.call('ZREM', KEYS[2], id)
  redis.call('ZREM', KEYS[3], id)
  redis.call('PSETEX', KEYS[4], 2700000, '1')
  return 0
end
local spread = tonumber(string.sub(id, 1, 3), 16) % 550
return math.min(2700, 1000 - now % 1000 + math.floor((rank + used) / batch) * 1000) + spread
`;

export async function reserveInteractiveStudentAdmission(sessionId: string, userId: string) {
  if (!isClassroomCapacityEnabled()) return 0;
  const batch = Number(process.env.INTERACTIVE_CLASSROOM_ADMISSION_BATCH ?? 12);
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > 40) return 3000;
  const redis = redisClient.getClient();
  if (redis?.status !== 'ready') return 2500;
  const prefix = `interactive-classroom:{${createHash('sha256').update(sessionId).digest('hex')}}`;
  const user = createHash('sha256').update(userId).digest('hex');
  try {
    return Number(await redis.eval(RESERVE, 4, `${prefix}:cursor`, `${prefix}:waiting`,
      `${prefix}:expires`, `${prefix}:student:${user}`, user, batch));
  } catch {
    return 2500;
  }
}
