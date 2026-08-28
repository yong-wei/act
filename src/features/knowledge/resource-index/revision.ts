import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ResourceRegistryIndexError } from './errors';

const GIT_SHA = /^[a-f0-9]{40}$/i;

function readEnvRevision(env: NodeJS.ProcessEnv): string | null {
  const revision = (env.APP_REVISION || env.GIT_SHA || '').trim();
  return GIT_SHA.test(revision) ? revision.toLowerCase() : null;
}

function readRevisionFile(cwd: string, env: NodeJS.ProcessEnv): string | null {
  const revisionPath = path.resolve(cwd, env.APP_REVISION_FILE || '.app-revision');
  if (!existsSync(revisionPath)) return null;
  const revision = readFileSync(revisionPath, 'utf8').trim();
  return GIT_SHA.test(revision) ? revision.toLowerCase() : null;
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readGitRevision(cwd: string): { sha: string; dirty: boolean } | null {
  try {
    const inside = git(cwd, ['rev-parse', '--is-inside-work-tree']);
    if (inside !== 'true') return null;
    const sha = git(cwd, ['rev-parse', 'HEAD']);
    if (!GIT_SHA.test(sha)) return null;
    const dirty = git(cwd, ['status', '--porcelain']) !== '';
    return { sha: sha.toLowerCase(), dirty };
  } catch {
    return null;
  }
}

export function resolveLiveResourceIndexRevision(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const fromEnv = readEnvRevision(env);
  if (fromEnv) return fromEnv;
  const fromFile = readRevisionFile(cwd, env);
  if (fromFile) return fromFile;
  const fromGit = readGitRevision(cwd);
  if (fromGit) return fromGit.dirty ? `${fromGit.sha}-dirty` : fromGit.sha;
  throw new ResourceRegistryIndexError(
    'MISSING_CAPTURE',
    'Live RegistryIndex requires APP_REVISION, GIT_SHA, or a Git HEAD capture.',
  );
}
