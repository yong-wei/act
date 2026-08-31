import { isMixedWorktree, loadGitSourceSnapshot } from '@/lib/architecture-census/identity';

import type { ClosureCapture } from './types';

export function loadClosureCapture(repoRoot: string): ClosureCapture {
  const snapshot = loadGitSourceSnapshot(repoRoot);
  return {
    sourceCommit: snapshot.identity.sourceCommit,
    sourceTree: snapshot.identity.sourceTree,
    dirty: snapshot.dirty,
    mixedWorktree: snapshot.mixedWorktree || isMixedWorktree(repoRoot),
    detachedUnresolved: snapshot.detachedUnresolved,
  };
}

export function captureFromFlags(
  sourceCommit: string,
  sourceTree: string,
  flags: Partial<Pick<ClosureCapture, 'dirty' | 'mixedWorktree' | 'detachedUnresolved'>> = {},
): ClosureCapture {
  return {
    sourceCommit,
    sourceTree,
    dirty: flags.dirty ?? false,
    mixedWorktree: flags.mixedWorktree ?? false,
    detachedUnresolved: flags.detachedUnresolved ?? false,
  };
}
