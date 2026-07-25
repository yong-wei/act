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
import { resolveInitialKnowledgeNodeId } from '@/features/knowledge/graph/node-activation';
import { resolveRelationFamilyControlPlacement } from '@/features/knowledge/graph/relation-family-control';
import { buildPlatformStatusViewModel } from '@/components/platform/platform-ui-contracts';
import {
  getPathNodeSemanticsForResourceType,
  type ResourceNode,
} from '@/lib/resource-node-registry';

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
    pathSemantics: getPathNodeSemanticsForResourceType('simulation'),
    externalResource: null,
    checkpoint: null,
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
      readiness: null,
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

  it('blocks ResourceNode workspace planning status for audit-only capability gaps', () => {
    const node = resourceNode({
      planningMetadata: {
        ...resourceNode().planningMetadata,
        abilityImpact: {},
      },
      eligibility: {
        pathEligible: true,
        reasons: [],
        auditIssues: [],
      },
    });

    const detail = buildResourceNodeDetailView(node, 'student');
    const pathEligibility = detail.fields.find((field) => field.id === 'path-eligibility');

    expect(pathEligibility?.value).toContain('暂不可纳入路径');
    expect(detail.status.summary).toContain('暂不可进入学习路径规划');
    expect(detail.status.categories.readiness).toBe('blocked');
    expect(detail.status.categories.sourceCoverage).toBe('partial');
    expect(detail.warnings).toEqual([
      expect.objectContaining({
        code: 'missing-capability-mapping',
        roleScope: 'student-visible',
        severity: 'blocking',
      }),
    ]);
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

  it('fails closed when the public launch projection receives an unsafe opaque target', () => {
    const launch = buildResourceNodeLaunchAction(resourceNode({
      launchTarget: 'javascript:alert(document.domain)',
      renderTarget: '/safe-fallback-must-not-replace-owned-target',
    }));

    expect(launch).toMatchObject({
      kind: 'feature-owned-launcher',
      href: null,
      disabledReason: '资源启动地址未通过安全校验，当前不可启动。',
      owner: 'simulation',
    });
  });

  it.each([
    ['', 'blank'],
    ['\n', 'newline'],
    [42, 'numeric'],
    [{ href: '/safe-fallback-must-not-replace-owned-target' }, 'object'],
  ])('does not fall back when authoritative launchTarget is %s (%s)', (launchTarget, _description) => {
    const launch = buildResourceNodeLaunchAction(resourceNode({
      launchTarget: launchTarget as ResourceNode['launchTarget'],
      renderTarget: '/safe-fallback-must-not-replace-owned-target',
    }));

    expect(launch).toMatchObject({
      href: null,
      disabledReason: '资源启动地址未通过安全校验，当前不可启动。',
    });
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
    expect(source).toContain('data-knowledge-mobile-drawer="node-filters"');
    expect(resolveRelationFamilyControlPlacement({
      isMobile: true,
      inspectorVisible: false,
      toolPanelVisible: false,
    })).toBe('canvas');
    expect(resolveRelationFamilyControlPlacement({
      isMobile: true,
      inspectorVisible: true,
      toolPanelVisible: true,
    })).toBe('inspector');
    expect(resolveRelationFamilyControlPlacement({
      isMobile: true,
      inspectorVisible: false,
      toolPanelVisible: true,
    })).toBe('tool-panel');
    expect(resolveRelationFamilyControlPlacement({
      isMobile: false,
      inspectorVisible: true,
      toolPanelVisible: true,
    })).toBe('canvas');
    expect(source).not.toContain('data-knowledge-mobile-drawer="relation-filters"');
    expect(source).not.toContain('data-knowledge-mobile-drawer="legend"');
    expect(source).not.toContain('data-knowledge-density-mode=');
    expect(source).not.toContain('密度模式');
    expect(source).not.toContain('关系类型');
    expect(source).not.toContain('关系强度阈值');
    expect(source).not.toContain('仅显示存在可见关系的节点');
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
    expect(source).toContain('target="_blank"');
    expect(source).toContain('node=');
    expect(graphSource).toContain('initialSelectedNodeId');
    expect(resolveInitialKnowledgeNodeId('?node=kn-bode', 'kn-initial')).toBe('kn-bode');
    expect(resolveInitialKnowledgeNodeId('?nodeId=kn-legacy', 'kn-initial')).toBe('kn-legacy');
    expect(resolveInitialKnowledgeNodeId('?node=kn-preferred&nodeId=kn-legacy', 'kn-initial')).toBe('kn-preferred');
    expect(resolveInitialKnowledgeNodeId('', 'kn-initial')).toBe('kn-initial');
    expect(resolveInitialKnowledgeNodeId('')).toBeNull();
  });

  it('preserves explicit source-owned targets and keeps inferred knowledge cards in the card entry', () => {
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
    const resourceObjectLessonLaunch = resolveKnowledgeResourceLaunch({
      id: 'infograph-node',
      name: '信息图节点',
      nodeType: 'THEORY',
      description: '信息图入口',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      resources: [{ type: 'infograph', lessonId: '3-9' }],
      metadata: {},
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
    const sourceOwnedInternalLaunch = resolveKnowledgeResourceLaunch({
      id: 'opaque-internal-node', name: '内部目标', nodeType: 'SCENARIO', description: '',
      positionX: 0, positionY: 0, positionZ: 0, resources: [],
      metadata: { launchTarget: 'adaptive-learning/path-node/opaque-7' },
    });
    const sourceOwnedHttpsLaunch = resolveKnowledgeResourceLaunch({
      id: 'opaque-https-node', name: '外部目标', nodeType: 'SCENARIO', description: '',
      positionX: 0, positionY: 0, positionZ: 0, resources: [],
      metadata: { launchTarget: 'https://example.edu/resource?id=7#step' },
    });
    const noTargetLaunch = resolveKnowledgeResourceLaunch({
      id: 'no-target-node', name: '无目标', nodeType: 'THEORY', description: '',
      positionX: 0, positionY: 0, positionZ: 0, resources: [], metadata: {},
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
    expect(resourceObjectLessonLaunch).toMatchObject({
      href: '/interactive-learning/courses/3-9',
      lessonId: '3-9',
    });
    expect(directLaunch).toMatchObject({
      href: '/simulations/cruise',
      label: '启动关联资源',
    });
    expect(sourceOwnedInternalLaunch.href).toBe('adaptive-learning/path-node/opaque-7');
    expect(sourceOwnedHttpsLaunch.href).toBe('https://example.edu/resource?id=7#step');
    expect(noTargetLaunch).toMatchObject({ href: null, hasKnowledgeCard: false, lessonId: null });
    expect(metadataCardLaunch).toMatchObject({
      href: 'course-content/runtime/knowledge/cards/nodes/传递函数_1_5b0faf8b.md',
      hasKnowledgeCard: true,
    });
    expect(resolveKnowledgeResourceLaunch(null)).toMatchObject({ href: null, lessonId: null });
  });
});
