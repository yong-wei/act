import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const source = readFileSync(
  join(repoRoot, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
  'utf8',
);

describe('lesson entry runtime sections', () => {
  it('opens knowledge-node infographics in a larger preview dialog from the entry page', () => {
    expect(source).toContain('setIsInfographPreviewOpen(true)');
    expect(source).toContain('LessonEntryInfographDialog');
    expect(source).toContain('查看大图');
    expect(source).toContain('aria-label={`放大查看${selectedInfographAlt}`}');
  });
});
