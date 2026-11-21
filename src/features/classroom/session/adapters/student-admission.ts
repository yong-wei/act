import { createHash } from 'node:crypto';
import { redisClient } from '@/lib/redis-client';
import { getHostAdmissionScale } from '@/lib/simulation-admission-pressure';
import { isClassroomCapacityEnabled } from './shared-classroom-reads';

// Keep waiting leases and admitted slots per classroom, independent of browser storage.
const RESERVE = `
local id = ARGV[1]
local batch = tonumber(ARGV[2])
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local probe = ARGV[4] == 'probe'
if redis.call('EXISTS', KEYS[4]) == 1 then return 0 end
for _, expired in ipairs(redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now)) do
  redis.call('ZREM', KEYS[2], expired)
  redis.call('ZREM', KEYS[5], expired)
end
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
local rank = redis.call('ZRANK', KEYS[2], id)
if not rank then
  if redis.call('ZCARD', KEYS[2]) >= 512 then return 7500 end
  redis.call('ZADD', KEYS[2], redis.call('HINCRBY', KEYS[1], 'sequence', 1), id)
  rank = redis.call('ZRANK', KEYS[2], id)
end
redis.call('ZADD', KEYS[3], now + 30000, id)
for i = 1, 3 do redis.call('PEXPIRE', KEYS[i], 60000) end
redis.call('PEXPIRE', KEYS[5], 60000)
local spread = tonumber(string.sub(id, 1, 3), 16)
if batch == 0 then
  if rank < 3 then return 1300 + spread % 550 end
  return 5200 + spread % 2200
end
local slot = math.floor(now / 1000)
local used = 0
if tostring(slot) == redis.call('HGET', KEYS[1], 'slot') then
  used = tonumber(redis.call('HGET', KEYS[1], 'used') or 0)
end
local available = batch - used
local candidate = rank < available
local holdMs = tonumber(ARGV[3])
if not candidate and available > 0 and holdMs > 0 then
  local offered = 0
  -- A sleeping head holds capacity briefly. Ready candidates can use its
  -- unused slot after that grace, while the head retains its queue order.
  for _, head in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do
    if head == id then
      candidate = true
      break
    end
    local deadline = tonumber(redis.call('ZSCORE', KEYS[5], head))
    if not deadline then
      redis.call('ZADD', KEYS[5], now + holdMs, head)
      deadline = now + holdMs
    end
    if deadline > now then offered = offered + 1 end
    if offered >= available then break end
  end
  redis.call('PEXPIRE', KEYS[5], 60000)
end
if candidate then
  if probe then return 0 end
  redis.call('HSET', KEYS[1], 'slot', slot, 'used', used + 1)
  redis.call('ZREM', KEYS[2], id)
  redis.call('ZREM', KEYS[3], id)
  redis.call('ZREM', KEYS[5], id)
  redis.call('PSETEX', KEYS[4], 2700000, '1')
  return 0
end
local untilNextSlot = 1000 - now % 1000
local slotsAhead = math.floor((rank + used) / batch)
if slotsAhead < 2 then return untilNextSlot + spread % 300 end
-- Far-back students can wait longer between probes within their 30-second lease.
return math.min(14000, untilNextSlot + (slotsAhead - 1) * 1000) + spread % 1800
`;

export async function reserveInteractiveStudentAdmission(sessionId: string, userId: string, mode: 'probe' | 'reserve' = 'reserve') {
  if (!isClassroomCapacityEnabled()) return 0;
  const batch = Number(process.env.INTERACTIVE_CLASSROOM_ADMISSION_BATCH ?? 12);
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > 40) return 3000;
  const redis = redisClient.getClient();
  if (redis?.status !== 'ready') return 2500;
  const prefix = `interactive-classroom:{${createHash('sha256').update(sessionId).digest('hex')}}`;
  const user = createHash('sha256').update(userId).digest('hex');
  const adaptive = process.platform === 'linux' && process.env.INTERACTIVE_CLASSROOM_ADAPTIVE_ADMISSION !== '0';
  const scale = adaptive ? await getHostAdmissionScale() : 1;
  const limit = Math.min(40, Math.ceil(batch * scale));
  const holdMs = process.env.INTERACTIVE_CLASSROOM_HEAD_HOLD === '0' ? 0 : 1500;
  try {
    return Number(await redis.eval(RESERVE, 5, `${prefix}:cursor`, `${prefix}:waiting`,
      `${prefix}:expires`, `${prefix}:student:${user}`, `${prefix}:head-holds`, user, limit, holdMs, mode));
  } catch {
    return 2500;
  }
}
