import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EVIDENCE_DIR = join(process.cwd(), 'artifacts/commercial-ui/knowledge-graph-evidence-link/playwright');
const TEST_NODE_ID = 'knowledge-node:test-evidence-link-001';

const widths = [1280, 320] as const;

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
    sameSite: 'Lax' as const,
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

function buildKnowledgeGraphPayload() {
  return {
    mode: 'normal',
    graphVersion: 'knowledge-evidence-link-v1',
    shardKey: 'knowledge-evidence-link-v1:shard:normal',
    nodes: [{
      id: TEST_NODE_ID,
      name: '\u53CD\u9988\u63A7\u5236\u7CFB\u7EDF',
      nodeType: 'THEORY',
      description: '\u53CD\u9988\u63A7\u5236\u7CFB\u7EDF\u7684\u57FA\u672C\u6982\u5FF5\u4E0E\u7ED3\u6784',
      positionX: 0, positionY: 0, positionZ: 0,
      chapter: 1, chapterName: '\u7B2C\u4E00\u7AE0',
      metadata: { chapterName: '\u7B2C\u4E00\u7AE0' },
      expansion: { state: 'leaf' as const },
    }],
    links: [],
    membershipLinks: [],
  };
}

async function installKnowledgeRoutes(page: Page) {
  await page.route('**/api/knowledge/graph?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildKnowledgeGraphPayload()),
    });
  });
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'knowledge-evidence-student', name: 'Knowledge Evidence Student', email: 'test@example.com', role: 'STUDENT' },
        profile: null,
        statistics: { totalSimulations: 0, completedMissions: 0, ethicalViolations: 0, totalSimulationTime: 0, averageScore: 0 },
        competency: { overallScore: 0, level: '\u8BC1\u636E\u4E0D\u8DB3', trend: '\u6682\u65E0\u8D8B\u52BF', strengths: [], weaknesses: [], dimensions: [] },
        recentActivity: { preview: [], grouped: [], total: 0 },
        missionProgress: { total: 0, completed: 0, unlocked: 0, locked: 0 },
        personalizedReinforcement: { resources: [], adaptivePractice: {} },
        evidenceStatus: { state: 'missing', confidence: { state: 'missing', level: 'low', score: 0, evidenceCount: 0, sourceCompleteness: 0 }, evidenceWindow: { daysCovered: 0 }, sourceCounts: {}, statusMarkers: ['missing-source'], restrictedReason: null, staleReason: null, refreshedAt: null, generatedAt: new Date(0).toISOString() },
        arenaPortfolio: { controllerCount: 0, identificationModels: [], submissionSummary: { total: 0, valid: 0, invalid: 0, pending: 0 }, personalBestByTask: [], frequentFailureObjects: [], improvingMetrics: [], growth: { capabilityCoverage: { covered: 0, total: 0 }, evidenceAvailable: false, weakCapabilities: [], improvingCapabilities: [], strongCapabilities: [], nextChallenges: [] } },
      }),
    });
  });
}

test.describe.configure({ timeout: 120_000 });

for (const width of widths) {
  test(knowledge graph evidence link opens in new tab at px, async ({ context, page }) => {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    await addStudentSession(context);
    await installKnowledgeRoutes(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/knowledge', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-knowledge-canvas-primary]', { timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(EVIDENCE_DIR, graph-loaded-.png), fullPage: true });
    const nodeControl = page.locator(utton[data-knowledge-node-id=""]);
    await expect(nodeControl).toBeAttached({ timeout: 10_000 });
    await nodeControl.click();
    await page.waitForTimeout(500);
    const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
    await expect(inspector).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: join(EVIDENCE_DIR, inspector-open-.png), fullPage: true });
    const evidenceLink = page.locator('a[data-resource-node-action="review-evidence"]');
    await expect(evidenceLink).toBeVisible({ timeout: 5_000 });
    await expect(evidenceLink).toHaveAttribute('target', '_blank');
    await expect(evidenceLink).toHaveAttribute('rel', 'noopener noreferrer');
    const href = await evidenceLink.getAttribute('href');
    expect(href).toBe(/profile/evidence?node=);
  });
}

test('evidence page backHref reflects node parameter from source knowledge graph', async ({ context, page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await addStudentSession(context);
  await page.goto(/profile/evidence?node=, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(EVIDENCE_DIR, 'evidence-with-node.png'), fullPage: true });
  await expect(page.locator('nav[aria-label="Breadcrumb"]').first()).toBeVisible();
});

test('evidence page without node parameter loads with default backHref', async ({ context, page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await addStudentSession(context);
  await page.goto('/profile/evidence', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(EVIDENCE_DIR, 'evidence-without-node.png'), fullPage: true });
  await expect(page.locator('nav[aria-label="Breadcrumb"]').first()).toBeVisible();
});
