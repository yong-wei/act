#!/usr/bin/env node
import process from 'node:process';
import { exportAggregateDatabase } from './database-export';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const outputPath = option('--output');
  const proofPath = option('--proof');
  if (!databaseUrl?.trim()) throw new Error('DATABASE_URL is required; the exporter does not load credentials or dotenv files');
  if (!outputPath || !proofPath) throw new Error('--output and --proof absolute paths are required');
  const signingPrivateKeyPath = option('--signing-private-key');
  const signingKeyId = option('--signing-key-id');
  if (!signingPrivateKeyPath || !signingKeyId) throw new Error('--signing-private-key and --signing-key-id are required');
  await exportAggregateDatabase({
    root: option('--root') ?? process.cwd(),
    registryPath: option('--registry') ?? 'docs/proposals/course-knowledge-base-governance-source-registry.yaml',
    databaseUrl,
    outputPath,
    proofPath,
    signingPrivateKeyPath,
    signingKeyId,
  });
  process.stdout.write('aggregate database export completed\n');
}

main().catch((error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? ` (${error.code})` : '';
  process.stderr.write(`aggregate database export failed${code}\n`);
  process.exitCode = 1;
});
