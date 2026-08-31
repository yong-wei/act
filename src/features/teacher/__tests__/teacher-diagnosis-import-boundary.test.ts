import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const productionCallers = [
  'src/features/teacher/teacher-diagnosis-report-history.tsx',
  'src/features/teacher/teacher-diagnosis-report-history-projection.ts',
];

describe('teacher diagnosis report-history import boundary', () => {
  it('does not import App Router modules from production feature callers', () => {
    for (const path of productionCallers) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toContain('@/app/');
      expect(source).not.toContain('diagnosis-reports/route');
      expect(source).toContain('@/features/teacher/diagnosis/public-api');
    }
  });
});
