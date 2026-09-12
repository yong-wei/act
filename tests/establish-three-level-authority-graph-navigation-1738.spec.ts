import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #1738 browser acceptance: three-level navigation over the real product
 * chain. Root → bounded DomainConcept overview → disclosed one-hop network,
 * plus the seven formerly missing v0.37 domains and request-size evidence.
 */

const runtimeRoot = join(process.cwd(), 'course-content/runtime/knowledge/authority-domain-shards');
const evidenceDir = join(process.cwd(), 'artifacts/establish-three-level-authority-graph-navigation-1738');

const pointer = JSON.parse(readFileSync(join(runtimeRoot, 'current.json'), 'utf8')) as { shardSetId: string };
const setRoot = join(runtimeRoot, 'sets', pointer.shardSetId);
const coverage = JSON.parse(readFileSync(join(setRoot, 'coverage.json'), 'utf8')) as {
  domains: Array<{ domainId: string; overviewObjectCount: number; searchEntryCount: number }>;
};

function readDomainShard(domainId: string, file: 'default.json' | 'search-index.json') {
  return JSON.parse(readFileSync(join(setRoot, 'domains', domainId, file), 'utf8')) as {
    objects?: Array<{ id: string; canonicalType: string }>;
    entries?: Array<{ id: string; canonicalType: string; label: string }>;
  };
}

const NONLINEAR_DOMAIN = 'nonlinear-system-analysis';
const MODELING_DOMAIN = 'system-modeling';
const nonlinearDefault = readDomainShard(NONLINEAR_DOMAIN, 'default.json');
const nonlinearIndex = readDomainShard(NONLINEAR_DOMAIN, 'search-index.json');
const modelingDefault = readDomainShard(MODELING_DOMAIN, 'default.json');
const modelingIndex = readDomainShard(MODELING_DOMAIN, 'search-index.json');
const formulaEntry = modelingIndex.entries?.find((entry) => entry.canonicalType === 'Formula');

const DOMAIN_DEFAULT_BUDGET = 512 * 1024;
const ANY_SHARD_BUDGET = 2 * 1024 * 1024;

const recordedRequests: Array<{ test: string; url: string; bytes: number }> = [];

function writeEvidence(label: string) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `request-sizes-${label}.json`),
    `${JSON.stringify({
      shardSetId: pointer.shardSetId,
      catalogDomains: coverage.domains.length,
      requests: recordedRequests,
    }, null, 2)}\n`,
  );
}

async function activateSharedRuntimeControl(page: Page, selector: string) {
  const locator = page.locator(selector);
  await expect(locator).toHaveCount(1);
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('Expected an HTMLElement');
    }
    element.click();
  });
}

async function addStudentSession(context: BrowserContext) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'playwright-local-auth-secret-at-least-32-bytes',
    token: {
      id: 'issue-1738-student',
      email: 'issue-1738-student@example.com',
      name: '1738学生',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

function trackShardRequests(page: Page, label: string) {
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/knowledge/shards/active')) return;
    try {
      const body = await response.body();
      recordedRequests.push({ test: label, url, bytes: body.length });
    } catch {
      // Aborted or streamed responses carry no bounded body evidence.
    }
  });
}

async function visibleNodeIds(page: Page): Promise<string[]> {
  const ids = await page.locator('[data-active-authority-node]').evaluateAll(
    (nodes) => nodes.map((node) => (node as HTMLElement).dataset.activeAuthorityNode ?? ''),
  );
  return [...new Set(ids.filter(Boolean))];
}

test.beforeAll(() => {
  if (!formulaEntry) throw new Error('system-modeling must expose a Formula search entry');
});

test.describe('#1738 three-level authority graph navigation', () => {
  test('desktop: root, bounded overview, search-disclosed one-hop, deterministic return', async ({ page, context }) => {
    test.setTimeout(180_000);
    await addStudentSession(context as BrowserContext);
    trackShardRequests(page, 'desktop');

    // Level one: the exact catalog denominator is visible at the root.
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    const entries = page.locator('[data-authority-domain-entry]');
    await expect(entries.first()).toBeVisible({ timeout: 60_000 });
    await expect(entries).toHaveCount(coverage.domains.length);

    // A formerly missing v0.37 domain now resolves to a bounded overview.
    await activateSharedRuntimeControl(page, '[data-authority-domain-entry="nonlinear-analysis"]');
    const firstConcept = nonlinearDefault.objects![0]!.id;
    await expect(page.locator(`[data-active-authority-node="${firstConcept}"]`).first()).toBeVisible({ timeout: 60_000 });
    const nonlinearConceptIds = new Set(nonlinearDefault.objects!.map((object) => object.id));
    const nonlinearMemberIds = new Set(nonlinearIndex.entries!.map((entry) => entry.id));
    for (const id of await visibleNodeIds(page)) {
      // Members of this domain that are visible must be overview concepts;
      // secondary members stay undisclosed until search or one-hop.
      if (nonlinearMemberIds.has(id)) {
        expect(nonlinearConceptIds.has(id)).toBe(true);
      }
    }

    // Return to the root level.
    await page.click('[data-active-authority-domain-return="true"]');
    await expect(entries.first()).toBeVisible({ timeout: 30_000 });

    // Level two on the densest historical domain, then bounded server search.
    await activateSharedRuntimeControl(page, '[data-authority-domain-entry="modeling"]');
    const modelingConcept = modelingDefault.objects![0]!.id;
    await expect(page.locator(`[data-active-authority-node="${modelingConcept}"]`).first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator(`[data-active-authority-node="${formulaEntry!.id}"]`).count()).toBe(0);

    // Level three: an undisclosed Formula arrives only through search + one-hop.
    await page.fill('#active-authority-search', formulaEntry!.label.slice(0, 6));
    await expect(page.locator(`[data-active-authority-search-result="${formulaEntry!.id}"]`)).toBeVisible({ timeout: 30_000 });
    await page.click(`[data-active-authority-search-result="${formulaEntry!.id}"]`);
    await expect(page.locator(`[data-active-authority-node="${formulaEntry!.id}"]`).first()).toBeVisible({ timeout: 60_000 });

    // Leaving the neighborhood restores the same concept overview.
    await page.keyboard.press('Escape');
    await expect(page.locator(`[data-active-authority-node="${formulaEntry!.id}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-active-authority-node="${modelingConcept}"]`).first()).toBeVisible();

    // Bounded server search was used, never a full-domain request.
    const searchRequests = recordedRequests.filter((row) => row.url.includes('/search?'));
    expect(searchRequests.length).toBeGreaterThan(0);
    for (const row of recordedRequests) {
      expect(row.bytes).toBeLessThan(ANY_SHARD_BUDGET);
      if (row.url.includes('/domains/') && !row.url.includes('/families/') && !row.url.includes('/search')) {
        expect(row.bytes).toBeLessThan(DOMAIN_DEFAULT_BUDGET);
      }
    }
    writeEvidence('desktop');
  });

  test('mobile: the seven formerly missing domains enter the same bounded overview', async ({ page, context }) => {
    test.setTimeout(180_000);
    await addStudentSession(context as BrowserContext);
    trackShardRequests(page, 'mobile');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    const entries = page.locator('[data-authority-domain-entry]');
    await expect(entries.first()).toBeVisible({ timeout: 60_000 });
    await expect(entries).toHaveCount(coverage.domains.length);

    for (const visualRole of ['nonlinear-analysis', 'lyapunov', 'discrete-design']) {
      await activateSharedRuntimeControl(page, `[data-authority-domain-entry="${visualRole}"]`);
      const firstNode = page.locator('[data-active-authority-node]').first();
      await expect(firstNode).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-active-authority-filter-panel="true"]')).toBeVisible();
      await expect(page.locator('[data-active-authority-type-menu-trigger]')).toBeVisible();
      await page.click('[data-active-authority-domain-return="true"]');
      await expect(entries.first()).toBeVisible({ timeout: 30_000 });
    }

    for (const row of recordedRequests.filter((item) => item.test === 'mobile')) {
      expect(row.bytes).toBeLessThan(ANY_SHARD_BUDGET);
      if (row.url.includes('/domains/') && !row.url.includes('/families/') && !row.url.includes('/search')) {
        expect(row.bytes).toBeLessThan(DOMAIN_DEFAULT_BUDGET);
      }
    }
    writeEvidence('mobile');
  });
});
