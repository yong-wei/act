import { describe, expect, it } from 'vitest';

import { attachPublishedResourcesToRegistry } from '@/lib/published-resource-planning';
import { buildResourceNodeRegistry, type ResourceNode } from '@/lib/resource-node-registry';
import type { PublishedResourceFeature, PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';

import {
  appearanceRank,
  isAppearanceAdmissible,
  knowledgeResourceAdmission,
  teachingOrderProximity,
} from '@/features/personalization/path-planning/application/mastery-thresholds';
import { assembleKnowledgePathPlan } from '@/features/personalization/path-planning/internal/knowledge-path-mount';
import { fillKnowledgeSkeleton, indexResourcesByKnowledge, rankBoundResources } from '@/features/personalization/path-planning/knowledge-path-assembly';

const HASH = 'e'.repeat(64);
const TARGET = 'ctc:v11g-5845390ded447e37f06ea222';

describe('knowledge resource admission', () => {
  it('keeps only first-appearance resources for a new learner', () => {
    expect(knowledgeResourceAdmission(undefined)).toBe('first-only');
    expect(knowledgeResourceAdmission({ posteriorMastery: 0.4, evidenceCount: 2 })).toBe('first-only');
    expect(isAppearanceAdmissible('first', 'first-only')).toBe(true);
    expect(isAppearanceAdmissible('reference', 'first-only')).toBe(true);
    expect(isAppearanceAdmissible('revisit', 'first-only')).toBe(false);
  });

  it('admits revisits after mastery evidence reaches 0.5', () => {
    expect(knowledgeResourceAdmission({
      posteriorMastery: 0.62,
      confidence: 0.4,
      evidenceCount: 3,
    })).toBe('first-and-revisit');
    expect(isAppearanceAdmissible('revisit', 'first-and-revisit')).toBe(true);
  });

  it('skips mastered knowledge', () => {
    expect(knowledgeResourceAdmission({
      posteriorMastery: 0.9,
      confidence: 0.7,
      evidenceCount: 8,
    })).toBe('skip');
    expect(isAppearanceAdmissible('first', 'skip')).toBe(false);
  });

  it('keeps missing teaching order sortable without NaN', () => {
    expect(Number.isFinite(teachingOrderProximity(null) - teachingOrderProximity(undefined))).toBe(true);
    expect(teachingOrderProximity(null) - teachingOrderProximity(undefined)).toBe(0);
    expect(teachingOrderProximity({ unitIndex: 1, stepIndex: 2 }))
      .toBeLessThan(teachingOrderProximity({ unitIndex: 2, stepIndex: null }));
  });
});

describe('first-appearance ranking', () => {
  it('ranks first ahead of revisit before portrait preference', () => {
    const nodes = nodesFor([
      feature('revisit-card', 'revisit', 4),
      feature('first-card', 'first', 1),
    ]);
    const ranked = rankBoundResources(nodes, {
      knowledgeIds: [TARGET],
      styleKinds: ['knowledge_card'],
      preferredTypes: ['knowledge_card'],
      timeBudgetMinutes: 30,
    });
    expect(ranked[0]?.publishedResource?.appearance).toBe('first');
    expect(appearanceRank('first')).toBeLessThan(appearanceRank('revisit'));
    expect(teachingOrderProximity(null)).toBeGreaterThan(teachingOrderProximity({ unitIndex: 9, stepIndex: 9 }));
  });

  it('fills only first resources when the learner has no mastery evidence', () => {
    const nodes = nodesFor([
      feature('first-card', 'first', 1),
      feature('revisit-card', 'revisit', 4),
    ]);
    const fill = fillKnowledgeSkeleton({
      knowledgeIds: [TARGET],
      byKnowledge: indexResourcesByKnowledge([TARGET], nodes, canonicalIds),
      styleKinds: ['knowledge_card'],
      preferredTypes: [],
      timeBudgetMinutes: 30,
      deadline: Date.now() + 80,
      admissionOf: () => 'first-only',
    });
    expect(fill.mounted).toHaveLength(1);
    expect(fill.mounted[0]?.node.publishedResource?.appearance).toBe('first');
  });
});

describe('knowledge path mastery skip', () => {
  it('omits mastered knowledge from the assembled skeleton', () => {
    const prior = 'ctc:prior-root-locus';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('card-prior', 'first', 1, [prior]),
      feature('card-target', 'first', 2, [TARGET]),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-mastered',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: {
        knowledgeMastery: {
          tags: {
            [prior]: { posteriorMastery: 0.9, confidence: 0.7, evidenceCount: 6 },
          },
        },
      },
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [{
        id: 'edge-1',
        sourceCanonicalId: prior,
        targetCanonicalId: TARGET,
        strength: 'REQUIRED',
      }],
      heuristicTimeoutMs: 80,
    });
    expect(plan.explanations.fallbackReasons).toContain('mastered-knowledge-skipped');
    expect(plan.mainPath.every((node) => !node.knowledgeCoverage.includes(prior))).toBe(true);
    expect(plan.mainPath.some((node) => node.knowledgeCoverage.includes(TARGET))).toBe(true);
  });
});

function feature(
  resourceKey: string,
  appearance: 'first' | 'revisit' | 'reference',
  unitIndex: number,
  canonicalIds = [TARGET],
): PublishedResourceFeature {
  return {
    identity: {
      resourceId: `act:card:${resourceKey}`,
      projectionId: `proj-${HASH}`,
      projectionHash: HASH,
      snapshotId: `snap-${HASH}`,
      snapshotHash: HASH,
      runtimeReleaseId: null,
    },
    version: resourceKey.replace(/[^a-f0-9]/g, 'a').padEnd(64, '0').slice(0, 64),
    type: 'card',
    title: resourceKey,
    summary: resourceKey,
    canonicalIds,
    bindingIds: [`bind-${resourceKey}`],
    bindingRoles: ['COVERS'],
    sourcePath: null,
    baselineDifficulty: null,
    estimatedMinutes: 8,
    estimateSource: 'policy-estimate',
    executable: true,
    recommendable: true,
    limitation: null,
    backend: { kind: 'route', href: `/learn/${resourceKey}` },
    appearance,
    teachingOrder: { unitId: `1-${unitIndex}`, unitIndex, stepIndex: 1 },
    anchorLabel: appearance,
  };
}

function indexFor(resources: PublishedResourceFeature[]): PublishedResourceFeatureIndex {
  return {
    contract: 'published-resource-features/v1',
    indexId: HASH,
    projectionId: `proj-${HASH}`,
    projectionHash: HASH,
    snapshotId: `snap-${HASH}`,
    snapshotHash: HASH,
    runtimeReleaseId: null,
    authorityReleaseId: 'authority-test',
    generatedAt: '2026-09-13T00:00:00.000Z',
    resources,
    prerequisiteEdges: [],
  };
}

function nodesFor(resources: PublishedResourceFeature[]): ResourceNode[] {
  return attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor(resources)).nodes;
}

function canonicalIds(node: ResourceNode): string[] {
  return node.publishedResource?.canonicalIds ?? node.planningMetadata.knowledgeCoverage;
}
