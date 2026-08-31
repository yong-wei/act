import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { CONTROL_ENGINE_BUILD_HASH, CONTROL_ENGINE_EXPORTS, CONTROL_ENGINE_FILE_HASHES } from './identity.generated';
import { ControlEngineFailure } from './envelope';
import {
  GENERATED_PACKAGE_DIR,
  IDENTITY_SCHEMA,
  REQUIRED_GENERATED_FILES,
  WASM_EXPORTS,
} from './types';

export interface GeneratedPackageIdentity {
  readonly schemaVersion: typeof IDENTITY_SCHEMA;
  readonly buildHash: string;
  readonly wasmPack: string;
  readonly rustc: string;
  readonly exports: readonly string[];
  readonly files: Record<string, string>;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function generatedPackageDir(cwd = process.cwd()): string {
  return path.join(cwd, GENERATED_PACKAGE_DIR);
}

export function readGeneratedPackageIdentity(cwd = process.cwd()): GeneratedPackageIdentity {
  const dir = generatedPackageDir(cwd);
  const identityPath = path.join(dir, 'identity.json');
  const hashPath = path.join(dir, '.build-hash');
  const missing = REQUIRED_GENERATED_FILES.filter((file) => !existsSync(path.join(dir, file)));
  if (missing.length > 0) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'partial-generated-package',
      message: `Generated control-engine package is incomplete: ${missing.join(', ')}`,
      retryable: false,
    });
  }

  const parsed = existsSync(identityPath)
    ? JSON.parse(readFileSync(identityPath, 'utf8')) as GeneratedPackageIdentity
    : {
      schemaVersion: IDENTITY_SCHEMA,
      buildHash: CONTROL_ENGINE_BUILD_HASH,
      wasmPack: 'unknown',
      rustc: 'unknown',
      exports: [...CONTROL_ENGINE_EXPORTS],
      files: { ...CONTROL_ENGINE_FILE_HASHES },
    };
  const buildHash = existsSync(hashPath) ? readFileSync(hashPath, 'utf8').trim() : CONTROL_ENGINE_BUILD_HASH;
  if (parsed.schemaVersion !== IDENTITY_SCHEMA) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'identity-schema',
      message: 'Generated control-engine identity schema is not supported.',
      retryable: false,
    });
  }
  if (parsed.buildHash !== buildHash || parsed.buildHash !== CONTROL_ENGINE_BUILD_HASH) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'stale-generated-package',
      message: 'Generated control-engine identity does not match the build hash.',
      retryable: false,
    });
  }
  if (WASM_EXPORTS.some((name) => !parsed.exports.includes(name)) || CONTROL_ENGINE_EXPORTS.some((name) => !parsed.exports.includes(name))) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'missing-export',
      message: 'Generated control-engine export manifest is incomplete.',
      retryable: false,
    });
  }

  for (const file of REQUIRED_GENERATED_FILES) {
    const actual = sha256File(path.join(dir, file));
    const expected = parsed.files[file] ?? CONTROL_ENGINE_FILE_HASHES[file as keyof typeof CONTROL_ENGINE_FILE_HASHES];
    if (!expected || expected === 'pending-build' || actual !== expected) {
      throw new ControlEngineFailure({
        state: 'unavailable',
        category: 'hand-edited-generated-package',
        message: `Generated control-engine file ${file} does not match the sealed identity.`,
        retryable: false,
      });
    }
  }

  return parsed;
}
