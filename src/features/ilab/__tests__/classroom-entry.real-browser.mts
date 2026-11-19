import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const origin = process.env.CLASSROOM_TEST_ORIGIN ?? 'http://127.0.0.1:3847';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Run with a local app and the iLab test bypass enabled');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const resources: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/\.(glb|wasm)$/.test(path)) resources.push(path);
  });
  let release = false;
  const entry = '**/api/simulations/network/classroom-entry';
  await page.route(entry, route => release ? route.continue() : route.fulfill({
    json: { admitted: false, retryAfterMs: 1000 },
  }));
  const exchange = page.waitForResponse(response => response.url() === origin + '/api/ilab/grant' && response.request().method() === 'POST',
    { timeout: 120000 });
  await page.goto(origin + '/simulations/destroyer?ticket=dev-bypass&graphics=webgl', { waitUntil: 'domcontentloaded', timeout: 120000 });
  const response = await exchange;
  assert.equal(response.status(), 200);
  await page.getByText('正在分批入场，轮到时会自动打开实验。').waitFor({ timeout: 20000 });
  assert.equal(new URL(page.url()).searchParams.has('ticket'), false);
  assert.equal(resources.length, 0, 'Waiting does not fetch scene or WASM');
  const authenticated = await page.request.get(origin + '/api/ilab/grant');
  const prior = await authenticated.json();
  assert(prior.userId);
  type SessionView = { originId: string; uploadMode: string };
  const seen: SessionView[] = [];
  await page.route('**/api/ilab/destroyer/session**', async route => {
    const response = await route.fetch();
    if (response.ok()) seen.push(await response.json() as SessionView);
    await route.fulfill({ response });
  });
  const admitted = page.waitForResponse(response => response.url().endsWith('classroom-entry') && response.ok());
  const hydrated = page.waitForResponse(response => response.url().startsWith(origin + '/api/ilab/course-session-recovery?')
    && response.ok(), { timeout: 90000 });
  void hydrated.catch(() => undefined);
  release = true;
  await Promise.all([admitted, hydrated]);
  await page.waitForFunction(() => sessionStorage.getItem('act-destroyer-origin'), undefined, { timeout: 90000 });
  const session = seen.find(view => view.originId);
  assert(session?.originId);
  assert.equal(session.uploadMode, 'dev-bypass');
  seen.length = 0;
  const recovery = page.waitForResponse(response => response.url() === origin + '/api/ilab/destroyer/session/' + session.originId
    && response.request().method() === 'GET' && response.ok(), { timeout: 90000 });
  await Promise.all([recovery, page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })]);
  assert(seen.some(view => view.originId === session.originId && view.uploadMode === session.uploadMode));
  assert.equal((await (await page.request.get(origin + '/api/ilab/grant')).json()).userId, prior.userId);
  console.log('Verified waiting gate, ticket exchange, same grant after reload and gated scene start');
} finally { await browser.close(); }
