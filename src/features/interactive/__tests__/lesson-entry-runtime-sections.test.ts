import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const source = readFileSync(
  join(repoRoot, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
  'utf8',
);

describe('lesson entry runtime sections', () => {
  it('does not render a second infograph figure outside KnowledgeCard on the entry page', () => {
    expect(source).not.toContain('LessonEntryInfographDialog');
    expect(source).not.toContain('selectedInfographSrc');
    expect(source).not.toContain('setIsInfographPreviewOpen');
    expect(source).not.toContain('知识点信息图');
  });

  it('keeps the selected node resources flowing into KnowledgeCard', () => {
    expect(source).toContain('<KnowledgeCard');
    expect(source).toContain('resources={selectedNode.resources}');
    expect(source).toContain("surface: 'lesson_entry'");
  });
});
