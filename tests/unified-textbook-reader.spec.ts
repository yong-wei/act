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
}

interface RuntimeAnchor {
  id: string;
  owningUnitId: string;
}

let edition = '';
let firstUnit: RuntimeUnit;
let secondUnit: RuntimeUnit;
let anchoredUnit: RuntimeUnit;
let fragment = '';

function textbookUrl(unit: RuntimeUnit, anchor?: string): string {
  const pathname = [
    'textbooks',
    BOOK_ID,
    encodeURIComponent(edition),
    ...unit.structuralPath.map(encodeURIComponent),
  ].join('/');
  return `/${pathname}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`;
}

async function loadRuntimeFixtures() {
  const manifest = JSON.parse(
    await readFile(path.join(RUNTIME_ROOT, 'manifest.json'), 'utf8'),
  ) as { edition: string };
  edition = manifest.edition;

  const anchorLines = createInterface({
    input: createReadStream(path.join(RUNTIME_ROOT, 'anchors.jsonl'), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let firstAnchor: RuntimeAnchor | null = null;
  for await (const line of anchorLines) {
    if (!line.trim()) continue;
    firstAnchor = JSON.parse(line) as RuntimeAnchor;
    anchorLines.close();
    break;
  }
  if (!firstAnchor) throw new Error('Missing textbook fragment fixture');
  fragment = firstAnchor.id.slice(firstAnchor.id.lastIndexOf('#') + 1);

  const unitLines = createInterface({
    input: createReadStream(path.join(RUNTIME_ROOT, 'units.jsonl'), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  const firstUnits: RuntimeUnit[] = [];
  let matchedAnchorOwner: RuntimeUnit | null = null;
  for await (const line of unitLines) {
    if (!line.trim()) continue;
    const unit = JSON.parse(line) as RuntimeUnit;
    if (firstUnits.length < 2) firstUnits.push(unit);
    if (unit.id === firstAnchor.owningUnitId) matchedAnchorOwner = unit;
    if (firstUnits.length === 2 && matchedAnchorOwner) {
      unitLines.close();
      break;
    }
  }
  if (firstUnits.length < 2 || !matchedAnchorOwner) {
    throw new Error('Missing textbook unit fixtures');
  }
  [firstUnit, secondUnit] = firstUnits;
  anchoredUnit = matchedAnchorOwner;
}

async function establishAuthenticatedSession(context: BrowserContext, baseURL: string) {
  const request = context.request;
  const csrfResponse = await request.get(new URL('/api/auth/csrf', baseURL).toString());
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();

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
  expect(loginResponse.ok()).toBe(true);
  const sessionResponse = await request.get(new URL('/api/auth/session', baseURL).toString());
  const session = await sessionResponse.json() as { user?: { id?: string } };
  expect(session.user?.id).toBeTruthy();
}

test.describe('unified textbook reader', () => {
  test.skip(!existsSync(RUNTIME_ROOT), 'structured textbook runtime v2 is not synchronized');

  test.beforeAll(loadRuntimeFixtures);

  test('denies anonymous access before rendering textbook content', async ({ page }) => {
    await page.goto(textbookUrl(firstUnit));
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await expect(page.locator('[data-textbook-reader="true"]')).toHaveCount(0);
  });

  test('supports standalone, refresh, intercepted modal, close, and shared links', async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required');
    const context = await browser.newContext();
    await establishAuthenticatedSession(context, baseURL);
    const page = await context.newPage();
    const firstUrl = textbookUrl(firstUnit);
    const secondUrl = textbookUrl(secondUnit);

    await page.goto(firstUrl);
    await expect(page.locator('[data-textbook-reader-presentation="standalone"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-textbook-reader-presentation="standalone"]')).toBeVisible();

    const sourceUrl = '/review/unified-textbook-reader';
    await page.goto(sourceUrl);
    await page.locator('[data-textbook-review-entry="true"]').click();
    await expect(page).toHaveURL(firstUrl);
    await expect(page.locator('[data-textbook-reader-modal="true"]')).toBeVisible();
    await expect(page.locator('[data-textbook-reader-presentation="modal"]')).toBeVisible();

    await page.locator(`a[href="${secondUrl}"]`).last().click();
    await expect(page).toHaveURL(secondUrl);
    await expect(page.locator('[data-textbook-reader-presentation="modal"]')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(firstUrl);
    await expect(page.locator('[data-textbook-reader-presentation="modal"]')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(sourceUrl);
    await expect(page.locator('[data-textbook-reader-modal="true"]')).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(firstUrl);
    await expect(page.locator('[data-textbook-reader-presentation="modal"]')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(secondUrl);
    await expect(page.locator('[data-textbook-reader-presentation="modal"]')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(sourceUrl);
    await expect(page.locator('[data-textbook-reader-modal="true"]')).toHaveCount(0);

    await page.goForward();
    await expect(page).toHaveURL(firstUrl);
    await page.goBack();
    await expect(page).toHaveURL(sourceUrl);

    const sharedPage = await context.newPage();
    await sharedPage.goto(secondUrl);
    await expect(
      sharedPage.locator('[data-textbook-reader-presentation="standalone"]'),
    ).toBeVisible();
    await context.close();
  });

  test('focuses a valid fragment and keeps chapter navigation usable', async ({
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error('Playwright baseURL is required');
    const context = await browser.newContext();
    await establishAuthenticatedSession(context, baseURL);
    const page = await context.newPage();

    await page.goto(textbookUrl(anchoredUnit, fragment));
    const fragmentRoot = page.locator('[data-textbook-fragment-state="focused"]');
    await expect(fragmentRoot).toBeVisible();
    await expect(
      fragmentRoot.locator('[data-textbook-fragment-target="true"]'),
    ).toBeFocused();
    await expect(page.getByRole('navigation', { name: '教材目录' })).toBeVisible();

    await page.locator('[data-textbook-parent-link="true"]:visible').first().click();
    await expect(page).toHaveURL(textbookUrl(firstUnit));
    await expect(
      page.locator('[data-textbook-reader-presentation="standalone"]'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(textbookUrl(anchoredUnit, fragment));
    await expect(page.getByText('展开全书目录')).toBeVisible();
    expect(await page.evaluate(() => (
      Math.max(document.body.scrollWidth, document.documentElement.scrollWidth)
      > window.innerWidth + 1
    ))).toBe(false);
    await context.close();
  });
});
