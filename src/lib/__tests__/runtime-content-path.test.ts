import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('runtime content path resolver', () => {
  it('accepts project-relative runtime paths inside fixed roots', async () => {
    const { resolveRuntimeContentPath, resolveReadableContentPath } = await import('@/lib/runtime-content-path');

    expect(resolveRuntimeContentPath('course-content/runtime/lessons/3-8/lesson.json').projectPath)
      .toBe('course-content/runtime/lessons/3-8/lesson.json');
    expect(resolveRuntimeContentPath('/course-content/runtime/lessons/3-8/3-8-handout.md').runtimePath)
      .toBe('lessons/3-8/3-8-handout.md');
    expect(resolveReadableContentPath('course-content/runtime/knowledge/cards/nodes/传递函数_1_1.md').projectPath)
      .toBe('course-content/runtime/knowledge/cards/nodes/传递函数_1_1.md');
  });

  it('rejects traversal and project-root-relative arbitrary reads before filesystem access', async () => {
    const { resolveRuntimeContentPath, resolveReadableContentPath } = await import('@/lib/runtime-content-path');

    expect(() => resolveRuntimeContentPath('../package.json')).toThrow(/Invalid runtime content path/);
    expect(() => resolveRuntimeContentPath('lessons/3-8/../3-9/lesson.json'))
      .toThrow(/Invalid runtime content path/);
    expect(() => resolveRuntimeContentPath('course-content/runtime/../authoring/shared/lesson-id-map.json'))
      .toThrow(/Invalid runtime content path/);
    expect(() => resolveReadableContentPath('content/demo/example.mdx')).toThrow(/Invalid readable content path/);
    expect(() => resolveReadableContentPath('package.json')).toThrow(/Invalid readable content path/);
    expect(() => resolveReadableContentPath('/course-content/authoring/shared/lesson-id-map.json'))
      .toThrow(/Invalid readable content path/);
  });
});
