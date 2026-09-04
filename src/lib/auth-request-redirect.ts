import { headers } from 'next/headers';

import { buildLoginRedirectForPath } from '@/lib/auth-redirect';

/**
 * 从当前请求构造登录重定向目标，保留完整 pathname 与查询串。
 * `x-pathname` 由 `src/middleware.ts` 写入；仅接受站内路径，middleware
 * 缺席或路径不可信时退回裸登录页（丢失深链但不引入跳转面）。
 */
export async function buildLoginRedirectFromRequest() {
  const requestPath = (await headers()).get('x-pathname');
  if (requestPath?.startsWith('/') && !requestPath.startsWith('//')) {
    return buildLoginRedirectForPath(requestPath);
  }
  return '/login';
}
