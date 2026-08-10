import { execFileSync } from 'node:child_process';

type RunGit = (
  file: string,
  args: string[],
  options: { cwd: string; encoding: 'utf8' },
) => string;

export function assertCleanSourceRevision(
  cwd = process.cwd(),
  runGit: RunGit = execFileSync,
) {
  const status = runGit(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd, encoding: 'utf8' },
  );
  if (status.length > 0) {
    throw new Error('smart-lesson-e2e-source-worktree-dirty');
  }
  const sourceRevision = runGit(
    'git',
    ['rev-parse', 'HEAD'],
    { cwd, encoding: 'utf8' },
  ).trim();
  if (!/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new Error('smart-lesson-e2e-source-revision-invalid');
  }
  return sourceRevision;
}
