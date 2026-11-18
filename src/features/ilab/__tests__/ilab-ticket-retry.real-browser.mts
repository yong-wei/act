import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

const origin = process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3001';
assert(['localhost', '127.0.0.1', 'act.adapt-learn.online'].includes(new URL(origin).hostname));
const ticket = 'ACT-TICKET-RETRY-FIXTURE';
const failure = '实验空间响应超时，请保留当前链接并刷新重试。';
const paths = ['', 'destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const outcomes: Array<{ path: string; retryRequests: number }> = [];

try {
  for (const vessel of paths) {
    // 正式环境通过现有测试账号的会话建立先登录再携票进入的初始状态。
    const context = await browser.newContext({ storageState: process.env.VESSEL_BROWSER_STORAGE_STATE });
    const path = `/simulations${vessel ? `/${vessel}` : ''}`;
    const endpoint = !vessel ? '/api/ilab/grant' : vessel === 'destroyer'
      ? '/api/ilab/destroyer/session' : '/api/ilab/vessel/session';
    let attempts = 0;
    let allowGrant = false;
    let mappedReady = false;
    let courseRecoveries = 0;
    const session = { connected: true, userId: 'ilab-retry-fixture', displayName: '入口重试测试',
      originId: '00000000-0000-4000-8000-000000000001', uploadMode: 'ilab-remote',
      experimentVersion: VESSEL_COURSE_VERSION, steps: [], currentSeq: 1, status: 0 };
    await context.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/ilab/') && !url.pathname.startsWith('/api/auth/')) {
        if (request.method() === 'GET' || request.method() === 'HEAD') await route.continue();
        else await route.fulfill({ status: 403, json: { error: 'Read-only browser fixture' } });
        return;
      }
      if (url.pathname === '/api/ilab/course-session-recovery') courseRecoveries++;
      if (url.pathname === endpoint && request.method() === 'POST') {
        // Keep the existing client account available while the asynchronous exchange is in flight.
        await new Promise(resolve => setTimeout(resolve, 100));
        const arrivalTicket = request.postDataJSON().ticket;
        if (arrivalTicket) {
          assert.equal(arrivalTicket, ticket);
          attempts++;
        } else assert(mappedReady, 'A pending arrival must complete before opening an account session');
        if (allowGrant) mappedReady = true;
        await route.fulfill({ status: allowGrant ? 200 : 401, json: allowGrant
          ? session : { error: failure } });
        return;
      }
      await route.fulfill({ status: 200, json: url.pathname === '/api/auth/session'
        ? { user: { id: mappedReady ? session.userId : 'platform-retry-fixture', role: 'STUDENT', name: '入口测试' },
          expires: new Date(Date.now() + 3600000).toISOString() }
        : url.pathname === endpoint && mappedReady ? session
          : url.pathname === '/api/ilab/grant' ? { connected: mappedReady }
            : url.pathname === '/api/ilab/course-session-recovery' ? { recovery: null } : { reports: [] } });
    });
    try {
      const page = await context.newPage();
      const arrival = new URL(path, origin);
      arrival.searchParams.set('ticket', ticket);
      arrival.searchParams.set('token', 'legacy-fixture');
      arrival.searchParams.set('graphics', 'webgl');
      arrival.searchParams.set('keep', 'retry-regression');
      const exchange = page.waitForResponse(response => new URL(response.url()).pathname === endpoint
        && response.request().method() === 'POST', { timeout: 90000 });
      await page.goto(arrival.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await exchange;
      await page.waitForTimeout(500);
      assert.equal(new URL(page.url()).searchParams.get('ticket'), ticket, `${path} must retain a failed ticket`);
      await page.getByText(failure, { exact: true }).first().waitFor({ timeout: 90000 })
        .catch(() => { throw new Error(`${path} must show the failed-arrival retry message`); });
      const before = attempts;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText(failure, { exact: true }).first().waitFor({ timeout: 90000 });
      assert(attempts > before, `${path} must retry the same arrival after refresh`);
      assert.equal(new URL(page.url()).searchParams.get('ticket'), ticket);
      assert.equal(new URL(page.url()).searchParams.get('keep'), 'retry-regression');
      assert.equal(courseRecoveries, 0, 'Failed arrivals must wait for their mapped account before recovering course data');
      for (const reset of await page.getByRole('button', { name: '重置', exact: true }).all()) {
        assert(await reset.isDisabled(), 'Pending identity must protect the prior account from reset actions');
      }
      const recovered = vessel ? page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/ilab/course-session-recovery', { timeout: 90000 }) : null;
      allowGrant = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (recovered) await recovered;
      else await page.locator('[data-ilab-grant-status="connected"]').waitFor({ timeout: 90000 });
      const connected = new URL(page.url());
      assert.equal(connected.searchParams.has('ticket'), false);
      assert.equal(connected.searchParams.has('token'), false);
      assert.equal(connected.searchParams.get('keep'), 'retry-regression');
      outcomes.push({ path, retryRequests: attempts });
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({ status: 'passed', scope: 'mocked upstream responses in actual pages',
    externalIlabCalls: 0, experimentApisMocked: true, successStripsArrivalOnlyAfterConnection: true, outcomes }));
} finally {
  await browser.close();
}
