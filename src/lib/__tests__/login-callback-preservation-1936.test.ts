/**
 * 受保护页登录重定向保留 callbackUrl 契约（Issue #1936）。
 *
 * 覆盖三层：helper 对路径（含查询串）的编码、代表性受保护页守卫
 * 迁移到 helper 的源码契约，以及 callbackUrl 经登录页安全解析后
 * 回到原路径的端到端闭环。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildLoginRedirectForPath,
  normalizeSafeCallbackPath,
  resolvePostLoginRedirect,
} from '@/lib/auth-redirect';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const source = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8');

describe('protected-route login redirects preserve callbackUrl (#1936)', () => {
  it('encodes callback paths including query strings', () => {
    expect(buildLoginRedirectForPath('/dashboard')).toBe('/login?callbackUrl=%2Fdashboard');
    expect(buildLoginRedirectForPath('/playlists/new?nodeId=node-1'))
      .toBe('/login?callbackUrl=%2Fplaylists%2Fnew%3FnodeId%3Dnode-1');
    expect(buildLoginRedirectForPath('/admin/lesson-plans/42/edit'))
      .toBe('/login?callbackUrl=%2Fadmin%2Flesson-plans%2F42%2Fedit');
  });

  it('routes representative protected pages through the shared helper', () => {
    expect(source('src/app/(main)/dashboard/page.tsx'))
      .toContain("redirect(buildLoginRedirectForPath('/dashboard'))");
    expect(source('src/app/teacher/lesson-plans/[id]/edit/page.tsx'))
      .toContain('redirect(buildLoginRedirectForPath(`/teacher/lesson-plans/${id}/edit`))');
    expect(source('src/app/playlists/new/page.tsx'))
      .toContain("redirect(buildLoginRedirectForPath(`/playlists/new${nodeIdQuery}`))");
  });

  it('round-trips a preserved target back to the original path after login', () => {
    const original = '/playlists/new?nodeId=node-1';
    const loginHref = buildLoginRedirectForPath(original);
    const parsed = new URLSearchParams(loginHref.split('?')[1]).get('callbackUrl');
    expect(resolvePostLoginRedirect({
      callbackUrl: normalizeSafeCallbackPath(parsed),
      origin: 'https://act.local',
      role: 'STUDENT',
    })).toBe(original);
  });
});
