import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { applyMicroInterventionMasteryPolicy } from '@/features/assessment/micro-intervention-learning-evidence';

const PRODUCTION_GLOBS = [
  'src/app/api/student/recommendations/route.ts',
  'src/app/api/ai/intervention/check/route.ts',
  'src/app/api/ai/intervention/generate/route.ts',
  'src/app/api/assessment/remediation/interventions/events/route.ts',
  'src/app/api/assessment/remediation/interventions/validation/route.ts',
  'src/lib/konling-agent-runtime.ts',
  'src/lib/konling-intervention-client-payload.ts',
  'src/lib/data-governance/profile-center.ts',
  'src/app/(main)/profile/page.tsx',
  'src/features/ai/companion/ai-companion-panel.tsx',
  'scripts/workers/data-governance-worker.ts',
];

describe('personalization recommendation/intervention production boundary', () => {
  it('has zero production imports of the old recommendation engine and companion intervention strategy', () => {
    for (const file of PRODUCTION_GLOBS) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('@/lib/data-governance/recommendation-engine');
      expect(source, file).not.toContain('@/features/ai/companion/intervention-engine');
    }
  });

  it('keeps student recommendations and intervention check on Personalization public use cases', () => {
    expect(readFileSync('src/app/api/student/recommendations/route.ts', 'utf8')).toContain('recommendLearning');
    expect(readFileSync('src/app/api/ai/intervention/check/route.ts', 'utf8')).toContain('decideIntervention');
    expect(readFileSync('src/lib/konling-agent-runtime.ts', 'utf8')).toContain('decideIntervention');
  });

  it('stages micro-intervention outbox without request-path LearningFact materialization', () => {
    const events = readFileSync('src/app/api/assessment/remediation/interventions/events/route.ts', 'utf8');
    const validation = readFileSync('src/app/api/assessment/remediation/interventions/validation/route.ts', 'utf8');
    const worker = readFileSync('scripts/workers/data-governance-worker.ts', 'utf8');
    expect(events).toContain('stageInterventionEvidenceProjection');
    expect(validation).toContain('stageInterventionEvidenceProjection');
    expect(events).not.toContain('processPendingMicroInterventionEvidenceProjections');
    expect(validation).not.toContain('processPendingMicroInterventionEvidenceProjections');
    expect(events).not.toContain('applyStagedMicroInterventionEvidence');
    expect(validation).not.toContain('applyStagedMicroInterventionEvidence');
    expect(worker).toContain('applyStagedMicroInterventionEvidence');
    expect(worker).not.toContain("from '@/features/assessment/micro-intervention-learning-evidence'");
  });

  it('does not treat browse, hint, or recommendation activity as mastery', () => {
    const mastery = applyMicroInterventionMasteryPolicy([]);
    expect(mastery).toEqual([]);
    expect(readFileSync('src/features/personalization/recommendations/application/recommend-learning.ts', 'utf8'))
      .toContain('grantsMastery: false');
    expect(readFileSync('src/features/personalization/interventions/application/decide-intervention.ts', 'utf8'))
      .toContain('grantsMastery: false');
  });
});
