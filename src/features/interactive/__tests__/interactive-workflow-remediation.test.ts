import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('interactive workflow remediation guards', () => {
  it('requires subagent-driven page design with review, rework and acceptance records', () => {
    const designSkill = readRepoFile('.codex/skills/interactive-design/SKILL.md');

    expect(designSkill).toContain('主代理首先基于讲义的核心思路和主要内容模块');
    expect(designSkill).toContain('设计子代理');
    expect(designSkill).toContain('逻辑审核子代理');
    expect(designSkill).toContain('整改子代理');
    expect(designSkill).toContain('学生只看这一页互动就能明白');
    expect(designSkill).toContain('interactive-design-acceptance.json');
  });

  it('requires subagent-driven implementation review loops and page-level acceptance files', () => {
    const implementationSkill = readRepoFile('.codex/skills/interactive-lesson-implementation/SKILL.md');

    expect(implementationSkill).toContain('逐个页面发放实现任务');
    expect(implementationSkill).toContain('实现子代理');
    expect(implementationSkill).toContain('学生视角审查子代理');
    expect(implementationSkill).toContain('interactive-implementation-acceptance.json');
    expect(implementationSkill).toContain('忠实反映契约中的内容和逻辑');
  });

  it('teaches review and audit tools to reject stale review state, visible inline AI and static-image downgrades', () => {
    const reviewSkill = readRepoFile('.codex/skills/lesson-content-review/SKILL.md');
    const reviewScript = readRepoFile('course-content/scripts/review_lesson_content.py');

    expect(reviewSkill).toContain('作者态同步');
    expect(reviewSkill).toContain('审查已过期');
    expect(reviewSkill).toContain('页内 AI');
    expect(reviewSkill).toContain('静态图片降级');
    expect(reviewScript).toContain('interactive-design-acceptance.json');
    expect(reviewScript).toContain('interactive-implementation-acceptance.json');
    expect(reviewScript).toContain('inline_ai_visibility');
    expect(reviewScript).toContain('stale_review');
    expect(reviewScript).toContain('static_media_downgrade');
  });
});
