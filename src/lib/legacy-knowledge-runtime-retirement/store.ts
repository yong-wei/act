/**
 * Filesystem retirement store: reviewed manifest + optional removal receipt
 * (#1277). Production assembly loads this to apply the retirement gate.
 *
 * Layout (under retirementRoot):
 *   current.json
 *   releases/<retirementId>/
 *     retirement-manifest.json
 *     removal-receipt.json   (optional)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_LEGACY_RETIREMENT_ROOT_RELATIVE,
  LEGACY_RETIREMENT_MANIFEST_CONTRACT,
  LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT,
  LegacyRetirementGateError,
  type RemovalReceipt,
  type RetirementManifest,
} from './contracts';
import { isSha256Hex, retirementDigest } from './hash';

export const LEGACY_RETIREMENT_POINTER_CONTRACT =
  'act-legacy-knowledge-runtime-retirement-current/v1' as const;

export interface RetirementStorePaths {
  root: string;
  currentPointer: string;
  releasesDir: string;
}

export interface RetirementCurrentPointer {
  contract: typeof LEGACY_RETIREMENT_POINTER_CONTRACT;
  retirementId: string;
  manifestDigest: string;
  removalReceiptId: string | null;
  appliedAt: string;
}

export function resolveRetirementStorePaths(
  retirementRoot: string,
): RetirementStorePaths {
  return {
    root: retirementRoot,
    currentPointer: path.join(retirementRoot, 'current.json'),
    releasesDir: path.join(retirementRoot, 'releases'),
  };
}

export function resolveConfiguredRetirementRoot(
  repoRoot = process.cwd(),
): string {
  const fromEnv =
    process.env.ACT_LEGACY_RETIREMENT_ROOT?.trim()
    || process.env.LEGACY_RETIREMENT_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(repoRoot, DEFAULT_LEGACY_RETIREMENT_ROOT_RELATIVE);
}

export function resolveDefaultRetirementStorePaths(
  repoRoot = process.cwd(),
): RetirementStorePaths {
  return resolveRetirementStorePaths(resolveConfiguredRetirementRoot(repoRoot));
}

function releaseDir(paths: RetirementStorePaths, retirementId: string): string {
  return path.join(paths.releasesDir, retirementId);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(tmp, filePath);
}

export function verifyRetirementManifestBytes(
  manifest: RetirementManifest,
): void {
  if (manifest.contract !== LEGACY_RETIREMENT_MANIFEST_CONTRACT) {
    throw new LegacyRetirementGateError(
      'manifest-contract-mismatch',
      'retirement manifest contract mismatch',
    );
  }
  const { manifestDigest: _ignored, ...rest } = manifest;
  const expected = retirementDigest(rest);
  if (expected !== manifest.manifestDigest || !isSha256Hex(manifest.manifestDigest)) {
    throw new LegacyRetirementGateError(
      'manifest-digest-tamper',
      'retirement manifest digest does not match content',
      ['manifest-digest-tamper'],
    );
  }
}

export function verifyRemovalReceiptBytes(receipt: RemovalReceipt): void {
  if (receipt.contract !== LEGACY_RETIREMENT_REMOVAL_RECEIPT_CONTRACT) {
    throw new LegacyRetirementGateError(
      'removal-receipt-contract-mismatch',
      'removal receipt contract mismatch',
    );
  }
  const { receiptDigest: _ignored, ...rest } = receipt;
  const expected = retirementDigest(rest);
  if (expected !== receipt.receiptDigest || !isSha256Hex(receipt.receiptDigest)) {
    throw new LegacyRetirementGateError(
      'removal-receipt-digest-tamper',
      'removal receipt digest does not match content',
      ['removal-receipt-digest-tamper'],
    );
  }
}

/**
 * Persist a reviewed retirement manifest (and optional removal receipt) and
 * atomically point current.json at it. Does not mutate activation pointers.
 */
export function writeRetirementStore(input: {
  paths: RetirementStorePaths;
  manifest: RetirementManifest;
  removalReceipt?: RemovalReceipt | null;
  appliedAt?: string;
}): RetirementCurrentPointer {
  verifyRetirementManifestBytes(input.manifest);
  if (
    input.manifest.status !== 'ready-for-removal'
    && input.manifest.status !== 'removed'
  ) {
    throw new LegacyRetirementGateError(
      'retirement-not-ready',
      'cannot publish blocked retirement manifest to current pointer',
      input.manifest.reasons,
    );
  }
  if (input.removalReceipt) {
    verifyRemovalReceiptBytes(input.removalReceipt);
    if (input.removalReceipt.manifestDigest !== input.manifest.manifestDigest) {
      throw new LegacyRetirementGateError(
        'removal-receipt-manifest-mismatch',
        'removal receipt manifestDigest must match retirement manifest',
      );
    }
  }

  const dir = releaseDir(input.paths, input.manifest.retirementId);
  mkdirSync(dir, { recursive: true });
  writeJsonAtomic(
    path.join(dir, 'retirement-manifest.json'),
    input.manifest,
  );
  if (input.removalReceipt) {
    writeJsonAtomic(
      path.join(dir, 'removal-receipt.json'),
      input.removalReceipt,
    );
  }

  const pointer: RetirementCurrentPointer = {
    contract: LEGACY_RETIREMENT_POINTER_CONTRACT,
    retirementId: input.manifest.retirementId,
    manifestDigest: input.manifest.manifestDigest,
    removalReceiptId: input.removalReceipt?.receiptId ?? null,
    appliedAt: input.appliedAt ?? new Date().toISOString(),
  };
  writeJsonAtomic(input.paths.currentPointer, pointer);
  return pointer;
}

export interface LoadedRetirementStore {
  status: 'available' | 'absent' | 'invalid';
  pointer: RetirementCurrentPointer | null;
  manifest: RetirementManifest | null;
  removalReceipt: RemovalReceipt | null;
  reasons: string[];
}

/**
 * Load current retirement pointer + digest-checked artifacts.
 * Missing pointer → absent (not yet retired). Tamper → invalid (fail closed).
 */
export function loadCurrentRetirementStore(
  paths: RetirementStorePaths,
): LoadedRetirementStore {
  if (!existsSync(paths.currentPointer)) {
    return {
      status: 'absent',
      pointer: null,
      manifest: null,
      removalReceipt: null,
      reasons: ['current-pointer-missing'],
    };
  }

  try {
    const pointer = readJsonFile(paths.currentPointer) as RetirementCurrentPointer;
    if (pointer.contract !== LEGACY_RETIREMENT_POINTER_CONTRACT) {
      return {
        status: 'invalid',
        pointer: null,
        manifest: null,
        removalReceipt: null,
        reasons: ['pointer-contract-mismatch'],
      };
    }
    if (!pointer.retirementId || !isSha256Hex(pointer.manifestDigest)) {
      return {
        status: 'invalid',
        pointer: null,
        manifest: null,
        removalReceipt: null,
        reasons: ['pointer-fields-invalid'],
      };
    }

    const manifestPath = path.join(
      releaseDir(paths, pointer.retirementId),
      'retirement-manifest.json',
    );
    if (!existsSync(manifestPath)) {
      return {
        status: 'invalid',
        pointer,
        manifest: null,
        removalReceipt: null,
        reasons: ['manifest-file-missing'],
      };
    }
    const manifest = readJsonFile(manifestPath) as RetirementManifest;
    verifyRetirementManifestBytes(manifest);
    if (manifest.manifestDigest !== pointer.manifestDigest) {
      return {
        status: 'invalid',
        pointer,
        manifest: null,
        removalReceipt: null,
        reasons: ['pointer-manifest-digest-mismatch'],
      };
    }
    if (manifest.retirementId !== pointer.retirementId) {
      return {
        status: 'invalid',
        pointer,
        manifest: null,
        removalReceipt: null,
        reasons: ['pointer-retirement-id-mismatch'],
      };
    }

    let removalReceipt: RemovalReceipt | null = null;
    const receiptPath = path.join(
      releaseDir(paths, pointer.retirementId),
      'removal-receipt.json',
    );
    if (existsSync(receiptPath)) {
      removalReceipt = readJsonFile(receiptPath) as RemovalReceipt;
      verifyRemovalReceiptBytes(removalReceipt);
      if (removalReceipt.manifestDigest !== manifest.manifestDigest) {
        return {
          status: 'invalid',
          pointer,
          manifest: null,
          removalReceipt: null,
          reasons: ['removal-receipt-manifest-mismatch'],
        };
      }
    }

    return {
      status: 'available',
      pointer,
      manifest,
      removalReceipt,
      reasons: [],
    };
  } catch (error) {
    return {
      status: 'invalid',
      pointer: null,
      manifest: null,
      removalReceipt: null,
      reasons: [
        error instanceof Error ? error.message : 'retirement-store-load-failed',
      ],
    };
  }
}
