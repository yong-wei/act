import { createHash } from 'node:crypto';
import { redisClient } from '@/lib/redis-client';

const INTERVAL_MS = 1500;
const LIMIT = 6;
const CAPACITY = 240;
const WAITING_MS = 30_000;
const LEASE_MS = 30_000;
const PREFIX = 'simulation:{course-save}';

const ADMIT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local round, worker, action = ARGV[1], ARGV[2], ARGV[3]
local interval, limit, capacity = tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])
local waitingMs, leaseMs = tonumber(ARGV[7]), tonumber(ARGV[8])
for _, key in ipairs(redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now)) do
  redis.call('ZREM', KEYS[2], key)
end
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', now)
local holder = redis.call('GET', KEYS[5])
if action == 'release' then
  if holder == worker then
    redis.call('DEL', KEYS[5])
    redis.call('ZREM', KEYS[4], round)
    if redis.call('GET', KEYS[6]) == round then redis.call('DEL', KEYS[6]) end
  end
  return 0
end
if holder == worker then
  redis.call('PEXPIRE', KEYS[5], leaseMs)
  redis.call('PSETEX', KEYS[6], leaseMs, round)
  redis.call('ZADD', KEYS[4], now + leaseMs, round)
  redis.call('PEXPIRE', KEYS[4], leaseMs * 2)
  return 0
end
if action == 'renew' then return -2 end
if holder then return 2000 end
local accountRound = redis.call('GET', KEYS[6])
if accountRound and accountRound ~= round then return 6000 end
local rank = redis.call('ZRANK', KEYS[2], round)
if not rank then
  if redis.call('ZCARD', KEYS[2]) >= capacity then return -1 end
  redis.call('ZADD', KEYS[2], redis.call('HINCRBY', KEYS[1], 'sequence', 1), round)
  rank = redis.call('ZRANK', KEYS[2], round)
end
redis.call('ZADD', KEYS[3], now + waitingMs, round)
redis.call('PSETEX', KEYS[6], waitingMs, round)
for i = 1, 3 do redis.call('PEXPIRE', KEYS[i], waitingMs * 2) end
local nextAt = tonumber(redis.call('HGET', KEYS[1], 'next') or '0')
if rank == 0 and now >= nextAt and redis.call('ZCARD', KEYS[4]) < limit then
  redis.call('HSET', KEYS[1], 'next', now + interval)
  redis.call('ZREM', KEYS[2], round)
  redis.call('ZREM', KEYS[3], round)
  redis.call('PSETEX', KEYS[5], leaseMs, worker)
  redis.call('PSETEX', KEYS[6], leaseMs, round)
  redis.call('ZADD', KEYS[4], now + leaseMs, round)
  redis.call('PEXPIRE', KEYS[4], leaseMs * 2)
  return 0
end
return math.max(interval, math.min(6000, nextAt - now + rank * interval))
`;

export async function updateCourseSaveAdmission(userId: string, roundRef: string, worker: string,
  action: 'reserve' | 'renew' | 'release') {
  if (process.env.SIMULATION_SAVE_QUEUE !== '1') return 0;
  const redis = redisClient.getClient();
  if (!redis) throw new Error('Simulation save Redis unavailable');
  const round = createHash('sha256').update(JSON.stringify([userId, roundRef])).digest('hex');
  const account = createHash('sha256').update(userId).digest('hex');
  return Number(await redis.eval(ADMIT, 6, `${PREFIX}:cursor`, `${PREFIX}:waiting`, `${PREFIX}:expires`,
    `${PREFIX}:active`, `${PREFIX}:lease:${round}`, `${PREFIX}:account:${account}`,
    round, worker, action, INTERVAL_MS, LIMIT, CAPACITY, WAITING_MS, LEASE_MS));
}
