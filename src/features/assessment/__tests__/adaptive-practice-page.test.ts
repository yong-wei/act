import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('adaptive practice page entry states', () => {
  it('does not leave unauthenticated homepage entry in an empty loading state', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain("import { useSession } from 'next-auth/react';");
    expect(source).toContain("authStatus === 'unauthenticated'");
    expect(source).toContain('请先登录后再进入自适应练习');
    expect(source).toContain('登录后继续');
    expect(source).toContain('/login?callbackUrl=');
  });

  it('shows a retryable question loading fallback instead of only the pending placeholder', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    expect(source).toContain('练习加载未完成');
    expect(source).toContain('重新加载');
    expect(source).toContain('void bootstrapPractice()');
  });

  it('keeps an explicit pathId stable after Konling path updates', () => {
    const source = readRepoFile('src/app/assessment/adaptive-practice/page.tsx');

    const refreshBlock = source.slice(
      source.indexOf('const refreshLatestLearningPathAfterKonling = useCallback'),
      source.indexOf('useEffect(() => {', source.indexOf('const refreshLatestLearningPathAfterKonling = useCallback')),
    );

    expect(refreshBlock).toContain('if (activePathId)');
    expect(refreshBlock).toContain('fetchLearningPathRound(activePathId, activeGoal)');
    expect(refreshBlock).toContain('Keep the explicit URL path stable instead of switching to latest.');
    expect(refreshBlock.indexOf('if (activePathId)')).toBeLessThan(refreshBlock.indexOf('fetchLatestLearningPathRound(activeGoal)'));
    expect(refreshBlock.indexOf('fetchLearningPathRound(activePathId, activeGoal)')).toBeLessThan(refreshBlock.indexOf('fetchLatestLearningPathRound(activeGoal)'));
    expect(refreshBlock).toContain('}, [activeGoal, activePathId, authStatus, isDemoMode]);');
  });
});
