import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  Redis: vi.fn(() => ({
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
    status: 'connecting',
  })),
}));

vi.mock('ioredis', () => ({
  Redis: redisMock.Redis,
}));

describe('redisClient', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMock.Redis.mockClear();
  });

  it('does not create a Redis connection when the module is imported', async () => {
    await import('@/lib/redis-client');

    expect(redisMock.Redis).not.toHaveBeenCalled();
  });

  it('creates the Redis connection lazily on first client access', async () => {
    const { redisClient } = await import('@/lib/redis-client');

    expect(redisMock.Redis).not.toHaveBeenCalled();

    redisClient.getClient();

    expect(redisMock.Redis).toHaveBeenCalledTimes(1);
  });
});
