import { describe, expect, it } from 'vitest';
import {
  validateKaqGraphCatalog,
  type KaqGraphCatalog,
  type KaqGraphLearnerOverlay,
} from '../kaq-graph-schema';
import type { KaqObjective } from '../kaq-objective-taxonomy';

const policy = {
  evidencePolicy: {
    requiredFamilies: ['assessment'],
    minimumEvidenceCount: 1,
    confidenceFloor: 0.5,
  },
  graphBinding: {
    required: true,
    nodeKinds: ['knowledge'],
    bindingRefs: ['knowledge:time-domain'],
  },
} satisfies Pick<KaqObjective, 'evidencePolicy' | 'graphBinding'>;

const objectives: KaqObjective[] = [
  {
    id: 'knowledge:time-domain',
    domain: 'knowledge',
    level: 'overall',
    parentId: null,
    title: '时域指标',
    description: '理解时域指标及其控制含义。',
    moduleId: 'unit-3-6',
    portraitDimensions: ['controlModelingRepresentation'],
    status: 'active',
    ...policy,
  },
  {
    id: 'capability:time-domain-translation',
    domain: 'capability',
    level: 'overall',
    parentId: null,
    title: '时域指标翻译',
    description: '把性能指标翻译为控制器设计约束。',
    moduleId: 'unit-3-6',
    portraitDimensions: ['controllerDesignSynthesis'],
    status: 'active',
    ...policy,
  },
  {
    id: 'quality:evidence-integrity',
    domain: 'quality',
    level: 'overall',
    parentId: null,
    title: '证据完整性',
    description: '在工程判断中声明证据来源和适用边界。',
    moduleId: 'unit-3-6',
    portraitDimensions: ['engineeringConstraintSafety'],
    status: 'active',
    ...policy,
  },
];

const validCatalog: KaqGraphCatalog = {
  nodes: [
    {
      id: 'kn:time-domain-targets',
      domain: 'knowledge',
      kind: 'concept',
      title: '时域指标',
      description: '超调、调节时间和稳态误差指标。',
      objectiveIds: ['knowledge:time-domain'],
      moduleId: 'unit-3-6',
      portraitDimensions: ['controlModelingRepresentation'],
      status: 'active',
      knowledgeRefs: ['control-correction:time-domain-targets'],
    },
    {
      id: 'kn:dominant-pole',
      domain: 'knowledge',
      kind: 'method',
      title: '主导极点',
      description: '用主导极点解释响应形态。',
      objectiveIds: ['knowledge:time-domain'],
      moduleId: 'unit-3-6',
      portraitDimensions: ['systemAnalysisInterpretation'],
      status: 'active',
      knowledgeRefs: ['control-correction:dominant-pole'],
    },
    {
      id: 'cap:translate-targets',
      domain: 'capability',
      title: '翻译性能指标',
      description: '将时域指标翻译为目标极点区域。',
      objectiveIds: ['capability:time-domain-translation'],
      moduleId: 'unit-3-6',
      portraitDimensions: ['controllerDesignSynthesis'],
      status: 'active',
      knowledgeNodeIds: ['kn:time-domain-targets'],
      bloomLevel: 'apply',
      behaviorVerb: 'translate',
      taskContext: 'control-correction design',
      successCriteria: ['Translate overshoot and settling-time targets into pole-region constraints.'],
      observableEvidenceTypes: ['simulation-run'],
      evaluationMethods: ['governed simulation replay'],
    },
    {
      id: 'qual:evidence-integrity',
      domain: 'quality',
      title: '声明证据边界',
      description: '说明设计结论的证据来源和局限。',
      objectiveIds: ['quality:evidence-integrity'],
      moduleId: 'unit-3-6',
      portraitDimensions: ['engineeringConstraintSafety'],
      status: 'active',
      scenario: 'teacher review of a correction design',
      observableBehaviors: ['States which simulation and assessment evidence support the decision.'],
      rubricLevels: [
        {
          id: 'proficient',
          label: 'Proficient',
          criteria: ['Uses governed evidence and states limitations.'],
        },
      ],
      evidenceSources: ['simulation-run', 'reflection'],
    },
  ],
  edges: [
    {
      id: 'edge:time-domain-to-pole',
      domain: 'knowledge',
      sourceNodeId: 'kn:time-domain-targets',
      targetNodeId: 'kn:dominant-pole',
      relation: 'supports',
      strength: 'strong',
      rationale: 'Time-domain requirements constrain feasible dominant pole regions.',
    },
  ],
};

describe('kaq graph schema', () => {
  it('validates a legal K/A/Q graph catalog and keeps overlays separate', () => {
    const overlay: KaqGraphLearnerOverlay = {
      domain: 'capability',
      nodeId: 'cap:translate-targets',
      learnerId: 'student-1',
      score: 0.72,
      confidence: 0.68,
      evidenceCount: 4,
    };

    expect(overlay.nodeId).toBe('cap:translate-targets');
    expect(validateKaqGraphCatalog(validCatalog, objectives)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('rejects orphan edges, unknown objectives, invalid portraits, and overlay data in graph bodies', () => {
    const invalidCatalog: KaqGraphCatalog = {
      nodes: [
        {
          ...validCatalog.nodes[0],
          objectiveIds: ['missing-objective'],
          portraitDimensions: ['unknown-dimension' as KaqGraphCatalog['nodes'][number]['portraitDimensions'][number]],
          learnerScore: 0.5,
        } as unknown as KaqGraphCatalog['nodes'][number],
        {
          ...validCatalog.nodes[0],
        },
      ],
      edges: [
        {
          id: 'edge:orphan',
          domain: 'capability',
          sourceNodeId: 'missing-source',
          targetNodeId: 'kn:time-domain-targets',
          relation: 'depends-on',
          strength: 'medium',
          rationale: 'Invalid edge used by fixture.',
        },
      ],
    };

    const result = validateKaqGraphCatalog(invalidCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate-node-id',
      'unknown-objective-id',
      'invalid-portrait-dimension',
      'graph-body-contains-overlay-data',
      'invalid-edge-reference',
      'edge-domain-mismatch',
    ]));
  });

  it('rejects active capability and quality nodes without observable teaching semantics', () => {
    const invalidCatalog: KaqGraphCatalog = {
      nodes: [
        {
          id: 'cap:empty',
          domain: 'capability',
          title: 'Empty capability',
          description: 'Missing semantics.',
          objectiveIds: ['capability:time-domain-translation'],
          portraitDimensions: ['controllerDesignSynthesis'],
          status: 'active',
          knowledgeNodeIds: [],
          bloomLevel: 'apply',
          behaviorVerb: '',
          taskContext: '',
          successCriteria: [],
          observableEvidenceTypes: [],
          evaluationMethods: [],
        },
        {
          id: 'qual:empty',
          domain: 'quality',
          title: 'Empty quality',
          description: 'Missing semantics.',
          objectiveIds: ['quality:evidence-integrity'],
          portraitDimensions: ['engineeringConstraintSafety'],
          status: 'active',
          scenario: '',
          observableBehaviors: [],
          rubricLevels: [],
          evidenceSources: [],
        },
      ],
      edges: [],
    };

    const result = validateKaqGraphCatalog(invalidCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'capability-missing-knowledge-binding',
      'capability-missing-observable-evidence',
      'quality-missing-scenario',
      'quality-missing-observable-behavior',
      'quality-missing-rubric-levels',
      'quality-missing-evidence-sources',
    ]));
  });

  it('rejects malformed top-level catalog input without throwing', () => {
    for (const catalog of [null, {}, { nodes: null, edges: [] }]) {
      expect(() => validateKaqGraphCatalog(catalog as unknown as KaqGraphCatalog, objectives)).not.toThrow();
      const result = validateKaqGraphCatalog(catalog as unknown as KaqGraphCatalog, objectives);
      expect(result.valid).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toContain('invalid-catalog-shape');
    }
  });

  it('rejects malformed node and edge array items without throwing', () => {
    const invalidCatalog = {
      nodes: [null, 'bad-node'],
      edges: [null, 'bad-edge'],
    } as unknown as KaqGraphCatalog;

    expect(() => validateKaqGraphCatalog(invalidCatalog, objectives)).not.toThrow();
    const result = validateKaqGraphCatalog(invalidCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-node-shape',
      'invalid-edge-shape',
    ]));
  });

  it('keeps malformed id metadata within the public issue contract', () => {
    const invalidCatalog: KaqGraphCatalog = {
      nodes: [
        {
          ...validCatalog.nodes[0],
          id: { value: 'bad-node-id' } as unknown as string,
        },
      ],
      edges: [
        {
          ...validCatalog.edges[0],
          id: { value: 'bad-edge-id' } as unknown as string,
        },
      ],
    };

    const result = validateKaqGraphCatalog(invalidCatalog, objectives);
    const issueIds = result.issues.map((issue) => issue.nodeId ?? issue.edgeId).filter((id) => id !== undefined);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-node-id',
      'invalid-edge-id',
    ]));
    expect(issueIds.every((id) => id === null || typeof id === 'string')).toBe(true);
  });

  it('rejects invalid runtime node and edge enum values and empty required body fields', () => {
    const invalidCatalog: KaqGraphCatalog = {
      nodes: [
        {
          ...validCatalog.nodes[0],
          id: 123 as unknown as string,
          domain: 'invalid-domain' as KaqGraphCatalog['nodes'][number]['domain'],
          kind: 'invalid-kind' as KaqGraphCatalog['nodes'][number]['domain'],
          title: '',
          description: '',
          status: 'published' as KaqGraphCatalog['nodes'][number]['status'],
        } as unknown as KaqGraphCatalog['nodes'][number],
      ],
      edges: [
        {
          id: {} as unknown as string,
          domain: 'invalid-domain' as KaqGraphCatalog['edges'][number]['domain'],
          sourceNodeId: '',
          targetNodeId: '',
          relation: 'bad-relation' as KaqGraphCatalog['edges'][number]['relation'],
          strength: 'invalid-strength' as KaqGraphCatalog['edges'][number]['strength'],
          rationale: '',
        },
      ],
    };

    const result = validateKaqGraphCatalog(invalidCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-node-id',
      'invalid-node-domain',
      'invalid-knowledge-kind',
      'missing-node-title',
      'missing-node-description',
      'invalid-node-status',
      'invalid-edge-id',
      'invalid-edge-domain',
      'invalid-edge-reference',
      'invalid-edge-relation',
      'invalid-edge-strength',
      'missing-edge-rationale',
    ]));
  });

  it('rejects graph body nodes that include learner, class, or resource overlay fields', () => {
    const invalidCatalog: KaqGraphCatalog = {
      nodes: [
        {
          ...validCatalog.nodes[0],
          score: 0.8,
          confidence: 0.7,
          evidenceCount: 3,
          distribution: { high: 2 },
          coveredResourceIds: ['resource-1'],
          missingResourceTypes: ['quiz'],
        } as unknown as KaqGraphCatalog['nodes'][number],
      ],
      edges: [],
    };

    const result = validateKaqGraphCatalog(invalidCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.filter((issue) => issue.code === 'graph-body-contains-overlay-data')).toHaveLength(6);
  });

  it('rejects active capability and quality nodes with malformed domain-specific enums or rubric levels', () => {
    const invalidCatalog: KaqGraphCatalog = {
      nodes: [
        {
          ...validCatalog.nodes[2],
          bloomLevel: 'bad-level' as KaqGraphCatalog['nodes'][number]['domain'],
        },
        {
          ...validCatalog.nodes[3],
          rubricLevels: [
            null,
            'bad-rubric',
            {
              id: '',
              label: '',
              criteria: [],
            },
          ],
        },
      ] as unknown as KaqGraphCatalog['nodes'],
      edges: [],
    };

    const result = validateKaqGraphCatalog(invalidCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-capability-bloom-level',
      'invalid-quality-rubric-level',
    ]));
  });

  it('rejects malformed untyped graph contracts and weak rubric levels', () => {
    const malformedCatalog: KaqGraphCatalog = {
      nodes: [
        ...validCatalog.nodes,
        {
          id: '',
          domain: 'knowledge',
          kind: 'concept',
          title: 'Missing id',
          description: 'Invalid node fixture.',
          objectiveIds: ['knowledge:time-domain'],
          portraitDimensions: ['controlModelingRepresentation'],
          status: 'active',
          knowledgeRefs: [],
        },
        {
          id: 'node:malformed',
          domain: 'unknown' as KaqGraphCatalog['nodes'][number]['domain'],
          title: '',
          description: '',
          objectiveIds: ['knowledge:time-domain'],
          portraitDimensions: ['controlModelingRepresentation'],
          status: 'published' as KaqGraphCatalog['nodes'][number]['status'],
        },
        {
          ...validCatalog.nodes[3],
          id: 'qual:weak-rubric',
          rubricLevels: [{ id: 'empty', label: '', criteria: [] }],
        },
      ] as unknown as KaqGraphCatalog['nodes'],
      edges: [
        ...validCatalog.edges,
        {
          id: '',
          domain: 'knowledge',
          sourceNodeId: 'kn:time-domain-targets',
          targetNodeId: 'kn:dominant-pole',
          relation: 'supports',
          strength: 'medium',
          rationale: 'Missing edge id fixture.',
        },
        {
          id: 'edge:malformed',
          domain: 'knowledge',
          sourceNodeId: 'kn:time-domain-targets',
          targetNodeId: 'kn:dominant-pole',
          relation: 'unknown' as KaqGraphCatalog['edges'][number]['relation'],
          strength: 'heavy' as KaqGraphCatalog['edges'][number]['strength'],
          rationale: '',
        },
        {
          id: 'edge:duplicate',
          domain: 'knowledge',
          sourceNodeId: 'kn:time-domain-targets',
          targetNodeId: 'kn:dominant-pole',
          relation: 'supports',
          strength: 'medium',
          rationale: 'Duplicate edge fixture.',
        },
        {
          id: 'edge:duplicate',
          domain: 'knowledge',
          sourceNodeId: 'kn:time-domain-targets',
          targetNodeId: 'kn:dominant-pole',
          relation: 'supports',
          strength: 'medium',
          rationale: 'Duplicate edge fixture.',
        },
      ],
    };

    const result = validateKaqGraphCatalog(malformedCatalog, objectives);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing-node-id',
      'missing-node-title',
      'missing-node-description',
      'invalid-node-domain',
      'invalid-node-status',
      'invalid-quality-rubric-level',
      'missing-edge-id',
      'duplicate-edge-id',
      'invalid-edge-relation',
      'invalid-edge-strength',
      'missing-edge-rationale',
    ]));
  });
});
