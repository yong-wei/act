import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

import { characterizeRepository } from './characterize';
import { generateArchitectureClosure } from './generate';
import { loadClosureCapture } from './identity';
import { privacyViolation } from './serialize';
import { CLOSURE_MANIFEST_SCHEMA_VERSION } from './types';
import type { ClosureCapture, ClosureManifest } from './types';

export interface ClosureCommandResult {
  readonly status: string;
  readonly receiptId: string;
  readonly digest: string;
  readonly out?: string;
  readonly failures: readonly string[];
}

export interface ClosureCommandOptions {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly capture?: ClosureCapture;
  readonly competing?: ReturnType<typeof characterizeRepository>;
}

function argument(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

function toRepoPath(cwd: string, value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (isAbsolute(normalized)) return relative(cwd, normalized).replaceAll('\\', '/');
  return normalized;
}

export function runArchitectureClosureCommand(options: ClosureCommandOptions): ClosureCommandResult {
  const manifestPath = argument(options.argv, '--manifest');
  if (!manifestPath) throw new Error('closure-manifest-required');
  const capture = options.capture ?? loadClosureCapture(options.cwd);
  const manifest = JSON.parse(readFileSync(join(options.cwd, toRepoPath(options.cwd, manifestPath)), 'utf8')) as ClosureManifest;
  if (manifest.schemaVersion !== CLOSURE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`invalid-manifest-schema:${String(manifest.schemaVersion)}`);
  }
  const competing = options.competing ?? characterizeRepository(options.cwd);
  const generated = generateArchitectureClosure(capture, manifest, competing);
  const violation = privacyViolation(generated.serialized);
  if (violation) throw new Error(`privacy-violation:${violation}`);
  const outArg = argument(options.argv, '--out');
  if (outArg) {
    const outDir = join(options.cwd, toRepoPath(options.cwd, outArg));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'architecture-closure-receipt.json'), generated.serialized);
    writeFileSync(join(outDir, 'architecture-closure-receipt.sha256'), `${generated.digest}\n`);
  }
  return {
    status: generated.receipt.status,
    receiptId: generated.receipt.receiptId,
    digest: generated.digest,
    out: outArg ? toRepoPath(options.cwd, outArg) : undefined,
    failures: generated.failures.map((item) => item.code).sort(),
  };
}
