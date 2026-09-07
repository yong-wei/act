import { afterEach, describe, expect, it } from 'vitest';

import { planLearningPath } from '@/features/personalization/path-planning/public-api';
import type { TeachingBindingRuntime, TeachingResourceRuntime } from '@/lib/teaching-projection/contracts';
import {
  applyCoreResourcePathReadinessDispositions,
  buildResourceNodeRegistry,
} from '@/lib/resource-node-registry';
import {
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
    expect(mapActResourceIdToNodeId('act:video:1-1:1-1-intro-video')).toEqual({
      nodeId: 'runtime-media:1-1:1-1-intro-video',
      kind: 'video',
    });
    expect(mapActResourceIdToNodeId('act:audio:1-1:1-1-audio')).toEqual({
      nodeId: 'runtime-media:1-1:1-1-audio',
      kind: 'audio',
    });
    expect(mapActResourceIdToNodeId('act:simulation:arena-task-task-second-order-lead-pid')).toEqual({
      nodeId: 'arena-task:task-second-order-lead-pid',
      kind: 'arena',
    });
    expect(mapActResourceIdToNodeId('act:exercise:bode-drill')).toEqual({
      nodeId: 'exercise:bode-drill',
      kind: 'exercise',
    });
    expect(mapActResourceIdToNodeId('act:textbook:dorf')).toEqual({ skip: 'textbook-container' });
    expect(mapActResourceIdToNodeId('act:textbook-chapter:dorf:ch1')).toEqual({ skip: 'textbook-container' });
    expect(mapActResourceIdToNodeId('act:simulation:lesson01-pid')).toEqual({ skip: 'classroom-simulation' });
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
});
