import { redisClient } from '@/lib/redis-client';
import { getSimulationAdmissionScale } from '@/lib/simulation-admission-pressure';

const WINDOW_MS = 5_000;
const WAITING_TTL_MS = 30_000;
const LEASE_MS = 30 * 60_000;

// Count actual releases, including clients whose polling was delayed.
const RESERVE = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if redis.call('EXISTS', KEYS[4]) == 1 then return 0 end
local interval = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
for _, id in ipairs(redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now)) do
  redis.call('ZREM', KEYS[2], id)
  redis.call('ZREM', KEYS[3], id)
end
local id = ARGV[5]
if not redis.call('ZSCORE', KEYS[2], id) then
  redis.call('ZADD', KEYS[2], redis.call('HINCRBY', KEYS[1], 'sequence', 1), id)
end
redis.call('ZADD', KEYS[3], now + tonumber(ARGV[3]), id)
for i = 1, 3 do redis.call('PEXPIRE', KEYS[i], tonumber(ARGV[3]) * 2) end
if limit == 0 then return 5000 end
local slot = math.floor(now / interval)
local used = 0
if tostring(slot) == redis.call('HGET', KEYS[1], 'slot') then
  used = tonumber(redis.call('HGET', KEYS[1], 'used') or 0)
end
local rank = redis.call('ZRANK', KEYS[2], id)
if rank < limit - used then
  redis.call('HSET', KEYS[1], 'slot', slot, 'used', used + 1)
  redis.call('ZREM', KEYS[2], id)
  redis.call('ZREM', KEYS[3], id)
  redis.call('PSETEX', KEYS[4], ARGV[4], '1')
  return 0
end
return math.min(10000, interval - now % interval + math.floor((rank + used) / limit) * interval)
`;

export async function reserveSimulationClassroomEntry(browserId: string) {
  if (process.env.SIMULATION_ENTRY_QUEUE !== '1') return 0;
  const batch = Number(process.env.SIMULATION_ENTRY_BATCH_SIZE ?? 2);
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > 120) throw new Error('Invalid simulation entry batch size');
  const redis = redisClient.getClient();
  if (!redis) throw new Error('Simulation entry Redis unavailable');
  const scale = await getSimulationAdmissionScale();
  const limit = scale ? Math.min(120, Math.ceil(batch * scale)) : 0;
  return Number(await redis.eval(RESERVE, 4,
    'simulation:{classroom-entry}:cursor', 'simulation:{classroom-entry}:waiting',
    'simulation:{classroom-entry}:expires', `simulation:{classroom-entry}:browser:${browserId}`,
    WINDOW_MS, limit, WAITING_TTL_MS, LEASE_MS, browserId));
}
