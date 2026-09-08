import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { planLearningPath } from '@/features/personalization/path-planning/public-api';
import type { TeachingBindingRuntime, TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';
import {
  applyCoreResourcePathReadinessDispositions,
  buildResourceNodeRegistry,
  type RuntimeResourceProjectionInput,
} from '@/lib/resource-node-registry';
import {
  coreResourcePathReadinessReviewRef,
} from '@/lib/resource-node-path-readiness-review-batch';
import {
  loadDenominatorBridge,
  mapTeachingProjectionBindingsToRegistryInput,
} from '@/lib/teaching-projection-path-binding-adapter';
import {
  mapActResourceIdToNodeId,
  resolveCanonicalGoalTargets,
  setCanonicalTargetBridge,
} from '@/lib/teaching-projection-path-node-ids';

afterEach(() => {
  setCanonicalTargetBridge(null);
});

function resource(resourceId: string, title = resourceId): TeachingResourceRuntime {
  return {
    resourceId,
    resourceType: 'card',
    projectionMode: 'OPTIONAL',
    scopeId: 'course',
    title,
    sourcePath: `/src/${resourceId}`,
    legacyCrosswalkRef: null,
    bindingCount: 1,
    bindingStatus: 'BOUND',
    projectionStatus: 'PROJECTED',
    bindingDigest: 'digest',
  };
}

function binding(resourceId: string, canonicalId: string): TeachingBindingRuntime {
  return {
    bindingId: `bind:${resourceId}`,
    resourceId,
    canonicalId,
    role: 'COVERS',
    scopeId: 'course',
    sourcePath: null,
    primary: true,
    rationale: null,
  };
}

function reviewedKnowledgeCardProjection(): RuntimeResourceProjectionInput {
  return {
    id: 'knowledge-card:Bode图_1_1',
    resourceNodeId: 'knowledge-card:Bode图_1_1',
    title: 'Bode图',
    resourceType: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: 'Bode图_1_1',
    sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/Bode图_1_1.md',
    sourceRecord: 'Bode图_1_1',
    sourceHash: 'sha256:bode-card',
    sourceVersionRef: 'runtime-knowledge-card.v1',
    projectionLevel: 'ResourceNode',
    routeTarget: '/knowledge?node=Bode图_1_1',
    graphNodeRefs: {
      knowledge: ['Bode图_1_1'],
      capability: ['controlModeling'],
      quality: [],
    },
    estimatedTimeMinutes: 6,
    evidenceInstrumentation: ['knowledge_card_open'],
    privacyScope: 'student-visible',
    teacherPolicy: 'allowed',
    evidenceContract: {
      eventSource: true,
      eventType: true,
      clientEventIdPolicy: true,
      attemptKey: true,
      sourceLogId: true,
      dedupeKey: true,
      timestamps: true,
      learningFactPolicy: false,
      learningFactMaterializationPolicy: 'path-execution-evidence-only',
      confidencePolicy: true,
      privacyScope: true,
      complete: true,
      missingFields: [],
    },
    reviewAudit: {
      status: 'human-confirmed',
      reviewerId: 'teacher-1',
      reviewerRole: 'teacher',
      reviewedAt: '2026-07-03T00:00:00.000Z',
      reviewBatchId: 'core-resource-path-readiness-2026-07-03',
      reviewedSourceHash: 'sha256:bode-card',
      reviewedVersionRef: 'runtime-knowledge-card.v1',
      generationToolOrModel: 'template',
      promptOrManifestHash: null,
      confidence: 0.9,
      staleInvalidationRule: 'stale when source hash or version changes',
    },
  };
}

describe('teaching projection path binding adapter', () => {
  it('maps projection identities onto existing ResourceNode ids', () => {
    expect(mapActResourceIdToNodeId('act:handout:3-2')).toEqual({
      nodeId: 'runtime-handout:3-2',
      kind: 'handout',
    });
    expect(mapActResourceIdToNodeId('act:card:比例控制_1_1')).toEqual({
      nodeId: 'knowledge-card:比例控制_1_1',
      kind: 'card',
    });
    expect(mapActResourceIdToNodeId('act:video:1-1')).toEqual({
      nodeId: 'runtime-media:1-1:1-1-intro-video',
      kind: 'video',
    });
    expect(mapActResourceIdToNodeId('act:audio:1-1')).toEqual({
      nodeId: 'runtime-media:1-1:1-1-audio',
      kind: 'audio',
    });
    expect(mapActResourceIdToNodeId('act:simulation:arena-task-second-order-lead-pid')).toEqual({
      nodeId: 'arena-task:task-second-order-lead-pid',
      kind: 'arena',
    });
    expect(mapActResourceIdToNodeId('act:simulation:arena-task-task-second-order-lead-pid')).toEqual({
      nodeId: 'arena-task:task-second-order-lead-pid',
      kind: 'arena',
    });
    expect(mapActResourceIdToNodeId('act:exercise:bode-drill')).toEqual({
      nodeId: 'exercise:bode-drill',
      kind: 'exercise',
    });
    expect(mapActResourceIdToNodeId('act:textbook-section:dorf-modern-control-systems.ch10-sec01')).toEqual({
      nodeId: 'textbook-section:dorf-modern-control-systems:ch10-sec01',
      kind: 'textbook-section',
    });
    expect(mapActResourceIdToNodeId('act:simulation:sim-scene-cruise')).toEqual({
      nodeId: 'registry:sim-scene-cruise',
      kind: 'simulation',
    });
    expect(mapActResourceIdToNodeId('act:textbook:dorf')).toEqual({ skip: 'textbook-container' });
    expect(mapActResourceIdToNodeId('act:textbook-chapter:dorf:ch1')).toEqual({ skip: 'textbook-container' });
    expect(mapActResourceIdToNodeId('act:simulation:lesson01-pid')).toEqual({ skip: 'classroom-simulation' });
    expect(mapActResourceIdToNodeId('act:video:1-1:1-1-intro-video')).toEqual({ skip: 'unmapped' });
  });

  it('counts skipped classroom simulations and textbook containers without emitting nodes', () => {
    const mapped = mapTeachingProjectionBindingsToRegistryInput({
      resources: [
        resource('act:handout:3-2', '第三讲讲义'),
        resource('act:simulation:lesson01-pid'),
        resource('act:textbook:dorf'),
        resource('act:textbook-section:bare-token'),
      ],
      bindings: [binding('act:handout:3-2', 'canonical-handout-3-2')],
    });

    expect(mapped.extraInput.runtimeLessons).toEqual([
      expect.objectContaining({
        lessonId: '3-2',
        knowledgeNodeIds: expect.arrayContaining(['canonical-handout-3-2', 'runtime-handout:3-2']),
      }),
    ]);
    expect(mapped.extraInput.simulations).toEqual([]);
    expect(mapped.extraInput.textbookSections).toEqual([]);
    expect(mapped.skipCounts).toEqual({
      'classroom-simulation': 1,
      'textbook-container': 1,
      unmapped: 1,
    });
  });

  it('does not let adapter patches grant path eligibility to unreviewed nodes', () => {
    const registry = applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
      knowledgeCards: [
        {
          id: 'unreviewed-card',
          title: '未评审卡',
          sourceRef: 'unreviewed-card',
          knowledgeNodeIds: ['kn-a'],
        },
      ],
      ...mapTeachingProjectionBindingsToRegistryInput({
        resources: [resource('act:card:unreviewed-card', '绑定补丁')],
        bindings: [binding('act:card:unreviewed-card', 'canonical-unreviewed')],
      }).extraInput,
    }));
    const node = registry.nodes.find((item) => item.id === 'knowledge-card:unreviewed-card');

    expect(node?.planningMetadata.knowledgeCoverage).toEqual(
      expect.arrayContaining(['canonical-unreviewed', 'knowledge-card:unreviewed-card']),
    );
    expect(node?.planningMetadata.pathDisposition?.kind).toBe('excluded-with-rationale');
    expect(node?.eligibility.pathEligible).toBe(false);
  });

  it('matches bridged canonical targets and cites the canonical id', () => {
    setCanonicalTargetBridge(new Map([
      ['act:card:kn-bode', 'knowledge-card:kn-bode'],
    ]));
    const registry = applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'kn-bode',
        title: '伯德图知识卡',
        sourceRef: 'kn-bode:card',
        knowledgeNodeIds: ['kn-bode'],
        launchTarget: '/knowledge',
        renderTarget: '/knowledge',
      }],
    }));
    const plan = planLearningPath({
      studentId: 'student-1',
      goal: {
        id: 'goal-canonical-bridge',
        title: 'canonical 桥匹配',
        knowledgeTargets: ['act:card:kn-bode'],
        competencyTargets: [],
      },
      registry,
      constraints: {
        timeBudgetMinutes: 40,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds: [],
      },
    });

    expect(plan.mainPath.map((node) => node.nodeId)).toContain('knowledge-card:kn-bode');
    expect(plan.explanations.selectedReasons).toEqual(
      expect.arrayContaining(['canonical-binding:act:card:kn-bode']),
    );
  });

  it('does not match canonical targets absent from the bridge', () => {
    expect(resolveCanonicalGoalTargets(['act:card:missing'])).toEqual([]);
    const registry = applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'kn-bode',
        title: '伯德图知识卡',
        sourceRef: 'kn-bode:card',
        knowledgeNodeIds: ['kn-bode'],
        launchTarget: '/knowledge',
        renderTarget: '/knowledge',
      }],
    }));
    const plan = planLearningPath({
      studentId: 'student-1',
      goal: {
        id: 'goal-unmapped-canonical',
        title: '无桥 canonical',
        knowledgeTargets: ['act:card:missing'],
        competencyTargets: [],
      },
      registry,
      constraints: {
        timeBudgetMinutes: 40,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds: [],
      },
    });

    expect(plan.explanations.fallbackReasons).toEqual(
      expect.arrayContaining(['unmapped-canonical-target:act:card:missing']),
    );
    expect(plan.mainPath).toEqual([]);
  });

  it('emits textbook-section patches and maps registered classroom simulations exactly', () => {
    expect(mapActResourceIdToNodeId('act:simulation:lesson13-physics-builder-simple')).toEqual({
      nodeId: 'registry:lesson13-physics-builder-simple',
      kind: 'simulation',
    });
    const mapped = mapTeachingProjectionBindingsToRegistryInput({
      resources: [
        resource('act:textbook-section:dorf-modern-control-systems.ch10-sec01', 'Dorf §10.1'),
        resource('act:simulation:sim-scene-cruise', '邮轮仿真'),
        resource('act:video:1-1', '导入片'),
      ],
      bindings: [binding('act:textbook-section:dorf-modern-control-systems.ch10-sec01', 'ctc:bode')],
    });

    expect(mapped.extraInput.textbookSections).toEqual([
      expect.objectContaining({
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch10-sec01',
        knowledgeNodeIds: expect.arrayContaining(['ctc:bode']),
      }),
    ]);
    expect(mapped.extraInput.registeredResources).toEqual([
      expect.objectContaining({ id: 'sim-scene-cruise' }),
    ]);
    expect(mapped.extraInput.runtimeLessons).toEqual([
      expect.objectContaining({
        lessonId: '1-1',
        mediaResources: [
          expect.objectContaining({
            id: '1-1-intro-video',
            kind: 'video',
          }),
        ],
      }),
    ]);
    expect(mapped.extraInput.runtimeLessons?.[0]?.mediaResources?.[0]?.url).not.toMatch(/^\/src\//);
    expect(mapped.extraInput.textbookSections?.[0]?.citationHref).not.toMatch(/^\/src\//);
  });

  it('loads the cutover denominator only when capture revision and baseline hash are present', () => {
    const bridge = loadDenominatorBridge(process.cwd());
    expect(bridge.ok).toBe(true);
    expect(bridge.map.size).toBeGreaterThan(0);
    expect(loadDenominatorBridge('/tmp/missing-cutover-bridge')).toEqual({
      ok: false,
      map: new Map(),
    });
  });

  it('rejects a denominator receipt that does not match the live teaching projection', () => {
    const receipt = JSON.parse(readFileSync(path.join(
      process.cwd(),
      'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5/candidate-receipt.json',
    ), 'utf8')) as { teachingProjectionHash: string; authorityCaptureHash: string };
    expect(loadDenominatorBridge(process.cwd(), {
      projectionHash: receipt.teachingProjectionHash,
      authoritySnapshotHash: receipt.authorityCaptureHash,
    }).ok).toBe(true);
    expect(loadDenominatorBridge(process.cwd(), {
      projectionHash: 'e'.repeat(64),
      authoritySnapshotHash: receipt.authorityCaptureHash,
    }).ok).toBe(false);
    expect(loadDenominatorBridge(process.cwd(), {
      projectionHash: receipt.teachingProjectionHash,
      authoritySnapshotHash: 'a'.repeat(64),
    }).ok).toBe(false);
  });

  it('keeps reviewed knowledge-card source identity when a projection patch overlaps', () => {
    const mapped = mapTeachingProjectionBindingsToRegistryInput({
      resources: [resource('act:card:Bode图_1_1', 'Bode图')],
      bindings: [binding('act:card:Bode图_1_1', 'ctc:bode')],
    });
    const registry = applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
      runtimeResourceProjections: [reviewedKnowledgeCardProjection()],
      knowledgeCards: mapped.extraInput.knowledgeCards,
    }));
    const node = registry.nodes.find((entry) => entry.id === 'knowledge-card:Bode图_1_1');
    expect(node).toMatchObject({
      sourceKind: 'knowledge_graph',
      sourceRef: 'Bode图_1_1',
      eligibility: { pathEligible: true },
      planningMetadata: {
        pathDisposition: { kind: 'path-plannable' },
      },
    });
    expect(node?.planningMetadata.knowledgeCoverage).toEqual(
      expect.arrayContaining(['Bode图_1_1', 'knowledge-card:Bode图_1_1', 'ctc:bode']),
    );
    expect(coreResourcePathReadinessReviewRef(node!)).toBe(
      'knowledge-card:Bode图_1_1|knowledge_graph:Bode图_1_1|runtime-knowledge-card.v1',
    );
  });

  it('keeps unreviewed exercise nodes excluded even when mix lists exercise', () => {
    const registry = applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
      exercises: [{
        id: 'unreviewed-drill',
        title: '未评审习题',
        sourceRef: 'act:exercise:unreviewed-drill',
        knowledgeNodeIds: ['kn-bode'],
        launchTarget: '/assessment/adaptive-practice',
        renderTarget: '/assessment/adaptive-practice',
      }],
    }));
    const node = registry.nodes.find((item) => item.id === 'exercise:unreviewed-drill');
    expect(node?.planningMetadata.pathDisposition?.kind).toBe('excluded-with-rationale');
    expect(node?.eligibility.pathEligible).toBe(false);

    const plan = planLearningPath({
      studentId: 'student-1',
      goal: {
        id: 'frequency-response-foundations',
        title: '频率响应基础',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      registry,
      constraints: {
        timeBudgetMinutes: 40,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds: [],
      },
    });
    expect(plan.mainPath.map((item) => item.nodeId)).not.toContain('exercise:unreviewed-drill');
  });

  it('lets reviewed exercise and video nodes enter a mix that lists those families', () => {
    const registry = applyCoreResourcePathReadinessDispositions(buildResourceNodeRegistry({
      knowledgeCards: [{
        id: 'kn-bode',
        title: '伯德图知识卡',
        sourceRef: 'kn-bode:card',
        knowledgeNodeIds: ['kn-bode'],
        launchTarget: '/knowledge',
        renderTarget: '/knowledge',
      }],
      exercises: [{
        id: 'bode-drill',
        title: '伯德图习题',
        sourceRef: 'act:exercise:bode-drill',
        knowledgeNodeIds: ['kn-bode'],
        launchTarget: '/assessment/adaptive-practice',
        renderTarget: '/assessment/adaptive-practice',
      }],
      runtimeLessons: [{
        lessonId: '1-1',
        title: '导入片',
        knowledgeNodeIds: ['kn-bode'],
        mediaResources: [{
          id: '1-1-intro-video',
          title: '导入片',
          kind: 'video',
          url: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
        }],
      }],
    }));

    expect(registry.nodes.find((item) => item.id === 'exercise:bode-drill')?.eligibility.pathEligible).toBe(true);
    expect(registry.nodes.find((item) => item.id === 'runtime-media:1-1:1-1-intro-video')?.eligibility.pathEligible).toBe(true);

    const plan = planLearningPath({
      studentId: 'student-1',
      goal: {
        id: 'frequency-response-foundations',
        title: '频率响应基础',
        knowledgeTargets: ['kn-bode'],
        competencyTargets: [],
      },
      registry,
      constraints: {
        timeBudgetMinutes: 40,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
        completedNodeIds: [],
      },
    });
    const pathIds = plan.mainPath.map((item) => item.nodeId);
    expect(pathIds).toEqual(expect.arrayContaining([
      'exercise:bode-drill',
      'runtime-media:1-1:1-1-intro-video',
    ]));
  });
});

