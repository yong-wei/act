import { describe, expect, it } from 'vitest';

import { getAdaptivePracticeGoalOptions as getClientGoalOptions } from '@/lib/adaptive-path-goal-options-client';
import { getAdaptivePracticeGoalOptions as getServerGoalOptions } from '@/lib/adaptive-path-goal-options';

describe('adaptive practice client goal options', () => {
  it('stays aligned with the registered server goal catalogue', () => {
    const clientProjection = getClientGoalOptions().map((goal) => ({
      id: goal.id,
      label: goal.label,
      detail: goal.detail,
      intentType: goal.intentType,
      terminalValidationSummary: goal.terminalValidationSummary,
      hrefs: goal.hrefs,
    }));
    const serverProjection = getServerGoalOptions().map((goal) => ({
      id: goal.id,
      label: goal.label,
      detail: goal.detail,
      intentType: goal.intentType,
      terminalValidationSummary: goal.terminalValidationSummary,
      hrefs: { generation: goal.hrefs.generation },
    }));

    expect(clientProjection).toEqual(serverProjection);
  });
});
