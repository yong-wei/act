import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teachingResource: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/textbook-reader', () => ({
  buildTextbookReaderHref: vi.fn(({ bookId, edition, unitPath }: { bookId: string; edition: string; unitPath: string[] }) =>
    `/textbooks/${bookId}/${edition}/${unitPath.join('/')}`),
  loadTextbookCitationUnits: vi.fn(),
}));

vi.mock('@/lib/resource-registry-metadata', () => ({
  getRegisteredResourceMetadataByNodeId: vi.fn(),
  getRegisteredResourceMetadata: vi.fn(() => undefined),
  getAllRegisteredResourceMetadata: vi.fn(() => []),
}));

// 隔离本地 consumer-activation 工件：composed 查询按 fixture 身份执行，
// 不读取仓库真实 authority/teaching-projection 激活指针。
vi.mock('@/lib/versioned-knowledge-activation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/versioned-knowledge-activation')>(
    '@/lib/versioned-knowledge-activation',
  );
  const absentSelection = {
    mode: 'absent',
    consumerId: 'test',
    combination: null,
    resolved: {} as never,
    reasons: [],
  } as never;
  return {
    ...actual,
    resolveEngineeringRagProductionSelection: vi.fn(() => absentSelection),
    resolveTeachingResourceRagProductionSelection: vi.fn(() => absentSelection),
  };
});

vi.mock('@/lib/teaching-projection/live-course-pointer', () => ({
  overlayLiveTeachingPins: (pins: unknown) => pins,
  readAgreedLiveCourseProjection: vi.fn(() => null),
  readAgreedLiveResourceBindingRelease: vi.fn(() => null),
}));

vi.mock('@/lib/math-calc', async () => {
  const actual = await vi.importActual<typeof import('@/lib/math-calc')>('@/lib/math-calc');
  return actual;
});

vi.mock('@/features/personalization/learner-state/public-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/personalization/learner-state/public-api')>(
    '@/features/personalization/learner-state/public-api',
  );
  return actual;
});

vi.mock('@/lib/learning-goal-assessment-coverage-runtime', async () => {
  const actual = await vi.importActual<typeof import('@/lib/learning-goal-assessment-coverage-runtime')>(
    '@/lib/learning-goal-assessment-coverage-runtime',
  );
  return actual;
});

vi.mock('@/lib/learning-goal-resource-baseline-runtime', async () => {
  const actual = await vi.importActual<typeof import('@/lib/learning-goal-resource-baseline-runtime')>(
    '@/lib/learning-goal-resource-baseline-runtime',
  );
  return actual;
});

vi.mock('@/lib/source-pack/textbook-v2-adapter', () => ({
  retrieveTextbookSourcePackV2Progressive: vi.fn(),
}));

vi.mock('@/lib/course-bundle', () => ({
  loadAllLessonRuntimeResourceCatalogEntries: vi.fn(),
  loadAllTextbookStructureRuntimeCatalogEntries: vi.fn(),
  loadAllTextbookStructureUnitProjections: vi.fn(),
}));

vi.mock('@/lib/teacher-resource-node-data', async () => {
  const actual = await vi.importActual<typeof import('@/lib/teacher-resource-node-data')>(
    '@/lib/teacher-resource-node-data',
  );
  return actual;
});

import { loadTextbookCitationUnits } from '@/lib/textbook-reader';
import { retrieveTextbookSourcePackV2Progressive } from '@/lib/source-pack/textbook-v2-adapter';
import { prisma } from '@/lib/prisma';
import {
  buildScopedKonlingAiTools,
  buildKonlingToolRuntime,
  projectKonlingTextbookModelToolResult,
  KONLING_TOOL_REGISTRY,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { resolveKonlingTeachingResourceCitations } from '@/lib/konling-teaching-resource-citations';
import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';
import { RAG_PRODUCTION_AUTHORITY_ENV } from '@/lib/canonical-rag/authority';

/** 真实治理台账中存在 approved 教材映射的 canonicalId（Dorf 例题 3.6）。 */
const DORF_MAPPED_CANONICAL_ID = 'ctc:909e732d40f972bf760fa8ff';

const loadUnits = vi.mocked(loadTextbookCitationUnits);
const retrieveProgressive = vi.mocked(retrieveTextbookSourcePackV2Progressive);
const prismaFindUnique = vi.mocked(prisma.teachingResource.findUnique);

const TEXTBOOK_RESOURCE_ID =
  'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-03/section-3.8/example-3.6';

function unit(bookId: string, edition: string, unitId: string, structuralPath: string[]) {
  return {
    id: unitId,
    bookId,
    edition,
    sourceRevision: 'rev-2026-08-01',
    title: '单元',
    kind: 'section',
    naturalNumber: null,
    structuralPath,
    markdown: '# 单元内容',
    fragments: [],
  };
}

function makeLayeredPayload(): LayeredGraphPayload {
  return {
    contract: 'act-layered-graph-payload/v1',
    engineering: {
      identity: {
        layer: 'engineering',
        status: 'ready',
        authorityReleaseId: 'ctr:release:test-1',
        authoritySnapshotId: 'snap-1',
        authoritySnapshotHash: 'hash-1',
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        reasons: [],
      },
      nodes: [
        { canonicalId: 'ctc:focus-1', ordinal: 0, canonicalType: 'DomainConcept', semanticName: '根轨迹', reviewStatus: null, publicationStatus: null, lifecycleStatus: null, payload: {} },
        { canonicalId: 'ctc:neighbor-1', ordinal: 1, canonicalType: 'DomainConcept', semanticName: '开环增益', reviewStatus: null, publicationStatus: null, lifecycleStatus: null, payload: {} },
        { canonicalId: DORF_MAPPED_CANONICAL_ID, ordinal: 2, canonicalType: 'DomainConcept', semanticName: '根轨迹', reviewStatus: null, publicationStatus: null, lifecycleStatus: null, payload: {} },
      ],
      relations: [
        { relationId: 'rel-1', ordinal: 0, qualityTier: 'GOLD', sourceId: 'ctc:focus-1', targetId: 'ctc:neighbor-1', relationType: 'is_a', reviewStatus: null, publicationStatus: null, direct: true, payload: {} },
        { relationId: 'rel-2', ordinal: 1, qualityTier: 'GOLD', sourceId: 'ctc:focus-1', targetId: 'ctc:neighbor-1', relationType: 'prerequisite', reviewStatus: null, publicationStatus: null, direct: true, payload: {} },
        { relationId: 'rel-5', ordinal: 2, qualityTier: 'GOLD', sourceId: 'ctc:focus-1', targetId: DORF_MAPPED_CANONICAL_ID, relationType: 'is_a', reviewStatus: null, publicationStatus: null, direct: true, payload: {} },
      ],
      predicates: ['is_a', 'prerequisite'],
    },
    teachingPrerequisites: {
      identity: { layer: 'teachingPrerequisites', status: 'absent', authorityReleaseId: null, authoritySnapshotId: null, authoritySnapshotHash: null, projectionId: null, projectionHash: null, scopeId: null, reasons: ['absent'] },
      edges: [],
    },
    teachingResources: {
      identity: {
        layer: 'teachingResources',
        status: 'ready',
        authorityReleaseId: 'ctr:release:test-1',
        authoritySnapshotId: null,
        authoritySnapshotHash: null,
        projectionId: 'proj-test-1',
        projectionHash: 'proj-hash-1',
        scopeId: 'course-1',
        reasons: [],
      },
      resources: [
        { resourceId: 'res-handout', resourceType: 'HANDOUT', title: '根轨迹课堂讲义', scopeId: 'course-1', canonicalIds: ['ctc:focus-1'], roles: ['EXPLAINS'], projectionMode: 'projected', sourcePath: null } as never,
        { resourceId: TEXTBOOK_RESOURCE_ID, resourceType: null, title: 'Dorf 例题 3.6', scopeId: 'course-1', canonicalIds: ['ctc:focus-1'], roles: ['REFERENCES'], projectionMode: 'projected', sourcePath: null } as never,
      ],
      bindings: [
        { bindingId: 'b-1', resourceId: 'res-handout', canonicalId: 'ctc:focus-1', role: 'EXPLAINS', scopeId: 'course-1', primary: false, resourceType: 'HANDOUT', resourceTitle: '根轨迹课堂讲义', projectionMode: 'projected', sourcePath: null },
        { bindingId: 'b-2', resourceId: TEXTBOOK_RESOURCE_ID, canonicalId: 'ctc:focus-1', role: 'REFERENCES', scopeId: 'course-1', primary: false, resourceType: null, resourceTitle: 'Dorf 例题 3.6', projectionMode: 'projected', sourcePath: null },
      ],
      coreNodes: [],
      cards: [],
      notProjectedCanonicalIds: [],
    },
    fallback: null,
    requestedScope: { scopeId: 'course-1' },
  };
}

function createScope(): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'student-1',
    targetUserId: 'student-1',
    role: 'student',
    courseId: 'course-1',
    classId: null,
    pageId: null,
    resourceId: null,
    pathNodeId: null,
  } as KonlingRuntimeScope;
}

function createRuntimeContext(payload: LayeredGraphPayload): KonlingRuntimeContext {
  return {
    pageContext: {
      courseId: 'course-1',
      courseTitle: '自动控制原理',
      pageType: 'practice',
      stepId: null,
      topic: '根轨迹',
      learningObjectives: [],
      knowledgeType: 'X',
    },
    userProfile: {
      id: 'student-1',
      name: '张三',
      learningStyle: 'INTERACTIVE',
      cognitiveLevel: 3,
      abilityVector: { computational: 0.5, crossDomain: 0.5, design: 0.5, analysis: 0.5, evaluation: 0.5 },
    },
    learnerState: null,
    planContext: {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    },
    memory: [],
    citationContext: {
      required: true,
      contentCitations: [],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 0, evidenceWhenAvailable: 0 },
        fallbackWhenMissing: 'low-confidence',
      },
    },
    permittedTools: ['search_textbook', 'search_engineering_graph'],
    missingContext: [],
    featureFlags: { learnerState: false, semanticMemory: false, strategyMemory: false },
    layeredGraphPayload: payload,
    teachingProjectionContext: {
      contract: 'act-konling-teaching-projection-context/v1',
      source: 'server-owned',
      status: 'ready',
      authorityReleaseId: 'ctr:release:test-1',
      authoritySnapshotId: 'snap-1',
      authoritySnapshotHash: 'hash-1',
      projectionId: 'proj-test-1',
      projectionHash: 'proj-hash-1',
      scope: { scopeId: 'course-1' },
      canonicalIds: ['ctc:focus-1', DORF_MAPPED_CANONICAL_ID],
      linkedResources: [
        { resourceId: 'res-handout', resourceType: 'HANDOUT', role: 'EXPLAINS', title: '根轨迹课堂讲义', primary: false, canonicalId: 'ctc:focus-1', scopeId: 'course-1', sourcePath: null, citationSafe: true },
        { resourceId: TEXTBOOK_RESOURCE_ID, resourceType: null, role: 'REFERENCES', title: 'Dorf 例题 3.6', primary: false, canonicalId: 'ctc:focus-1', scopeId: 'course-1', sourcePath: null, citationSafe: true },
      ],
      prerequisiteAncestors: [],
      prerequisiteSuccessors: [],
      activeCard: null,
      optionalCardStatus: 'not-applicable',
      evidenceCutoff: null,
      fallback: null,
      clientHintsAccepted: [],
      clientHintsRejected: [],
      reasons: [],
      engineeringOnlyAllowed: true,
    },
    teachingResourceCitations: [],
    teachingResourceCitationUnresolved: [],
  } as KonlingRuntimeContext;
}

async function resolveContextCitations(context: KonlingRuntimeContext) {
  const resolution = await resolveKonlingTeachingResourceCitations({
    viewerRole: 'student',
    projectionId: context.teachingProjectionContext?.projectionId ?? null,
    linkedResources: context.teachingProjectionContext?.linkedResources ?? [],
  });
  context.teachingResourceCitations = resolution.citations;
  context.teachingResourceCitationUnresolved = resolution.unresolved;
}

function mockNoopDb() {
  return { agentSession: {}, toolRun: {} } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KONLING_SERVER_MODE_CONTEXT_SECRET = 'unit-test-strong-secret-0f3a1b';
  // 缺省拨盘为 LEGACY（影子门禁前）；composed 用例显式切换。
  process.env[RAG_PRODUCTION_AUTHORITY_ENV] = 'canonical-composed';
  retrieveProgressive.mockResolvedValue({
    foreground: { candidates: [] },
    optimizationPending: false,
  } as never);
  prismaFindUnique.mockResolvedValue({
    teacherOnly: false,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    type: 'HANDOUT',
    content: null,
  } as never);
  loadUnits.mockImplementation(async ({ requests }: { requests: Array<{ bookId: string; unitIds: string[] }> }) =>
    requests.flatMap((request) => request.unitIds.map((unitId) => unit(
      'dorf-modern-control-systems',
      '14th Global Edition',
      unitId,
      ['chapter-chapter-03', 'section-3.8', 'example-3.6'],
    ))));
});

afterEach(() => {
  delete process.env.KONLING_SERVER_MODE_CONTEXT_SECRET;
  delete process.env[RAG_PRODUCTION_AUTHORITY_ENV];
});

describe('konling composed RAG 通道与工程图谱工具（#2047）', () => {
  it('composed 拨盘：绑定资源进引用编号表，search_textbook 返回教学资源引用并记录影子样本', async () => {
    const context = createRuntimeContext(makeLayeredPayload());
    await resolveContextCitations(context);
    const runtime = buildKonlingToolRuntime({
      db: mockNoopDb(),
      scope: createScope(),
      context,
      permittedTools: ['search_textbook', 'search_engineering_graph'],
    });

    // 上下文层引用（linkedResources）已分配编号。
    const assigned = runtime.getAssignedCitations();
    const handout = assigned.find((citation) => citation.id === 'teach-res:res-handout');
    expect(handout).toMatchObject({
      sourceType: 'teaching-resource',
      href: '/interactive-learning/resources/res-handout',
      verifiable: true,
    });

    const result = await runtime.searchTextbook({ query: '根轨迹' }) as {
      teachingResourceReferences?: Array<{ resourceId: string; displayNumber: number; href: string | null }>;
      composedRagShadowDiagnostic?: { productionChannel: string };
    };
    expect(result.teachingResourceReferences?.map((reference) => reference.resourceId))
      .toContain('res-handout');
    // composed 命中经共享解析器拿到安全 href，并与上下文层同编号。
    const reference = result.teachingResourceReferences?.find((item) => item.resourceId === 'res-handout');
    expect(reference?.displayNumber).toBe(handout?.displayNumber);
    expect(result.composedRagShadowDiagnostic?.productionChannel).toBe('canonical-composed');

    const samples = runtime.getComposedRagShadowSamples();
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ productionChannel: 'canonical-composed' });
    expect(samples[0]!.sharedTeachingResourceIds).toContain('res-handout');

    // 模型投影层必须保留教学资源引用（模型以 [n] 引用资源）。
    const projected = projectKonlingTextbookModelToolResult(result);
    expect(projected.teachingResourceReferences?.some((reference) => (
      reference.resourceId === 'res-handout'
      && reference.displayNumber === handout?.displayNumber
    ))).toBe(true);
  });

  it('legacy 回滚拨盘：composed 结果只做影子指标，不合并引用', async () => {
    process.env[RAG_PRODUCTION_AUTHORITY_ENV] = 'legacy';
    const context = createRuntimeContext(makeLayeredPayload());
    await resolveContextCitations(context);
    const runtime = buildKonlingToolRuntime({
      db: mockNoopDb(),
      scope: createScope(),
      context,
      permittedTools: ['search_textbook', 'search_engineering_graph'],
    });

    const result = await runtime.searchTextbook({ query: '根轨迹' }) as {
      teachingResourceReferences?: unknown;
      composedRagShadowDiagnostic?: { productionChannel: string };
    };
    expect(result.teachingResourceReferences).toBeUndefined();
    const samples = runtime.getComposedRagShadowSamples();
    expect(samples[0]).toMatchObject({ productionChannel: 'legacy' });
    // 上下文层 linkedResources 引用不受拨盘影响（引用面板能力独立于 RAG 权威）。
    expect(runtime.getAssignedCitations().some((citation) => citation.id === 'teach-res:res-handout')).toBe(true);
  });

  it('search_engineering_graph：焦点白名单 + 谓词白名单 + 教材出处引用', async () => {
    const runtime = buildKonlingToolRuntime({
      db: mockNoopDb(),
      scope: createScope(),
      context: createRuntimeContext(makeLayeredPayload()),
      permittedTools: ['search_engineering_graph'],
    });

    expect(KONLING_TOOL_REGISTRY.search_engineering_graph).toMatchObject({
      permissionTier: 'read',
      approvalPolicy: 'none',
    });

    const result = await runtime.searchEngineeringGraph({ query: '根轨迹' }) as {
      status: string;
      authorityReleaseId: string | null;
      entries: Array<{
        relationId: string | null;
        predicate: string | null;
        direction: 'outgoing' | 'incoming' | null;
        canonicalId: string;
        neighborCanonicalId: string | null;
        neighborLabel: string | null;
      }>;
      textbookCitations: Array<{ displayNumber: number; href: string | null }>;
    };
    expect(result.status).toBe('ready');
    expect(result.authorityReleaseId).toBe('ctr:release:test-1');
    // rel-2 的 prerequisite 谓词不在白名单内，被拒绝。
    expect(result.entries.map((entry) => entry.relationId)).toEqual(['rel-1', 'rel-5']);
    // 条目必须携带邻居端点与方向：模型才能区分「谁指向谁」（#2047 review P1）。
    expect(result.entries[0]).toMatchObject({
      canonicalId: 'ctc:focus-1',
      predicate: 'is_a',
      direction: 'outgoing',
      neighborCanonicalId: 'ctc:neighbor-1',
      neighborLabel: '开环增益',
    });
    // rel-5 命中的种子是 DORF 节点：焦点指向它 → 对该节点为 incoming，
    // 邻居端点为焦点本身（方向与端点随种子节点视角给出）。
    expect(result.entries[1]).toMatchObject({
      canonicalId: DORF_MAPPED_CANONICAL_ID,
      predicate: 'is_a',
      direction: 'incoming',
      neighborCanonicalId: 'ctc:focus-1',
    });
    expect(result.textbookCitations.length).toBeGreaterThan(0);
    expect(result.textbookCitations[0]!.href).toContain('/textbooks/dorf-modern-control-systems/');

    // 工程层不可用时显式降级。
    const degradedPayload = makeLayeredPayload();
    degradedPayload.engineering.identity.status = 'unavailable';
    const degraded = buildKonlingToolRuntime({
      db: mockNoopDb(),
      scope: createScope(),
      context: createRuntimeContext(degradedPayload),
      permittedTools: ['search_engineering_graph'],
    });
    await expect(degraded.searchEngineeringGraph({ query: 'x' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'engineering-layer-unavailable',
    });
  });

  it('search_engineering_graph 进入 AI 工具面且无状态变更入参', () => {
    const tools = buildScopedKonlingAiTools({
      permittedTools: ['search_engineering_graph'],
      // buildScopedKonlingAiTools 只需 runtime 形状中的 permittedTools 即可构造面。
    } as never);
    expect(tools).toHaveProperty('search_engineering_graph');
    expect(tools).not.toHaveProperty('search_knowledge_graph');
  });
});
