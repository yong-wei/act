import { NextResponse, type NextRequest } from 'next/server';

/**
 * 受保护页登录重定向依赖请求级 pathname（含查询串）。
 * middleware 在每个页面请求上写入 `x-pathname`，server component
 * 通过 `buildLoginRedirectFromRequest` 读取并编码为 callbackUrl。
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-pathname', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
