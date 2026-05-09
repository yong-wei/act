/**
 * Redis Event Buffer
 *
 * Buffers secondary events in Redis for batch processing.
 * Core events bypass this and go directly to PostgreSQL.
 */

import { redisClient } from '@/lib/redis-client';
import type { LearningEvent, EventPriority } from './event-protocol';
import { isCoreEvent, isSecondaryEvent } from './event-types';

// Redis key patterns
const REDIS_KEYS = {
  secondaryBuffer: (date: string) => `event:buffer:secondary:${date}`,
  dailyStats: (date: string) => `event:stats:daily:${date}`,
  userSequence: (userId: string) => `event:sequence:${userId}`,
};

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

    // Compress event to JSON string
    const eventJson = JSON.stringify(event);

    // Push to list with max length protection (keep last 10000)
    await client.lpush(key, eventJson);
    await client.ltrim(key, 0, 9999);

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

/**
 * Fetch secondary events from buffer for processing
 */
export async function fetchSecondaryEvents(
  date: string,
  limit: number = 100
): Promise<LearningEvent[]> {
  if (!redisClient.isReady()) {
    return [];
  }

  const client = redisClient.getClient();
  if (!client) return [];

  try {
    const key = REDIS_KEYS.secondaryBuffer(date);

    // Pop events from the end (oldest first)
    const eventJsons: string[] = [];
    for (let i = 0; i < limit; i++) {
      const eventJson = await client.rpop(key);
      if (!eventJson) break;
      eventJsons.push(eventJson);
    }

    // Parse events
    const events: LearningEvent[] = [];
    for (const json of eventJsons) {
      try {
        const event = JSON.parse(json) as LearningEvent;
        events.push(event);
      } catch {
        // Skip invalid JSON
      }
    }

    return events;
  } catch (error) {
    console.error('[EventBuffer] Failed to fetch events:', error);
    return [];
  }
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
    const key = REDIS_KEYS.secondaryBuffer(date);
    return await client.llen(key);
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
