/**
 * 受保护页登录重定向保留 callbackUrl 契约（Issue #1936）。
 *
 * 覆盖三层：helper 对路径（含查询串）的编码、代表性受保护页守卫
 * 在重定向层读取请求级 pathname 的源码契约，以及 callbackUrl 经
 * 登录页安全解析后回到原路径的端到端闭环。实际重定向响应由
 * tests/login-callback-redirect-1936.spec.ts 以 Playwright 断言。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn() }));

import { buildLoginRedirectForPath, normalizeSafeCallbackPath, resolvePostLoginRedirect } from '@/lib/auth-redirect';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const source = (relative: string) => readFileSync(path.join(repoRoot, relative), 'utf8');

describe('protected-route login redirects preserve callbackUrl (#1936)', () => {
  it('encodes callback paths including query strings', () => {
    expect(buildLoginRedirectForPath('/dashboard')).toBe('/login?callbackUrl=%2Fdashboard');
    expect(buildLoginRedirectForPath('/dashboard?tab=evidence'))
      .toBe('/login?callbackUrl=%2Fdashboard%3Ftab%3Devidence');
    expect(buildLoginRedirectForPath('/admin/lesson-plans/42/edit'))
      .toBe('/login?callbackUrl=%2Fadmin%2Flesson-plans%2F42%2Fedit');
  });

  it('routes representative protected pages through the request-level helper', () => {
    for (const page of [
      'src/app/(main)/dashboard/page.tsx',
      'src/app/teacher/layout.tsx',
      'src/app/teacher/lesson-plans/[id]/edit/page.tsx',
      'src/app/playlists/new/page.tsx',
    ]) {
      const s = source(page);
      expect(s, page).toContain('redirect(await buildLoginRedirectFromRequest())');
      expect(s, page).not.toContain("redirect('/login')");
      expect(s, page).not.toContain('buildLoginRedirectForPath(');
    }
  });

  it('middleware stamps the request pathname onto every page request', () => {
    const middlewareSource = source('src/middleware.ts');
    expect(middlewareSource).toContain("headers.set('x-pathname'");
    expect(middlewareSource).toContain('request.nextUrl.pathname');
    expect(middlewareSource).toContain('request.nextUrl.search');
  });

  it('round-trips a preserved target back to the original path after login', () => {
    const original = '/dashboard?tab=evidence';
    const loginHref = buildLoginRedirectForPath(original);
    const parsed = new URLSearchParams(loginHref.split('?')[1]).get('callbackUrl');
    expect(resolvePostLoginRedirect({
      callbackUrl: normalizeSafeCallbackPath(parsed),
      origin: 'https://act.local',
      role: 'STUDENT',
    })).toBe(original);
  });
});

describe('buildLoginRedirectFromRequest (#1936)', () => {
  it('builds the login target from the middleware-stamped request pathname', async () => {
    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue(new Headers({
      'x-pathname': '/teacher/smart-prep/editor/lesson/doc-1?taskId=t-9',
    }));
    expect(await buildLoginRedirectFromRequest())
      .toBe(`/login?callbackUrl=${encodeURIComponent('/teacher/smart-prep/editor/lesson/doc-1?taskId=t-9')}`);
  });

  it('falls back to the bare login page when the pathname is absent or unsafe', async () => {
    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue(new Headers());
    expect(await buildLoginRedirectFromRequest()).toBe('/login');
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-pathname': '//evil.example' }));
    expect(await buildLoginRedirectFromRequest()).toBe('/login');
  });
});
