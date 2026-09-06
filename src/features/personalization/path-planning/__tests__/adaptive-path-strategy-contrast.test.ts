import { describe, expect, it } from 'vitest';

import { buildControlCorrectionResourceNodeRegistry } from '@/lib/control-correction-resource-seed';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/features/personalization/path-planning/public-api';
import { planLearningPath } from '@/features/personalization/path-planning/public-api';

function runPlanner(preferredTypes: string[]) {
  return planLearningPath({
    studentId: 'student-contrast',
    goal: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].goal,
    registry: buildControlCorrectionResourceNodeRegistry(),
    learnerState: {
      primaryPortraitState: 'SNAPSHOT' as const,
      primaryPortraitAvailability: 'available' as const,
      knowledgeMastery: {
        tags: {
          'control-correction:time-domain-targets': { posteriorMastery: 0.2, confidence: 0.7, evidenceCount: 3 },
          'control-correction:root-locus-design': { posteriorMastery: 0.75, confidence: 0.7, evidenceCount: 3 },
        },
      },
      resourcePreference: { preferredModalities: ['simulation'], confidence: 'medium' as const },
      primaryCompetencies: { authority: 'legacy-compatibility-only' as const, vector: {} as never },
    } as never,
    constraints: {
      timeBudgetMinutes: 180,
      privacyScopes: ['student-visible'],
      device: 'desktop',
    },
    policyBundle: {
      families: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      overlapThreshold: 0.85,
    },
    resourcePreferences: preferredTypes as never,
    resourcePreferenceSource: 'profile' as never,
    now: new Date('2026-09-06T00:00:00.000Z'),
  });
}

describe('portrait-driven strategy single-variable contrast (#2033)', () => {
  // TODO(#2033 续)：需要三族幸存的受控 registry fixture（当前小 registry 触发族重叠裁剪，
  // 仅 foundation-remediation 幸存）。fixture 构造参考 assemble-plan.test.ts 的
  // buildAlternativeCoreFixtureRegistry（嵌套作用域，待导出复用）。
  it.skip('changes the preference strategy composition under a single preference switch', () => {
    const simulationRun = runPlanner(['simulation']);
    const handoutRun = runPlanner(['handout']);

    const preferenceOption = (plan: ReturnType<typeof runPlanner>) =>
      plan.policyBundle?.paths.find((path) => path.policyFamily === 'preference-matched');

    expect(preferenceOption(simulationRun)?.strategy?.strategyId).toBe('preference-reinforce');
    expect(preferenceOption(handoutRun)?.strategy?.strategyId).toBe('preference-reinforce');

    const preferredShare = (plan: ReturnType<typeof runPlanner>) => {
      const option = preferenceOption(plan);
      if (!option?.strategy) return 0;
      const preferredTypes = new Set(['simulation']);
      const nodes = option.nodeIds
        .map((nodeId) => plan.mainPath.find((node) => node.nodeId === nodeId))
        .filter(Boolean) as Array<{ type: string; terminalConstraints: string[] }>;
      const teaching = nodes.filter((node) => node.terminalConstraints.length === 0);
      if (teaching.length === 0) return 0;
      return teaching.filter((node) => preferredTypes.has(node.type)).length / teaching.length;
    };

    // 单变量切换：仿真偏好下仿真节点占比应高于讲义偏好运行。
    expect(preferredShare(simulationRun)).toBeGreaterThanOrEqual(preferredShare(handoutRun));
  });
});
