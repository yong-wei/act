import { describe, expect, it } from 'vitest';

import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_GRAPH_VERSION,
} from '../data-governance/autocontrol-kaq-graph-catalog';
import type { KaqGraphCatalog } from '../data-governance/kaq-graph-schema';
import {
  expandLearningGoalPackageSubgraph,
  expandLearningGoalSubgraph,
  GOAL_SUBGRAPH_EXPANSION_VERSION,
} from '../graphs/goal-subgraph-expansion-service';
import { getLearningGoalPackage, type LearningGoalPackageDefinition } from '../adaptive-learning-path-planner';

describe('goal subgraph expansion service', () => {
  it('expands a path-ready LearningGoal package into deterministic K/A/Q graph payloads', () => {
    const first = expandLearningGoalSubgraph('control-correction');
    const second = expandLearningGoalSubgraph('control-correction');

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      expansionVersion: GOAL_SUBGRAPH_EXPANSION_VERSION,
      status: 'degraded',
      learningGoalId: 'control-correction',
      graphVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
      graphNodeIds: {
        knowledge: expect.arrayContaining([
          'kn:autocontrol:controller-correction',
          'kn:autocontrol:root-locus',
        ]),
        capability: expect.arrayContaining([
          'cap:autocontrol:synthesize-controller-correction',
          'cap:autocontrol:validate-with-simulation-evidence',
        ]),
        quality: expect.arrayContaining([
          'qual:autocontrol:evidence-integrity',
          'qual:autocontrol:system-tradeoff',
        ]),
      },
    });
    expect(first.requiredEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        edgeId: 'edge:cap:analysis-supports-synthesis',
        semantics: 'hard_prerequisite',
        direction: 'incoming',
        required: true,
      }),
      expect.objectContaining({
        edgeId: 'edge:cap:validation-assesses-synthesis',
        semantics: 'evidence_for',
        direction: 'internal',
        required: true,
      }),
    ]));
    expect(first.recommendedEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({
        edgeId: 'edge:kn:time-domain-supports-root-locus',
        semantics: 'soft_prerequisite',
        required: false,
      }),
    ]));
    expect(first.terminalValidationCandidates.length).toBeGreaterThan(0);
    expect(first.checkpointSuggestions.length).toBeGreaterThan(0);
    expect(first.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'package-limitation' }),
    ]));
  });

  it('rejects path-ready packages with missing graph bindings without fabricating nodes', () => {
    const packageDefinition = {
      ...getLearningGoalPackage('control-correction')!,
      targetGraphNodeIds: [
        'kn:autocontrol:controller-correction',
        'kn:autocontrol:missing-node',
      ],
    } satisfies LearningGoalPackageDefinition;

    const expansion = expandLearningGoalPackageSubgraph(packageDefinition);

    expect(expansion.status).toBe('rejected');
    expect(expansion.graphNodeIds.knowledge).toEqual(['kn:autocontrol:controller-correction']);
    expect(expansion.fixtures.planner.targetGraphNodeIds).not.toContain('kn:autocontrol:missing-node');
    expect(expansion.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'missing-graph-node',
        graphNodeId: 'kn:autocontrol:missing-node',
        severity: 'blocking',
      }),
    ]));
  });

  it('surfaces inactive graph bindings as governed limitations', () => {
    const packageDefinition = getLearningGoalPackage('frequency-response-foundations')!;
    const catalog: KaqGraphCatalog = {
      nodes: AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.map((node) =>
        node.id === 'kn:autocontrol:frequency-response'
          ? { ...node, status: 'deprecated' }
          : node
      ),
      edges: AUTOCONTROL_KAQ_GRAPH_CATALOG.edges,
    };

    const expansion = expandLearningGoalPackageSubgraph(packageDefinition, { catalog });

    expect(expansion.status).toBe('degraded');
    expect(expansion.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'inactive-graph-node',
        graphNodeId: 'kn:autocontrol:frequency-response',
        severity: 'warning',
      }),
    ]));
  });

  it('rejects fully-governed packages when a bound graph node is inactive', () => {
    const packageDefinition: LearningGoalPackageDefinition = {
      ...getLearningGoalPackage('frequency-response-foundations')!,
      status: 'fully-governed',
    };
    const catalog: KaqGraphCatalog = {
      nodes: AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.map((node) =>
        node.id === 'kn:autocontrol:frequency-response'
          ? { ...node, status: 'deprecated' }
          : node
      ),
      edges: AUTOCONTROL_KAQ_GRAPH_CATALOG.edges,
    };

    const expansion = expandLearningGoalPackageSubgraph(packageDefinition, { catalog });

    expect(expansion.status).toBe('rejected');
    expect(expansion.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'inactive-graph-node',
        graphNodeId: 'kn:autocontrol:frequency-response',
        severity: 'blocking',
      }),
    ]));
  });

  it('exposes weak or unsupported relation semantics as limitations', () => {
    const packageDefinition = getLearningGoalPackage('frequency-response-foundations')!;
    const catalog: KaqGraphCatalog = {
      nodes: AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes,
      edges: [
        {
          id: 'edge:test:weak-support',
          domain: 'knowledge',
          sourceNodeId: 'kn:autocontrol:frequency-response',
          targetNodeId: 'kn:autocontrol:stability-margin',
          relation: 'supports',
          strength: 'weak',
          rationale: 'Weak test relation.',
        },
        {
          id: 'edge:test:unknown',
          domain: 'knowledge',
          sourceNodeId: 'kn:autocontrol:frequency-response',
          targetNodeId: 'kn:autocontrol:stability-margin',
          relation: 'unknown-relation' as never,
          strength: 'medium',
          rationale: 'Unsupported test relation.',
        },
      ],
    };

    const expansion = expandLearningGoalPackageSubgraph(packageDefinition, { catalog });

    expect(expansion.prerequisitePolicy).toContainEqual(expect.objectContaining({
      edgeId: 'edge:test:weak-support',
      semantics: 'soft_prerequisite',
      required: false,
    }));
    expect(expansion.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'weak-relation-evidence', edgeId: 'edge:test:weak-support' }),
      expect.objectContaining({ code: 'unsupported-relation', edgeId: 'edge:test:unknown' }),
    ]));
  });

  it('does not promote outgoing relations from target nodes into required prerequisite policy', () => {
    const expansion = expandLearningGoalSubgraph('simulation-validation-practice');
    const targetNodeIds = new Set(expansion.fixtures.planner.targetGraphNodeIds);
    const externallyRequiredEdges = expansion.requiredEdges.filter((entry) =>
      !targetNodeIds.has(entry.sourceNodeId) || !targetNodeIds.has(entry.targetNodeId)
    );

    expect(externallyRequiredEdges.every((entry) => targetNodeIds.has(entry.targetNodeId))).toBe(true);
    expect(expansion.requiredEdges).not.toContainEqual(expect.objectContaining({
      edgeId: 'edge:cap:validation-assesses-synthesis',
    }));
    expect(expansion.requiredEdges).not.toContainEqual(expect.objectContaining({
      edgeId: 'edge:qual:evidence-supports-safety',
    }));
    expect(expansion.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'outgoing-relation-not-prerequisite',
        edgeId: 'edge:cap:validation-assesses-synthesis',
      }),
      expect.objectContaining({
        code: 'outgoing-relation-not-prerequisite',
        edgeId: 'edge:qual:evidence-supports-safety',
      }),
    ]));
  });

  it('does not invert depends-on edges into reverse prerequisites', () => {
    const expansion = expandLearningGoalSubgraph('root-locus-analysis-foundations');

    expect(expansion.fixtures.planner.targetGraphNodeIds).toContain('kn:autocontrol:root-locus');
    expect(expansion.fixtures.planner.targetGraphNodeIds).not.toContain('kn:autocontrol:controller-correction');
    expect(expansion.requiredEdges).not.toContainEqual(expect.objectContaining({
      edgeId: 'edge:kn:correction-depends-on-root-locus',
      semantics: 'hard_prerequisite',
      sourceNodeId: 'kn:autocontrol:controller-correction',
    }));
    expect(expansion.prerequisitePolicy).not.toContainEqual(expect.objectContaining({
      edgeId: 'edge:kn:correction-depends-on-root-locus',
      semantics: 'hard_prerequisite',
    }));
    expect(expansion.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'unsupported-relation',
        edgeId: 'edge:kn:correction-depends-on-root-locus',
      }),
    ]));
  });

  it('keeps outgoing depends-on dependencies as remediation candidates', () => {
    const packageDefinition: LearningGoalPackageDefinition = {
      ...getLearningGoalPackage('control-correction')!,
      targetGraphNodeIds: ['kn:autocontrol:controller-correction'],
    };

    const expansion = expandLearningGoalPackageSubgraph(packageDefinition);

    expect(expansion.fixtures.planner.targetGraphNodeIds).toEqual(['kn:autocontrol:controller-correction']);
    expect(expansion.prerequisitePolicy).toContainEqual(expect.objectContaining({
      edgeId: 'edge:kn:correction-depends-on-root-locus',
      sourceNodeId: 'kn:autocontrol:controller-correction',
      targetNodeId: 'kn:autocontrol:root-locus',
      semantics: 'hard_prerequisite',
      direction: 'outgoing',
      required: false,
    }));
    expect(expansion.remediationCandidates).toContain('kn:autocontrol:root-locus');
    expect(expansion.remediationCandidates).not.toContain('kn:autocontrol:controller-correction');
  });

  it('provides planner, Konling, and GraphCenter fixtures without creating paths or selecting resources', () => {
    const expansion = expandLearningGoalSubgraph('simulation-validation-practice');

    expect(expansion.fixtures.planner).toMatchObject({
      learningGoalId: 'simulation-validation-practice',
      graphVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
      targetGraphNodeIds: expect.arrayContaining([
        'kn:autocontrol:simulation-validation',
        'cap:autocontrol:validate-with-simulation-evidence',
      ]),
    });
    expect(expansion.fixtures.konling.groundingNodeIds).toEqual(expansion.fixtures.planner.targetGraphNodeIds);
    expect(expansion.fixtures.konling.versionRefs).toMatchObject({
      graphCatalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
      groundingVersion: 'konling-graph-grounding.v1',
    });
    expect(expansion.fixtures.graphCenter).toMatchObject({
      learningGoalId: 'simulation-validation-practice',
      actionable: false,
      versionRefs: {
        graphCatalogVersion: AUTOCONTROL_KAQ_GRAPH_VERSION,
        overlayVersion: 'graph-center-overlay.v1',
      },
    });
    expect(JSON.stringify(expansion)).not.toContain('resourceNodeIds');
    expect(JSON.stringify(expansion)).not.toContain('rankedResources');
    expect(JSON.stringify(expansion)).not.toContain('pathRounds');
  });

  it('rejects unknown LearningGoal ids without creating graph payloads', () => {
    const expansion = expandLearningGoalSubgraph('unknown-goal-subgraph');

    expect(expansion.status).toBe('rejected');
    expect(expansion.graphNodeIds).toEqual({ knowledge: [], capability: [], quality: [] });
    expect(expansion.limitations).toEqual([
      expect.objectContaining({ code: 'missing-package', severity: 'blocking' }),
    ]);
  });
});
