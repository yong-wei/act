import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const address = listener.address();
assert(address && typeof address !== 'string');
const { port } = address;
await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));

const redisServer = spawn('redis-server', ['--bind', '127.0.0.1', '--port', String(port), '--save', '', '--appendonly', 'no']);
const redisReady = new Promise<void>((resolve, reject) => {
  redisServer.once('error', reject);
  redisServer.once('exit', code => reject(new Error(`Redis stopped with code ${code}`)));
  redisServer.stdout.on('data', data => {
    if (String(data).includes('Ready to accept connections')) resolve();
  });
});
process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
process.env.SIMULATION_ENTRY_QUEUE = '1';
process.env.SIMULATION_ENTRY_BATCH_SIZE = '24';
let disconnect: (() => void) | undefined;
try {
  await redisReady;
  const { redisClient } = await import('@/lib/redis-client');
  const { POST } = await import('@/app/api/simulations/network/classroom-entry/route');
  const redis = redisClient.getClient()!;
  disconnect = () => redis.disconnect();
  const request = async (browserId: string) => {
    const response = await POST(new Request('http://localhost/classroom-entry', {
      method: 'POST', body: JSON.stringify({ browserId }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return await response.json() as { admitted: boolean; retryAfterMs: number };
  };
  const clients = Array.from({ length: 120 }, () => randomUUID());
  const [seconds, micros] = await redis.time();
  const now = Number(seconds) * 1000 + Math.floor(Number(micros) / 1000);
  await delay((5000 - now % 5000) + 100);
  const started = performance.now();
  const receipts = await Promise.all(clients.map(request));
  const burstMs = performance.now() - started;
  assert.equal(receipts.filter(receipt => receipt.admitted).length, 24);
  assert((await request(clients[0])).admitted, 'Refresh preserves previously acquired admission');
  assert(!(await request(clients[25])).admitted, 'Waiting retry cannot skip the queue');
  const visitors = clients.slice(24);
  const laterBatches: number[] = [];
  while (visitors.length) {
    await delay(5000);
    const current = visitors.slice(0, 24);
    const next = await Promise.all(current.map(request));
    assert(next.every(receipt => receipt.admitted), 'FIFO releases the next batch');
    const later = visitors[24];
    if (later) assert(!(await request(later)).admitted, 'A window cannot exceed its quota');
    laterBatches.push(current.length);
    visitors.splice(0, current.length);
    // Waiters in a browser refresh their lease on their own polling schedule.
    await Promise.all(visitors.map(request)).then(receipts => assert(receipts.every(receipt => !receipt.admitted)));
  }
  console.log(JSON.stringify({ arrivals: clients.length, initialBatch: 24, laterBatches, burstMs,
    releaseMs: performance.now() - started }));
} finally {
  disconnect?.();
  redisServer.kill();
}
