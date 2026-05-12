import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('AddStudentsModal search state', () => {
  it('keeps the visible search query aligned with the auto-loaded candidate list', () => {
    const source = readFileSync(join(repoRoot, 'src/components/teacher/add-students-modal.tsx'), 'utf8');

    expect(source).toContain("setSearchQuery('');");
    expect(source).toContain("void fetchStudents('');");
  });
});
