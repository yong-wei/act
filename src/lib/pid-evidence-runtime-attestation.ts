import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { PID_EVIDENCE_BUILD_SOURCE_HASHES } from './pid-evidence-runtime-manifest.generated';

const execFileAsync = promisify(execFile);
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export const PID_EVIDENCE_RUNTIME_PATHS = [
  'src/app/review/pid-turn-calibration-1039/page.tsx',
  'src/app/api/simulation/optimize/route.ts',
  'src/resources/simulations/ai-recommend-panel.tsx',
  'src/resources/simulations/lib/monte-carlo-optimizer.ts',
  'src/lib/control-engine/server.ts',
  'src/resources/simulations/core/seeded-rng.ts',
  'src/resources/simulations/lib/replay-checksum.ts',
  'src/lib/pid-evidence-runtime-attestation.ts',
  'rust/control-engine/src/virtual_simulation_runtime.rs',
  'src/resources/control-system/wasm/control_engine/index.d.ts',
  'src/resources/control-system/wasm/control_engine/index.js',
  'src/resources/control-system/wasm/control_engine/index_bg.wasm',
  'src/resources/control-system/wasm/control_engine/index_bg.wasm.d.ts',
] as const;

async function git(cwd: string, args: string[]) {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}

export function assertPidEvidenceBuildSourceHashes(sourceHashes: Record<string, string>) {
  const buildSourceHashes = PID_EVIDENCE_BUILD_SOURCE_HASHES as Record<string, string>;
  const paths = Object.keys(sourceHashes);
  if (
    paths.length !== Object.keys(buildSourceHashes).length
    || paths.some((relativePath) => sourceHashes[relativePath] !== buildSourceHashes[relativePath])
  ) {
    throw new Error('PID evidence runtime checkout does not match the executing bundle');
  }
}

export async function resolvePidEvidenceRuntimeAttestation(options?: {
  cwd?: string;
  env?: Record<string, string | undefined>;
}) {
  const cwd = path.resolve(/*turbopackIgnore: true*/ options?.cwd ?? process.cwd());
  const env = options?.env ?? process.env;
  const gitRoot = await git(cwd, ['rev-parse', '--show-toplevel']);
  const revision = await git(gitRoot, ['rev-parse', 'HEAD']);
  if (!COMMIT_SHA_PATTERN.test(revision)) {
    throw new Error('PID evidence runtime Git HEAD is not a full commit SHA');
  }
  if (env.APP_REVISION?.trim() !== revision) {
    throw new Error('PID evidence runtime APP_REVISION does not match its own Git HEAD');
  }

  await git(gitRoot, ['ls-files', '--error-unmatch', '--', ...PID_EVIDENCE_RUNTIME_PATHS]);
  const preStatus = await git(gitRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    ...PID_EVIDENCE_RUNTIME_PATHS,
  ]);
  if (preStatus) {
    throw new Error(`PID evidence runtime inputs are dirty:\n${preStatus}`);
  }

  const sourceHashes = Object.fromEntries(await Promise.all(
    PID_EVIDENCE_RUNTIME_PATHS.map(async (relativePath) => {
      const bytes = await readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ gitRoot, relativePath));
      return [relativePath, createHash('sha256').update(bytes).digest('hex')];
    }),
  ));
  assertPidEvidenceBuildSourceHashes(sourceHashes);

  const [postRevision, postStatus] = await Promise.all([
    git(gitRoot, ['rev-parse', 'HEAD']),
    git(gitRoot, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      ...PID_EVIDENCE_RUNTIME_PATHS,
    ]),
  ]);
  if (postRevision !== revision || postStatus) {
    throw new Error('PID evidence runtime inputs drifted during attestation');
  }

  return { revision, sourceHashes };
}
