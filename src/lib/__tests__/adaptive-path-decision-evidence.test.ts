import { describe, expect, it } from 'vitest';

import {
  buildPersonalizedPathDecisionEvidence,
  PERSONALIZED_PATH_DECISION_EVIDENCE_VERSION,
} from '../adaptive-path-decision-evidence';

describe('personalized path decision evidence', () => {
  it('freezes insufficient preference evidence as a degraded explanation', () => {
    const evidence = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-08-25T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: {},
        evidenceWindow: null,
        freshness: 'missing',
        confidence: { level: 'low', score: 0.1, sourceCompleteness: 0, evidenceCount: 0 },
        missingEvidence: ['LearningFact'],
        preferredModalities: ['video'],
        preferredModalityConfidence: 'low',
      },
      deficits: [],
      paths: [{
        optionId: 'path-option-1',
        styleId: 'foundation-remediation',
        nodeIds: ['node-a'],
        resourceMix: { knowledge_card: 1 },
      }],
    });

    expect(evidence.snapshot.version).toBe(PERSONALIZED_PATH_DECISION_EVIDENCE_VERSION);
    expect(evidence.snapshot.learnerStateVersion).toBe('adaptive-learner-state.v1');
    expect(evidence.snapshot.degradationReasons).toContain('insufficient-evidence');
    expect(evidence.paths[0]?.explanations.map((item) => item.studentText)).toContain(
      '目前学习记录不足，暂时无法判断你的资源偏好。',
    );
    expect(JSON.stringify(evidence)).not.toContain('最佳路径');
  });

  it('records profile-driven node and modality impacts when evidence is trusted', () => {
    const evidence = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-08-25T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: { LearningFact: 'available' },
        evidenceWindow: {
          firstStartedAt: '2026-08-01T00:00:00.000Z',
          lastStartedAt: '2026-08-24T00:00:00.000Z',
          daysCovered: 23,
        },
        freshness: 'current',
        confidence: { level: 'medium', score: 0.7, sourceCompleteness: 0.7, evidenceCount: 6 },
        missingEvidence: [],
        preferredModalities: ['simulation'],
        preferredModalityConfidence: 'medium',
      },
      deficits: [{
        targetId: '频域分析',
        kind: 'knowledge',
        value: 0.3,
        confidence: 0.7,
        evidenceCount: 4,
        reasonCode: 'low-mastery-target',
      }],
      paths: [
        {
          optionId: 'path-option-1',
          styleId: 'foundation-remediation',
          nodeIds: ['shared', 'freq-card'],
          planNodes: [
            { nodeId: 'shared', title: '共享节点', knowledgeCoverage: [], capabilityTargets: [] } as never,
            { nodeId: 'freq-card', title: '频域讲解', knowledgeCoverage: ['频域分析'], capabilityTargets: [] } as never,
          ],
          resourceMix: { knowledge_card: 1 },
        },
        {
          optionId: 'path-option-2',
          styleId: 'simulation-driven',
          nodeIds: ['shared', 'sim-lab'],
          planNodes: [
            { nodeId: 'shared', title: '共享节点', knowledgeCoverage: [], capabilityTargets: [] } as never,
            { nodeId: 'sim-lab', title: '仿真实验', knowledgeCoverage: [], capabilityTargets: [] } as never,
          ],
          resourceMix: { simulation: 1 },
        },
      ],
    });

    expect(evidence.paths[0]?.impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'added', source: 'profile', nodeId: 'freq-card' }),
    ]));
    expect(evidence.paths[1]?.impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'resource-type', source: 'profile', resourceType: 'simulation' }),
    ]));
    expect(evidence.paths[0]?.explanations.some((item) => item.studentText.includes('频域'))).toBe(true);
    expect(evidence.paths[1]?.explanations.some((item) => item.studentText.includes('仿真'))).toBe(true);
    expect(evidence.paths[1]?.explanations.some((item) => item.studentText.includes('频域'))).toBe(false);
    expect(evidence.snapshot.learnerStateVersion).toBe('adaptive-learner-state.v1');
  });

  it('does not present stale or missing evidence as current personalized conclusions', () => {
    const evidence = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-08-01T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: { LearningFact: 'available' },
        evidenceWindow: null,
        freshness: 'stale',
        confidence: { level: 'medium', score: 0.7, sourceCompleteness: 0.7, evidenceCount: 6 },
        missingEvidence: ['QuizAttempt'],
        preferredModalities: ['video'],
        preferredModalityConfidence: 'medium',
      },
      deficits: [{
        targetId: '频域分析',
        kind: 'knowledge',
        value: 0.3,
        confidence: 0.7,
        evidenceCount: 4,
        reasonCode: 'low-mastery-target',
      }],
      paths: [
        {
          optionId: 'path-option-1',
          styleId: 'foundation-remediation',
          nodeIds: ['shared', 'freq-card'],
          planNodes: [
            { nodeId: 'shared', title: '共享节点', knowledgeCoverage: [], capabilityTargets: [] } as never,
            { nodeId: 'freq-card', title: '频域讲解', knowledgeCoverage: ['频域分析'], capabilityTargets: [] } as never,
          ],
          resourceMix: { video: 1 },
        },
        {
          optionId: 'path-option-2',
          styleId: 'simulation-driven',
          nodeIds: ['shared', 'sim-lab'],
          planNodes: [
            { nodeId: 'shared', title: '共享节点', knowledgeCoverage: [], capabilityTargets: [] } as never,
            { nodeId: 'sim-lab', title: '仿真实验', knowledgeCoverage: [], capabilityTargets: [] } as never,
          ],
          resourceMix: { simulation: 1 },
        },
      ],
    });

    expect(evidence.snapshot.degradationReasons).toEqual(expect.arrayContaining([
      'stale-evidence',
      'missing-evidence',
    ]));
    expect(evidence.paths[0]?.explanations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'stale-evidence',
      'missing-evidence',
    ]));
    expect(evidence.paths[0]?.explanations.some((item) => item.code === 'weak-target')).toBe(false);
    expect(evidence.paths[0]?.explanations.some((item) => item.studentText.includes('因此增加了'))).toBe(false);
    expect(evidence.paths[0]?.impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'added', source: 'degraded', nodeId: 'freq-card' }),
    ]));
  });

  it('does not present partial freshness as current personalized conclusions', () => {
    const evidence = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-08-25T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: { LearningFact: 'available' },
        evidenceWindow: null,
        freshness: 'partial',
        confidence: { level: 'medium', score: 0.7, sourceCompleteness: 0.7, evidenceCount: 6 },
        missingEvidence: [],
        preferredModalities: [],
        preferredModalityConfidence: 'none',
      },
      deficits: [{
        targetId: '频域分析',
        kind: 'knowledge',
        value: 0.3,
        confidence: 0.7,
        evidenceCount: 4,
        reasonCode: 'low-mastery-target',
      }],
      paths: [
        {
          optionId: 'path-option-1',
          styleId: 'foundation-remediation',
          nodeIds: ['shared', 'freq-card'],
          planNodes: [
            { nodeId: 'shared', title: '共享节点', knowledgeCoverage: [], capabilityTargets: [] } as never,
            { nodeId: 'freq-card', title: '频域讲解', knowledgeCoverage: ['频域分析'], capabilityTargets: [] } as never,
          ],
          resourceMix: { knowledge_card: 1 },
        },
        {
          optionId: 'path-option-2',
          styleId: 'simulation-driven',
          nodeIds: ['shared', 'sim-lab'],
          planNodes: [
            { nodeId: 'shared', title: '共享节点', knowledgeCoverage: [], capabilityTargets: [] } as never,
            { nodeId: 'sim-lab', title: '仿真实验', knowledgeCoverage: [], capabilityTargets: [] } as never,
          ],
          resourceMix: { simulation: 1 },
        },
      ],
    });

    expect(evidence.snapshot.degradationReasons).toContain('partial-evidence');
    expect(evidence.paths[0]?.explanations.map((item) => item.code)).toContain('partial-evidence');
    expect(evidence.paths[0]?.explanations.some((item) => item.code === 'weak-target')).toBe(false);
  });

  it('does not describe shared target coverage as a personalized addition', () => {
    const evidence = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-08-25T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: { LearningFact: 'available' },
        evidenceWindow: null,
        freshness: 'current',
        confidence: { level: 'medium', score: 0.7, sourceCompleteness: 0.7, evidenceCount: 6 },
        missingEvidence: [],
        preferredModalities: [],
        preferredModalityConfidence: 'none',
      },
      deficits: [{
        targetId: '频域分析',
        kind: 'knowledge',
        value: 0.3,
        confidence: 0.7,
        evidenceCount: 4,
        reasonCode: 'low-mastery-target',
      }],
      paths: [
        {
          optionId: 'path-option-1',
          styleId: 'foundation-remediation',
          nodeIds: ['shared-freq', 'card-a'],
          planNodes: [
            { nodeId: 'shared-freq', title: '共享频域', knowledgeCoverage: ['频域分析'], capabilityTargets: [] } as never,
            { nodeId: 'card-a', title: '补充卡片', knowledgeCoverage: [], capabilityTargets: [] } as never,
          ],
          resourceMix: { knowledge_card: 1 },
        },
        {
          optionId: 'path-option-2',
          styleId: 'simulation-driven',
          nodeIds: ['shared-freq', 'sim-b'],
          planNodes: [
            { nodeId: 'shared-freq', title: '共享频域', knowledgeCoverage: ['频域分析'], capabilityTargets: [] } as never,
            { nodeId: 'sim-b', title: '仿真', knowledgeCoverage: [], capabilityTargets: [] } as never,
          ],
          resourceMix: { simulation: 1 },
        },
      ],
    });

    expect(evidence.paths[0]?.explanations.some((item) => item.code === 'weak-target')).toBe(false);
    expect(evidence.paths[1]?.explanations.some((item) => item.code === 'weak-target')).toBe(false);
    expect(evidence.paths[0]?.impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'added', source: 'rule', nodeId: 'card-a' }),
    ]));
  });

  it('does not rewrite a frozen snapshot when later learner-state objects change', () => {
    const preferredModalities = ['video'];
    const missingEvidence = ['LearningFact'];
    const weakTargets = [{
      targetId: '频域分析',
      kind: 'knowledge' as const,
      value: 0.3,
      confidence: 0.7,
      evidenceCount: 4,
      reasonCode: 'low-mastery-target',
    }];
    const first = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-26T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v1',
        generatedAt: '2026-08-25T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: { LearningFact: 'available' },
        evidenceWindow: null,
        freshness: 'current',
        confidence: { level: 'medium', score: 0.7, sourceCompleteness: 0.7, evidenceCount: 6 },
        missingEvidence,
        preferredModalities,
        preferredModalityConfidence: 'medium',
      },
      deficits: weakTargets,
      paths: [{
        optionId: 'path-option-1',
        styleId: 'foundation-remediation',
        nodeIds: ['node-a'],
        resourceMix: { video: 1 },
      }],
    });

    preferredModalities.push('simulation');
    missingEvidence.push('QuizAttempt');
    weakTargets[0]!.value = 0.9;
    const later = buildPersonalizedPathDecisionEvidence({
      capturedAt: '2026-08-27T00:00:00.000Z',
      plannerVersion: 'adaptive-learning-path-planner.v1',
      learnerStateSnapshot: {
        payloadVersion: 'adaptive-learner-state.v2',
        generatedAt: '2026-08-27T00:00:00.000Z',
        authority: 'server-owned',
        sourceCoverage: { LearningFact: 'available' },
        evidenceWindow: null,
        freshness: 'stale',
        confidence: { level: 'low', score: 0.1, sourceCompleteness: 0.1, evidenceCount: 1 },
        missingEvidence: ['QuizAttempt'],
        preferredModalities: ['simulation'],
        preferredModalityConfidence: 'low',
      },
      deficits: [],
      paths: [{
        optionId: 'path-option-1',
        styleId: 'foundation-remediation',
        nodeIds: ['node-a'],
        resourceMix: { simulation: 1 },
      }],
    });

    expect(first.snapshot.preferredModalities).toEqual(['video']);
    expect(first.snapshot.missingEvidence).toEqual(['LearningFact']);
    expect(first.snapshot.weakTargets[0]?.value).toBe(0.3);
    expect(first.snapshot.learnerStateVersion).toBe('adaptive-learner-state.v1');
    expect(later.snapshot.preferredModalities).toEqual(['simulation']);
    expect(later.snapshot.learnerStateVersion).toBe('adaptive-learner-state.v2');
    expect(later.snapshot.degradationReasons).toContain('insufficient-evidence');
  });
});
