import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { expect, test, type BrowserContext } from '@playwright/test';

const BOOK_ID = 'hu-shousong-auto-control-8th';
const RUNTIME_ROOT = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbooks-v2',
  BOOK_ID,
);
const TEST_ACCOUNT = {
  account: process.env.TEXTBOOK_READER_TEST_ACCOUNT ?? 'admin',
  password: process.env.TEXTBOOK_READER_TEST_PASSWORD ?? 'admin@Just',
};

interface RuntimeUnit {
  id: string;
  structuralPath: string[];
  title: string;
}

let edition = '';
let firstUnit: RuntimeUnit;

function textbookUrl(unit: RuntimeUnit) {
  return `/${[
    'textbooks',
    BOOK_ID,
    encodeURIComponent(edition),
    ...unit.structuralPath.map(encodeURIComponent),
  ].join('/')}`;
}

async function loadUnits() {
  const manifest = JSON.parse(await readFile(path.join(RUNTIME_ROOT, 'manifest.json'), 'utf8')) as { edition: string };
  edition = manifest.edition;
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
});
