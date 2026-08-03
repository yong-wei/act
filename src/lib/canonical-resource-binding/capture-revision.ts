import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_COMMIT = /^[a-f0-9]{40}$/u;

export const CANONICAL_RESOURCE_BINDING_CAPTURE_PATHS = [
  'src/lib/resource-registry-metadata.ts',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
  'scripts/db/import-canonical-resource-binding-shadow.ts',
  'src/lib/canonical-resource-binding',
  'src/lib/teacher-resource-node-data.ts',
  'prisma/schema.prisma',
  'prisma/migrations/20260728190000_add_canonical_resource_binding_shadow/migration.sql',
] as const;

type CommandError = Error & {
  code?: number | string;
  stderr?: string;
};

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}

async function isInsideGitWorkTree(cwd: string): Promise<boolean> {
  try {
    const result = await git(cwd, ['rev-parse', '--is-inside-work-tree']);
    if (result === 'true') return true;
    if (result === 'false') return false;
    throw new Error(`unexpected Git work tree response: ${result || '<empty>'}`);
  } catch (error) {
    const commandError = error as CommandError;
    if (commandError.code === 'ENOENT') {
      return false;
    }
    if (
      commandError.code === 128
      && commandError.stderr?.includes('not a git repository')
    ) {
      return false;
    }
    throw new Error('unable to determine canonical resource binding Git checkout state', {
      cause: error,
    });
  }
}

async function readOptionalRevisionFile(revisionPath: string): Promise<string | undefined> {
  return readFile(revisionPath, 'utf8')
    .then((value) => value.trim())
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
}

export async function resolveCanonicalResourceBindingCaptureRevision(options?: {
  cwd?: string;
  env?: Record<string, string | undefined>;
}): Promise<string> {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const env = options?.env ?? process.env;
  const environmentRevision = env.APP_REVISION?.trim() || undefined;

  if (await isInsideGitWorkTree(cwd)) {
    const revisionPath = path.resolve(cwd, env.APP_REVISION_FILE ?? '.app-revision');
    const fileRevision = await readOptionalRevisionFile(revisionPath);
    const gitRoot = await git(cwd, ['rev-parse', '--show-toplevel']);
    const headRevision = await git(gitRoot, ['rev-parse', 'HEAD']);
    if (!GIT_COMMIT.test(headRevision)) {
      throw new Error('Git HEAD is not a 40-character lowercase commit');
    }
    if (environmentRevision && environmentRevision !== headRevision) {
      throw new Error('APP_REVISION does not match Git HEAD');
    }
    if (fileRevision && fileRevision !== headRevision) {
      throw new Error('APP_REVISION_FILE does not match Git HEAD');
    }
    try {
      await git(gitRoot, [
        'ls-files',
        '--error-unmatch',
        '--',
        ...CANONICAL_RESOURCE_BINDING_CAPTURE_PATHS,
      ]);
    } catch (error) {
      throw new Error(
        'canonical resource binding capture inputs must be tracked by Git',
        { cause: error },
      );
    }
    const dirty = await git(gitRoot, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      ...CANONICAL_RESOURCE_BINDING_CAPTURE_PATHS,
    ]);
    if (dirty) {
      throw new Error(`canonical resource binding capture inputs are dirty:\n${dirty}`);
    }
    return headRevision;
  }

  const trustedRevisionPath = path.join(cwd, '.app-revision');
  if (
    env.APP_REVISION_FILE
    && path.resolve(cwd, env.APP_REVISION_FILE) !== trustedRevisionPath
  ) {
    throw new Error('APP_REVISION_FILE must resolve to cwd/.app-revision outside a Git checkout');
  }
  const fileRevision = await readOptionalRevisionFile(trustedRevisionPath);
  if (!fileRevision || !GIT_COMMIT.test(fileRevision)) {
    throw new Error(
      'APP_REVISION_FILE with a 40-character lowercase commit is required outside a Git checkout',
    );
  }
  if (environmentRevision && environmentRevision !== fileRevision) {
    throw new Error('APP_REVISION does not match the immutable image revision file');
  }
  return fileRevision;
}

export async function assertCanonicalResourceBindingCaptureRevisionUnchanged(
  expectedRevision: string,
  options?: {
    cwd?: string;
    env?: Record<string, string | undefined>;
  },
): Promise<void> {
  const currentRevision = await resolveCanonicalResourceBindingCaptureRevision(options);
  if (currentRevision !== expectedRevision) {
    throw new Error(
      `canonical resource binding capture revision changed during inventory construction (${expectedRevision} != ${currentRevision})`,
    );
  }
}
