import { describe, expect, it } from 'vitest';

import {
  nextPromptAssessmentSessionVersion,
  selectPromptAssessmentSessionHistory,
} from '@/features/evaluation/prompt-assessment-session-history';

describe('prompt assessment session history', () => {
  it('keeps the latest record and next version within the active evaluation session', () => {
    const history = [
      { sessionId: 'report-student-1', version: 1, label: 'current-v1' },
      { sessionId: 'showcase-extracurricular', version: 8, label: 'showcase-v8' },
      { sessionId: 'report-student-1', version: 2, label: 'current-v2' },
      { sessionId: 'showcase-extracurricular', version: 9, label: 'showcase-v9' },
    ];

    const activeHistory = selectPromptAssessmentSessionHistory(history, 'report-student-1');

    expect(activeHistory.map((record) => record.label)).toEqual(['current-v1', 'current-v2']);
    expect(activeHistory.at(-1)?.version).toBe(2);
    expect(nextPromptAssessmentSessionVersion(history, 'report-student-1')).toBe(3);
  });
});
