import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  RESOURCE_NODE_WORKSPACE_FEATURE_FLAG,
  RESOURCE_NODE_WORKSPACE_REGIONS,
  buildResourceNodeDetailView,
  buildResourceNodeLaunchAction,
  buildResourceNodeWorkspaceState,
  getResourceNodeWorkspaceMigrationContracts,
} from '@/features/knowledge/resource-node-workspace-contracts';
import { resolveKnowledgeResourceLaunch } from '@/features/knowledge/resource-panel/resource-panel';
import { buildPlatformStatusViewModel } from '@/components/platform/platform-ui-contracts';
import type { ResourceNode } from '@/lib/resource-node-registry';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function resourceNode(overrides: Partial<ResourceNode> = {}): ResourceNode {
  return {
    id: 'simulation:cruise',
    title: '邮轮舒适度仿真',
    description: null,
    type: 'simulation',
    courseModule: null,
    sourceKind: 'simulation_resource',
    sourceRef: 'cruise',
    sourceRefs: [
      { kind: 'simulation_resource', ref: 'cruise' },
      { kind: 'knowledge_graph', ref: 'kn-bode' },
    ],
    renderTarget: null,
    launchTarget: '/simulations/cruise',
    planningMetadata: {
      prerequisites: ['knowledge-node:kn-bode'],
      estimatedTimeMinutes: 25,
      cognitiveLoad: 'high',
      knowledgeCoverage: ['kn-bode', 'kn-frequency-response'],
      abilityImpact: { engineeringDecision: 0.3 },
      cost: { effort: 'high', requiresTeacherReview: false },
      availability: 'available',
      teacherPolicy: 'allowed',
      privacyLevel: 'student-visible',
      terminalConstraints: [],
      evidenceInstrumentation: ['simulation-run'],
    },
    sourceOfRecord: {
      content: 'simulation',
      catalogMetadata: 'resource_registry',
      planningMetadata: 'ResourceNode',
    },
    eligibility: {
      pathEligible: true,
      reasons: [],
      auditIssues: [],
    },
    ...overrides,
  };
}

describe('resource node knowledge workspace UI contracts', () => {
  it('defines graph, list, detail, related resource, warning, and launch regions', () => {
    expect(RESOURCE_NODE_WORKSPACE_REGIONS).toEqual([
      'graph-stage',
      'resource-list',
      'detail-panel',
      'related-resources',
      'mapping-warnings',
      'launch-actions',
    ]);
  });

  it('keeps current graph exploration available when the ResourceNode panel flag is disabled', () => {
    const state = buildResourceNodeWorkspaceState({
      featureFlags: [],
      selectedNode: resourceNode(),
    });

    expect(state.mode).toBe('legacy-knowledge-graph');
    expect(state.activeFeatureFlag).toBe(RESOURCE_NODE_WORKSPACE_FEATURE_FLAG);
    expect(state.regions).toEqual(['graph-stage', 'detail-panel']);
    expect(state.status.categories.readiness).toBe('ready');
    expect(state.status.summary).toContain('现有知识图谱');
    expect(buildPlatformStatusViewModel(state.status, { role: 'student' }).tone).not.toBe('danger');
  });

  it('shows ResourceNode detail fields and launch action for student-visible mapped resources', () => {
    const node = resourceNode();
    const detail = buildResourceNodeDetailView(node, 'student');
    const launch = buildResourceNodeLaunchAction(node);

    expect(detail.fields.map((field) => field.id)).toEqual(
      expect.arrayContaining([
        'source-reference',
        'knowledge-coverage',
        'prerequisites',
        'availability',
        'privacy-level',
        'teacher-policy',
        'evidence-instrumentation',
        'path-eligibility',
      ]),
    );
    expect(detail.fields.some((field) => field.roleScope === 'audit-only')).toBe(false);
    expect(detail.status.categories.readiness).toBe('ready');
    expect(buildPlatformStatusViewModel(detail.status, { role: 'student' }).tone).not.toBe('danger');
    expect(launch).toMatchObject({
      kind: 'feature-owned-launcher',
      href: '/simulations/cruise',
      owner: 'simulation',
    });
  });

  it('represents partial coverage and role-scoped audit warnings without hiding student actions', () => {
    const node = resourceNode({
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target', 'missing-evidence-instrumentation'],
        auditIssues: [
          {
            code: 'missing-render-or-launch-target',
            message: '缺少可渲染或可启动入口。',
            severity: 'blocking',
          },
          {
            code: 'missing-evidence-instrumentation',
            message: '缺少学习证据采集。',
            severity: 'warning',
          },
        ],
      },
    });

    const student = buildResourceNodeDetailView(node, 'student');
    const audit = buildResourceNodeDetailView(node, 'audit');

    expect(student.status.categories.sourceCoverage).toBe('partial');
    expect(student.status.categories.readiness).toBe('blocked');
    expect(student.warnings).toEqual([
      expect.objectContaining({
        code: 'missing-render-or-launch-target',
        roleScope: 'student-visible',
      }),
    ]);
    expect(audit.fields.map((field) => field.id)).toContain('source-of-record');
    expect(audit.warnings.map((warning) => warning.code)).toEqual([
      'missing-render-or-launch-target',
      'missing-evidence-instrumentation',
    ]);
  });

  it('keeps warning-only audit coverage visible even when a node remains path eligible', () => {
    const node = resourceNode({
      eligibility: {
        pathEligible: true,
        reasons: ['missing-evidence-instrumentation'],
        auditIssues: [
          {
            code: 'missing-evidence-instrumentation',
            message: '缺少学习证据采集。',
            severity: 'warning',
          },
        ],
      },
    });

    const detail = buildResourceNodeDetailView(node, 'audit');
    const status = buildPlatformStatusViewModel(detail.status, { role: 'audit' });

    expect(detail.status.categories.sourceCoverage).toBe('partial');
    expect(detail.status.categories.readiness).toBe('degraded');
    expect(status.tone).toBe('warning');
    expect(detail.warnings).toEqual([
      expect.objectContaining({
        code: 'missing-evidence-instrumentation',
        roleScope: 'audit-only',
      }),
    ]);
  });

  it('keeps admin-scoped privacy and policy details out of teacher views', () => {
    const node = resourceNode({
      planningMetadata: {
        ...resourceNode().planningMetadata,
        privacyLevel: 'admin-scoped',
        teacherPolicy: 'teacher-only',
      },
      eligibility: {
        pathEligible: false,
        reasons: ['missing-privacy-policy'],
        auditIssues: [
          {
            code: 'missing-privacy-policy',
            message: '缺少隐私策略。',
            severity: 'blocking',
          },
        ],
      },
    });

    const teacher = buildResourceNodeDetailView(node, 'teacher');
    const admin = buildResourceNodeDetailView(node, 'admin');
    const student = buildResourceNodeDetailView(node, 'student');
    const studentPathEligibility = student.fields.find((field) => field.id === 'path-eligibility');

    expect(teacher.fields.map((field) => field.id)).not.toContain('privacy-level');
    expect(admin.fields.map((field) => field.id)).toContain('privacy-level');
    expect(teacher.warnings.map((warning) => warning.code)).toEqual(['missing-privacy-policy']);
    expect(teacher.warnings[0].roleScope).toBe('teacher-scoped');
    expect(student.warnings).toEqual([]);
    expect(studentPathEligibility?.value).not.toContain('missing-privacy-policy');
    expect(student.status.summary).not.toContain('missing-privacy-policy');
  });

  it('uses source references, registry ids, or feature-owned launchers without importing implementations', () => {
    const registryLaunch = buildResourceNodeLaunchAction(resourceNode({
      id: 'lesson-step:5-3-step-1',
      type: 'lesson_step',
      sourceKind: 'resource_registry',
      sourceRef: 'unit-5-3-step-1',
      sourceRefs: [{ kind: 'resource_registry', ref: 'unit-5-3-step-1' }],
      launchTarget: null,
      renderTarget: null,
    }));

    const contractSource = readRepoFile('src/features/knowledge/resource-node-workspace-contracts.ts');

    expect(registryLaunch).toMatchObject({
      kind: 'registry-resource',
      registryId: 'unit-5-3-step-1',
      owner: 'resource_registry',
    });
    expect(contractSource).not.toContain('@/features/interactive/');
    expect(contractSource).not.toContain('@/features/arena/');
    expect(contractSource).not.toContain('@/resources/');
    expect(contractSource).not.toContain("'use client'");
  });

  it('documents migration from existing graph and resource panels to platform primitives', () => {
    expect(getResourceNodeWorkspaceMigrationContracts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacySurface: 'KnowledgeGraphSystem',
          preserves: expect.stringContaining('filter'),
        }),
        expect.objectContaining({
          legacySurface: 'ResourcePanel',
          platformPrimitive: 'PlatformStatusPayload',
        }),
      ]),
    );
  });

  it('keeps the /knowledge workspace canvas-first and rejects 320px squeeze-down panels', () => {
    const source = readRepoFile('src/features/knowledge/knowledge-graph-system.tsx');

    expect(source).toContain('data-knowledge-workspace="canvas-first"');
    expect(source).toContain('data-knowledge-canvas-primary="true"');
    expect(source).toContain('data-knowledge-squeeze-down-rejected="permanent-panels-hidden-at-320"');
    expect(source).toContain('data-knowledge-mobile-drawer="chapter-directory"');
    expect(source).toContain('data-knowledge-mobile-drawer="relation-filters"');
    expect(source).toContain('data-knowledge-mobile-drawer="legend"');
    expect(source).toContain('lg:block');
    expect(source).not.toContain('w-[360px]');
  });

  it('connects selected knowledge nodes to launch, return, and evidence review actions', () => {
    const source = readRepoFile('src/features/knowledge/resource-panel/resource-panel.tsx');
    const graphSource = readRepoFile('src/features/knowledge/knowledge-graph-system.tsx');

    expect(source).toContain('data-resource-node-launch-contract="launch-return-evidence"');
    expect(source).toContain('data-resource-node-action="launch"');
    expect(source).toContain('data-resource-node-action="return-to-learning-path"');
    expect(source).toContain('data-resource-node-action="review-evidence"');
    expect(source).toContain('resolveKnowledgeResourceLaunch');
    expect(source).toContain('evidenceHref = launchAction.lessonId');
    expect(source).toContain('/profile/evidence');
    expect(graphSource).toContain('initialSelectedNodeId');
    expect(graphSource).toContain('new URLSearchParams(window.location.search).get(\'node\')');
  });

  it('derives ResourcePanel launch targets without turning knowledge card files into raw markdown routes', () => {
    const cardOnlyLaunch = resolveKnowledgeResourceLaunch({
      id: 'transfer-function',
      name: '传递函数',
      nodeType: 'THEORY',
      description: '知识卡片',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      resources: ['course-content/runtime/knowledge/cards/nodes/传递函数_1_5b0faf8b.md'],
      metadata: {},
    });

    const lessonLaunch = resolveKnowledgeResourceLaunch({
      id: 'lesson-node',
      name: '课程节点',
      nodeType: 'THEORY',
      description: '课程入口',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      resources: [],
      metadata: { lessonId: 'unit-4-1-design-task-expression' },
    });

    const directLaunch = resolveKnowledgeResourceLaunch({
      id: 'simulation-node',
      name: '仿真节点',
      nodeType: 'SCENARIO',
      description: '仿真入口',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      resources: [],
      metadata: { launchTarget: '/simulations/cruise' },
    });
    const metadataCardLaunch = resolveKnowledgeResourceLaunch({
      id: 'metadata-card-node',
      name: '元数据卡片节点',
      nodeType: 'THEORY',
      description: '元数据卡片',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      resources: [],
      metadata: { renderTarget: 'course-content/runtime/knowledge/cards/nodes/传递函数_1_5b0faf8b.md' },
    });

    expect(cardOnlyLaunch).toMatchObject({
      href: null,
      hasKnowledgeCard: true,
      lessonId: null,
    });
    expect(cardOnlyLaunch.reason).toContain('知识卡片');
    expect(lessonLaunch).toMatchObject({
      href: '/interactive-learning/courses/unit-4-1-design-task-expression',
      lessonId: 'unit-4-1-design-task-expression',
    });
    expect(directLaunch).toMatchObject({
      href: '/simulations/cruise',
      label: '启动关联资源',
    });
    expect(metadataCardLaunch).toMatchObject({
      href: null,
      hasKnowledgeCard: true,
    });
  });
});
