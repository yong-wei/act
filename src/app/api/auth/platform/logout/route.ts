import { NextResponse } from 'next/server';
import { assertSameOrigin, platformOidcConfig, requestOrigin } from '@/lib/platform-oidc';
import { sessionCookieName } from '@/lib/platform-session';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { global?: boolean };
    const origin = requestOrigin(request);
    let logoutUrl: string | null = null;
    if (body.global === true) {
      const config = platformOidcConfig();
      if (config) {
        const logout = new URL(`${config.issuer}/protocol/openid-connect/logout`);
        logout.search = new URLSearchParams({
          post_logout_redirect_uri: `${origin}/login`,
          client_id: config.clientId,
        }).toString();
        logoutUrl = logout.toString();
      }
    }
    const response = NextResponse.json({ logout_url: logoutUrl });
    response.cookies.set(sessionCookieName(origin), '', {
      httpOnly: true,
      secure: origin.startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  }
}
