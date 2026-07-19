#!/usr/bin/env node
import process from 'node:process';
import { buildManifest, canonicalJson } from './manifest';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const root = option('--root') ?? process.cwd();
  const manifest = await buildManifest({
    root,
    mainWorktreeRoot: option('--main-worktree-root'),
    mainWorktreeRevision: option('--main-worktree-revision'),
    registryPath: option('--registry'),
    databaseExportPath: option('--database-export'),
    databaseExportProofPath: option('--database-export-proof'),
    databaseProofPublicKeyPath: option('--database-proof-public-key'),
    databaseProofKeyId: option('--database-proof-key-id'),
    capturedAt: option('--captured-at'),
    anchorReviewAttestationPath: option('--anchor-review-attestation'),
  });
  process.stdout.write(canonicalJson(manifest));
  const readiness = manifest && typeof manifest === 'object' && !Array.isArray(manifest) ? manifest.readiness : false;
  if (readiness !== true && !process.argv.includes('--allow-blocked')) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
