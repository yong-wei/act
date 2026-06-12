import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('AddStudentsModal search state', () => {
  it('preserves user search text while the same opened class modal rerenders', () => {
    const source = readFileSync(join(repoRoot, 'src/components/teacher/add-students-modal.tsx'), 'utf8');

    expect(source).toContain('if (!isOpen) return null;');
    expect(source).toContain('function AddStudentsModalContent');
    expect(source).toContain('key={classId}');
    expect(source).not.toContain("setSearchQuery('');");
    expect(source).toContain('activeSearchRequestRef');
    expect(source).toContain('searchAbortRef');
    expect(source).toContain('signal: controller.signal');
    expect(source).toContain("setSearchError('请输入至少2个字符');\n      setSearchResults([]);\n      setIsSearching(false);");
    expect(source).toContain("void fetchStudents('');");
  });
});
