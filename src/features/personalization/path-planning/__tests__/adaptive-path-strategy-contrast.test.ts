import { describe, expect, it } from 'vitest';

import {
  buildAlternativeCoreDiversityInput,
  buildPlannerPortrait,
} from '@/features/personalization/path-planning/__tests__/fixtures/alternative-core-fixture';
import { buildGatedCandidateSnapshots } from '@/features/personalization/path-planning/adaptive-path-candidate-batches';
import { planLearningPath } from '@/features/personalization/path-planning/public-api';

const NOW = new Date('2026-05-27T08:00:00.000Z');

function runPlanner(resourcePreferences: string[]) {
  return planLearningPath(buildAlternativeCoreDiversityInput({
    resourcePreferences: resourcePreferences as never,
    resourcePreferenceSource: 'request' as never,
  }));
}

type PlanShape = ReturnType<typeof runPlanner>;

function policyOption(plan: PlanShape, family: string) {
  return plan.policyBundle?.paths.find((path) => path.policyFamily === family);
}

function teachingNodes(plan: PlanShape, family: string) {
  const option = policyOption(plan, family);
  if (!option) return [];
  return (option.planNodes ?? [])
    .filter((node) => node.terminalConstraints.length === 0)
    .map((node) => ({ nodeId: node.nodeId, type: node.type as string }));
}

function preferredShare(plan: PlanShape, family: string, preferredTypes: string[]) {
  const teaching = teachingNodes(plan, family);
  if (teaching.length === 0) return 0;
  return teaching.filter((node) => preferredTypes.includes(node.type)).length / teaching.length;
}

describe('policy bundle three-family survival (#2033 fixture)', () => {
  it('keeps all three starter families alive on the shared alternative-core fixture', () => {
    const plan = runPlanner(['knowledge_card']);
    const families = plan.policyBundle?.paths.map((path) => path.policyFamily) ?? [];
    expect(families).toEqual(expect.arrayContaining([
      'foundation-remediation',
      'simulation-driven',
      'preference-matched',
    ]));
  });
});

describe('portrait-driven strategy single-variable contrast (#2033)', () => {
  it('changes the preference strategy composition under a single preference switch', () => {
    // registry 中唯一 simulation 资源是 terminal 节点（teaching 占比诚实为 0），
    // 单变量切换选用两个可满足 teaching 配额的偏好类型。
    const cardRun = runPlanner(['knowledge_card']);
    const textbookRun = runPlanner(['textbook_section']);

    for (const run of [cardRun, textbookRun]) {
      expect(policyOption(run, 'preference-matched')?.strategy?.strategyId).toBe('preference-reinforce');
    }

    // 单变量切换：偏好族 basis 跟随偏好类型，偏好节点占比随切换同向变化。
    expect(policyOption(cardRun, 'preference-matched')?.strategy?.portraitBasis).toEqual(['knowledge_card']);
    expect(policyOption(textbookRun, 'preference-matched')?.strategy?.portraitBasis).toEqual(['textbook_section']);

    expect(preferredShare(cardRun, 'preference-matched', ['knowledge_card']))
      .toBeGreaterThan(preferredShare(cardRun, 'preference-matched', ['textbook_section']));
    // textbook 资源在 registry 中唯一，配额上限内占比不低于对方偏好即可。
    expect(preferredShare(textbookRun, 'preference-matched', ['textbook_section']))
      .toBeGreaterThanOrEqual(preferredShare(textbookRun, 'preference-matched', ['knowledge_card']));

    // 复审修复回归：可序列化快照必须保留各策略族自己的画像依据，
    // 不得用统一 deficit 列表覆盖偏好/优势族的 basis。
    const cardSnapshots = buildGatedCandidateSnapshots(cardRun, 'contrast-snapshot').candidates;
    const preferenceSnapshot = cardSnapshots
      .find((candidate) => candidate.policyFamily === 'preference-matched');
    expect((preferenceSnapshot?.snapshot as Record<string, unknown>).strategy)
      .toMatchObject({ strategyId: 'preference-reinforce', portraitBasis: ['knowledge_card'] });
  });

  it('keeps the weakness strategy observation anchored on low-mastery knowledge targets', () => {
    const plan = runPlanner([]);
    const strategy = policyOption(plan, 'foundation-remediation')?.strategy;

    expect(strategy?.strategyId).toBe('weakness-repair');
    expect(strategy?.generic).toBe(false);
    // 薄弱依据锚定声明序前两个未达目标（0.3 / 0.25，均低于维护阈值）。
    expect(strategy?.portraitBasis).toEqual([
      'control-correction:time-domain-targets',
      'control-correction:root-locus-design',
    ]);
    // 受控切换：前置目标达标后，薄弱依据不再包含它们。
    const masteredRun = planLearningPath(buildAlternativeCoreDiversityInput({
      learnerState: {
        primaryPortraitState: 'SNAPSHOT' as const,
        primaryPortraitAvailability: 'available',
        primaryPortrait: buildPlannerPortrait(NOW, 'student-1'),
        knowledgeMastery: {
          tags: {
            'control-correction:time-domain-targets': { posteriorMastery: 0.9, confidence: 0.7, evidenceCount: 4 },
            'control-correction:root-locus-design': { posteriorMastery: 0.9, confidence: 0.7, evidenceCount: 4 },
            'control-correction:simulation-validation': { posteriorMastery: 0.2, confidence: 0.6, evidenceCount: 1 },
            'control-correction:arena-transfer': { posteriorMastery: 0.1, confidence: 0.5, evidenceCount: 0 },
          },
        },
        evidence: {
          confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
          sourceCoverage: { LearningFact: 'available', ArenaSubmission: 'partial' },
        },
      },
    }));
    const masteredBasis = policyOption(masteredRun, 'foundation-remediation')?.strategy?.portraitBasis ?? [];
    expect(masteredBasis).not.toContain('control-correction:time-domain-targets');
    expect(masteredBasis).not.toContain('control-correction:root-locus-design');
    expect(strategy?.weaknessResourceCount).toBeGreaterThan(0);
  });

  it('switches the strength strategy observation under a single portrait dimension change', () => {
    const baseline = runPlanner([]);
    const boosted = planLearningPath(buildAlternativeCoreDiversityInput({
      learnerState: {
        primaryPortraitState: 'SNAPSHOT' as const,
        primaryPortraitAvailability: 'available',
        primaryPortrait: buildPlannerPortrait(NOW, 'student-1', {
          simulationValidationEvidence: 0.92,
        }),
        knowledgeMastery: buildAlternativeCoreDiversityInput().learnerState!.knowledgeMastery!,
        evidence: {
          confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
          sourceCoverage: { LearningFact: 'available', ArenaSubmission: 'partial' },
        },
      },
    }));

    const baselineBasis = policyOption(baseline, 'simulation-driven')?.strategy?.portraitBasis ?? [];
    const boostedBasis = policyOption(boosted, 'simulation-driven')?.strategy?.portraitBasis ?? [];

    expect(boostedBasis).toEqual(['simulationValidationEvidence']);
    expect(boostedBasis).not.toEqual(baselineBasis);
    expect(policyOption(boosted, 'simulation-driven')?.strategy?.strategyId).toBe('strength-transfer');
  });

  it('marks strategies generic when no trusted portrait snapshot exists', () => {
    const plan = planLearningPath(buildAlternativeCoreDiversityInput({
      learnerState: {
        primaryPortraitState: 'NO_EVIDENCE' as const,
        primaryPortraitAvailability: 'unavailable',
        knowledgeMastery: buildAlternativeCoreDiversityInput().learnerState!.knowledgeMastery!,
      },
    }));

    for (const family of ['foundation-remediation', 'simulation-driven', 'preference-matched']) {
      expect(policyOption(plan, family)?.strategy?.generic).toBe(true);
    }
  });
});
