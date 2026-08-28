import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  PLAN_LEARNING_PATH_STAGE_ORDER,
  evaluateHardEligibility,
  getRegisteredAdaptiveLearningPathGoal,
  planLearningPath,
} from '../public-api';
import {
  CONTROL_CORRECTION_GOAL_ID,
  createControlCorrectionPersonalizationPlugin,
  createPersonalizationPluginRegistry,
} from '@/features/personalization/plugins/public-api';
import { buildResourceNodeRegistry } from '@/lib/resource-node-registry';

const GENERIC_PIPELINE_FILES = [
  'src/features/personalization/path-planning/application/plan-learning-path.ts',
  'src/features/personalization/path-planning/ports.ts',
  'src/features/personalization/path-planning/contracts.ts',
  'src/features/personalization/path-planning/public-api.ts',
];

const PRODUCTION_CALLERS = [
  'src/lib/konling-agent-runtime.ts',
  'src/lib/full-resource-path-readiness-gate.ts',
  'src/lib/canonical-learning-path-transition/replan.ts',
  'src/lib/adaptive-path-candidate-batches.ts',
  'src/app/api/learning-paths/plan/route.ts',
  'src/app/api/adaptive/path-advisor-tool/route.ts',
  'src/app/api/learning-paths/candidate-batches/latest/route.ts',
];

describe('PlanLearningPath pipeline', () => {
  it('exposes one application function and the seven-stage order', () => {
    expect(typeof planLearningPath).toBe('function');
    expect([...PLAN_LEARNING_PATH_STAGE_ORDER]).toEqual([
      'GoalContextLoader',
      'CandidateProvider',
      'EligibilityPolicy',
      'RankingStrategy',
      'ConstraintRepair',
      'PathAssembler',
      'ExplanationBuilder',
    ]);
  });

  it('keeps hard eligibility independent of teacher-only preference', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'visible-card',
          label: '可见知识卡',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/interactive-learning/resources/visible-card',
          knowledgeNodeIds: ['kn-bode'],
        },
      ],
      aiInterventions: [
        {
          id: 'teacher-only-hint',
          title: '教师专用提示',
          renderTarget: '/assessment/adaptive-practice',
          knowledgeNodeIds: ['kn-bode'],
          teacherOnly: true,
        },
      ],
    });
    const { eligible, blocked } = evaluateHardEligibility(registry.nodes, {
      timeBudgetMinutes: 45,
      privacyScopes: ['student-visible', 'teacher-scoped', 'class-shared', 'public'],
      device: 'desktop',
    });
    expect(eligible.some((node) => node.id.includes('visible-card'))).toBe(true);
    expect(eligible.some((node) => node.id.includes('teacher-only-hint'))).toBe(false);
    expect(blocked.some((item) => item.reasonCodes.includes('teacher-policy-teacher-only'))).toBe(true);
  });

  it('fails closed when the control-correction plugin is retired', () => {
    const registry = createPersonalizationPluginRegistry();
    registry.register(createControlCorrectionPersonalizationPlugin('retired'));
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID, registry)).toBeNull();
    expect(getRegisteredAdaptiveLearningPathGoal(CONTROL_CORRECTION_GOAL_ID)).not.toBeNull();
  });

  it('does not introduce RL or keep a src/lib planner import in the generic pipeline', () => {
    for (const file of GENERIC_PIPELINE_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/reinforc(?:e|ment)|q-learning|reward-model/i);
      expect(source, file).not.toContain('@/lib/adaptive-learning-path-planner');
    }
    expect(readFileSync('src/features/personalization/path-planning/application/plan-learning-path.ts', 'utf8'))
      .toContain('evaluateHardEligibility');
    const assembler = readFileSync(
      'src/features/personalization/path-planning/internal/assemble-plan.ts',
      'utf8',
    );
    expect(assembler).not.toMatch(/rawAnswer|officialAnswer|assessmentRawPayload/);
    expect(assembler).toContain('function buildStudentFacingPathExplanation');
  });

  it('migrates production callers onto the Personalization public API', () => {
    for (const file of PRODUCTION_CALLERS) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('@/lib/adaptive-learning-path-planner');
      expect(source, file).not.toContain('@/lib/act-prerequisite-path-planner');
      expect(source, file).toContain('@/features/personalization/path-planning/public-api');
      expect(source, file).not.toContain('assembleAdaptiveLearningPathPlan');
    }
  });
});
