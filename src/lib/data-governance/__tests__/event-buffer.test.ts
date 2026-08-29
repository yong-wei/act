import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LearningEvent } from '../event-protocol';

// Define mock functions before importing the module
const mockLpush = vi.fn();
const mockRpop = vi.fn();
const mockRpoplpush = vi.fn();
const mockLrange = vi.fn();
const mockLrem = vi.fn();
const mockRpush = vi.fn();
const mockHset = vi.fn();
const mockHget = vi.fn();
const mockHdel = vi.fn();
const mockLtrim = vi.fn();
const mockLlen = vi.fn();
const mockEval = vi.fn();
const mockHincrby = vi.fn();
const mockHgetall = vi.fn();
const mockExpire = vi.fn();

const mockIsReady = vi.fn().mockReturnValue(true);
const mockGetClient = vi.fn().mockReturnValue({
  lpush: mockLpush,
  rpop: mockRpop,
  rpoplpush: mockRpoplpush,
  lrange: mockLrange,
  lrem: mockLrem,
  rpush: mockRpush,
  hset: mockHset,
  hget: mockHget,
  hdel: mockHdel,
  ltrim: mockLtrim,
  llen: mockLlen,
  eval: mockEval,
  hincrby: mockHincrby,
  hgetall: mockHgetall,
  expire: mockExpire,
});

// Mock the redis-client module
vi.mock('@/lib/redis-client', () => ({
  redisClient: {
    isReady: () => mockIsReady(),
    getClient: () => mockGetClient(),
  },
}));

// Import after mocking
import {
  routeEvent,
  bufferSecondaryEvent,
  fetchSecondaryEvents,
  claimSecondaryEvents,
  ackSecondaryEvents,
  recoverExpiredSecondaryClaims,
  getBufferedEventCount,
  getBufferStats,
  getDailyStats,
  markEventsProcessed,
} from '../event-buffer';

// Helper function to create mock LearningEvent
function createMockEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    eventId: 'event-' + Math.random().toString(36).substr(2, 9),
    occurredAt: new Date().toISOString(),
    userId: 'user-1',
    role: 'student',
    pagePath: '/test',
    pageType: 'theory',
    actionType: 'page_view',
    payload: {},
    source: 'web',
    priority: 'secondary',
    ...overrides,
  };
}

describe('routeEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockEval.mockResolvedValue(1);
  });

  it('should route core events to postgresql', async () => {
    const event = createMockEvent({
      actionType: 'answer_submit',
      priority: 'core',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('postgresql');
    expect(mockEval).not.toHaveBeenCalled();
  });

  it('should route resource_complete to postgresql as a high-value extracurricular event', async () => {
    const event = createMockEvent({
      actionType: 'resource_complete',
      priority: 'core',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('postgresql');
    expect(mockEval).not.toHaveBeenCalled();
  });

  it('should route secondary events to redis', async () => {
    const event = createMockEvent({
      actionType: 'page_view',
      priority: 'secondary',
    });
    mockEval.mockResolvedValue(1);

    const result = await routeEvent(event);

    expect(result.destination).toBe('redis');
    expect(mockEval).toHaveBeenCalled();
  });

  it('should route unknown event types to redis', async () => {
    const event = createMockEvent({
      actionType: 'unknown_event_type',
      priority: 'secondary',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('redis');
    expect(mockEval).toHaveBeenCalled();
  });

  it('should route core events to postgresql when redis is unavailable', async () => {
    mockIsReady.mockReturnValue(false);
    const event = createMockEvent({
      actionType: 'answer_submit',
      priority: 'core',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('postgresql');
  });

  it('should drop secondary events when redis is unavailable', async () => {
    mockIsReady.mockReturnValue(false);
    const event = createMockEvent({
      actionType: 'page_view',
      priority: 'secondary',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('dropped');
    expect(result.reason).toBe('redis_unavailable');
  });

  it('should drop events when buffer is full', async () => {
    mockEval.mockResolvedValue(0);
    const event = createMockEvent({
      actionType: 'page_view',
      priority: 'secondary',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('dropped');
    expect(result.reason).toBe('buffer_full');
  });
});

describe('bufferSecondaryEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockEval.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
    mockHincrby.mockResolvedValue(1);
  });

  it('should buffer event in Redis', async () => {
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(true);
    expect(mockEval).toHaveBeenCalled();
    expect(mockLpush).not.toHaveBeenCalled();
    expect(mockLtrim).not.toHaveBeenCalled();
  });

  it('should return false when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
    expect(mockEval).not.toHaveBeenCalled();
  });

  it('should return false when Redis client is null', async () => {
    mockGetClient.mockReturnValueOnce(null);
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
  });

  it('rejects new writes when buffer plus processing occupancy is at capacity', async () => {
    mockEval.mockResolvedValue(0);
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('LLEN', buffer) + redis.call('LLEN', processing)"),
      2,
      expect.stringContaining('event:buffer:secondary:'),
      expect.stringContaining('event:processing:secondary:'),
      10000,
      expect.any(String),
      7 * 24 * 60 * 60,
    );
    expect(mockLpush).not.toHaveBeenCalled();
    expect(mockLtrim).not.toHaveBeenCalled();
  });

  it('should set expiration to 7 days', async () => {
    const event = createMockEvent({ actionType: 'page_view' });

    await bufferSecondaryEvent(event);

    expect(mockExpire).toHaveBeenCalledWith(
      expect.any(String),
      7 * 24 * 60 * 60
    );
  });

  it('should update daily stats', async () => {
    const event = createMockEvent({ actionType: 'page_view' });

    await bufferSecondaryEvent(event);

    expect(mockHincrby).toHaveBeenCalledWith(
      expect.stringContaining('stats:daily'),
      'buffered',
      1
    );
  });

  it('should return false on Redis error', async () => {
    mockEval.mockRejectedValue(new Error('Redis error'));
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
  });
});

describe('claimSecondaryEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockLrange.mockResolvedValue([]);
    mockHget.mockResolvedValue(null);
    mockEval.mockResolvedValue(0);
  });

  it('moves events with rpoplpush instead of destructive rpop', async () => {
    const mockEvent = createMockEvent({ actionType: 'page_view' });
    mockRpoplpush
      .mockResolvedValueOnce(JSON.stringify(mockEvent))
      .mockResolvedValueOnce(null);

    const claims = await claimSecondaryEvents('2024-01-01', 10);

    expect(mockRpop).not.toHaveBeenCalled();
    expect(mockRpoplpush).toHaveBeenCalled();
    expect(claims).toHaveLength(1);
    expect(claims[0].event?.eventId).toBe(mockEvent.eventId);
  });

  it('does not ack until callers remove the processing copy', async () => {
    const mockEvent = createMockEvent({ actionType: 'page_view' });
    const raw = JSON.stringify(mockEvent);
    mockRpoplpush.mockResolvedValueOnce(raw).mockResolvedValueOnce(null);

    const claims = await claimSecondaryEvents('2024-01-01', 10);
    expect(mockLrem).not.toHaveBeenCalled();
    await ackSecondaryEvents('2024-01-01', claims);
    expect(mockLrem).toHaveBeenCalled();
  });

  it('returns empty array when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);
    const claims = await claimSecondaryEvents('2024-01-01', 10);
    expect(claims).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const mockEvent = createMockEvent({ actionType: 'page_view' });
    mockRpoplpush.mockResolvedValue(JSON.stringify(mockEvent));
    await claimSecondaryEvents('2024-01-01', 5);
    expect(mockRpoplpush).toHaveBeenCalledTimes(5);
  });

  it('keeps invalid JSON recoverable instead of dropping it before ack', async () => {
    mockRpoplpush
      .mockResolvedValueOnce('invalid json')
      .mockResolvedValueOnce(null);
    const claims = await claimSecondaryEvents('2024-01-01', 10);
    expect(claims).toHaveLength(1);
    expect(claims[0].invalid).toBe(true);
  });

  it('requeues expired processing entries atomically without dropping occupancy', async () => {
    mockEval.mockResolvedValue(1);
    const recovered = await recoverExpiredSecondaryClaims('2024-01-01', Date.now());
    expect(recovered).toBe(1);
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('LREM', processing, 1, raw)"),
      3,
      expect.stringContaining('event:processing:secondary:'),
      expect.stringContaining('event:buffer:secondary:'),
      expect.stringContaining('event:lease:secondary:'),
      expect.any(Number),
      5 * 60 * 1000,
    );
    const script = String(mockEval.mock.calls[0]?.[0]);
    expect(script).toContain("redis.call('RPUSH', buffer, raw)");
    expect(script).toContain('redis.sha1hex(raw)');
    expect(mockLrem).not.toHaveBeenCalled();
    expect(mockRpush).not.toHaveBeenCalled();
  });
});

describe('fetchSecondaryEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockLrange.mockResolvedValue([]);
  });

  it('should fetch events from Redis', async () => {
    const mockEvent = createMockEvent({ actionType: 'page_view' });
    mockRpoplpush
      .mockResolvedValueOnce(JSON.stringify(mockEvent))
      .mockResolvedValueOnce(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe(mockEvent.eventId);
    expect(mockRpop).not.toHaveBeenCalled();
  });

  it('should return empty array when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toEqual([]);
  });

  it('should return empty array when client is null', async () => {
    mockGetClient.mockReturnValueOnce(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toEqual([]);
  });

  it('should respect the limit parameter', async () => {
    const mockEvent = createMockEvent({ actionType: 'page_view' });
    mockRpoplpush.mockResolvedValue(JSON.stringify(mockEvent));

    await fetchSecondaryEvents('2024-01-01', 5);

    expect(mockRpoplpush).toHaveBeenCalledTimes(5);
  });

  it('should stop when no more events', async () => {
    mockRpoplpush.mockResolvedValue(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toHaveLength(0);
    expect(mockRpoplpush).toHaveBeenCalledTimes(1);
  });

  it('should skip invalid JSON events', async () => {
    mockRpoplpush
      .mockResolvedValueOnce('invalid json')
      .mockResolvedValueOnce(JSON.stringify(createMockEvent()))
      .mockResolvedValueOnce(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toHaveLength(1);
  });

  it('should return empty array on Redis error', async () => {
    mockRpoplpush.mockRejectedValue(new Error('Redis error'));

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toEqual([]);
  });
});

describe('getBufferedEventCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
  });

  it('should return count from Redis', async () => {
    mockLlen.mockResolvedValueOnce(40).mockResolvedValueOnce(2);

    const count = await getBufferedEventCount('2024-01-01');

    expect(count).toBe(42);
    expect(mockLlen).toHaveBeenCalledWith(
      expect.stringContaining('buffer:secondary')
    );
  });

  it('should return 0 when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);

    const count = await getBufferedEventCount('2024-01-01');

    expect(count).toBe(0);
  });

  it('should return 0 when client is null', async () => {
    mockGetClient.mockReturnValueOnce(null);

    const count = await getBufferedEventCount('2024-01-01');

    expect(count).toBe(0);
  });

  it('should return 0 on Redis error', async () => {
    mockLlen.mockRejectedValue(new Error('Redis error'));

    const count = await getBufferedEventCount('2024-01-01');

    expect(count).toBe(0);
  });
});

describe('getBufferStats', () => {
  it('should return current stats', () => {
    const stats = getBufferStats();

    expect(stats).toHaveProperty('buffered');
    expect(stats).toHaveProperty('dropped');
    expect(stats).toHaveProperty('lastBufferTime');
    expect(typeof stats.buffered).toBe('number');
    expect(typeof stats.dropped).toBe('number');
    expect(typeof stats.lastBufferTime).toBe('number');
  });

  it('should return a copy of stats', () => {
    const stats1 = getBufferStats();
    const stats2 = getBufferStats();

    // Verify they are different objects
    expect(stats1).not.toBe(stats2);
  });
});

describe('getDailyStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
  });

  it('should return daily stats from Redis', async () => {
    mockHgetall.mockResolvedValue({
      buffered: '100',
      processed: '80',
    });

    const stats = await getDailyStats('2024-01-01');

    expect(stats.buffered).toBe(100);
    expect(stats.processed).toBe(80);
  });

  it('should return 0 for missing fields', async () => {
    mockHgetall.mockResolvedValue({});

    const stats = await getDailyStats('2024-01-01');

    expect(stats.buffered).toBe(0);
    expect(stats.processed).toBe(0);
  });

  it('should return zeros when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);

    const stats = await getDailyStats('2024-01-01');

    expect(stats.buffered).toBe(0);
    expect(stats.processed).toBe(0);
  });

  it('should return zeros on Redis error', async () => {
    mockHgetall.mockRejectedValue(new Error('Redis error'));

    const stats = await getDailyStats('2024-01-01');

    expect(stats.buffered).toBe(0);
    expect(stats.processed).toBe(0);
  });
});

describe('markEventsProcessed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockHincrby.mockResolvedValue(1);
  });

  it('should increment processed count', async () => {
    await markEventsProcessed(10);

    expect(mockHincrby).toHaveBeenCalledWith(
      expect.stringContaining('stats:daily'),
      'processed',
      10
    );
  });

  it('should increment processed count on the processed batch date', async () => {
    await markEventsProcessed(7, '2026-05-07');

    expect(mockHincrby).toHaveBeenCalledWith(
      'event:stats:daily:2026-05-07',
      'processed',
      7
    );
  });

  it('should do nothing when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);

    await markEventsProcessed(10);

    expect(mockHincrby).not.toHaveBeenCalled();
  });

  it('should do nothing when client is null', async () => {
    mockGetClient.mockReturnValueOnce(null);

    await markEventsProcessed(10);

    expect(mockHincrby).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockHincrby.mockRejectedValue(new Error('Redis error'));

    // Should not throw
    await expect(markEventsProcessed(10)).resolves.not.toThrow();
  });
});
