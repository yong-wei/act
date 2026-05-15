import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('homepage course design dialog', () => {
  it('opens simulation background details in place instead of navigating to interactive courses', () => {
    const source = readFileSync(join(repoRoot, 'src/app/page.tsx'), 'utf8');

    expect(source).toContain("from '@/components/ui/dialog'");
    expect(source).toContain('showCourseDesignDialog');
    expect(source).toContain('虚拟仿真要求');
    expect(source).toContain('背景知识');
    expect(source).not.toMatch(/<Link\s+href="\/interactive-learning\/courses"[\s\S]*?了解课程设计[\s\S]*?<\/Link>/);
  });
});
