import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createPrismaClient } from '../src/lib/prisma-client.ts';
import { authorizeActIdentity } from '../src/lib/platform-access.ts';
import { resolveLocalPlatformUser } from '../src/lib/platform-local-account.ts';

const platformRoot = process.env.ACT_PLATFORM_REPO
  ? pathToFileURL(resolve(process.env.ACT_PLATFORM_REPO) + '/')
  : new URL('../../platform/', import.meta.url);
const { openDirectory } = await import(new URL('directory/account-directory.mjs', platformRoot));
const { createGrantService } = await import(new URL('directory/app-grants.mjs', platformRoot));
const { createGrantServer } = await import(new URL('auth/grant-api.mjs', platformRoot));

const env = Object.fromEntries(readFileSync(new URL('deploy/keycloak/.env', platformRoot), 'utf8')
  .split('\n').filter((line) => line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
const appEnv = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n').filter((line) => line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
const issuer = 'http://127.0.0.1:18080/realms/platform-test';
const origin = 'http://localhost:15174';
const container = 'act-central-login-directory';
const databasePassword = randomBytes(18).toString('base64url');
const appToken = randomBytes(24).toString('base64url');
const clientSecret = randomBytes(24).toString('base64url');
const personId = `act-e2e-person-${Date.now().toString(36)}`;
const externalPersonId = `${personId}-external`;
const conflictPersonId = `${personId}-conflict`;
const username = `act-e2e-${Date.now().toString(36)}`;
let directory;
let grantServer;
let nextApp;
let prisma;
let browser;
let adminToken;
let keycloakUserId;
let keycloakClientId;
let realmConfig;

function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (!allowFailure && result.status !== 0) throw new Error('temporary directory database failed');
  return result;
}
function stop(child) {
  if (!child || child.killed) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
}
async function waitFor(work, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { return await work(); } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${message}: ${last?.message || 'timeout'}`);
}
async function kcAdmin(path, options = {}) {
  if (!adminToken) {
    const response = await fetch('http://127.0.0.1:18080/realms/master/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: env.KC_ADMIN, password: env.KC_ADMIN_PASSWORD }),
    });
    if (!response.ok) throw new Error('Keycloak admin login failed');
    adminToken = (await response.json()).access_token;
  }
  return fetch(`http://127.0.0.1:18080${path}`, {
    ...options,
    headers: { authorization: `Bearer ${adminToken}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
}
async function setupKeycloak() {
  const realmResponse = await kcAdmin('/admin/realms/platform-test');
  realmConfig = await realmResponse.json();
  const relaxed = await kcAdmin('/admin/realms/platform-test', {
    method: 'PUT',
    body: JSON.stringify({
      ...realmConfig,
      browserSecurityHeaders: {
        ...(realmConfig.browserSecurityHeaders || {}),
        contentSecurityPolicy: "frame-src 'self'; frame-ancestors 'self' http://localhost:15174; object-src 'none';",
        xFrameOptions: '',
      },
    }),
  });
  if (!relaxed.ok) throw new Error('could not allow the test login iframe');
  const created = await kcAdmin('/admin/realms/platform-test/users', {
    method: 'POST',
    body: JSON.stringify({ username, enabled: true, attributes: { platformPersonId: [personId] } }),
  });
  if (created.status !== 201) throw new Error('could not create Keycloak user');
  keycloakUserId = new URL(created.headers.get('location')).pathname.split('/').pop();
  const reset = await kcAdmin(`/admin/realms/platform-test/users/${keycloakUserId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ type: 'password', value: env.KC_TEST_PASSWORD, temporary: false }),
  });
  if (!reset.ok) throw new Error('could not set test password');
  const clients = await kcAdmin('/admin/realms/platform-test/clients?clientId=act-e2e');
  const existing = (await clients.json())[0];
  const body = {
    clientId: 'act-e2e', name: 'ACT E2E', enabled: true, protocol: 'openid-connect',
    publicClient: false, secret: clientSecret, standardFlowEnabled: true,
    directAccessGrantsEnabled: false, implicitFlowEnabled: false, serviceAccountsEnabled: false,
    redirectUris: [`${origin}/api/auth/platform/callback`], webOrigins: [origin],
    attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': `${origin}/login` },
  };
  const response = existing
    ? await kcAdmin(`/admin/realms/platform-test/clients/${existing.id}`, { method: 'PUT', body: JSON.stringify({ ...existing, ...body }) })
    : await kcAdmin('/admin/realms/platform-test/clients', { method: 'POST', body: JSON.stringify(body) });
  if (![201, 204].includes(response.status)) throw new Error('could not configure ACT client');
  keycloakClientId = existing?.id ?? new URL(response.headers.get('location')).pathname.split('/').pop();
}

try {
  docker(['rm', '-f', container], true);
  docker(['run', '-d', '--name', container, '-e', `POSTGRES_PASSWORD=${databasePassword}`, '-e', 'POSTGRES_DB=platform_directory', '-p', '127.0.0.1:54329:5432', 'postgres:16-alpine']);
  const connectionString = `postgres://postgres:${encodeURIComponent(databasePassword)}@127.0.0.1:54329/platform_directory`;
  await waitFor(async () => {
    const probe = await openDirectory(connectionString);
    await probe.close();
  }, 'directory database');
  directory = await openDirectory(connectionString);
  const grants = createGrantService(directory);
  await directory.reserveAccount({
    personId, displayName: 'ACT E2E', username, operationId: personId,
    affiliations: [{ kind: 'teacher', sourceApp: 'achieve', sourceId: username }],
  });
  await grants.writeGrant({ personId, appId: 'act', op: 'allow', version: 1, source: 'test', actor: 'test' });
  grantServer = createGrantServer({ grants, directory, operatorToken: randomBytes(18).toString('base64url'), appTokens: { [appToken]: 'act-api' } });
  await new Promise((resolve) => grantServer.listen(18182, '127.0.0.1', resolve));
  await setupKeycloak();
  await directory.bindIdentity({ personId, issuer, subject: keycloakUserId, username, actor: 'test' });

  process.env.DATABASE_URL ||= appEnv.DATABASE_URL;
  process.env.PLATFORM_ACCESS_URL = 'http://127.0.0.1:18182/access';
  process.env.PLATFORM_APP_TOKEN = appToken;
  prisma = createPrismaClient();
  nextApp = spawn('npx', ['next', 'dev', '-p', '15174'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      NEXTAUTH_URL: origin,
      NEXTAUTH_SECRET: randomBytes(24).toString('base64url'),
      PLATFORM_OIDC_ISSUER: issuer,
      PLATFORM_OIDC_CLIENT_ID: 'act-e2e',
      PLATFORM_OIDC_CLIENT_SECRET: clientSecret,
      PLATFORM_OIDC_ENFORCED: 'true',
      PLATFORM_ACCESS_URL: 'http://127.0.0.1:18182/access',
      PLATFORM_APP_TOKEN: appToken,
      ACT_ROSTER_EXPORT_TOKEN: 'act-e2e-roster',
    },
    detached: true,
    stdio: 'inherit',
  });
  await waitFor(async () => {
    const response = await fetch(`${origin}/api/auth/platform/mode`);
    if (!response.ok) throw new Error('next not ready');
    return response;
  }, 'Next application', 90000);
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--disable-web-security'] });
  const page = await browser.newPage();
  await page.goto(`${origin}/`);
  assert.equal(await page.locator('iframe[title="统一身份认证"]').count(), 0);
  page.on('console', (message) => console.log(`browser-console:${message.text()}`));
  page.on('requestfailed', (request) => console.log(`browser-request-failed:${request.url()} ${request.failure()?.errorText}`));
  await page.goto(`${origin}/login?callbackUrl=%2Fprofile`);
  await page.getByRole('button', { name: '统一身份登录（校园账号）' }).click();
  const frame = page.frameLocator('iframe[title="统一身份认证"]');
  try {
    await frame.locator('#username').fill(username, { timeout: 10000 });
  } catch (error) {
    const authorizeUrl = await page.locator('iframe[title="统一身份认证"]').getAttribute('src').catch(() => null);
    const authorizeResponse = authorizeUrl ? await page.request.get(authorizeUrl) : null;
    const transactionResponse = await page.evaluate(async () => {
      const response = await fetch('/api/auth/platform/transactions?return_to=%2Fprofile', { method: 'POST', body: '{}' });
      return { status: response.status, body: await response.text() };
    });
    console.log(JSON.stringify({
      transactionResponse,
      pageUrl: page.url(),
      frames: page.frames().map((item) => item.url()),
      authorizeUrl,
      authorizeStatus: authorizeResponse?.status(),
      authorizeBody: authorizeResponse ? (await authorizeResponse.text()).slice(0, 500) : null,
      body: (await page.locator('body').innerText()).slice(0, 800),
    }));
    throw error;
  }
  await frame.locator('#password').fill(env.KC_TEST_PASSWORD);
  await frame.locator('form').evaluate((form) => form.submit());
  try {
    await page.waitForURL(/\/profile/, { timeout: 30000 });
  } catch (error) {
    console.log(JSON.stringify({
      pageUrl: page.url(),
      frames: page.frames().map((item) => item.url()),
      body: (await page.locator('body').innerText()).slice(0, 800),
    }));
    throw error;
  }
  const session = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  const userId = session.user.id;
  assert.ok(userId);
  assert.equal(session.user.role, 'TEACHER');
  assert.equal((await directory.getAccount(personId)).localLinks.find(({ appId }) => appId === 'act')?.localUserId, userId);
  assert.equal((await prisma.user.findUnique({ where: { id: userId } })).passwordHash, null);
  const roster = await page.evaluate(async () => (await fetch('/api/platform/roster', { headers: { authorization: 'Bearer act-e2e-roster' } })).json());
  assert.equal(roster.apps.act.accounts.find((account) => account.localUserId === userId).localUserId, userId);
  assert.equal(JSON.stringify(roster).includes('passwordHash'), false);

  await grants.writeGrant({ personId, appId: 'act', op: 'revoke', version: 2, source: 'admin', actor: 'test' });
  const revoked = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  assert.equal(revoked.user, undefined);
  assert.equal(revoked.error, 'ACT_ACCESS_DENIED');
  await grants.writeGrant({ personId, appId: 'act', op: 'allow', version: 3, source: 'admin', actor: 'test' });
  await page.goto(`${origin}/login?callbackUrl=%2Fprofile`);
  await page.getByRole('button', { name: '统一身份登录（校园账号）' }).click();
  await page.waitForURL(/\/profile/, { timeout: 30000 });
  const restored = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  assert.equal(restored.user.id, userId);

  await grants.writeActRole({ personId, role: 'TEACHER', actor: 'test-admin' });
  const priorRoleDecision = await authorizeActIdentity({ issuer, subject: keycloakUserId }, fetch, { allowSessionRenewal: true });
  await grants.writeActRole({ personId, role: 'STUDENT', actor: 'test-admin' });
  const staleRole = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  assert.equal(staleRole.user, undefined);
  await page.goto(`${origin}/login?callbackUrl=%2Fprofile`);
  await page.getByRole('button', { name: '统一身份登录（校园账号）' }).click();
  await page.waitForURL(/\/profile/, { timeout: 30000 });
  const changedRole = await page.evaluate(async () => (await fetch('/api/auth/session')).json());
  assert.equal(changedRole.user.id, userId);
  assert.equal(changedRole.user.role, 'STUDENT');
  assert.equal(await resolveLocalPlatformUser({
    issuer, subject: keycloakUserId, personId,
    sessionVersion: priorRoleDecision.sessionVersion, provisioning: priorRoleDecision.actProvisioning,
  }), null);
  assert.equal((await prisma.user.findUnique({ where: { id: userId } })).role, 'STUDENT');

  const externalSubject = `${externalPersonId}-subject`;
  await directory.reserveAccount({ personId: externalPersonId, displayName: 'ACT external E2E', operationId: externalPersonId });
  await directory.bindIdentity({ personId: externalPersonId, issuer, subject: externalSubject, username: externalSubject, actor: 'test' });
  await grants.writeGrant({ personId: externalPersonId, appId: 'act', op: 'allow', version: 1 });
  const externalDecision = await authorizeActIdentity({ issuer, subject: externalSubject }, fetch, { allowSessionRenewal: true });
  assert.equal(externalDecision.actProvisioning.rosterKind, 'external');
  const resolveExternal = () => resolveLocalPlatformUser({
    issuer, subject: externalSubject, personId: externalPersonId,
    sessionVersion: externalDecision.sessionVersion, provisioning: externalDecision.actProvisioning,
  });
  const [first, second] = await Promise.all([resolveExternal(), resolveExternal()]);
  assert.equal(first.id, second.id);
  const external = await prisma.user.findUnique({ where: { id: first.id }, include: { profile: true } });
  assert.equal(external.role, 'STUDENT');
  assert.equal(external.profile.classId, null);
  assert.equal(external.profile.studentNumber, null);
  assert.equal(external.passwordHash, null);
  assert.equal((await directory.getAccount(externalPersonId)).localLinks[0].localUserId, external.id);

  const conflictSubject = `${conflictPersonId}-subject`;
  await directory.reserveAccount({
    personId: conflictPersonId, displayName: 'ACT conflict E2E', operationId: conflictPersonId,
    externalIds: [{ institution: 'just', identifierType: 'student_no', value: conflictSubject }],
  });
  await directory.bindIdentity({ personId: conflictPersonId, issuer, subject: conflictSubject, username: conflictSubject, actor: 'test' });
  await grants.writeGrant({ personId: conflictPersonId, appId: 'act', op: 'allow', version: 1 });
  const conflictDecision = await authorizeActIdentity({ issuer, subject: conflictSubject }, fetch, { allowSessionRenewal: true });
  await prisma.studentProfile.update({ where: { userId: external.id }, data: { studentNumber: conflictSubject } });
  assert.equal(await resolveLocalPlatformUser({
    issuer, subject: conflictSubject, personId: conflictPersonId,
    sessionVersion: conflictDecision.sessionVersion, provisioning: conflictDecision.actProvisioning,
  }), null);

  const legacy = await page.evaluate(async () => (await fetch('/api/user/password', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'legacy-password', newPassword: 'another-password' }),
  })).status);
  assert.equal(legacy, 410);
  const localLogout = await page.evaluate(async () => (await fetch('/api/auth/platform/logout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ global: false }),
  })).status);
  assert.equal(localLogout, 200);
  await page.evaluate(() => sessionStorage.setItem('act_oidc_logout_hold', '1'));
  await page.goto(`${origin}/login`);
  assert.equal(await page.locator('iframe[title="统一身份认证"]').count(), 0);
  const globalLogout = await page.evaluate(async () => (await fetch('/api/auth/platform/logout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ global: true }),
  })).json());
  assert.ok(globalLogout.logout_url.includes('post_logout_redirect_uri'));
  console.log('ACT central login ok');
} finally {
  await browser?.close().catch(() => {});
  stop(nextApp);
  if (prisma) {
    await prisma.user.deleteMany({
      where: { accounts: { some: { provider: 'platform', session_state: { in: [personId, externalPersonId, conflictPersonId] } } } },
    }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
  if (grantServer) await new Promise((resolve) => grantServer.close(resolve));
  await directory?.close().catch(() => {});
  if (keycloakUserId) await kcAdmin(`/admin/realms/platform-test/users/${keycloakUserId}`, { method: 'DELETE' }).catch(() => {});
  if (keycloakClientId) await kcAdmin(`/admin/realms/platform-test/clients/${keycloakClientId}`, { method: 'DELETE' }).catch(() => {});
  if (realmConfig) await kcAdmin('/admin/realms/platform-test', { method: 'PUT', body: JSON.stringify(realmConfig) }).catch(() => {});
  docker(['rm', '-f', container], true);
}
