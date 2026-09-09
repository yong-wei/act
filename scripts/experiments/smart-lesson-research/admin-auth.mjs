import { credentialsFor } from '../../db/verified-test-accounts.mjs';
import { BASE_URL, apiRequest } from './lib.mjs';

const adminCredentials = credentialsFor('admin', {
  loginId: process.env.SMART_LESSON_ADMIN_LOGIN_ID,
  password: process.env.SMART_LESSON_ADMIN_PASSWORD,
});

export const ADMIN_LOGIN_ID = adminCredentials.loginId;
export const ADMIN_PASSWORD = adminCredentials.password;

export async function adminLogin() {
  const jar = new Map();
  const remember = (response) => {
    const lines = response.headers.getSetCookie?.() ?? [];
    for (const line of lines) {
      const pair = line.split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');

  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: { cookie: cookieHeader() },
  });
  remember(csrfResponse);
  const csrfBody = await csrfResponse.json();
  const csrfToken = String(csrfBody.csrfToken ?? '');
  if (!csrfToken) throw new Error('无法读取 csrfToken');

  const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: ADMIN_LOGIN_ID,
      password: ADMIN_PASSWORD,
      redirect: 'false',
      json: 'true',
    }),
  });
  remember(loginResponse);
  const loginBody = await loginResponse.json().catch(() => ({}));
  const loginUrl = String(loginBody.url ?? loginResponse.headers.get('location') ?? '');
  if (loginResponse.status >= 400 || loginUrl.includes('error=CredentialsSignin')) {
    throw new Error(`管理员登录失败: ${loginResponse.status} ${loginUrl}`);
  }

  const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  remember(sessionResponse);
  const session = await sessionResponse.json();
  if (!session?.user?.id || session?.user?.role !== 'ADMIN') {
    throw new Error(`管理员会话无效: ${JSON.stringify(session)}`);
  }
  return { userId: session.user.id, cookieHeader: cookieHeader() };
}

export async function getAdminAISettings(cookieHeader) {
  return apiRequest('GET', '/api/admin/ai-settings', { cookie: cookieHeader });
}

export async function testAdminAIModel(cookieHeader, providerId, model) {
  return apiRequest('POST', '/api/admin/ai-settings/test', {
    cookie: cookieHeader,
    body: { providerId, model },
  });
}

export async function saveAdminAISettings(cookieHeader, settings) {
  return apiRequest('PUT', '/api/admin/ai-settings', {
    cookie: cookieHeader,
    body: settings,
  });
}
