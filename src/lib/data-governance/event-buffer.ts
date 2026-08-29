/**
 * Redis Event Buffer
 *
 * Buffers secondary events in Redis for batch processing.
 * Core events bypass this and go directly to PostgreSQL.
 */

import { createHash } from 'node:crypto';
import { redisClient } from '@/lib/redis-client';
import type { LearningEvent } from './event-protocol';
import { isCoreEvent, isSecondaryEvent } from './event-types';

export const SECONDARY_CLAIM_LEASE_MS = 5 * 60 * 1000;
export const SECONDARY_BUFFER_CAPACITY = 10_000;

const REDIS_KEYS = {
  secondaryBuffer: (date: string) => `event:buffer:secondary:${date}`,
  secondaryProcessing: (date: string) => `event:processing:secondary:${date}`,
  secondaryLease: (date: string) => `event:lease:secondary:${date}`,
  dailyStats: (date: string) => `event:stats:daily:${date}`,
  userSequence: (userId: string) => `event:sequence:${userId}`,
};

function leaseField(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface ClaimedSecondaryEvent {
  raw: string;
  event: LearningEvent | null;
  invalid: boolean;
}

export interface BufferStats {
  buffered: number;
  dropped: number;
  lastBufferTime: number;
}

const stats: BufferStats = {
  buffered: 0,
  dropped: 0,
  lastBufferTime: Date.now(),
};

/**
 * Route event to appropriate destination based on priority
 */
export async function routeEvent(event: LearningEvent): Promise<{
  destination: 'postgresql' | 'redis' | 'dropped';
  reason?: string;
}> {
  // Check if Redis is available
  if (!redisClient.isReady()) {
    // Redis unavailable: core events still go to DB, secondary dropped
    if (isCoreEvent(event.actionType)) {
      return { destination: 'postgresql' };
    }
    stats.dropped++;
    return { destination: 'dropped', reason: 'redis_unavailable' };
  }

  // Route based on event type
  if (isCoreEvent(event.actionType)) {
    return { destination: 'postgresql' };
  }

  if (isSecondaryEvent(event.actionType)) {
    const success = await bufferSecondaryEvent(event);
    return {
      destination: success ? 'redis' : 'dropped',
      reason: success ? undefined : 'buffer_full',
    };
  }

  // Unknown event type: treat as secondary (safer)
  const success = await bufferSecondaryEvent(event);
  return {
    destination: success ? 'redis' : 'dropped',
    reason: success ? undefined : 'buffer_full',
  };
}

/**
 * Buffer a secondary event in Redis
 */
export async function bufferSecondaryEvent(event: LearningEvent): Promise<boolean> {
  if (!redisClient.isReady()) {
    return false;
  }

  const client = redisClient.getClient();
  if (!client) return false;

  try {
    const date = new Date().toISOString().split('T')[0];
    const key = REDIS_KEYS.secondaryBuffer(date);
    const buffered = await client.llen(key);
    if (buffered >= SECONDARY_BUFFER_CAPACITY) {
      stats.dropped++;
      return false;
    }

    const eventJson = JSON.stringify(event);
    await client.lpush(key, eventJson);

    // Set expiration (7 days)
    await client.expire(key, 7 * 24 * 60 * 60);

    // Update stats
    await client.hincrby(REDIS_KEYS.dailyStats(date), 'buffered', 1);
    await client.expire(REDIS_KEYS.dailyStats(date), 7 * 24 * 60 * 60);

    stats.buffered++;
    stats.lastBufferTime = Date.now();

    return true;
  } catch (error) {
    console.error('[EventBuffer] Failed to buffer event:', error);
    return false;
  }
}

export async function recoverExpiredSecondaryClaims(
  date: string,
  now = Date.now(),
  leaseMs = SECONDARY_CLAIM_LEASE_MS,
): Promise<number> {
  if (!redisClient.isReady()) return 0;
  const client = redisClient.getClient();
  if (!client) return 0;

  const processingKey = REDIS_KEYS.secondaryProcessing(date);
  const bufferKey = REDIS_KEYS.secondaryBuffer(date);
  const leaseKey = REDIS_KEYS.secondaryLease(date);
  const items = await client.lrange(processingKey, 0, -1);
  let recovered = 0;
  for (const raw of items) {
    const claimedAt = Number(await client.hget(leaseKey, leaseField(raw)));
    if (Number.isFinite(claimedAt) && now - claimedAt < leaseMs) continue;
    await client.lrem(processingKey, 1, raw);
    await client.rpush(bufferKey, raw);
    await client.hdel(leaseKey, leaseField(raw));
    recovered += 1;
  }
  return recovered;
}

export async function claimSecondaryEvents(
  date: string,
  limit: number = 100,
  now = Date.now(),
): Promise<ClaimedSecondaryEvent[]> {
  if (!redisClient.isReady()) return [];
  const client = redisClient.getClient();
  if (!client) return [];

  try {
    await recoverExpiredSecondaryClaims(date, now);
    const bufferKey = REDIS_KEYS.secondaryBuffer(date);
    const processingKey = REDIS_KEYS.secondaryProcessing(date);
    const leaseKey = REDIS_KEYS.secondaryLease(date);
    const claims: ClaimedSecondaryEvent[] = [];
    for (let i = 0; i < limit; i += 1) {
      const raw = await client.rpoplpush(bufferKey, processingKey);
      if (!raw) break;
      await client.hset(leaseKey, leaseField(raw), String(now));
      await client.expire(leaseKey, 7 * 24 * 60 * 60);
      await client.expire(processingKey, 7 * 24 * 60 * 60);
      try {
        claims.push({ raw, event: JSON.parse(raw) as LearningEvent, invalid: false });
      } catch {
        claims.push({ raw, event: null, invalid: true });
      }
    }
    return claims;
  } catch (error) {
    console.error('[EventBuffer] Failed to claim events:', error);
    return [];
  }
}

export async function ackSecondaryEvents(date: string, claims: ClaimedSecondaryEvent[]): Promise<void> {
  if (!redisClient.isReady() || claims.length === 0) return;
  const client = redisClient.getClient();
  if (!client) return;
  const processingKey = REDIS_KEYS.secondaryProcessing(date);
  const leaseKey = REDIS_KEYS.secondaryLease(date);
  for (const claim of claims) {
    await client.lrem(processingKey, 1, claim.raw);
    await client.hdel(leaseKey, leaseField(claim.raw));
  }
}

/**
 * Claim secondary events without acknowledging them. Callers MUST ack after
 * fact+trigger commit. Invalid JSON is returned as `invalid` rather than dropped.
 */
export async function fetchSecondaryEvents(
  date: string,
  limit: number = 100
): Promise<LearningEvent[]> {
  const claims = await claimSecondaryEvents(date, limit);
  return claims.flatMap((claim) => (claim.event ? [claim.event] : []));
}

/**
 * Get count of buffered events for a date
 */
export async function getBufferedEventCount(date: string): Promise<number> {
  if (!redisClient.isReady()) {
    return 0;
  }

  const client = redisClient.getClient();
  if (!client) return 0;

  try {
    const buffered = await client.llen(REDIS_KEYS.secondaryBuffer(date));
    const processing = await client.llen(REDIS_KEYS.secondaryProcessing(date));
    return buffered + processing;
  } catch {
    return 0;
  }
}

/**
 * Get buffer statistics
 */
export function getBufferStats(): BufferStats {
  return { ...stats };
}

/**
 * Get daily statistics from Redis
 */
export async function getDailyStats(date: string): Promise<{
  buffered: number;
  processed: number;
}> {
  if (!redisClient.isReady()) {
    return { buffered: 0, processed: 0 };
  }

  const client = redisClient.getClient();
  if (!client) return { buffered: 0, processed: 0 };

  try {
    const stats = await client.hgetall(REDIS_KEYS.dailyStats(date));
    return {
      buffered: parseInt(stats.buffered || '0', 10),
      processed: parseInt(stats.processed || '0', 10),
    };
  } catch {
    return { buffered: 0, processed: 0 };
  }
}

/**
 * Mark events as processed in stats
 */
export async function markEventsProcessed(count: number, batchDate?: string): Promise<void> {
  if (!redisClient.isReady()) return;

  const client = redisClient.getClient();
  if (!client) return;

  const date = batchDate && batchDate.trim().length > 0
    ? batchDate
    : new Date().toISOString().split('T')[0];
  try {
    await client.hincrby(REDIS_KEYS.dailyStats(date), 'processed', count);
  } catch (error) {
    console.error('[EventBuffer] Failed to mark processed:', error);
  }
}
