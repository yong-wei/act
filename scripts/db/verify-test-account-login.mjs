#!/usr/bin/env node

import { VERIFIED_TEST_ACCOUNTS } from './verified-test-accounts.mjs';

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function loginAccount(baseUrl, account) {
  const cookieJar = new Map();
  const remember = (response) => {
    const header = response.headers.getSetCookie?.() ?? [];
    for (const line of header) {
      const pair = line.split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq > 0) cookieJar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  };
  const cookieHeader = () => [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { cookie: cookieHeader() },
  });
  remember(csrfResponse);
  const csrfBody = await readJson(csrfResponse);
  const csrfToken = String(csrfBody.csrfToken ?? '');
  if (!csrfToken) {
    throw new Error(`[${account.loginId}] 无法读取 csrfToken`);
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: account.loginId,
      password: account.password,
      redirect: 'false',
      json: 'true',
    }),
  });
  remember(loginResponse);
  const loginBody = await readJson(loginResponse);
  const loginUrl = String(loginBody.url ?? loginResponse.headers.get('location') ?? '');
  if (loginResponse.status >= 400 || loginUrl.includes('error=CredentialsSignin')) {
    throw new Error(`[${account.loginId}] 登录失败: ${loginResponse.status} ${loginUrl || JSON.stringify(loginBody)}`);
  }

  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  remember(sessionResponse);
  const session = await readJson(sessionResponse);
  const role = String(session?.user?.role ?? '');
  if (!session?.user?.id || role !== account.role) {
    throw new Error(`[${account.loginId}] 会话角色不匹配: ${JSON.stringify(session)}`);
  }
  return { loginId: account.loginId, role, userId: session.user.id };
}

async function main(argv = process.argv.slice(2)) {
  const baseUrl = (option(argv, '--base-url', process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:3001') ?? '').replace(/\/$/, '');
  const results = [];
  for (const account of VERIFIED_TEST_ACCOUNTS) {
    results.push(await loginAccount(baseUrl, account));
  }
  process.stdout.write(`${JSON.stringify({ baseUrl, results }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
