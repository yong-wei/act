import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LearningEvent } from '../event-protocol';

// Define mock functions before importing the module
const mockLpush = vi.fn();
const mockRpop = vi.fn();
const mockLtrim = vi.fn();
const mockLlen = vi.fn();
const mockHincrby = vi.fn();
const mockHgetall = vi.fn();
const mockExpire = vi.fn();

const mockIsReady = vi.fn().mockReturnValue(true);
const mockGetClient = vi.fn().mockReturnValue({
  lpush: mockLpush,
  rpop: mockRpop,
  ltrim: mockLtrim,
  llen: mockLlen,
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
  });

  it('should route core events to postgresql', async () => {
    const event = createMockEvent({
      actionType: 'answer_submit',
      priority: 'core',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('postgresql');
    expect(mockLpush).not.toHaveBeenCalled();
  });

  it('should route resource_complete to postgresql as a high-value extracurricular event', async () => {
    const event = createMockEvent({
      actionType: 'resource_complete',
      priority: 'core',
    });

    const result = await routeEvent(event);

    expect(result.destination).toBe('postgresql');
    expect(mockLpush).not.toHaveBeenCalled();
  });

  it('should route secondary events to redis', async () => {
    const event = createMockEvent({
      actionType: 'page_view',
      priority: 'secondary',
    });
    mockLpush.mockResolvedValue(1);

    const result = await routeEvent(event);

    expect(result.destination).toBe('redis');
    expect(mockLpush).toHaveBeenCalled();
  });

  it('should route unknown event types to redis', async () => {
    const event = createMockEvent({
      actionType: 'unknown_event_type',
      priority: 'secondary',
    });
    mockLpush.mockResolvedValue(1);

    const result = await routeEvent(event);

    expect(result.destination).toBe('redis');
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
    mockLpush.mockRejectedValue(new Error('Buffer full'));
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
    mockLpush.mockResolvedValue(1);
    mockLtrim.mockResolvedValue('OK');
    mockExpire.mockResolvedValue(1);
    mockHincrby.mockResolvedValue(1);
  });

  it('should buffer event in Redis', async () => {
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(true);
    expect(mockLpush).toHaveBeenCalled();
    expect(mockLtrim).toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalled();
  });

  it('should return false when Redis is not ready', async () => {
    mockIsReady.mockReturnValue(false);
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
    expect(mockLpush).not.toHaveBeenCalled();
  });

  it('should return false when Redis client is null', async () => {
    mockGetClient.mockReturnValueOnce(null);
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
  });

  it('should limit buffer to 10000 events', async () => {
    const event = createMockEvent({ actionType: 'page_view' });

    await bufferSecondaryEvent(event);

    expect(mockLtrim).toHaveBeenCalledWith(
      expect.any(String),
      0,
      9999
    );
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
    mockLpush.mockRejectedValue(new Error('Redis error'));
    const event = createMockEvent({ actionType: 'page_view' });

    const result = await bufferSecondaryEvent(event);

    expect(result).toBe(false);
  });
});

describe('fetchSecondaryEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
  });

  it('should fetch events from Redis', async () => {
    const mockEvent = createMockEvent({ actionType: 'page_view' });
    mockRpop
      .mockResolvedValueOnce(JSON.stringify(mockEvent))
      .mockResolvedValueOnce(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe(mockEvent.eventId);
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
    mockRpop.mockResolvedValue(JSON.stringify(mockEvent));

    await fetchSecondaryEvents('2024-01-01', 5);

    expect(mockRpop).toHaveBeenCalledTimes(5);
  });

  it('should stop when no more events', async () => {
    mockRpop.mockResolvedValue(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toHaveLength(0);
    expect(mockRpop).toHaveBeenCalledTimes(1);
  });

  it('should skip invalid JSON events', async () => {
    mockRpop
      .mockResolvedValueOnce('invalid json')
      .mockResolvedValueOnce(JSON.stringify(createMockEvent()))
      .mockResolvedValueOnce(null);

    const events = await fetchSecondaryEvents('2024-01-01', 10);

    expect(events).toHaveLength(1);
  });

  it('should return empty array on Redis error', async () => {
    mockRpop.mockRejectedValue(new Error('Redis error'));

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
    mockLlen.mockResolvedValue(42);

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
