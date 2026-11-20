import type Redis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';
import { toStudentTeacherSyncRecord } from '../application/state';
import { CLASSROOM_STREAM_HEARTBEAT_MS } from '../application/stream-policy';
import { readLatestTeacherSync } from './prisma-state-runtime';
import { isClassroomStreamEnabled } from './shared-classroom-reads';

type Snapshot = NonNullable<Awaited<ReturnType<typeof readSnapshot>>>;
type Frame = { initial: Uint8Array; update: Uint8Array; finished: boolean };
type Listener = (frame: Frame | null) => void;
type Room = {
  listeners: Set<Listener>;
  frame?: Frame;
  ready: Promise<unknown>;
  reading: boolean;
  dirty: boolean;
};
type Hub = { subscriber: Redis; rooms: Map<string, Room> };
const hubKey = Symbol.for('act.classroom-stream-hub');
const registry = globalThis as typeof globalThis & { [hubKey]?: Hub };
const encoder = new TextEncoder();
const heartbeat = encoder.encode('event: heartbeat\ndata: ok\n\n');

async function readSnapshot(id: string) {
  const [session, teacherSync] = await Promise.all([
    prisma.classSession.findUnique({
      where: { id },
      select: { id: true, currentItemId: true, currentStage: true, status: true, updatedAt: true },
    }),
    readLatestTeacherSync(id),
  ]);
  return session && {
    ...session,
    sessionId: session.id,
    teacherSync: teacherSync ? toStudentTeacherSyncRecord(teacherSync) : null,
  };
}

function encodeFrame(snapshot: Snapshot): Frame {
  const data = JSON.stringify(snapshot);
  return {
    initial: encoder.encode(`data: {"type":"initial","data":${data}}\n\n`),
    update: encoder.encode(`data: {"type":"update","data":${data}}\n\n`),
    finished: snapshot.status === 'FINISHED',
  };
}

async function refresh(hub: Hub, channel: string, room: Room) {
  room.dirty = true;
  if (room.reading) return;
  room.reading = true;
  try {
    while (room.dirty && hub.rooms.get(channel) === room) {
      room.dirty = false;
      const snapshot = await readSnapshot(channel.slice('channel:session:'.length));
      if (hub.rooms.get(channel) !== room) return;
      if (snapshot) room.frame = encodeFrame(snapshot);
      for (const listener of room.listeners) listener(snapshot ? room.frame! : null);
    }
  } catch (error) {
    console.warn('[Classroom stream] Snapshot failed', error);
    for (const listener of room.listeners) listener(null);
  } finally {
    room.reading = false;
  }
}

function getHub(redis: Redis) {
  if (registry[hubKey]) return registry[hubKey];
  const subscriber = redis.duplicate({ maxRetriesPerRequest: 0, enableOfflineQueue: true, commandTimeout: 3000 });
  const hub: Hub = { subscriber, rooms: new Map() };
  registry[hubKey] = hub;
  subscriber.on('message', (channel: string) => {
    const room = hub.rooms.get(channel);
    if (room) void refresh(hub, channel, room);
  });
  subscriber.on('close', () => {
    if (registry[hubKey] === hub) delete registry[hubKey];
    const rooms = [...hub.rooms.values()];
    hub.rooms.clear();
    for (const room of rooms) {
      for (const listener of room.listeners) listener(null);
    }
    subscriber.disconnect();
  });
  subscriber.on('error', () => { /* Pending subscribers fall back to polling. */ });
  return hub;
}

function subscribe(hub: Hub, id: string, listener: Listener) {
  const channel = `channel:session:${id}`;
  let room = hub.rooms.get(channel);
  if (!room) {
    const next: Room = {
      listeners: new Set(),
      ready: hub.subscriber.subscribe(channel),
      reading: false,
      dirty: false,
    };
    hub.rooms.set(channel, next);
    void next.ready
      .then(() => refresh(hub, channel, next))
      .catch(() => { for (const fn of next.listeners) fn(null); });
    room = next;
  }
  room.listeners.add(listener);
  if (room.frame) listener(room.frame);
  return () => {
    room.listeners.delete(listener);
    if (room.listeners.size === 0 && hub.rooms.get(channel) === room) {
      hub.rooms.delete(channel);
      void hub.subscriber.unsubscribe(channel).catch(() => undefined);
    }
  };
}

export function openClassroomSessionStreamAdapter(request: Request, id: string) {
  const redis = redisClient.getClient();
  if (!isClassroomStreamEnabled() || redis?.status !== 'ready') {
    return new Response('Classroom stream unavailable', { status: 503 });
  }
  const hub = getHub(redis);
  let cleanup = () => {};
  let flush = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let unsubscribe = () => {};
      let closed = false;
      let initialized = false;
      let pending: Frame | null = null;
      const leaseExpiresAt = Date.now() + 180_000 + Math.random() * 60_000;
      const interval = setInterval(() => {
        if (Date.now() >= leaseExpiresAt) {
          close();
          return;
        }
        if (initialized && !pending && (controller.desiredSize ?? 0) > 0) controller.enqueue(heartbeat);
      }, CLASSROOM_STREAM_HEARTBEAT_MS);
      const detach = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        request.signal.removeEventListener('abort', close);
        unsubscribe();
      };
      const close = () => {
        if (closed) return;
        detach();
        controller.close();
      };
      cleanup = detach;
      request.signal.addEventListener('abort', close, { once: true });
      if (request.signal.aborted) {
        close();
        return;
      }
      flush = () => {
        if (closed || !pending || (controller.desiredSize ?? 0) <= 0) return;
        const frame = pending;
        pending = null;
        controller.enqueue(initialized ? frame.update : frame.initial);
        initialized = true;
        if (frame.finished) close();
      };
      unsubscribe = subscribe(hub, id, (frame) => {
        if (!frame) {
          close();
          return;
        }
        pending = frame;
        flush();
      });
      if (closed) unsubscribe();
    },
    pull() { flush(); },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'private, no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
