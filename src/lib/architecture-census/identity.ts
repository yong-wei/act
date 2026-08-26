import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isSourcePath } from './classify';
import type { CaptureIdentity, CensusSourceFile, CensusSourceSnapshot } from './types';

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  }).trim();
}

export function readCaptureIdentity(repoRoot: string): CaptureIdentity {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string> };
  return {
    sourceCommit: git(repoRoot, ['rev-parse', 'HEAD']),
    sourceTree: git(repoRoot, ['rev-parse', 'HEAD^{tree}']),
    commitTime: git(repoRoot, ['show', '-s', '--format=%cI', 'HEAD']),
    nodeVersion: process.version,
    npmVersion: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
    typescriptVersion: pkg.devDependencies?.typescript ?? pkg.devDependencies?.['typescript'] ?? 'unknown',
  };
}

export function loadGitSourceSnapshot(repoRoot: string): CensusSourceSnapshot {
  const porcelain = git(repoRoot, ['status', '--porcelain']);
  const identity = readCaptureIdentity(repoRoot);
  const paths = git(repoRoot, ['ls-files', '-z']).split('\0').filter(Boolean);
  const files: CensusSourceFile[] = paths.map((path) => {
    const full = join(repoRoot, path);
    if (!existsSync(full)) {
      return { path, content: '', byteLength: 0 };
    }
    const stat = lstatSync(full);
    const byteLength = stat.isSymbolicLink() ? 0 : stat.size;
    const inspectable = (
      !stat.isSymbolicLink()
      && (
        isSourcePath(path)
        || path === 'package.json'
        || path === 'prisma/schema.prisma'
        || path.startsWith('openspec/')
        || path.startsWith('.github/workflows/')
        || path.endsWith('.yml')
        || path.endsWith('.yaml')
      )
      && byteLength <= 2 * 1024 * 1024
    );
    return {
      path,
      content: inspectable ? readFileSync(full, 'utf8') : '',
      byteLength,
    };
  });
  return {
    identity,
    files,
    dirty: porcelain.length > 0,
    mixedWorktree: isMixedWorktree(repoRoot),
    detachedUnresolved: !/^[a-f0-9]{40}$/u.test(identity.sourceCommit),
  };
}

export function isMixedWorktree(repoRoot: string): boolean {
  const toplevel = resolve(git(repoRoot, ['rev-parse', '--show-toplevel']));
  const root = resolve(repoRoot);
  if (toplevel !== root) return true;
  const workTreeEnv = process.env.GIT_WORK_TREE;
  if (workTreeEnv && resolve(workTreeEnv) !== root) return true;
  return false;
}

export function snapshotFromFiles(
  identity: CaptureIdentity,
  files: readonly CensusSourceFile[],
  flags: Partial<Pick<CensusSourceSnapshot, 'dirty' | 'mixedWorktree' | 'detachedUnresolved'>> = {},
): CensusSourceSnapshot {
  return {
    identity,
    files: [...files].sort((left, right) => left.path.localeCompare(right.path)),
    dirty: flags.dirty ?? false,
    mixedWorktree: flags.mixedWorktree ?? false,
    detachedUnresolved: flags.detachedUnresolved ?? false,
  };
}
