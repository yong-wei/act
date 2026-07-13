import { describe, expect, it } from 'vitest';

import {
  inspectPortraitV2PrimaryUsage,
  PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER,
} from '@/lib/data-governance/portrait-v2-primary-gate';

describe('portrait v2 primary usage gate', () => {
  it('rejects newly added legacy competency usage without an explicit adapter', () => {
    const issues = inspectPortraitV2PrimaryUsage({
      filePath: 'src/app/api/student/profile/route.ts',
      addedLines: [
        "import type { CompetencyVector } from '@/lib/data-governance/competency-model';",
      ],
      addedLineNumbers: [42],
      source: 'export const route = true;',
    });

    expect(issues).toMatchObject([
      {
        filePath: 'src/app/api/student/profile/route.ts',
        line: 42,
        code: 'legacy-competency-vector',
      },
    ]);
  });

  it('accepts a legacy field when the file declares the compatibility boundary', () => {
    const issues = inspectPortraitV2PrimaryUsage({
      filePath: 'src/lib/data-governance/consumer.ts',
      addedLines: ['const vector = state.primaryCompetencies.vector;'],
      source: `// ${PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER}\nconst vector = state.primaryCompetencies.vector;`,
    });

    expect(issues).toEqual([]);
  });

  it('does not police legacy fixtures or documentation paths', () => {
    expect(inspectPortraitV2PrimaryUsage({
      filePath: 'src/lib/data-governance/__tests__/fixture.test.ts',
      addedLines: ['const vector: CompetencyVector = fixture.competencyVector;'],
    })).toEqual([]);
    expect(inspectPortraitV2PrimaryUsage({
      filePath: 'docs/portrait.md',
      addedLines: ['legacy competencyVector reference'],
    })).toEqual([]);
  });
});
