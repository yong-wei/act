import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';

async function addSession(
  context: BrowserContext,
  role: 'STUDENT' | 'TEACHER' | 'ADMIN',
) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: `candidate-graph-${role.toLowerCase()}`,
      email: `candidate-graph-${role.toLowerCase()}@example.com`,
      name: `候选图谱${role}`,
      role,
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

const canvas = {
  projectionVersion: 'act.canvas.v2',
  source: {
    authorityState: 'candidate',
    releaseSetId: 'actkg-authoritative-candidate-v1',
    releaseId: 'root-locus-engineering-v0.1',
    productionAuthoritative: false,
  },
  release: { label: '根轨迹局部发布版', version: 'v0.1', scope: 'root-locus' },
  coverage: {
    status: 'partial',
    objectCount: 3,
    relationCount: 2,
    goldRelationCount: 1,
    silverRelationCount: 1,
    sourceObjectCount: 2,
    evidenceSegmentCount: 2,
  },
  teachingSemantics: { status: 'unavailable', message: '教学关系尚未发布' },
  nodes: [
    {
      id: 'concept',
      canonicalType: 'DomainConcept',
      label: '根轨迹',
      description: '闭环极点随参数变化的轨迹。',
      governance: {
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
      },
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'formula',
      canonicalType: 'Formula',
      label: '特征方程',
      description: '根轨迹的代数表示。',
      governance: {
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
      },
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'model',
      canonicalType: 'SystemModel',
      label: '闭环系统模型',
      description: '用于分析闭环极点。',
      governance: {
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
      },
      semanticSupport: { supported: true, readOnly: true },
    },
  ],
  relations: [
    {
      id: 'gold',
      predicate: 'represented_by',
      sourceId: 'concept',
      targetId: 'formula',
      direction: null,
      direct: true,
      qualityTier: 'GOLD',
      governance: { reviewStatus: 'REVIEWED', publicationStatus: 'PUBLISHED' },
      semanticSupport: { supported: true, readOnly: true },
    },
    {
      id: 'silver',
      predicate: 'used_to_analyze',
      sourceId: 'formula',
      targetId: 'model',
      direction: null,
      direct: true,
      qualityTier: 'SILVER',
      governance: { reviewStatus: 'REVIEWED', publicationStatus: 'PUBLISHED' },
      semanticSupport: { supported: true, readOnly: true },
    },
  ],
};

async function mockCandidateApis(page: Page) {
  await page.route('**/api/knowledge/graph/v2', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(canvas) });
  });
  await page.route('**/api/knowledge/nodes/v2/*', async (route) => {
    const nodeId = decodeURIComponent(route.request().url().split('/').pop() ?? '');
    const node = canvas.nodes.find((candidate) => candidate.id === nodeId) ?? canvas.nodes[0];
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        projectionVersion: 'act.node-detail.v2',
        source: {
          ...canvas.source,
          controlledPath: 'course-content/authoring/knowledge/releases/release-set.lock.json',
        },
        role: 'ADMIN',
        node: {
          ...node,
          adjacency: [{
            relationId: 'gold',
            predicate: 'represented_by',
            qualityTier: 'GOLD',
            neighborId: 'formula',
            traversal: 'outgoing',
            readOnly: true,
          }],
          sources: [{ sourceEditionId: 'dorf-14e', sectionId: 'root-locus' }],
          aliases: ['根轨迹法'],
          teachingFields: { concept_kind: 'engineering' },
          governance: node.governance,
          coverage: { sourceMappingCount: 1, evidenceCount: 1 },
          governanceTier: 'CORE',
        },
        receipt: {
          id: 'receipt',
          sourceRun: 'run',
          sourceImplementationCommit: 'a'.repeat(40),
          captureRevision: 'b'.repeat(40),
          lockRawHash: 'c'.repeat(64),
        },
        diagnostics: [],
        activeConsumerRebinding: 'not-started',
      }),
    });
  });
}

test('ADMIN controlled verification covers navigation, filters, predicates, detail, and partial release messaging', async ({
  context,
  page,
}) => {
  await addSession(context, 'ADMIN');
  await mockCandidateApis(page);
  await page.goto('/knowledge');

  const candidate = page.locator('[data-candidate-authoritative-graph="true"]');
  await expect(candidate).toBeVisible();
  await expect(candidate).toHaveAttribute('data-candidate-controlled-verification', 'true');
  await expect(candidate).toContainText('根轨迹局部发布版');
  await expect(candidate).toContainText('真实覆盖：3 对象 · 2 关系');
  await expect(candidate).toContainText('教学关系尚未发布');
  await expect(candidate).toContainText('represented_by · 实线');
  await expect(candidate).toContainText('used_to_analyze · 点线');

  await page.getByRole('button', { name: '领域概念', exact: true }).click();
  await expect(page.locator('[data-candidate-context="center"]')).toHaveCount(1);
  await expect(page.locator('[data-candidate-context="one-hop"]')).toHaveCount(1);

  await page.getByRole('button', { name: '核心', exact: true }).click();
  await expect(candidate).toContainText('2 对象 · 1 关系');
  await expect(candidate).not.toContainText('used_to_analyze · 点线');

  await page.getByRole('button', { name: /根轨迹.*闭环极点/ }).click();
  const detail = page.locator('[data-candidate-node-detail="concept"]');
  await expect(detail).toContainText('dorf-14e · root-locus');
  await expect(detail).toContainText('教师治理信息');
  await expect(detail).toContainText('受控迁移诊断');

  await page.setViewportSize({ width: 390, height: 760 });
  await expect(detail).toBeVisible();
  await expect(page.getByRole('button', { name: '关闭候选节点详情' })).toBeVisible();

  await page.getByRole('button', { name: '旧版 Legacy' }).click();
  await expect(page.locator('[data-knowledge-graph-version="legacy"]')).toBeVisible();
  await page.getByRole('button', { name: '新版候选' }).click();
  await expect(page.locator('[data-candidate-node-detail]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '扩展（含核心）' })).toHaveAttribute('aria-pressed', 'true');
});

test('candidate citation URL restores only a canonical ID from the fixed projection', async ({
  context,
  page,
}) => {
  await addSession(context, 'ADMIN');
  await mockCandidateApis(page);
  const requestedPaths: string[] = [];
  page.on('request', (request) => {
    requestedPaths.push(new URL(request.url()).pathname);
  });

  await page.goto('/knowledge?canonicalId=formula');
  await expect(page.locator('[data-candidate-node-detail="formula"]')).toBeVisible();
  await expect(page.locator('[data-candidate-node-detail="formula"]'))
    .toContainText('dorf-14e · root-locus');
  const validDetailRequestCount = requestedPaths
    .filter((path) => path === '/api/knowledge/nodes/v2/formula')
    .length;
  expect(validDetailRequestCount).toBeGreaterThan(0);
  expect(requestedPaths.filter((path) => path === '/api/knowledge/graph')).toHaveLength(0);

  await page.goto('/knowledge?canonicalId=unknown%0Alegacy');
  await expect(page.locator('[data-candidate-authoritative-graph="true"]')).toBeVisible();
  await expect(page.locator('[data-candidate-node-detail]')).toHaveCount(0);
  expect(requestedPaths.filter((path) => path.startsWith('/api/knowledge/nodes/v2/')))
    .toHaveLength(validDetailRequestCount);
  expect(requestedPaths.filter((path) => path === '/api/knowledge/graph')).toHaveLength(0);
});

test('ordinary STUDENT remains on Legacy when acceptance env is absent', async ({
  context,
  page,
}) => {
  await addSession(context, 'STUDENT');
  let candidateRequestCount = 0;
  await page.route('**/api/knowledge/graph/v2', async (route) => {
    candidateRequestCount += 1;
    await route.abort();
  });
  await page.goto('/knowledge');

  await expect(page.locator('[data-knowledge-graph-version="legacy"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '新版候选' })).toHaveCount(0);
  expect(candidateRequestCount).toBe(0);
});
