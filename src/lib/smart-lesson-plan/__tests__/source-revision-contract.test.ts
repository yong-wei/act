import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { assertCleanSourceRevision } from '../../../../scripts/tests/smart-lesson-source-revision';

describe('smart lesson real-provider source revision contract', () => {
  it('fails before reading HEAD when tracked or untracked files are present', () => {
    const runGit = vi.fn()
      .mockReturnValueOnce(' M src/example.ts\n?? evidence.json\n');

    expect(() => assertCleanSourceRevision('/repo', runGit))
      .toThrowError('smart-lesson-e2e-source-worktree-dirty');
    expect(runGit).toHaveBeenCalledOnce();
    expect(runGit).toHaveBeenCalledWith(
      'git',
      ['status', '--porcelain', '--untracked-files=all'],
      { cwd: '/repo', encoding: 'utf8' },
    );
  });

  it('returns the committed revision only after an empty full worktree status', () => {
    const revision = 'a'.repeat(40);
    const runGit = vi.fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce(`${revision}\n`);

    expect(assertCleanSourceRevision('/repo', runGit)).toBe(revision);
    expect(runGit).toHaveBeenNthCalledWith(
      2,
      'git',
      ['rev-parse', 'HEAD'],
      { cwd: '/repo', encoding: 'utf8' },
    );
  });

  it('rejects a malformed revision', () => {
    const runGit = vi.fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('not-a-revision\n');

    expect(() => assertCleanSourceRevision('/repo', runGit))
      .toThrowError('smart-lesson-e2e-source-revision-invalid');
  });

  it('reuses the migration-seeded global cumulative portrait fence', () => {
    const runner = readFileSync(
      path.join(process.cwd(), 'scripts/tests/run-smart-lesson-real-e2e.ts'),
      'utf8',
    );
    expect(runner).toContain('cumulativePortraitCutoverFence.upsert({');
    expect(runner).toContain("where: { id: 'global' }");
    expect(runner).toContain('create: {');
    expect(runner).toContain('update: fenceData');
    expect(runner).not.toContain('cumulativePortraitCutoverFence.create({');
  });
});
