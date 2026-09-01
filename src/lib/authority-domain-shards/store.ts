/**
 * Filesystem layout for immutable Authority domain shard sets (#1375).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';

import {
  AUTHORITY_SHARD_CURRENT_CONTRACT,
  DEFAULT_AUTHORITY_DOMAIN_SHARD_RUNTIME_RELATIVE,
  type AuthorityShardCurrentPointer,
  type EngineeringRelationFamily,
} from './contracts';
import { isSha256Hex, shardSha256 } from './hash';

export class AuthorityShardStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthorityShardStoreError';
    this.code = code;
  }
}

export interface AuthorityDomainShardPaths {
  runtimeRoot: string;
  currentPath: string;
  setsDir: string;
}

export interface ShardIo {
  readFile(filePath: string): string;
  exists(filePath: string): boolean;
}

export const defaultShardIo: ShardIo = {
  readFile(filePath) {
    return readFileSync(filePath, 'utf8');
  },
  exists(filePath) {
    return existsSync(filePath);
  },
};

export function createRecordingShardIo(
  inner: ShardIo = defaultShardIo,
): { io: ShardIo; reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    io: {
      readFile(filePath) {
        reads.push(filePath);
        return inner.readFile(filePath);
      },
      exists(filePath) {
        reads.push(`exists:${filePath}`);
        return inner.exists(filePath);
      },
    },
  };
}

export function resolveAuthorityDomainShardPaths(
  repoRoot = process.cwd(),
  options: { runtimeRelative?: string } = {},
): AuthorityDomainShardPaths {
  const runtimeRoot = join(
    repoRoot,
    options.runtimeRelative ?? DEFAULT_AUTHORITY_DOMAIN_SHARD_RUNTIME_RELATIVE,
  );
  return {
    runtimeRoot,
    currentPath: join(runtimeRoot, 'current.json'),
    setsDir: join(/*turbopackIgnore: true*/ runtimeRoot, 'sets'),
  };
}

export function shardSetDir(
  paths: AuthorityDomainShardPaths,
  shardSetId: string,
): string {
  return join(paths.setsDir, shardSetId);
}

export function canonicalIdFileToken(canonicalId: string): string {
  return `node-${shardSha256(canonicalId)}`;
}

export function shardRelativePaths(input: {
  domainId?: RegisteredPeerDomainId;
  family?: EngineeringRelationFamily;
  canonicalId?: string;
}): {
  manifest: 'manifest.json';
  root: 'root.json';
  domainDefault: string | null;
  family: string | null;
  neighborhood: string | null;
  detail: string | null;
} {
  const domainDefault = input.domainId
    ? `domains/${input.domainId}/default.json`
    : null;
  const family = input.domainId && input.family
    ? `domains/${input.domainId}/families/${input.family}.json`
    : null;
  const token = input.canonicalId ? canonicalIdFileToken(input.canonicalId) : null;
  return {
    manifest: 'manifest.json',
    root: 'root.json',
    domainDefault,
    family,
    neighborhood: token ? `neighborhoods/${token}.json` : null,
    detail: token ? `details/${token}.json` : null,
  };
}

export function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readJsonViaIo<T>(io: ShardIo, filePath: string): T {
  try {
    return JSON.parse(io.readFile(filePath)) as T;
  } catch (error) {
    throw new AuthorityShardStoreError(
      'parse-failed',
      error instanceof Error ? error.message : `failed to parse ${filePath}`,
    );
  }
}

export function readCurrentShardPointer(
  paths: AuthorityDomainShardPaths,
  io: ShardIo = defaultShardIo,
): AuthorityShardCurrentPointer {
  if (!io.exists(paths.currentPath)) {
    throw new AuthorityShardStoreError(
      'pointer-absent',
      'authority domain shard current pointer is unavailable',
    );
  }
  const pointer = readJsonViaIo<AuthorityShardCurrentPointer>(io, paths.currentPath);
  if (pointer.contract !== AUTHORITY_SHARD_CURRENT_CONTRACT) {
    throw new AuthorityShardStoreError(
      'pointer-contract-invalid',
      `unsupported shard current pointer contract ${String(pointer.contract)}`,
    );
  }
  if (
    !pointer.shardSetId
    || !isSha256Hex(pointer.shardSetHash)
    || !pointer.snapshotId
    || !pointer.snapshotHash
    || !pointer.releaseId
    || !pointer.catalogId
    || !pointer.catalogHash
  ) {
    throw new AuthorityShardStoreError(
      'pointer-incomplete',
      'authority domain shard current pointer is incomplete',
    );
  }
  return pointer;
}
