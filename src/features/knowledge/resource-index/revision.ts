import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ResourceRegistryIndexError } from './errors';

const GIT_SHA = /^[a-f0-9]{40}$/i;

function readSha(value: string | undefined): string | null {
  const revision = (value || '').trim();
  return GIT_SHA.test(revision) ? revision.toLowerCase() : null;
}

function readRevisionFile(cwd: string, env: NodeJS.ProcessEnv): string | null {
  const revisionPath = path.resolve(cwd, env.APP_REVISION_FILE || '.app-revision');
  if (!existsSync(revisionPath)) return null;
  return readSha(readFileSync(revisionPath, 'utf8'));
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
  const fromAppRevision = readSha(env.APP_REVISION);
  const fromGitSha = readSha(env.GIT_SHA);
  const fromFile = readRevisionFile(cwd, env);
  const fromGit = readGitRevision(cwd);

  const signals: string[] = [];
  if (fromAppRevision) signals.push(fromAppRevision);
  if (fromGitSha) signals.push(fromGitSha);
  if (fromFile) signals.push(fromFile);
  if (fromGit) signals.push(fromGit.sha);

  if (signals.length === 0) {
    throw new ResourceRegistryIndexError(
      'MISSING_CAPTURE',
      'Live RegistryIndex requires APP_REVISION, GIT_SHA, or a Git HEAD capture.',
    );
  }

  const unique = new Set(signals);
  if (unique.size > 1) {
    throw new ResourceRegistryIndexError(
      'MIXED_CAPTURE',
      'Live RegistryIndex revision signals disagree.',
      {
        APP_REVISION: fromAppRevision,
        GIT_SHA: fromGitSha,
        APP_REVISION_FILE: fromFile,
        gitHead: fromGit?.sha ?? null,
      },
    );
  }

  const sha = signals[0];
  return fromGit?.dirty ? `${sha}-dirty` : sha;
}
