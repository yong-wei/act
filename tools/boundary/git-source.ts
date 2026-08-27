import { execFileSync } from 'node:child_process';

export function gitOutput(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

export function captureSourceIdentity(cwd: string): { sourceRevision: string; sourceTree: string } {
  return {
    sourceRevision: gitOutput(['rev-parse', 'HEAD'], cwd),
    sourceTree: gitOutput(['rev-parse', 'HEAD^{tree}'], cwd),
  };
}

export function listTrackedFiles(cwd: string, path: string): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--', path], { cwd, encoding: 'utf8' });
  return output.split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right));
}

export function worktreeIsClean(cwd: string): boolean {
  return gitOutput(['status', '--porcelain'], cwd) === '';
}
