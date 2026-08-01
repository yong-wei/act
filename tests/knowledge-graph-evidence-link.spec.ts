import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const evidenceDir = join(process.cwd(), 'artifacts/commercial-ui/knowledge-graph-evidence-link/playwright');
const graphVersion = 'knowledge-evidence-link-v1';
const testNodeId = 'knowledge-node:test-evidence-link-001';
const domainNode = {
  id: 'chapter-node:evidence-link-review',
  name: '\u7b2c\u4e00\u7ae0',
  nodeType: 'THEORY',
  description: '\u8bc1\u636e\u94fe\u63a5\u9a8c\u6536\u9886\u57df',
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '\u7b2c\u4e00\u7ae0',
  metadata: { isVirtualChapter: true, chapterName: '\u7b2c\u4e00\u7ae0' },
  expansion: { state: 'expandable' as const, revealableNeighborCount: 1 },
};
const testNode = {
  id: testNodeId,
  name: '\u53cd\u9988\u63a7\u5236\u7cfb\u7edf',
  nodeType: 'THEORY',
  description: '\u53cd\u9988\u63a7\u5236\u7cfb\u7edf\u7684\u57fa\u672c\u6982\u5ff5\u4e0e\u7ed3\u6784',
  positionX: 120,
  positionY: 0,
  positionZ: 0,
  chapter: 1,
  chapterName: '\u7b2c\u4e00\u7ae0',
  metadata: { chapterName: '\u7b2c\u4e00\u7ae0' },
  expansion: { state: 'leaf' as const },
};

async function addStudentSession(context: BrowserContext) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'knowledge-evidence-student',
      email: 'knowledge-evidence-student@example.com',
      name: 'Knowledge Evidence Student',
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
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

async function installRoutes(context: BrowserContext) {
  await context.route(`**/api/knowledge/nodes/${testNodeId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...testNode,
        metadata: { ...testNode.metadata, lessonId: '1-1' },
        resources: [{ path: 'course-content/runtime/knowledge/cards/nodes/test-evidence-link.md' }],
        relatedNodes: [],
      }),
    });
  });

  await context.route('**/api/knowledge/graph?*', async (route) => {
    const url = new URL(route.request().url());
    const mode = url.searchParams.get('mode');
    const domainId = url.searchParams.get('domainId');

    if (mode === 'expansion' && domainId === domainNode.id) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode,
          domainId,
          graphVersion,
          shardKey: `${graphVersion}:shard:expansion:${domainNode.id}`,
          nodes: [domainNode, testNode],
          links: [{
            id: `chapter-link:${domainNode.id}->${testNode.id}`,
            sourceId: domainNode.id,
            targetId: testNode.id,
            relation: 'contains',
            relationType: 'contains',
            strength: 1,
          }],
          source: 'file',
          truncated: { nodes: false, links: false, membershipLinks: false },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode,
        graphVersion,
        shardKey: mode === 'root'
          ? `${graphVersion}:shard:root:chapters`
          : `${graphVersion}:shard:${mode ?? 'remaining'}`,
        nodes: mode === 'root' ? [domainNode] : [],
        links: [],
        ...(mode === 'root' ? {
          rootCatalog: [{
            nodeId: testNode.id,
            nodeName: testNode.name,
            nodeType: testNode.nodeType,
            domainId: domainNode.id,
            chapterName: domainNode.name,
          }],
          rootSummaries: [{
            rootId: domainNode.id,
            rootName: domainNode.name,
            nodeCount: 1,
            hasExpansion: true,
          }],
        } : {}),
        source: 'file',
        truncated: { nodes: false, links: false, membershipLinks: false },
      }),
    });
  });

  await context.route('**/api/student/evidence?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'evidence-link-review-item',
          factType: 'question',
          outcome: 'success',
          score: 90,
          lessonId: '1-1',
          startedAt: '2026-07-26T08:00:00.000Z',
          createdAt: '2026-07-26T08:00:00.000Z',
          competencyContribution: {},
        }],
        nextCursor: null,
      }),
    });
  });
}

async function openLearningActions(page: Page) {
  const section = page.locator('[data-knowledge-inspector-section="learning-actions"]');
  await section.getByRole('button').click();
  return section;
}

function primaryCanvas(page: Page) {
  return page.getByRole('main').locator('[data-knowledge-canvas-primary="true"]');
}

test.describe.configure({ timeout: 120_000 });

for (const width of [1280, 320] as const) {
  test(`preserves knowledge context through evidence navigation at ${width}px`, async ({ context, page }) => {
    mkdirSync(evidenceDir, { recursive: true });
    await addStudentSession(context);
    await installRoutes(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/knowledge?node=${encodeURIComponent(testNodeId)}`, { waitUntil: 'domcontentloaded' });

    const canvas = primaryCanvas(page);
    await expect(canvas).toHaveAttribute('data-knowledge-selected-node-id', testNodeId);
    await expect(page.locator('[data-knowledge-inspector="floating-right-edge"]')).toBeVisible();
    const sourceUrl = page.url();
    const actions = await openLearningActions(page);
    const evidenceLink = actions.locator('[data-resource-node-action="review-evidence"]');
    await expect(evidenceLink).toHaveAttribute('target', '_blank');
    await expect(evidenceLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(evidenceLink).toHaveAttribute(
      'href',
      `/profile/evidence?node=${encodeURIComponent(testNodeId)}`,
    );
    await page.screenshot({ path: join(evidenceDir, `knowledge-selected-${width}.png`), fullPage: true });

    const [evidencePage] = await Promise.all([
      context.waitForEvent('page'),
      evidenceLink.click(),
    ]);
    await evidencePage.waitForLoadState('domcontentloaded');
    await evidencePage.setViewportSize({ width, height: 900 });
    expect(page.url()).toBe(sourceUrl);
    await expect(canvas).toHaveAttribute('data-knowledge-selected-node-id', testNodeId);

    const returnLink = evidencePage.locator('[data-evidence-back-link="source-context"]');
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveAttribute('href', `/knowledge?node=${encodeURIComponent(testNodeId)}`);
    await expect(evidencePage.locator('[data-learner-record-priority="evidence-timeline"] article')).toHaveCount(1);
    await evidencePage.screenshot({ path: join(evidenceDir, `evidence-with-node-${width}.png`), fullPage: true });

    await returnLink.click();
    await expect.poll(() => new URL(evidencePage.url()).searchParams.get('node')).toBe(testNodeId);
    await expect(primaryCanvas(evidencePage))
      .toHaveAttribute('data-knowledge-selected-node-id', testNodeId);
    await evidencePage.screenshot({ path: join(evidenceDir, `knowledge-reactivated-${width}.png`), fullPage: true });

    await evidencePage.goto('/profile/evidence', { waitUntil: 'domcontentloaded' });
    const defaultReturnLink = evidencePage.locator('[data-evidence-back-link="source-context"]');
    await expect(defaultReturnLink).toBeVisible();
    await expect(defaultReturnLink).toHaveAttribute('href', '/profile/growth');
    await expect(evidencePage.locator('[data-learner-record-priority="evidence-timeline"] article')).toHaveCount(1);
    await evidencePage.screenshot({ path: join(evidenceDir, `evidence-without-node-${width}.png`), fullPage: true });
  });
}
