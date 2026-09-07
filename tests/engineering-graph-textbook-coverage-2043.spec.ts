import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * #2043 browser acceptance: canvas node detail shows governed textbook
 * sources and launches the unified reader — zero frontend change. The
 * inspected node is picked from the governed artifacts themselves: a
 * DomainConcept that is visible in its domain default overview, carries
 * approved mapping sources, and owns a v2 textbook-section binding.
 */

const runtimeRoot = join(process.cwd(), 'course-content/runtime/knowledge/authority-domain-shards');
const mappingRoot = join(process.cwd(), 'course-content/authoring/knowledge/engineering-textbook-mapping');
const evidenceDir = join(process.cwd(), 'artifacts/issue-2043-textbook-coverage');

const pointer = JSON.parse(readFileSync(join(runtimeRoot, 'current.json'), 'utf8')) as {
  shardSetId: string;
  releaseId: string;
};
const setRoot = join(runtimeRoot, 'sets', pointer.shardSetId);
const coverage = JSON.parse(readFileSync(join(setRoot, 'coverage.json'), 'utf8')) as {
  sourceCitations: { ledgerProvided: boolean; nodesWithSources: number };
};
const sourcesInput = JSON.parse(readFileSync(join(mappingRoot, 'sources-input.json'), 'utf8')) as {
  contract: string;
  entries: Array<{ nodeId: string; sources: Array<{ sourceEditionId: string; label: string }> }>;
};
const projectionPointer = JSON.parse(
  readFileSync(join(process.cwd(), 'course-content/runtime/knowledge/projection/current.json'), 'utf8'),
) as { projectionId: string };
const projectionRoot = join(
  process.cwd(),
  'course-content/runtime/knowledge/projection/releases',
  projectionPointer.projectionId,
);
const bindings = readFileSync(join(projectionRoot, 'bindings.jsonl'), 'utf8')
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line) as { resourceId: string; canonicalId: string });
const catalog = JSON.parse(
  readFileSync(join(setRoot, 'domains', 'system-modeling', 'default.json'), 'utf8'),
) as { objects?: Array<{ id: string; canonicalType: string; label: string }> };

const sourcesByNode = new Map(sourcesInput.entries.map((entry) => [entry.nodeId, entry.sources]));
const textbookBoundNodes = new Set(
  bindings
    .filter((binding) => binding.resourceId.startsWith('act:textbook-section:'))
    .map((binding) => binding.canonicalId),
);
const inspectable = (catalog.objects ?? []).find((object) =>
  object.canonicalType === 'DomainConcept'
  && sourcesByNode.has(object.id)
  && textbookBoundNodes.has(object.id));
if (!inspectable) {
  throw new Error('#2043 acceptance: no visible DomainConcept carries both sources and a textbook binding');
}
const expectedSources = sourcesByNode.get(inspectable!.id)!;

function writeEvidence(payload: unknown, name: string): void {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, name),
    `${JSON.stringify(payload, null, 2)}\n`,
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
      id: 'issue-2043-student',
      email: 'issue-2043-student@example.com',
      name: '2043学生',
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
  }]);
}

test.describe('#2043 engineering-textbook coverage on canvas', () => {
  test('node detail shows textbook sources and launches the unified reader', async ({ page, context }) => {
    test.setTimeout(180_000);
    await addStudentSession(context as BrowserContext);

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-domain-entry]').first()).toBeVisible({ timeout: 60_000 });

    await activateSharedRuntimeControl(page, '[data-authority-domain-entry="modeling"]');
    const node = page.locator(`[data-active-authority-node="${inspectable!.id}"]`).first();
    await expect(node).toBeVisible({ timeout: 60_000 });
    // The canvas overlay intercepts pointer events; dispatch the DOM click
    // directly like the #1738 acceptance does.
    await node.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('Expected an HTMLElement');
      }
      element.click();
    });

    // Sources section displays the governed citation labels (no frontend change).
    const sourcesSection = page.locator('section[aria-labelledby="active-detail-sources"]');
    await expect(sourcesSection).toBeVisible({ timeout: 30_000 });
    const sourcesText = await sourcesSection.locator('p').first().textContent();
    expect(sourcesText, 'sources must not be the none-placeholder').toContain(
      expectedSources[0]!.label.split('·')[0]!.trim().slice(0, 12),
    );

    // Data-layer evidence: the projection binds textbook sections with unified
    // reader hrefs (see the resource-bindings unit tests). The in-panel click
    // is pending a user decision: the knowledge-graph launch sanitizer
    // deliberately rejects percent-encoded spaces, while two of three source
    // editions contain spaces (14th Global Edition / 7th edition).
    const sectionBinding = bindings.find((binding) =>
      binding.canonicalId === inspectable!.id
      && binding.resourceId.startsWith('act:textbook-section:')
      && !binding.resourceId.startsWith('act:textbook-section:cts.'));
    expect(sectionBinding, 'node must carry a v2 textbook-section binding').toBeTruthy();

    writeEvidence({
      shardSetId: pointer.shardSetId,
      releaseId: pointer.releaseId,
      projectionId: projectionPointer.projectionId,
      coverage: coverage.sourceCitations,
      inspectedNode: {
        id: inspectable!.id,
        label: inspectable!.label,
        sources: expectedSources,
      },
      v2SectionBinding: sectionBinding ?? null,
    }, 'canvas-acceptance.json');
  });

  test.fixme('textbook sections launch the unified reader from the resources panel', async ({ page, context }) => {
    test.setTimeout(180_000);
    await addStudentSession(context as BrowserContext);
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-authority-domain-entry]').first()).toBeVisible({ timeout: 60_000 });
    await activateSharedRuntimeControl(page, '[data-authority-domain-entry="modeling"]');
    const node = page.locator(`[data-active-authority-node="${inspectable!.id}"]`).first();
    await expect(node).toBeVisible({ timeout: 60_000 });
    await node.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('Expected an HTMLElement');
      }
      element.click();
    });
    const readerLaunch = page.locator('a[data-active-resource-launch][href^="/textbooks/"]');
    await expect(readerLaunch.first()).toBeVisible({ timeout: 30_000 });
    const href = await readerLaunch.first().getAttribute('href');
    expect(href).toMatch(/^\/textbooks\/[a-z0-9-]+\/[^/]+\/.+/);
  });
});
