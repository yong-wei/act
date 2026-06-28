import { describe, expect, it } from 'vitest';

import { buildKaqArtifactVersionRefs } from '../../kaq-artifact-versioning';
import {
  buildResourceNodeRegistry,
} from '../../resource-node-registry';
import type { KaqKnowledgeGraphNode } from '../kaq-graph-schema';
import type { KaqObjective, PortraitV2DimensionDefinition } from '../kaq-objective-taxonomy';
import type { LearningEvidenceCorpusChunk } from '../learning-evidence-rag-corpus';
import {
  projectGovernedSummaryToSar,
  projectKaqGraphNodeToSar,
  projectLearningEvidenceChunkToSar,
  projectLearningGoalToSar,
  projectResourceNodeToSar,
  validateSarResult,
} from '../structured-associative-retrieval';
import {
  chunkMatchesGraphCoverageRefs,
  resourceMatchesGraphCoverageRefs,
} from '../resource-coverage-matching';

describe('SAR platform source projections', () => {
  it('projects K/A/Q graph nodes with objective and portrait boundary entities', () => {
    const node: KaqKnowledgeGraphNode = {
      id: 'knowledge:root-locus',
      domain: 'knowledge',
      title: 'Root locus',
      description: 'Describe root locus construction and interpretation.',
      objectiveIds: ['obj:root-locus'],
      moduleId: 'unit-3',
      portraitDimensions: ['systemAnalysisInterpretation'],
      status: 'active',
      kind: 'method',
      knowledgeRefs: ['root-locus'],
    };
    const objective: KaqObjective = {
      id: 'obj:root-locus',
      domain: 'knowledge',
      level: 'tertiary',
      parentId: null,
      title: 'Root locus objective',
      description: 'Interpret the root locus.',
      portraitDimensions: ['systemAnalysisInterpretation'],
      evidencePolicy: null,
      graphBinding: null,
      status: 'active',
    };
    const dimension: PortraitV2DimensionDefinition = {
      id: 'systemAnalysisInterpretation',
      label: 'System analysis',
      description: 'Interpret system behavior.',
    };

    const result = projectKaqGraphNodeToSar({
      node,
      objectives: [objective],
      portraitDimensions: [dimension],
      coverageRefs: ['root-locus', 'obj:root-locus'],
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0]).toMatchObject({
      eventType: 'graph-node',
      sourceRef: { owner: 'kaq-graph', authorityLevel: 'platform-verified' },
      privacyScope: 'student-visible',
    });
    expect(result.entities.map((entity) => entity.entityType)).toEqual(expect.arrayContaining([
      'graph-node',
      'kaq-objective',
      'portrait-dimension',
    ]));
  });

  it('projects learning goals as path summaries while preserving objective and graph refs', () => {
    const result = projectLearningGoalToSar({
      goal: {
        id: 'goal:root-locus',
        title: 'Master root locus',
        description: 'Plan a path through root locus analysis.',
        completionMeaning: 'Learner can interpret root locus movement.',
        intentType: 'analysis',
        recommendedPhase: 'practice',
        knowledgeObjectiveIds: ['obj:root-locus'],
        capabilityObjectiveIds: ['cap:interpret-locus'],
        qualityObjectiveIds: [],
        targetGraphNodeIds: ['knowledge:root-locus'],
        goalSliceId: 'slice:root-locus',
        resourceMix: {
          required: ['knowledge_card'],
          preferred: ['simulation'],
          optional: [],
        },
        evidencePolicy: {
          requiredEvidenceTypes: ['question'],
          minimumEvidenceCount: 1,
          confidenceFloor: 0.6,
          qualityEvidenceGoverned: true,
          limitations: [],
        },
        terminalValidationPolicy: {
          required: false,
          acceptedEvidenceTypes: ['question'],
          terminalNodeTypes: ['knowledge_card'],
          summary: 'No terminal validation required.',
        },
        pathPolicyFamily: 'foundation-remediation',
        status: 'path-ready',
        version: 'learning-goal.v1',
        limitations: [],
      },
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].eventType).toBe('path-summary');
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'knowledge:root-locus',
      label: 'knowledge:root-locus',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:graph-node:knowledge:root-locus',
      role: 'supports',
    }));
    expect(result.entities.map((entity) => entity.entityType)).toEqual(expect.arrayContaining([
      'learning-goal',
      'graph-node',
      'kaq-objective',
    ]));
  });

  it('projects resource nodes without making retrieval chunks path-plannable', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'root-locus-resource',
        label: 'Root locus walkthrough',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/profile/growth',
        knowledgeNodeIds: ['root-locus'],
        planningOverride: {
          evidenceInstrumentation: ['view:root-locus-video'],
        },
      }],
    });
    const node = registry.nodes[0];

    const result = projectResourceNodeToSar({
      node,
      coverageRefs: ['view:root-locus-video'],
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(resourceMatchesGraphCoverageRefs(node, ['root-locus'])).toBe(true);
    expect(result.events[0].eventType).toBe('resource-node');
    expect(result.events[0].metadata).toMatchObject({
      graphCoverageMatched: true,
      graphCoverageRefs: ['view:root-locus-video'],
    });
    expect(result.entities).not.toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'view:root-locus-video',
    }));
    expect(result.citationTargetRefs).toEqual(['citation-target:registry:root-locus-resource:primary']);
    expect(result.retrievalChunkRefs).toEqual(['retrieval-chunk:registry:root-locus-resource:primary']);
    expect(result.entities.filter((entity) => entity.entityType === 'path-node')).toEqual([]);
    expect(result.entities.map((entity) => entity.entityType)).toContain('planning-unit');
  });

  it('projects LearningEvidence chunks with redacted summaries and citation target refs', () => {
    const chunk = learningEvidenceChunk({
      privacyClass: 'teacher-visible',
      content: {
        text: 'rawAnswerBody: learner private calculation detail',
        redactedSummary: 'Learner needs support interpreting root-locus breakaway behavior.',
        hash: 'sha256:private-root-locus',
      },
    });

    const result = projectLearningEvidenceChunkToSar({
      chunk,
      privacyScope: 'student-visible',
      coverageRefs: ['goal:root-locus'],
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0]).toMatchObject({
      eventType: 'corpus-chunk-summary',
      safeSummary: 'Learner needs support interpreting root-locus breakaway behavior.',
      privacyScope: 'teacher-scoped',
    });
    expect(result.entities.every((entity) => entity.privacyScope !== 'student-visible')).toBe(true);
    expect(result.events[0].metadata).toMatchObject({
      graphCoverageMatched: true,
      graphCoverageRefs: ['goal:root-locus'],
    });
    expect(result.entities).not.toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'goal:root-locus',
    }));
    expect(JSON.stringify(result)).not.toContain('rawAnswerBody');
    expect(result.citationTargetRefs).toEqual(['citation-target:root-locus-video:primary']);
    expect(result.retrievalChunkRefs).toEqual(['chunk:learner-root-locus']);
    expect(chunkMatchesGraphCoverageRefs(chunk, ['root-locus'], [])).toBe(true);

    const missingTarget = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        resourceProjection: {
          ...chunk.resourceProjection!,
          citationTargetRef: null,
        },
      }),
    });
    expect(missingTarget.limitations).toContain('missing-citation-target:chunk:learner-root-locus');
  });

  it('projects governed learning-fact summaries through stable refs only', () => {
    const result = projectGovernedSummaryToSar({
      id: 'learning-fact:learner-1:root-locus',
      title: 'Root locus mastery fact',
      summary: 'Learner has partial mastery evidence for root locus interpretation.',
      sourceOwner: 'adaptive-learner-state',
      sourceRefId: 'learning-fact:learner-1:root-locus',
      privacyScope: 'teacher-scoped',
      entityRefs: [{
        entityType: 'learning-fact',
        canonicalRef: 'learning-fact:learner-1:root-locus',
        label: 'Root locus mastery fact',
      }, {
        entityType: 'student',
        canonicalRef: 'student:learner-1',
        label: 'Learner 1',
      }],
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].eventType).toBe('learning-fact-summary');
    expect(result.limitations).toContain('privacy-scope-withheld:teacher-scoped');
    expect(result.entities.map((entity) => entity.entityType)).toEqual(expect.arrayContaining([
      'learning-fact',
      'student',
    ]));
  });
});

function learningEvidenceChunk(overrides: Partial<LearningEvidenceCorpusChunk> = {}): LearningEvidenceCorpusChunk {
  return {
    id: 'chunk:learner-root-locus',
    family: 'diagnosis',
    sourceType: 'diagnosis',
    sourceRef: {
      id: 'diagnosis:learner-root-locus',
      ownerUserId: 'learner-1',
      classId: 'class-1',
      goalId: 'goal:root-locus',
      resourceId: 'root-locus-video',
    },
    spanRef: {
      kind: 'summary',
      locator: 'diagnosis.summary',
    },
    display: {
      title: 'Root locus diagnosis',
      href: null,
      capsule: 'Learner shows partial root locus understanding.',
    },
    content: {
      text: null,
      redactedSummary: 'Learner shows partial root locus understanding.',
      hash: 'sha256:root-locus',
    },
    resourceProjection: {
      resourceId: 'resource:root-locus-video',
      segmentRef: 'resource-segment:root-locus-video:primary',
      citationTargetRef: 'citation-target:root-locus-video:primary',
      knowledgeNodeRefs: ['root-locus'],
      capabilityTargetRefs: ['cap:interpret-locus'],
      citationReadiness: {
        status: 'resolvable',
        verified: false,
        limitations: [],
      },
      authorityLevel: 'learner-evidence',
      privacyScope: 'teacher-visible',
      versionRefs: buildKaqArtifactVersionRefs(),
      pathEligibility: {
        eligible: false,
        reason: 'diagnosis-summary-not-path-node',
      },
    },
    privacyClass: 'student-visible',
    confidence: 'medium',
    freshness: {
      indexedAt: '2026-06-28T00:00:00.000Z',
      sourceUpdatedAt: null,
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'learner-evidence',
      knowledgeTags: ['root-locus'],
      pageAnchor: null,
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'teacher-visible',
        allowedRoles: ['teacher', 'admin', 'service'],
        classRequired: true,
      },
    },
    retrieval: {
      tags: ['root-locus'],
      goals: ['goal:root-locus'],
      useCases: ['diagnosis', 'teacher-report'],
    },
    ...overrides,
  };
}
