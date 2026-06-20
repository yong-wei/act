import { describe, expect, it } from 'vitest';
import type { CompetencyVector } from '../competency-model';
import {
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  type AdaptiveLearnerSecondaryDimension,
} from '../adaptive-learner-state-service';
import {
  mapAdaptiveGoalSliceDimensionToPortraitV2,
  mapLegacyCompetencyDimensionToPortraitV2,
  mapSecondaryLearnerStateDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSIONS,
  preserveSixDimensionalCompetencyVector,
  validateKaqObjectiveCatalog,
  type KaqObjective,
} from '../kaq-objective-taxonomy';

const basePolicy = {
  evidencePolicy: {
    requiredFamilies: ['assessment'],
    minimumEvidenceCount: 1,
    confidenceFloor: 0.5,
  },
  graphBinding: {
    required: true,
    nodeKinds: ['knowledge'],
    bindingRefs: ['control-correction:time-domain-targets'],
  },
} satisfies Pick<KaqObjective, 'evidencePolicy' | 'graphBinding'>;

function objective(overrides: Partial<KaqObjective>): KaqObjective {
  return {
    id: 'knowledge:control-correction',
    domain: 'knowledge',
    level: 'overall',
    parentId: null,
    title: '控制系统校正',
    description: '围绕控制系统校正建立目标树。',
    portraitDimensions: ['controlModelingRepresentation'],
    status: 'active',
    ...basePolicy,
    ...overrides,
  };
}

describe('kaq objective taxonomy', () => {
  it('validates K/A/Q hierarchy, policies, and portrait dimensions', () => {
    const result = validateKaqObjectiveCatalog([
      objective({ id: 'knowledge:control-correction' }),
      objective({
        id: 'knowledge:control-correction:root-locus',
        level: 'secondary',
        parentId: 'knowledge:control-correction',
        portraitDimensions: ['systemAnalysisInterpretation'],
      }),
      objective({
        id: 'knowledge:control-correction:root-locus:rules',
        level: 'tertiary',
        parentId: 'knowledge:control-correction:root-locus',
        portraitDimensions: ['controllerDesignSynthesis'],
      }),
    ]);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects duplicate ids, invalid parents, domain mismatches, and missing binding policies', () => {
    const result = validateKaqObjectiveCatalog([
      objective({ id: 'capability:control-correction', domain: 'capability' }),
      objective({
        id: 'capability:control-correction',
        domain: 'capability',
        level: 'secondary',
        parentId: 'missing-parent',
      }),
      objective({
        id: 'quality:reflection:prompting',
        domain: 'quality',
        level: 'tertiary',
        parentId: 'capability:control-correction',
        graphBinding: null,
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate-id',
      'invalid-parent',
      'domain-mismatch',
      'missing-graph-binding',
    ]));
  });

  it('rejects malformed catalog values loaded from untyped sources', () => {
    const malformed = objective({
      id: 'knowledge:malformed',
      domain: 'unknown' as KaqObjective['domain'],
      level: 'leaf' as KaqObjective['level'],
      status: 'published' as KaqObjective['status'],
      portraitDimensions: ['unknown-dimension' as KaqObjective['portraitDimensions'][number]],
      evidencePolicy: {
        requiredFamilies: [],
        minimumEvidenceCount: 0,
        confidenceFloor: 1.2,
      },
      graphBinding: {
        required: true,
        nodeKinds: [],
        bindingRefs: [],
      },
    });

    const result = validateKaqObjectiveCatalog([malformed]);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'invalid-domain',
      'invalid-level',
      'invalid-status',
      'invalid-portrait-dimension',
      'invalid-evidence-policy',
      'invalid-graph-binding',
    ]));
  });

  it('rejects missing required objective fields and partial policy objects without throwing', () => {
    const missingShape = {
      ...objective({ id: 'knowledge:missing-shape' }),
      title: '',
      description: '',
    } as KaqObjective;
    delete (missingShape as Partial<KaqObjective>).parentId;

    const partialPolicies = objective({
      id: 'knowledge:partial-policy',
      evidencePolicy: {} as KaqObjective['evidencePolicy'],
      graphBinding: { required: true } as KaqObjective['graphBinding'],
    });

    expect(() => validateKaqObjectiveCatalog([missingShape, partialPolicies])).not.toThrow();
    const result = validateKaqObjectiveCatalog([missingShape, partialPolicies]);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing-parent-id',
      'missing-title',
      'missing-description',
      'invalid-evidence-policy',
      'invalid-graph-binding',
    ]));
  });

  it('rejects an overall objective with a non-null parent id', () => {
    const result = validateKaqObjectiveCatalog([
      objective({
        id: 'knowledge:root',
        parentId: 'knowledge:another-root',
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('invalid-level-parent');
  });

  it('preserves the six-dimensional learner-state vector while deriving portrait v2 mappings', () => {
    const vector: CompetencyVector = {
      controlModeling: { score: 80, trend: 'up', confidence: 0.8, evidenceCount: 8, lastUpdated: '2026-06-01T00:00:00.000Z' },
      parameterDesign: { score: 70, trend: 'stable', confidence: 0.7, evidenceCount: 7, lastUpdated: '2026-06-01T00:00:00.000Z' },
      crossDomainTransfer: { score: 65, trend: 'stable', confidence: 0.65, evidenceCount: 6, lastUpdated: '2026-06-01T00:00:00.000Z' },
      engineeringDecision: { score: 75, trend: 'up', confidence: 0.75, evidenceCount: 7, lastUpdated: '2026-06-01T00:00:00.000Z' },
      inquiryReflection: { score: 68, trend: 'stable', confidence: 0.68, evidenceCount: 5, lastUpdated: '2026-06-01T00:00:00.000Z' },
      selfDirectedLearning: { score: 72, trend: 'up', confidence: 0.72, evidenceCount: 5, lastUpdated: '2026-06-01T00:00:00.000Z' },
    };

    expect(PORTRAIT_V2_DIMENSIONS).toHaveLength(7);
    expect(preserveSixDimensionalCompetencyVector(vector)).toBe(vector);
    expect(mapLegacyCompetencyDimensionToPortraitV2('crossDomainTransfer')).toMatchObject({
      sourceDimension: 'crossDomainTransfer',
      targetDimensions: ['transferIntegratedApplication'],
    });
  });

  it('maps secondary learner-state and registered goal-slice dimensions with confidence limitations', () => {
    expect(mapSecondaryLearnerStateDimensionToPortraitV2('aiUseStrategy')).toMatchObject({
      targetDimensions: ['reflectionImprovementAiCollab'],
      confidence: 'medium',
    });
    expect(mapAdaptiveGoalSliceDimensionToPortraitV2('simulation-validation')).toMatchObject({
      targetDimensions: ['simulationValidationEvidence'],
      confidence: 'high',
    });
    expect(mapAdaptiveGoalSliceDimensionToPortraitV2('unknown-dimension')).toMatchObject({
      targetDimensions: [],
      confidence: 'none',
    });
  });

  it('registers explicit portrait mappings for every current secondary and control-correction dimension', () => {
    const secondaryDimensions: AdaptiveLearnerSecondaryDimension[] = [
      'conceptMastery',
      'timeFrequencyTransfer',
      'modelingReliability',
      'tuningEfficiency',
      'constrainedOptimization',
      'solutionStability',
      'crossModalTransfer',
      'scenarioGeneralization',
      'riskRecognition',
      'constraintCompliance',
      'explanationQuality',
      'aiUseStrategy',
      'reflectionDepth',
      'pathExecution',
      'persistence',
      'remedialInitiative',
    ];

    for (const dimension of secondaryDimensions) {
      expect(mapSecondaryLearnerStateDimensionToPortraitV2(dimension).targetDimensions.length).toBeGreaterThan(0);
    }
    for (const dimension of CONTROL_CORRECTION_GOAL_DIMENSIONS) {
      expect(mapAdaptiveGoalSliceDimensionToPortraitV2(dimension).targetDimensions.length).toBeGreaterThan(0);
    }
  });
});
