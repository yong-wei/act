import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyMicroInterventionMasteryPolicy } from '@/features/assessment/micro-intervention-learning-evidence';

const REPO_ROOT = process.cwd();

const DELETED_AUTHORITIES = [
  'src/features/adaptive-learning/kaq-quiz-coverage.ts',
  'src/lib/adaptive-learning-path-planner.ts',
  'src/lib/act-prerequisite-path-planner/index.ts',
  'src/lib/data-governance/adaptive-learner-state-service.ts',
  'src/lib/data-governance/recommendation-engine.ts',
  'src/features/ai/companion/intervention-engine.ts',
  'src/features/adaptive/adaptive-learning-center-contracts.ts',
  'src/lib/adaptive-path-comparison.ts',
  'src/lib/adaptive-planning/item-type-terminal-validation.ts',
  'src/lib/adaptive-planning/path-constraint-repair.ts',
  'src/lib/adaptive-planning/resource-ranker.ts',
];

const BANNED_PRODUCTION_NEEDLES = [
  '@/features/adaptive-learning',
  'features/adaptive-learning/kaq-quiz-coverage',
  '@/lib/adaptive-learning-path-planner',
  '@/lib/act-prerequisite-path-planner',
  '@/lib/data-governance/adaptive-learner-state-service',
  '@/lib/data-governance/recommendation-engine',
  '@/features/ai/companion/intervention-engine',
  'WithPersistenceFallback',
  'isAdaptiveAssessmentPersistenceEnabled',
  '@/features/adaptive/',
  '@/lib/adaptive-',
];

const PATH_OWNED_ASSESSMENT_ROUTES = [
  'src/app/api/assessment/next-question/route.ts',
  'src/app/api/assessment/submit-answer/route.ts',
  'src/app/api/assessment/diagnostic/route.ts',
  'src/app/api/assessment/ability-report/[userId]/route.ts',
  'src/app/api/user/profile/route.ts',
];

const GENERIC_PERSONALIZATION_FILES = [
  'src/features/personalization/learner-state/internal.ts',
  'src/features/personalization/learner-state/public-api.ts',
  'src/features/personalization/learner-state/application/read-learner-state.ts',
  'src/features/personalization/path-planning/application/plan-learning-path.ts',
  'src/features/personalization/recommendations/engine.ts',
  'src/features/personalization/interventions/application/decide-intervention.ts',
];

const RETIRED_COURSE_POLICY_IDS = [
  'CONTROL_CORRECTION_COURSE_ID_VALUES',
  'CONTROL_CORRECTION_ARENA_TASK_ID_VALUES',
  'unit-3-6-zero-design-workshop',
  'task-second-order-lead-pid',
];

const PRODUCTION_ROOTS = ['src/app', 'src/features', 'src/lib', 'scripts'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.next', '__tests__', 'evals']);
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mjs|js)$/;
const SOURCE_FILE = /\.(?:ts|tsx|mjs|js)$/;

function walkProductionSources(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) continue;
      walkProductionSources(relative, acc);
      continue;
    }
    if (!SOURCE_FILE.test(entry.name) || TEST_FILE.test(entry.name)) continue;
    acc.push(relative);
  }
  return acc;
}

describe('legacy adaptive entrypoint retirement', () => {
  const productionFiles = PRODUCTION_ROOTS.flatMap((root) => walkProductionSources(root));

  it('deletes retired forwarding and authority files', () => {
    for (const file of DELETED_AUTHORITIES) {
      expect(existsSync(file), file).toBe(false);
    }
    expect(existsSync('src/features/adaptive-learning')).toBe(false);
  });

  it('keeps production, worker and script sources off retired entrypoints', () => {
    expect(productionFiles.length).toBeGreaterThan(100);
    for (const file of productionFiles) {
      const source = readFileSync(join(REPO_ROOT, file), 'utf8');
      for (const needle of BANNED_PRODUCTION_NEEDLES) {
        expect(source, `${file} contains ${needle}`).not.toContain(needle);
      }
    }
  });

  it('keeps path-owned Assessment routes on the public API without a second attempt authority', () => {
    for (const file of PATH_OWNED_ASSESSMENT_ROUTES) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain("from '@/features/assessment/adaptive-engine'");
      expect(source, file).not.toContain("from '@/features/assessment/adaptive-persistence'");
      expect(source, file).not.toContain('readVerifiedPathContext');
      expect(source, file).not.toContain('ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED');
    }
    expect(readFileSync('src/app/api/assessment/next-question/route.ts', 'utf8'))
      .toContain("from '@/features/assessment/public-api'");
    expect(readFileSync('src/app/api/assessment/submit-answer/route.ts', 'utf8'))
      .toContain("from '@/features/assessment/public-api'");
    expect(readFileSync('src/features/assessment/adaptive-persistence.ts', 'utf8'))
      .toContain('RETIRED_ADAPTIVE_ASSESSMENT_PERSISTENCE_FALLBACK');
  });

  it('keeps generic Personalization off a second learner-state, planner or course-policy authority', () => {
    for (const file of GENERIC_PERSONALIZATION_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain("from '@/lib/data-governance/adaptive-learner-state-service'");
      expect(source, file).not.toContain('@/lib/adaptive-learning-path-planner');
      for (const id of RETIRED_COURSE_POLICY_IDS) {
        expect(source, `${file} contains ${id}`).not.toContain(id);
      }
    }
    expect(readFileSync('src/features/personalization/path-planning/public-api.ts', 'utf8'))
      .toContain('planLearningPath');
    expect(readFileSync('src/features/personalization/learner-state/public-api.ts', 'utf8'))
      .toContain('readLearnerState');
  });

  it('keeps recommendation and intervention off a second mastery authority', () => {
    expect(applyMicroInterventionMasteryPolicy([])).toEqual([]);
    expect(readFileSync('src/features/personalization/recommendations/application/recommend-learning.ts', 'utf8'))
      .toContain('grantsMastery: false');
    expect(readFileSync('src/features/personalization/interventions/application/decide-intervention.ts', 'utf8'))
      .toContain('grantsMastery: false');
  });

  it('keeps the qualified EvidenceOutbox worker as the sole async LearningFact materializer', () => {
    const events = readFileSync('src/app/api/assessment/remediation/interventions/events/route.ts', 'utf8');
    const validation = readFileSync('src/app/api/assessment/remediation/interventions/validation/route.ts', 'utf8');
    const worker = readFileSync('scripts/workers/data-governance-worker.ts', 'utf8');
    expect(events).not.toContain('processPendingMicroInterventionEvidenceProjections');
    expect(validation).not.toContain('processPendingMicroInterventionEvidenceProjections');
    expect(events).not.toContain('applyStagedMicroInterventionEvidence');
    expect(validation).not.toContain('applyStagedMicroInterventionEvidence');
    expect(worker).toContain('applyAllStagedMicroInterventionEvidence');
    expect(worker).not.toContain("from '@/features/assessment/micro-intervention-learning-evidence'");
    expect(existsSync('src/features/assessment/micro-intervention-learning-evidence.ts')).toBe(true);
    expect(existsSync('src/features/learning-record/personalization-ports/outbox.ts')).toBe(true);
  });
});
