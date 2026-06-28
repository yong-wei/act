import { describe, expect, it } from 'vitest';

import { buildKaqArtifactVersionRefs } from '../../kaq-artifact-versioning';
import {
  buildResourceNodeRegistry,
  buildResourceSemanticProjection,
} from '../../resource-node-registry';
import type { LearningGoalDefinition } from '../../adaptive-learning-path-planner';
import type { ExpandedGoalSubgraph } from '../../graphs/goal-subgraph-expansion-service';
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
      goal: learningGoalDefinition(),
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

  it('projects expanded learning-goal subgraph bindings into path-boundary entities', () => {
    const goal = learningGoalDefinition();
    const expandedSubgraph = expandedGoalSubgraph(goal);
    const currentGraphVersion = buildKaqArtifactVersionRefs().graphCatalogVersion;

    const result = projectLearningGoalToSar({
      goal,
      expandedSubgraph,
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].metadata).toMatchObject({
      expandedSubgraph: {
        graphVersion: buildKaqArtifactVersionRefs().graphCatalogVersion,
        prerequisiteEdgeIds: ['edge:root-locus-foundation'],
        checkpointSuggestionIds: ['checkpoint:goal:root-locus:capability:interpret-locus'],
        terminalValidationCandidateIds: ['terminal:goal:root-locus:capability:interpret-locus'],
      },
    });
    expect(result.trace.versionRefs).toContain(currentGraphVersion);
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'knowledge:root-locus-foundation',
    }));
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'path-node',
      canonicalRef: 'checkpoint:goal:root-locus:capability:interpret-locus',
    }));
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'path-node',
      canonicalRef: 'terminal:goal:root-locus:capability:interpret-locus',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:graph-node:knowledge:root-locus-foundation',
      role: 'requires',
      source: 'expanded-goal-subgraph-prerequisite:hard_prerequisite',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:graph-node:knowledge:advanced-root-locus',
      role: 'candidate-for',
      source: 'expanded-goal-subgraph-extension-candidate',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:graph-node:knowledge:transfer-root-locus',
      role: 'candidate-for',
      source: 'expanded-goal-subgraph-transfer-candidate',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:path-node:checkpoint:goal:root-locus:capability:interpret-locus',
      role: 'candidate-for',
      source: 'expanded-goal-subgraph-checkpoint',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:path-node:terminal:goal:root-locus:capability:interpret-locus',
      role: 'candidate-for',
      source: 'expanded-goal-subgraph-terminal-validation',
    }));
    expect(result.limitations).toContain('goal-subgraph:weak-relation-evidence:Weak relation evidence retained as a limitation.');
  });

  it('preserves distinct SAR relation sources for the same event entity and role', () => {
    const goal = learningGoalDefinition();
    const result = projectLearningGoalToSar({
      goal,
      expandedSubgraph: expandedGoalSubgraph(goal, {
        remediationCandidates: ['knowledge:shared-boundary'],
        extensionCandidates: ['knowledge:shared-boundary'],
        transferCandidates: ['knowledge:shared-boundary'],
      }),
    });

    const sharedBoundaryRelations = result.relations.filter((item) => (
      item.entityId === 'sar:entity:graph-node:knowledge:shared-boundary'
      && item.role === 'candidate-for'
    ));
    expect(sharedBoundaryRelations.map((item) => item.source).sort()).toEqual([
      'expanded-goal-subgraph-extension-candidate',
      'expanded-goal-subgraph-remediation-candidate',
      'expanded-goal-subgraph-transfer-candidate',
    ]);
  });

  it('rejects stale expanded learning-goal subgraphs before projecting path-boundary entities', () => {
    const goal = learningGoalDefinition();
    const staleSubgraph = expandedGoalSubgraph(goal, {
      learningGoalVersion: 'learning-goal.v0',
      graphVersion: 'stale-graph.test',
    });

    const result = projectLearningGoalToSar({
      goal,
      expandedSubgraph: staleSubgraph,
      versionRefs: {
        graphCatalogVersion: 'caller-graph.test',
      },
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].metadata).toMatchObject({
      expandedSubgraph: null,
    });
    expect(result.entities).not.toContainEqual(expect.objectContaining({
      canonicalRef: 'knowledge:root-locus-foundation',
    }));
    expect(result.relations).not.toContainEqual(expect.objectContaining({
      source: expect.stringContaining('expanded-goal-subgraph'),
    }));
    expect(result.limitations).toContain('goal-subgraph-mismatch:learningGoalVersion:learning-goal.v0');
    expect(result.trace.versionRefs).toContain('learning-goal.v1');
    expect(result.trace.versionRefs).toContain('caller-graph.test');
    expect(result.trace.versionRefs).not.toContain('stale-graph.test');
  });

  it('rejects graph-version mismatched expanded learning-goal subgraphs', () => {
    const goal = learningGoalDefinition();
    const staleGraphSubgraph = expandedGoalSubgraph(goal, {
      graphVersion: 'stale-graph.test',
    });

    const result = projectLearningGoalToSar({
      goal,
      expandedSubgraph: staleGraphSubgraph,
      versionRefs: {
        graphCatalogVersion: 'kaq-graph.current',
      },
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].metadata).toMatchObject({
      expandedSubgraph: null,
    });
    expect(result.entities).not.toContainEqual(expect.objectContaining({
      canonicalRef: 'knowledge:root-locus-foundation',
    }));
    expect(result.limitations).toContain('goal-subgraph-mismatch:graphCatalogVersion:stale-graph.test');
    expect(result.trace.versionRefs).toContain('kaq-graph.current');
    expect(result.trace.versionRefs).not.toContain('stale-graph.test');
  });

  it('uses the current graph version when validating expanded learning-goal subgraphs without caller version refs', () => {
    const goal = learningGoalDefinition();
    const staleGraphSubgraph = expandedGoalSubgraph(goal, {
      graphVersion: 'stale-graph.test',
    });
    const currentGraphVersion = buildKaqArtifactVersionRefs().graphCatalogVersion;

    const result = projectLearningGoalToSar({
      goal,
      expandedSubgraph: staleGraphSubgraph,
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].metadata).toMatchObject({
      expandedSubgraph: null,
    });
    expect(result.entities).not.toContainEqual(expect.objectContaining({
      canonicalRef: 'knowledge:root-locus-foundation',
    }));
    expect(result.limitations).toContain('goal-subgraph-mismatch:graphCatalogVersion:stale-graph.test');
    expect(result.trace.versionRefs).toContain(currentGraphVersion);
    expect(result.trace.versionRefs).not.toContain('stale-graph.test');
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

  it('matches resource graph coverage against the supplied semantic projection', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'runtime-media-resource',
        label: 'Runtime media',
        type: 'video',
        renderTarget: '/course-runtime/media/runtime-media-resource',
        knowledgeNodeIds: ['node-only-knowledge'],
      }],
    });
    const node = registry.nodes[0];
    const baseProjection = buildResourceSemanticProjection(node);
    const projection = {
      ...baseProjection,
      resource: {
        ...baseProjection.resource,
        knowledgeNodeIds: ['projection-only-knowledge'],
        graphProfile: {
          ...baseProjection.resource.graphProfile,
          graphNodeRefs: {
            ...baseProjection.resource.graphProfile.graphNodeRefs,
            knowledge: ['knowledge:projection-only-knowledge'],
          },
        },
      },
    };

    const result = projectResourceNodeToSar({
      node,
      projection,
      coverageRefs: ['projection-only-knowledge'],
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(resourceMatchesGraphCoverageRefs(node, ['projection-only-knowledge'])).toBe(false);
    expect(result.events[0].metadata).toMatchObject({
      graphCoverageMatched: true,
      graphCoverageRefs: ['projection-only-knowledge'],
    });
    expect(result.entities).not.toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'projection-only-knowledge',
    }));
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'knowledge:projection-only-knowledge',
    }));

    const unrelated = projectResourceNodeToSar({
      node,
      projection,
      coverageRefs: ['unrelated-ref'],
    });
    expect(unrelated.events[0].metadata).toMatchObject({
      graphCoverageMatched: false,
      graphCoverageRefs: ['unrelated-ref'],
    });
  });

  it('projects segment and retrieval chunk graph refs as resource graph entities', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'runtime-media-resource',
        label: 'Runtime media',
        type: 'video',
        renderTarget: '/course-runtime/media/runtime-media-resource',
        knowledgeNodeIds: ['node-only-knowledge'],
      }],
    });
    const node = registry.nodes[0];
    const baseProjection = buildResourceSemanticProjection(node);
    const projection = {
      ...baseProjection,
      segments: baseProjection.segments.map((segment) => ({
        ...segment,
        graphNodeRefs: {
          ...segment.graphNodeRefs,
          quality: ['quality:segment-quality-ref'],
        },
      })),
      retrievalChunks: baseProjection.retrievalChunks.map((chunk) => ({
        ...chunk,
        graphNodeRefs: {
          ...chunk.graphNodeRefs,
          capability: ['capability:chunk-capability-ref'],
        },
      })),
    };

    const result = projectResourceNodeToSar({
      node,
      projection,
      coverageRefs: ['quality:segment-quality-ref', 'capability:chunk-capability-ref'],
    });

    expect(validateSarResult(result).issues).toEqual([]);
    expect(result.events[0].metadata).toMatchObject({
      graphCoverageMatched: true,
      graphCoverageRefs: ['capability:chunk-capability-ref', 'quality:segment-quality-ref'],
    });
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'quality:segment-quality-ref',
    }));
    expect(result.entities).toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'capability:chunk-capability-ref',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:graph-node:quality:segment-quality-ref',
      role: 'supports',
    }));
    expect(result.relations).toContainEqual(expect.objectContaining({
      entityId: 'sar:entity:graph-node:capability:chunk-capability-ref',
      role: 'supports',
    }));
  });

  it('matches non-path resource coverage through projection evidence instrumentation', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'reference-only-resource',
        label: 'Reference only resource',
        type: 'video',
        knowledgeNodeIds: ['node-only-knowledge'],
        planningOverride: {
          evidenceInstrumentation: ['view:reference-only-resource'],
        },
      }],
    });
    const node = registry.nodes[0];
    const projection = buildResourceSemanticProjection(node);

    const result = projectResourceNodeToSar({
      node,
      projection,
      coverageRefs: ['view:reference-only-resource'],
    });

    expect(projection.planningUnit).toBeNull();
    expect(resourceMatchesGraphCoverageRefs(node, ['view:reference-only-resource'])).toBe(true);
    expect(result.events[0].metadata).toMatchObject({
      graphCoverageMatched: true,
      graphCoverageRefs: ['view:reference-only-resource'],
    });
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

    const privateEvidenceWithoutRedactedSummary = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        privacyClass: 'teacher-visible',
        display: {
          ...chunk.display,
          capsule: 'Private teacher diagnosis capsule should not be exposed.',
        },
        content: {
          ...chunk.content,
          redactedSummary: null,
        },
      }),
    });
    expect(privateEvidenceWithoutRedactedSummary.events[0].safeSummary).toBe('Root locus diagnosis');
    expect(privateEvidenceWithoutRedactedSummary.limitations).toContain('missing-redacted-summary:chunk:learner-root-locus');
    expect(JSON.stringify(privateEvidenceWithoutRedactedSummary)).not.toContain('Private teacher diagnosis capsule');

    const privateEvidenceWithBlankRedactedSummary = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        privacyClass: 'admin-only',
        content: {
          ...chunk.content,
          redactedSummary: '   ',
        },
      }),
    });
    expect(privateEvidenceWithBlankRedactedSummary.events[0].safeSummary).toBe('Root locus diagnosis');
    expect(privateEvidenceWithBlankRedactedSummary.limitations).toContain('missing-redacted-summary:chunk:learner-root-locus');

    const studentVisibleWithoutRedactedSummary = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        privacyClass: 'student-visible',
        display: {
          ...chunk.display,
          capsule: 'Student-visible capsule can remain visible.',
        },
        content: {
          ...chunk.content,
          redactedSummary: null,
        },
      }),
    });
    expect(studentVisibleWithoutRedactedSummary.events[0].safeSummary).toBe('Student-visible capsule can remain visible.');
    expect(studentVisibleWithoutRedactedSummary.limitations).not.toContain('missing-redacted-summary:chunk:learner-root-locus');

    const semanticResourceIdEvidence = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        sourceRef: {
          ...chunk.sourceRef,
          resourceId: chunk.resourceProjection!.resourceId,
        },
      }),
    });
    expect(semanticResourceIdEvidence.events[0].metadata).toMatchObject({
      resourceId: 'resource:root-locus-video',
    });
    expect(semanticResourceIdEvidence.entities).toContainEqual(expect.objectContaining({
      entityType: 'resource-node',
      id: 'sar:entity:resource-node:root-locus-video',
      canonicalRef: 'root-locus-video',
      aliases: ['resource:root-locus-video', 'root-locus-video'],
    }));
    expect(semanticResourceIdEvidence.entities).not.toContainEqual(expect.objectContaining({
      entityType: 'resource-node',
      canonicalRef: 'resource:root-locus-video',
    }));

    const projectionOnlySemanticResourceIdEvidence = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        sourceRef: {
          ...chunk.sourceRef,
          resourceId: null,
        },
      }),
    });
    expect(projectionOnlySemanticResourceIdEvidence.entities).toContainEqual(expect.objectContaining({
      entityType: 'resource-node',
      canonicalRef: 'root-locus-video',
      aliases: ['resource:root-locus-video', 'root-locus-video'],
    }));

    const externalResourceIdEvidence = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        sourceRef: {
          ...chunk.sourceRef,
          resourceId: 'external-resource:root-locus-video',
        },
        resourceProjection: undefined,
      }),
    });
    expect(externalResourceIdEvidence.entities).toContainEqual(expect.objectContaining({
      entityType: 'resource-node',
      canonicalRef: 'external-resource:root-locus-video',
      aliases: ['external-resource:root-locus-video'],
    }));

    const missingTarget = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        resourceProjection: {
          ...chunk.resourceProjection!,
          graphNodeRefs: {
            knowledge: [],
            capability: [],
            quality: ['quality:root-locus-interpretation'],
          },
          citationTargetRef: null,
        },
      }),
    });
    expect(missingTarget.limitations).toContain('missing-citation-target:chunk:learner-root-locus');

    const qualityGraphResult = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        resourceProjection: {
          ...chunk.resourceProjection!,
          knowledgeNodeRefs: [],
          capabilityTargetRefs: [],
          graphNodeRefs: {
            knowledge: [],
            capability: [],
            quality: ['quality:root-locus-interpretation'],
          },
        },
      }),
      coverageRefs: ['quality:root-locus-interpretation'],
    });
    expect(qualityGraphResult.entities).toContainEqual(expect.objectContaining({
      entityType: 'graph-node',
      canonicalRef: 'quality:root-locus-interpretation',
    }));
    expect(qualityGraphResult.events[0].metadata).toMatchObject({
      graphCoverageMatched: true,
    });

    const unversionedProjection = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        resourceProjection: {
          ...chunk.resourceProjection!,
          versionRefs: undefined,
        },
      }),
    });
    expect(unversionedProjection.limitations).toContain(
      'legacy-artifact-unversioned:resourceProjectionVersion:Resource projection citation is missing artifact version refs.',
    );
    expect(unversionedProjection.trace.versionRefs).toEqual(['sar-projection.v1']);

    const partiallyVersionedProjection = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        resourceProjection: {
          ...chunk.resourceProjection!,
          versionRefs: {
            resourceProjectionVersion: 'resource-projection.legacy',
          } as NonNullable<LearningEvidenceCorpusChunk['resourceProjection']>['versionRefs'],
        },
      }),
    });
    expect(partiallyVersionedProjection.limitations).toContain(
      'missing-version-ref:graphCatalogVersion:Required artifact version ref is missing: graphCatalogVersion.',
    );
    expect(partiallyVersionedProjection.trace.versionRefs).toEqual(['resource-projection.legacy']);
    expect(partiallyVersionedProjection.trace.versionRefs).not.toContain(
      buildKaqArtifactVersionRefs().graphCatalogVersion,
    );

    const nonResourceEvidence = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        sourceRef: {
          ...chunk.sourceRef,
          resourceId: null,
        },
        resourceProjection: undefined,
      }),
    });
    expect(validateSarResult(nonResourceEvidence).issues).toEqual([]);
    expect(nonResourceEvidence.events[0].sourceRef.id).toBe('diagnosis:learner-root-locus');
    expect(nonResourceEvidence.entities).not.toContainEqual(expect.objectContaining({
      entityType: 'resource-node',
      canonicalRef: 'diagnosis:learner-root-locus',
    }));
    expect(nonResourceEvidence.relations).not.toContainEqual(expect.objectContaining({
      source: 'learning-evidence-source-ref',
    }));
    expect(nonResourceEvidence.limitations).not.toContain('missing-citation-target:chunk:learner-root-locus');

    const studentVisibleEvidence = projectLearningEvidenceChunkToSar({
      chunk: learningEvidenceChunk({
        privacyClass: 'student-visible',
      }),
    });
    expect(studentVisibleEvidence.events[0].privacyScope).toBe('student-visible');
    expect(studentVisibleEvidence.limitations).not.toContain('privacy-scope-withheld:student-visible');

    for (const privacyClass of ['teacher-visible', 'admin-only', 'service-only'] as const) {
      const restrictedEvidence = projectLearningEvidenceChunkToSar({
        chunk: learningEvidenceChunk({
          privacyClass,
        }),
      });
      expect(restrictedEvidence.limitations).toContain(`privacy-scope-withheld:${privacyClass}`);
    }
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

function learningGoalDefinition(): LearningGoalDefinition {
  return {
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
  };
}

function expandedGoalSubgraph(
  goal: LearningGoalDefinition,
  overrides: Partial<ExpandedGoalSubgraph> = {},
): ExpandedGoalSubgraph {
  return {
    expansionVersion: 'goal-subgraph-expansion.v1',
    status: 'expanded',
    learningGoalId: goal.id,
    learningGoalVersion: goal.version,
    graphVersion: buildKaqArtifactVersionRefs().graphCatalogVersion ?? 'kaq-graph.test',
    graphNodeIds: {
      knowledge: ['knowledge:root-locus'],
      capability: ['capability:interpret-locus'],
      quality: [],
    },
    requiredEdges: [{
      edgeId: 'edge:root-locus-foundation',
      sourceNodeId: 'knowledge:root-locus-foundation',
      targetNodeId: 'knowledge:root-locus',
      domain: 'knowledge',
      relation: 'supports',
      strength: 'strong',
      semantics: 'hard_prerequisite',
      direction: 'incoming',
      required: true,
      rationale: 'Root locus construction requires foundation vocabulary.',
    }],
    recommendedEdges: [],
    prerequisitePolicy: [{
      edgeId: 'edge:root-locus-foundation',
      sourceNodeId: 'knowledge:root-locus-foundation',
      targetNodeId: 'knowledge:root-locus',
      domain: 'knowledge',
      relation: 'supports',
      strength: 'strong',
      semantics: 'hard_prerequisite',
      direction: 'incoming',
      required: true,
      rationale: 'Root locus construction requires foundation vocabulary.',
    }],
    remediationCandidates: ['knowledge:root-locus-foundation'],
    extensionCandidates: ['knowledge:advanced-root-locus'],
    transferCandidates: ['knowledge:transfer-root-locus'],
    terminalValidationCandidates: [{
      id: 'terminal:goal:root-locus:capability:interpret-locus',
      graphNodeId: 'capability:interpret-locus',
      acceptedEvidenceTypes: ['question'],
      required: true,
      summary: 'Validate root locus interpretation with a question.',
    }],
    checkpointSuggestions: [{
      id: 'checkpoint:goal:root-locus:capability:interpret-locus',
      graphNodeId: 'capability:interpret-locus',
      evidenceTypes: ['question'],
      reason: 'Checkpoint root locus interpretation before terminal validation.',
    }],
    limitations: [{
      code: 'weak-relation-evidence',
      edgeId: 'edge:root-locus-foundation',
      severity: 'warning',
      message: 'Weak relation evidence retained as a limitation.',
    }],
    fixtures: {
      planner: {
        learningGoalId: goal.id,
        graphVersion: 'kaq-graph.test',
        targetGraphNodeIds: ['knowledge:root-locus', 'capability:interpret-locus'],
        prerequisitePolicy: [],
        terminalValidationCandidates: [],
        checkpointSuggestions: [],
        limitationCodes: ['weak-relation-evidence'],
      },
      konling: {
        learningGoalId: goal.id,
        graphVersion: 'kaq-graph.test',
        versionRefs: buildKaqArtifactVersionRefs({
          graphCatalogVersion: 'kaq-graph.test',
          learningGoalPackageVersion: goal.version,
        }),
        groundingNodeIds: ['knowledge:root-locus', 'capability:interpret-locus'],
        prerequisitePolicySummaries: [],
        limitations: [],
      },
      graphCenter: {
        learningGoalId: goal.id,
        graphVersion: 'kaq-graph.test',
        versionRefs: buildKaqArtifactVersionRefs({
          graphCatalogVersion: 'kaq-graph.test',
          learningGoalPackageVersion: goal.version,
        }),
        domains: [
          { domain: 'knowledge', nodeIds: ['knowledge:root-locus'] },
          { domain: 'capability', nodeIds: ['capability:interpret-locus'] },
          { domain: 'quality', nodeIds: [] },
        ],
        relationIds: ['edge:root-locus-foundation'],
        actionable: false,
      },
    },
    ...overrides,
  };
}

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
