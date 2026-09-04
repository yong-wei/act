import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { GET } from '../api/health/route';

const routeSource = readFileSync(
  path.join(process.cwd(), 'src/app/api/health/route.ts'),
  'utf8',
);

describe('public liveness probe contract (#1941)', () => {
  it('returns 200 with minimal JSON and no-store', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.status).toBe('ok');
    // 不泄露版本细节、内部路径或配置。
    expect(Object.keys(payload)).toEqual(['status']);
  });

  it('stays dependency-free: no auth, database, redis, or runtime calls', () => {
    expect(routeSource).toContain("export const dynamic = 'force-dynamic'");
    for (const forbidden of ['@/lib/prisma', '@/lib/redis-client', 'getServerSession', '@/lib/auth', 'runtime-readiness']) {
      expect(routeSource.includes(forbidden), forbidden).toBe(false);
    }
    // 无 try/catch 即无吞掉 Next 动态探测异常的可能（nextjs-dynamic-error 契约）。
    expect(routeSource.includes('try {')).toBe(false);
  });
});
