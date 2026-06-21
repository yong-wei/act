import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  filterGraphCenterPayload,
  GraphCenterClient,
  selectGraphCenterPayloadNode,
} from '@/features/graph-center/graph-center-client';
import { buildGraphCenterPayload } from '../graph-center';
import {
  createLearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusChunk,
} from '../learning-evidence-rag-corpus';
import { buildResourceNodeRegistry } from '../../resource-node-registry';

describe('graph center client surface', () => {
  it('renders domain switching, filters, list fallback, and selected-node detail', () => {
    const payload = buildGraphCenterPayload({
      domain: 'capability',
      objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      portraitDimension: 'simulationValidationEvidence',
      selectedNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-surface="read-only"');
    expect(html).toContain('data-graph-center-domain="capability"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="graph-center-objective"');
    expect(html).toContain('id="graph-center-portrait"');
    expect(html).toContain('data-graph-center-list-fallback="true"');
    expect(html).toContain('data-graph-center-detail="true"');
    expect(html).toContain('用仿真证据验证方案');
    expect(html).toContain('资源绑定');
    expect(html).toContain('kn:autocontrol:simulation-validation');
    expect(html).toContain('资源覆盖');
    expect(html).toContain('RAG 索引');
    expect(html).toContain('已校验引用');
    expect(html).toContain('资源类型');
    expect(html).toContain('校验');
    expect(html).toContain('通过');
    expect(html).toContain('data-graph-center-knowledge-compatibility-link="true"');
    expect(html).toContain('href="/knowledge"');
  });

  it('renders overlay and seed-coverage limitations outside graph body nodes', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(html).toContain('data-graph-center-limitations="true"');
    expect(html).toContain('学习者掌握度 overlay 尚未接入');
    expect(html).toContain('Runtime content');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('覆盖缺口');
    expect(html).toContain('缺少 RAG 索引');
    expect(html).not.toContain('coveredResourceIds');
  });

  it('preserves server-provided verified resource coverage in the initial render', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      resourceRegistry: buildFullCoverageRegistry(),
      evidenceCorpus: [verifiedChunk()],
    });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(payload.selectedNode?.resourceCoverage.coverageState).toBe('sufficient');
    expect(html).toContain('覆盖充分');
    expect(html).toContain('RAG 索引 1');
    expect(html).toContain('可引用 1');
    expect(html).toContain('已校验引用 1');
    expect(html).not.toContain('缺少已校验引用');
  });

  it('preserves server-provided coverage when selecting another node from the same payload', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      evidenceCorpus: [
        verifiedChunk({
          id: 'chunk-feedback-loop-verified',
          knowledgeNodeRef: '反馈_1_1',
          href: '/interactive-learning/resources/lesson01-feedback-precheck-v1',
        }),
      ],
    });
    const selectedPayload = selectGraphCenterPayloadNode(payload, 'kn:autocontrol:feedback-loop');

    expect(payload.resourceCoverage['kn:autocontrol:feedback-loop'].ragIndexedCount).toBe(1);
    expect(selectedPayload.selectedNode?.node.id).toBe('kn:autocontrol:feedback-loop');
    expect(selectedPayload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(1);
    expect(selectedPayload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(1);
  });

  it('preserves an initial no-match selected node state', () => {
    const payload = buildGraphCenterPayload({
      domain: 'quality',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const selectedPayload = selectGraphCenterPayloadNode(payload, null, { preserveEmptySelection: true });
    const html = renderToStaticMarkup(createElement(GraphCenterClient, { initialPayload: payload }));

    expect(payload.selectedNode).toBeNull();
    expect(selectedPayload.selectedNode).toBeNull();
    expect(html).toContain('无匹配节点');
  });

  it('defaults to the first node when a reused payload receives an empty selection', () => {
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });
    const selectedPayload = selectGraphCenterPayloadNode(payload, null);

    expect(payload.selectedNode?.node.id).toBe('kn:autocontrol:controller-correction');
    expect(selectedPayload.selectedNode?.node.id).toBe(payload.graph.nodes[0].id);
  });

  it('filters a server root payload without dropping verified coverage', () => {
    const rootPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      resourceRegistry: buildFullCoverageRegistry(),
      evidenceCorpus: [verifiedChunk()],
    });
    const filteredPayload = filterGraphCenterPayload(rootPayload, {
      objectiveId: 'knowledge:autocontrol:controller-correction',
      portraitDimension: null,
      selectedNodeId: 'kn:autocontrol:controller-correction',
    });

    expect(filteredPayload.graph.nodes.map((node) => node.id)).toEqual(['kn:autocontrol:controller-correction']);
    expect(filteredPayload.selectedNode?.resourceCoverage.ragIndexedCount).toBe(1);
    expect(filteredPayload.selectedNode?.resourceCoverage.verifiedCitationCount).toBe(1);
  });

  it('keeps overall objective filtering aligned with service graph bindings', () => {
    const rootPayload = buildGraphCenterPayload({ domain: 'knowledge' });
    const filteredPayload = filterGraphCenterPayload(rootPayload, {
      objectiveId: 'knowledge:autocontrol',
      portraitDimension: null,
      selectedNodeId: null,
    });

    expect(filteredPayload.graph.nodes.length).toBe(rootPayload.domains.find((domain) => domain.id === 'knowledge')?.nodeCount);
    expect(filteredPayload.selectedNode?.node.id).toBe(rootPayload.graph.nodes[0].id);
  });
});

function verifiedChunk(input: {
  id?: string;
  knowledgeNodeRef?: string;
  href?: string;
} = {}): LearningEvidenceCorpusChunk {
  const id = input.id ?? 'chunk-controller-correction-verified';
  const knowledgeNodeRef = input.knowledgeNodeRef ?? 'PID控制器_6_656b8b52';
  const href = input.href ?? '/interactive-learning/resources/lesson15-series-knowledge-deck';
  return createLearningEvidenceCorpusChunk({
    id,
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id,
      ownerUserId: null,
      classId: null,
      goalId: 'graph-resource-coverage',
      resourceId: id,
    },
    spanRef: { kind: 'text-range', start: 0, end: 20, locator: 'section#pid' },
    display: {
      title: id,
      href: `/learning-evidence/${id}`,
      capsule: 'Resource coverage fixture.',
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: id,
      href,
      locator: 'section#pid',
      contentHash: 'hash-controller-correction',
    },
    content: {
      text: null,
      redactedSummary: 'Resource coverage fixture.',
      hash: 'hash-controller-correction',
    },
    resourceProjection: {
      resourceId: id,
      segmentRef: `${id}:segment`,
      citationTargetRef: `${id}:citation`,
      knowledgeNodeRefs: [knowledgeNodeRef],
      capabilityTargetRefs: [],
      contentHash: 'hash-controller-correction',
    },
    privacyClass: 'public',
    confidence: 'high',
    freshness: {
      indexedAt: '2026-06-21T00:00:00.000Z',
      sourceUpdatedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'canonical',
      knowledgeTags: [knowledgeNodeRef],
      pageAnchor: 'section#pid',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: {
      tags: [knowledgeNodeRef],
      goals: ['graph-resource-coverage'],
      useCases: ['konling', 'diagnosis', 'prep-pack'],
    },
  });
}

function buildFullCoverageRegistry() {
  return buildResourceNodeRegistry({
    registeredResources: [
      {
        id: 'full-coverage-assessment',
        label: 'Full coverage assessment',
        type: 'ADAPTIVE_QUIZ',
        renderTarget: '/resources/full-coverage-assessment',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        planningOverride: {
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['adaptive_assessment'],
        },
      },
    ],
    simulations: [
      {
        id: 'full-coverage-simulation',
        title: 'Full coverage simulation',
        launchTarget: '/simulations/full-coverage',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        planningOverride: {
          estimatedTimeMinutes: 12,
          evidenceInstrumentation: ['simulation_run'],
        },
      },
    ],
    arenaTasks: [
      {
        id: 'full-coverage-arena-preview',
        title: 'Full coverage Arena preview',
        launchTarget: '/arena/full-coverage-preview',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        official: false,
        planningOverride: {
          estimatedTimeMinutes: 12,
          evidenceInstrumentation: ['arena_simulation_run'],
        },
      },
      {
        id: 'full-coverage-arena-official',
        title: 'Full coverage Arena official',
        launchTarget: '/arena/full-coverage-official',
        knowledgeNodeIds: ['PID控制器_6_656b8b52'],
        official: true,
        planningOverride: {
          estimatedTimeMinutes: 12,
          terminalConstraints: ['terminal-validation'],
          evidenceInstrumentation: ['arena_evaluation_complete'],
        },
      },
    ],
  });
}
