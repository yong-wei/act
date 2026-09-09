import { createReadStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { expect, test, type BrowserContext } from '@playwright/test';

import { credentialsFor } from '../scripts/db/verified-test-accounts.mjs';

const BOOK_ID = 'hu-shousong-auto-control-8th';
const RUNTIME_ROOT = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbooks-v2',
  BOOK_ID,
);
const admin = credentialsFor('admin', {
  loginId: process.env.TEXTBOOK_READER_TEST_ACCOUNT,
  password: process.env.TEXTBOOK_READER_TEST_PASSWORD,
});
const TEST_ACCOUNT = {
  account: admin.loginId,
  password: admin.password,
};

interface RuntimeUnit {
  id: string;
  structuralPath: string[];
  title: string;
  markdown: string;
}

let edition = '';
let sourceRevision = '';
let firstUnit: RuntimeUnit;
let secondUnit: RuntimeUnit;

function textbookUrl(unit: RuntimeUnit) {
  return `/${[
    'textbooks',
    BOOK_ID,
    encodeURIComponent(edition),
    ...unit.structuralPath.map(encodeURIComponent),
  ].join('/')}`;
}

async function loadUnits() {
  const manifest = JSON.parse(await readFile(path.join(RUNTIME_ROOT, 'manifest.json'), 'utf8')) as {
    edition: string;
    sourceRevision: string;
  };
  edition = manifest.edition;
  sourceRevision = manifest.sourceRevision;
  const units: RuntimeUnit[] = [];
  const lines = createInterface({
    input: createReadStream(path.join(RUNTIME_ROOT, 'units.jsonl'), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const unit = JSON.parse(line) as RuntimeUnit;
    if (unit.structuralPath?.length) units.push(unit);
    if (units.length >= 2) break;
  }
  if (units.length < 1) throw new Error('Need a textbook unit');
  [firstUnit] = units;
  secondUnit = units[1] ?? units[0];
}

async function establishAuthenticatedSession(context: BrowserContext, baseURL: string) {
  const request = context.request;
  const csrfResponse = await request.get(new URL('/api/auth/csrf', baseURL).toString());
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBeTruthy();
  const loginResponse = await request.post(
    new URL('/api/auth/callback/credentials?json=true', baseURL).toString(),
    {
      form: {
        csrfToken: csrf.csrfToken!,
        email: TEST_ACCOUNT.account,
        password: TEST_ACCOUNT.password,
        callbackUrl: baseURL,
        json: 'true',
      },
    },
  );
  expect(loginResponse.ok()).toBeTruthy();
}

test.describe('textbook resource coaching', () => {
  // 用例共享测试账号与教材单元身份，必须串行避免会话计数与幂等键互相干扰
  test.describe.configure({ mode: 'serial' });

  test.skip(!existsSync(RUNTIME_ROOT), 'structured textbook runtime v2 is not synchronized');

  test.beforeAll(loadUnits);

  test('opens contextual coaching without remounting the reader and preserves live scroll', async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required');
    const context = await browser.newContext();
    await establishAuthenticatedSession(context, baseURL);
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(textbookUrl(firstUnit));

    const surface = page.locator('[data-textbook-coaching-surface="true"]');
    await expect(surface).toBeVisible();
    const askButton = page.getByRole('button', { name: '对本页提问' });
    await expect(askButton).toBeVisible();
    await expect(askButton).toHaveAttribute('data-konling-mode', 'resource-coach');
    await askButton.focus();
    await expect(askButton).toBeFocused();

    const reader = page.locator('[data-textbook-reader="true"]');
    await expect(reader).toBeVisible();
    const liveUnit = await surface.getAttribute('data-live-unit');
    await askButton.click();
    await expect(surface).toHaveAttribute('data-panel-open', 'true');
    await expect(reader).toBeVisible();
    await expect(surface).toHaveAttribute('data-live-unit', liveUnit ?? '');

    const article = page.locator('article');
    await article.evaluate((node) => {
      const scroller = node.closest('section');
      if (scroller) scroller.scrollTop = 120;
    });
    await page.keyboard.press('Escape');
    await expect(surface).toHaveAttribute('data-panel-open', 'false');
    await expect(reader).toBeVisible();
    await expect(surface).toHaveAttribute('data-live-unit', liveUnit ?? '');
  });

  test('refuses an unverifiable version-bound handle without leaving the current unit', async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required');
    const context = await browser.newContext();
    await establishAuthenticatedSession(context, baseURL);
    const page = await context.newPage();
    const url = `${textbookUrl(firstUnit)}?vbh=not-a-signed-handle`;
    await page.goto(url);
    await expect(page.locator('[data-textbook-citation-unavailable="true"]')).toBeVisible();
    await expect(page.locator('[data-textbook-reader="true"]')).toBeVisible();
    await expect(page.locator('[data-textbook-coaching-surface="true"]')).toHaveAttribute(
      'data-live-unit',
      firstUnit.id,
    );
    await expect(page).toHaveURL(new RegExp(firstUnit.structuralPath[0]));
  });

  for (const width of [1440, 320]) {
    test(`creates no conversation across mount, reopen and refresh without a submitted question (${width}px)`, async ({
      browser,
      baseURL,
    }) => {
      if (!baseURL) throw new Error('Playwright baseURL is required');
      const context = await browser.newContext();
      await establishAuthenticatedSession(context, baseURL);
      const listConversations = async () => {
        const response = await context.request.get(new URL('/api/ai/sessions', baseURL).toString());
        expect(response.ok()).toBeTruthy();
        const body = await response.json() as { conversations: unknown[] };
        return body.conversations.length;
      };
      const page = await context.newPage();
      await page.setViewportSize({ width, height: width > 500 ? 900 : 720 });

      const askAndAwaitResolve = async () => {
        // 开发服务器下等待页面水合完成，且仅在面板未打开时点击，避免重复点击关合面板
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.waitForTimeout(1500);
        const ask = page.getByRole('button', { name: '对本页提问' });
        await expect(ask).toBeVisible();
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const waiting = page.waitForResponse(
            (response) => response.url().includes('/api/ai/sessions/resource-coach-match'),
            { timeout: 6000 },
          );
          const open = await page.evaluate(() =>
            document.querySelector('[data-panel-open]')?.getAttribute('data-panel-open'));
          if (open !== 'true') await ask.click();
          try {
            return await waiting;
          } catch {
            // 面板已打开或水合未完成时本轮未触发解析，重试
          }
        }
        throw new Error('resource-coach match was not requested');
      };

      const baseline = await listConversations();
      await page.goto(textbookUrl(firstUnit));
      await askAndAwaitResolve();
      expect(await listConversations()).toBe(baseline);

      await page.keyboard.press('Escape');
      await page.reload();
      await askAndAwaitResolve();
      expect(await listConversations()).toBe(baseline);
      await context.close();
    });

    test(`restores the version-bound conversation on reopen instead of creating a replacement (${width}px)`, async ({
      browser,
      baseURL,
    }) => {
      test.setTimeout(90_000);
      if (!baseURL) throw new Error('Playwright baseURL is required');
      const context = await browser.newContext();
      await establishAuthenticatedSession(context, baseURL);

      // 两个视口使用不同单元，避免共享幂等键在串行用例间互相干扰
      const unit = width > 500 ? firstUnit : secondUnit;
      // 建立等价于首个问题完成后的已绑定会话（服务端验证身份后落库）
      const contentHash = `sha256:${createHash('sha256').update(unit.markdown, 'utf8').digest('hex')}`;
      const created = await context.request.post(new URL('/api/ai/sessions', baseURL).toString(), {
        data: {
          courseId: 'automatic-control',
          pageId: textbookUrl(unit),
          assistantBinding: {
            modeId: 'resource-coach',
            clientContextHints: {
              resourceKind: 'structured-textbook-unit',
              resourceId: unit.id,
              bookId: BOOK_ID,
              edition,
              sourceRevision,
              unitId: unit.id,
              contentHash,
            },
          },
        },
      });
      expect([200, 201]).toContain(created.status());
      const conversation = await created.json() as { id: string };

      const page = await context.newPage();
      await page.setViewportSize({ width, height: width > 500 ? 900 : 720 });
      // 持久监听器跨重试与刷新累积事实，避免 waitForResponse 与点击的时序竞争；
      // 页面侧任何 POST /api/ai/sessions 都意味着创建了替代会话
      let detailFetchCount = 0;
      let pageCreateCount = 0;
      page.on('response', (response) => {
        if (
          response.url().includes(`/api/ai/sessions/${conversation.id}`)
          && response.request().method() === 'GET'
          && response.ok()
        ) {
          detailFetchCount += 1;
        }
      });
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().endsWith('/api/ai/sessions')) {
          pageCreateCount += 1;
        }
      });
      const reopenAndAwaitRestore = async (expectedCount: number) => {
        // 开发服务器下等待页面水合完成，且仅在面板未打开时点击，避免重复点击关合面板
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.waitForTimeout(1500);
        const ask = page.getByRole('button', { name: '对本页提问' });
        await expect(ask).toBeVisible();
        for (let attempt = 0; attempt < 10 && detailFetchCount < expectedCount; attempt += 1) {
          const open = await page.evaluate(() =>
            document.querySelector('[data-panel-open]')?.getAttribute('data-panel-open'));
          if (open !== 'true') await ask.click();
          await page.waitForTimeout(2000);
        }
        expect(detailFetchCount).toBeGreaterThanOrEqual(expectedCount);
      };

      await page.goto(textbookUrl(unit));
      await reopenAndAwaitRestore(1);
      expect(pageCreateCount).toBe(0);

      await page.keyboard.press('Escape');
      await page.reload();
      await reopenAndAwaitRestore(2);
      expect(pageCreateCount).toBe(0);

      const cleanup = await context.request.delete(
        new URL(`/api/ai/sessions/${conversation.id}`, baseURL).toString(),
        { data: { confirmed: true } },
      );
      expect(cleanup.ok()).toBeTruthy();
      await context.close();
    });
  }
});
