import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
  planLearningPath,
  type AdaptiveLearningPathPlannerInput,
} from '@/features/personalization/path-planning/public-api';
import { resolveAdaptivePathDestinationContract } from '@/features/personalization/path-planning/adaptive-path-destination-contract';
import { buildControlCorrectionResourceNodeRegistry } from '@/lib/control-correction-resource-seed';
import type { PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
  projectPortraitV2ForConsumer,
} from '@/lib/data-governance/portrait-v2-model';

const CONTROL_CORRECTION_SIMULATION_ID = 'simulation:control-correction-step-response-lab';
const CONTROL_CORRECTION_ARENA_ID = 'arena-task:task-second-order-lead-pid';
const GOVERNED_COURSE_DEMO =
  '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11';

function createPlannerPortrait(
  now: Date,
  userId: string,
  score: number,
) {
  return projectPortraitV2ForConsumer(createPortraitV2Payload({
    userId,
    generatedAt: now.toISOString(),
    now,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id: PortraitV2DimensionId) => ({
      id,
      score,
      confidence: 0.7,
      trend: 'stable' as const,
      freshness: {
        state: 'current' as const,
        asOf: now.toISOString(),
        evidenceAgeDays: 0,
      },
      evidenceSummary: {
        totalCount: 4,
        sourceFamilyCounts: { LearningFact: 4 },
      },
      lastPositiveEvidenceAt: now.toISOString(),
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [{
        kind: 'evidence-family' as const,
        ref: 'LearningFact',
        privacyScope: 'student-visible' as const,
      }],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  }), 'planner', { now });
}

function plannerInputForStudent(
  studentIndex: number,
  competencyScore: number,
): AdaptiveLearningPathPlannerInput {
  const now = new Date('2026-05-28T00:00:00Z');
  const studentId = `virtual-student-${String(studentIndex + 1).padStart(2, '0')}`;
  return {
    studentId,
    now,
    goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
    registry: buildControlCorrectionResourceNodeRegistry(),
    constraints: {
      timeBudgetMinutes: 90,
      privacyScopes: ['student-visible'],
      device: 'desktop',
      timelineWindowDays: 7,
    },
    learnerState: {
      primaryPortraitState: 'SNAPSHOT',
      primaryPortraitAvailability: 'available',
      primaryPortrait: createPlannerPortrait(now, studentId, Math.round(competencyScore * 100)),
      knowledgeMastery: {
        tags: {
          'control-correction:time-domain-targets': {
            posteriorMastery: competencyScore,
            confidence: 0.7,
            evidenceCount: 2,
          },
          'control-correction:root-locus-design': {
            posteriorMastery: Math.max(0, competencyScore - 0.05),
            confidence: 0.65,
            evidenceCount: 2,
          },
          'control-correction:simulation-validation': {
            posteriorMastery: Math.max(0, competencyScore - 0.1),
            confidence: 0.6,
            evidenceCount: 1,
          },
          'control-correction:arena-transfer': {
            posteriorMastery: Math.max(0, competencyScore - 0.2),
            confidence: 0.5,
            evidenceCount: 0,
          },
        },
      },
      primaryCompetencies: {
        vector: {
          controlModeling: { score: competencyScore, confidence: 0.7, evidenceCount: 4 },
          parameterDesign: { score: competencyScore, confidence: 0.7, evidenceCount: 4 },
          engineeringDecision: { score: Math.min(1, competencyScore + 0.07), confidence: 0.6, evidenceCount: 3 },
          crossDomainTransfer: { score: Math.max(0, competencyScore - 0.07), confidence: 0.5, evidenceCount: 2 },
        },
      },
      evidence: {
        confidence: {
          level: competencyScore >= 0.5 ? 'medium' : 'low',
          score: competencyScore,
          evidenceCount: 8,
          sourceCompleteness: 0.7,
        },
        sourceCoverage: {
          LearningFact: 'available',
          ArenaSubmission: 'partial',
        },
      },
    },
  };
}

describe('control-correction real seed destinations', () => {
  it('does not destination-block the governed course demo simulation seed', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const simulation = registry.nodes.find((node) => node.id === CONTROL_CORRECTION_SIMULATION_ID);
    expect(simulation?.launchTarget).toBe(GOVERNED_COURSE_DEMO);
    expect(resolveAdaptivePathDestinationContract(
      simulation!.type,
      simulation!.launchTarget ?? '',
      {
        nodeId: simulation!.id,
        sourceKind: simulation!.sourceKind,
        sourceRef: simulation!.sourceRef,
      },
    )).toMatchObject({
      disposition: 'destination-control',
      reason: null,
    });
  });

  it('plans a live control-correction main path that keeps simulation and Arena terminal', () => {
    const plan = planLearningPath(plannerInputForStudent(0, 0.55));
    const mainIds = plan.mainPath.map((node) => node.nodeId);
    const estimatedTime = plan.mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
    const simulationNode = plan.mainPath.find((node) => node.nodeId === CONTROL_CORRECTION_SIMULATION_ID);

    expect(plan.status).toBe('ready');
    expect(mainIds.length).toBeGreaterThan(0);
    expect(mainIds).toContain(CONTROL_CORRECTION_SIMULATION_ID);
    expect(mainIds.at(-1)).toBe(CONTROL_CORRECTION_ARENA_ID);
    expect(simulationNode?.launchBinding?.target).toBe(GOVERNED_COURSE_DEMO);
    expect(estimatedTime).toBeGreaterThan(0);
    expect(estimatedTime).toBeLessThanOrEqual(90);
  });

  it('runs 24 virtual students through the live planner on the unmodified registry', () => {
    const results = Array.from({ length: 24 }, (_, index) => {
      const competencyScore = 0.08 + (index / 23) * 0.8;
      const plan = planLearningPath(plannerInputForStudent(index, competencyScore));
      const mainIds = plan.mainPath.map((node) => node.nodeId);
      const estimatedTime = plan.mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
      const blockedSimulation = plan.alternatives.find((node) => (
        node.nodeId === CONTROL_CORRECTION_SIMULATION_ID
        && node.reasonCodes?.includes('destination-contract-blocked')
      ));
      return {
        studentId: `virtual-student-${String(index + 1).padStart(2, '0')}`,
        status: plan.status,
        mainIds,
        estimatedTime,
        simulationTarget: plan.mainPath.find((node) => node.nodeId === CONTROL_CORRECTION_SIMULATION_ID)
          ?.launchBinding?.target,
        blockedSimulation: Boolean(blockedSimulation),
      };
    });

    expect(new Set(results.map((result) => result.studentId)).size).toBe(24);
    expect(results.every((result) => !result.blockedSimulation)).toBe(true);
    const feasible = results.filter((result) => (
      result.status === 'ready'
      && result.mainIds.includes(CONTROL_CORRECTION_SIMULATION_ID)
      && result.mainIds.at(-1) === CONTROL_CORRECTION_ARENA_ID
    ));
    expect(feasible.length).toBeGreaterThan(0);
    expect(feasible.every((result) => result.simulationTarget === GOVERNED_COURSE_DEMO)).toBe(true);
  });
});
