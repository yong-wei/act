import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  loadSession: vi.fn(),
  loadTeacher: vi.fn(),
  duplicate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { classSession: { findUnique: db.loadSession } } }));
vi.mock('@/lib/redis-client', () => ({
  redisClient: { getClient: () => ({ status: 'ready', duplicate: db.duplicate }) },
}));
vi.mock('../adapters/prisma-state-runtime', () => ({ readLatestTeacherSync: db.loadTeacher }));

import { openClassroomSessionStreamAdapter } from '../adapters/sse';

class Subscriber extends EventEmitter {
  subscribe = vi.fn(async () => 1);
  unsubscribe = vi.fn(async () => 0);
  disconnect = vi.fn();
}

const room = 'test-room';
const channel = `channel:session:${room}`;
const decode = new TextDecoder();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('classroom streams', () => {
  it('shares Redis and snapshots, projects teacher state, and closes on Redis loss', async () => {
    vi.stubEnv('INTERACTIVE_CLASSROOM_CAPACITY', '1');
    const subscriber = new Subscriber();
    db.duplicate.mockReturnValue(subscriber);
    db.loadSession.mockResolvedValue({ id: room, currentItemId: 'step-1', status: 'ACTIVE', updatedAt: new Date(1000) });
    db.loadTeacher.mockResolvedValue({
      user: { id: 'teacher' }, itemId: 'teacher:course-sync', data: { released: false },
    });

    const open = () => openClassroomSessionStreamAdapter(new Request('http://localhost'), room).body!.getReader();
    const first = open();
    const second = open();
    try {
      const initial = await Promise.all([first.read(), second.read()]);
      expect(db.duplicate).toHaveBeenCalledTimes(1);
      expect(subscriber.subscribe).toHaveBeenCalledExactlyOnceWith(channel);
      expect(db.loadSession).toHaveBeenCalledTimes(1);
      expect(decode.decode(initial[0].value)).toContain('"type":"initial"');
      expect(decode.decode(initial[0].value)).not.toContain('"user"');
      expect(initial[0].value).toEqual(initial[1].value);

      db.loadTeacher.mockResolvedValue({ itemId: 'teacher:course-sync', data: { released: true } });
      subscriber.emit('message', channel, '{"data":{"private":"ignored"}}');
      const updates = await Promise.all([first.read(), second.read()]);
      expect(decode.decode(updates[0].value)).toContain('"released":true');
      expect(decode.decode(updates[0].value)).not.toContain('private');
      expect(db.loadTeacher).toHaveBeenCalledTimes(2);
      await first.cancel();
      expect(subscriber.unsubscribe).not.toHaveBeenCalled();

      subscriber.emit('close');
      await expect(second.read()).resolves.toEqual({ done: true, value: undefined });
    } finally {
      await first.cancel();
      await second.cancel();
      if (!subscriber.disconnect.mock.calls.length) subscriber.emit('close');
    }
  });

  it('returns an unavailable response when the stream is disabled', () => {
    vi.stubEnv('INTERACTIVE_CLASSROOM_CAPACITY', '1');
    vi.stubEnv('INTERACTIVE_CLASSROOM_STREAM', '0');
    const response = openClassroomSessionStreamAdapter(new Request('http://localhost'), room);
    expect(response.status).toBe(503);
    expect(db.duplicate).not.toHaveBeenCalled();
  });
});
