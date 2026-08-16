/**
 * Filesystem loader for Authority domain display catalog runtime (#1369).
 *
 * Runtime is the product path of record. Authoring is never a runtime fallback.
 * Loading fails closed on schema errors, hash mismatches, and Authority drift.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import {
  AUTHORITY_DOMAIN_CATALOG_CURRENT_CONTRACT,
  AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT,
  DEFAULT_AUTHORITY_DOMAIN_CATALOG_AUTHORING_RELATIVE,
  DEFAULT_AUTHORITY_DOMAIN_CATALOG_RUNTIME_RELATIVE,
  type AuthorityCatalogBinding,
  type AuthorityDomainCatalogAuthoring,
  type AuthorityDomainCatalogCurrentPointer,
  type AuthorityDomainCatalogRuntime,
  type AuthorityDomainRootPresentation,
  type AuthorityNodeEndpoint,
} from './contracts';
import {
  DomainCatalogBuildError,
  buildAuthorityDomainCatalog,
  verifyAuthorityDomainCatalogRuntime,
} from './builder';
import { catalogCanonicalJson, catalogSha256, isSha256Hex } from './hash';
import {
  assertRootPresentationExcludesAuthorityIdentity,
  buildAuthorityDomainRootPresentation,
} from './runtime';

export class DomainCatalogLoadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainCatalogLoadError';
    this.code = code;
  }
}

export interface AuthorityDomainCatalogPaths {
  authoringRoot: string;
  runtimeRoot: string;
  authoringCatalogPath: string;
  runtimeCatalogPath: string;
  runtimeCurrentPath: string;
}

export function resolveAuthorityDomainCatalogPaths(
  repoRoot = process.cwd(),
  options: {
    authoringRelative?: string;
    runtimeRelative?: string;
  } = {},
): AuthorityDomainCatalogPaths {
  const authoringRoot = join(
    repoRoot,
    options.authoringRelative ?? DEFAULT_AUTHORITY_DOMAIN_CATALOG_AUTHORING_RELATIVE,
  );
  const runtimeRoot = join(
    repoRoot,
    options.runtimeRelative ?? DEFAULT_AUTHORITY_DOMAIN_CATALOG_RUNTIME_RELATIVE,
  );
  return {
    authoringRoot,
    runtimeRoot,
    authoringCatalogPath: join(authoringRoot, 'catalog.json'),
    runtimeCatalogPath: join(runtimeRoot, 'catalog.json'),
    runtimeCurrentPath: join(runtimeRoot, 'current.json'),
  };
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function loadAuthorityDomainCatalogAuthoring(
  paths: AuthorityDomainCatalogPaths,
): AuthorityDomainCatalogAuthoring {
  if (!existsSync(paths.authoringCatalogPath)) {
    throw new DomainCatalogLoadError(
      'authoring-absent',
      `authoring catalog missing at ${paths.authoringCatalogPath}`,
    );
  }
  return readJsonFile<AuthorityDomainCatalogAuthoring>(paths.authoringCatalogPath);
}

/**
 * Stage / publish runtime catalog bytes from authoring.
 * Writes only under the catalog runtime root — never Authority snapshot paths.
 */
export function materializeAuthorityDomainCatalogRuntime(
  paths: AuthorityDomainCatalogPaths,
  authorityNodes: readonly AuthorityNodeEndpoint[],
  options: { activatedAt?: string } = {},
): AuthorityDomainCatalogRuntime {
  const authoring = loadAuthorityDomainCatalogAuthoring(paths);
  if (authoring.reviewStatus !== 'reviewed') {
    throw new DomainCatalogLoadError(
      'authoring-not-reviewed',
      'only reviewed authoring may materialize runtime catalog',
    );
  }
  const runtime = buildAuthorityDomainCatalog(authoring, authorityNodes);
  verifyAuthorityDomainCatalogRuntime(runtime);

  writeJsonFile(paths.runtimeCatalogPath, runtime);
  const pointer: AuthorityDomainCatalogCurrentPointer = {
    contract: AUTHORITY_DOMAIN_CATALOG_CURRENT_CONTRACT,
    catalogId: runtime.catalogId,
    catalogHash: runtime.catalogHash,
    snapshotId: runtime.authorityBinding.snapshotId,
    snapshotHash: runtime.authorityBinding.snapshotHash,
    releaseId: runtime.authorityBinding.releaseId,
    activatedAt: options.activatedAt ?? new Date().toISOString(),
  };
  writeJsonFile(paths.runtimeCurrentPath, pointer);
  return runtime;
}

function assertBindingMatch(
  binding: AuthorityCatalogBinding,
  expected: AuthorityCatalogBinding,
): void {
  if (!expected.snapshotId || !expected.snapshotHash || !expected.releaseId) {
    throw new DomainCatalogLoadError(
      'authority-binding-incomplete',
      'active Authority selection is incomplete',
    );
  }
  if (binding.snapshotId !== expected.snapshotId) {
    throw new DomainCatalogLoadError(
      'snapshot-id-drift',
      'catalog snapshotId does not match active Authority selection',
    );
  }
  if (binding.snapshotHash !== expected.snapshotHash) {
    throw new DomainCatalogLoadError(
      'snapshot-hash-drift',
      'catalog snapshotHash does not match active Authority selection',
    );
  }
  if (binding.releaseId !== expected.releaseId) {
    throw new DomainCatalogLoadError(
      'release-id-drift',
      'catalog releaseId does not match active Authority selection',
    );
  }
}

/**
 * Load the committed runtime catalog and fail closed on any identity drift.
 * Authoring is never consulted as a product fallback.
 */
export function loadAuthorityDomainCatalogRuntime(
  paths: AuthorityDomainCatalogPaths,
  activeBinding: AuthorityCatalogBinding,
): AuthorityDomainCatalogRuntime {
  if (!existsSync(paths.runtimeCatalogPath) || !existsSync(paths.runtimeCurrentPath)) {
    throw new DomainCatalogLoadError(
      'runtime-absent',
      'runtime domain display catalog is unavailable',
    );
  }

  let pointer: AuthorityDomainCatalogCurrentPointer;
  let runtime: AuthorityDomainCatalogRuntime;
  try {
    pointer = readJsonFile<AuthorityDomainCatalogCurrentPointer>(paths.runtimeCurrentPath);
    runtime = readJsonFile<AuthorityDomainCatalogRuntime>(paths.runtimeCatalogPath);
  } catch (error) {
    throw new DomainCatalogLoadError(
      'runtime-parse-failed',
      error instanceof Error ? error.message : 'runtime catalog parse failed',
    );
  }

  if (pointer.contract !== AUTHORITY_DOMAIN_CATALOG_CURRENT_CONTRACT) {
    throw new DomainCatalogLoadError(
      'schema-invalid',
      `unsupported current pointer contract ${String(pointer.contract)}`,
    );
  }
  if (runtime.contract !== AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT) {
    throw new DomainCatalogLoadError(
      'schema-invalid',
      `unsupported runtime contract ${String(runtime.contract)}`,
    );
  }

  if (
    !pointer.snapshotId
    || !pointer.snapshotHash
    || !pointer.releaseId
    || !runtime.authorityBinding.snapshotId
    || !runtime.authorityBinding.snapshotHash
    || !runtime.authorityBinding.releaseId
  ) {
    throw new DomainCatalogLoadError(
      'binding-fields-missing',
      'runtime catalog is missing required Authority binding fields',
    );
  }

  if (
    pointer.catalogId !== runtime.catalogId
    || pointer.catalogHash !== runtime.catalogHash
    || pointer.snapshotId !== runtime.authorityBinding.snapshotId
    || pointer.snapshotHash !== runtime.authorityBinding.snapshotHash
    || pointer.releaseId !== runtime.authorityBinding.releaseId
  ) {
    throw new DomainCatalogLoadError(
      'runtime-pointer-mismatch',
      'runtime current pointer does not match catalog artifact',
    );
  }

  try {
    verifyAuthorityDomainCatalogRuntime(runtime);
  } catch (error) {
    if (error instanceof DomainCatalogBuildError) {
      if (error.code === 'catalog-hash-mismatch') {
        throw new DomainCatalogLoadError('artifact-tamper', error.message);
      }
      throw new DomainCatalogLoadError(error.code, error.message);
    }
    throw error;
  }

  // File-level tamper: bytes must match the declared catalogHash via body verify above.
  // Also reject non-hex hashes early.
  if (!isSha256Hex(runtime.catalogHash) || !isSha256Hex(pointer.catalogHash)) {
    throw new DomainCatalogLoadError('catalog-hash-invalid', 'catalog hash is not valid sha256');
  }

  assertBindingMatch(runtime.authorityBinding, activeBinding);
  return runtime;
}

export function loadAuthorityDomainRootPresentation(
  paths: AuthorityDomainCatalogPaths,
  activeBinding: AuthorityCatalogBinding,
): AuthorityDomainRootPresentation {
  const runtime = loadAuthorityDomainCatalogRuntime(paths, activeBinding);
  const root = buildAuthorityDomainRootPresentation(runtime);
  assertRootPresentationExcludesAuthorityIdentity(root);
  return root;
}

/**
 * Normalized runtime bytes for deterministic rebuild tests.
 */
export function runtimeCatalogNormalizedBytes(runtime: AuthorityDomainCatalogRuntime): string {
  return `${catalogCanonicalJson(runtime)}\n`;
}

export function runtimeCatalogFileHash(paths: AuthorityDomainCatalogPaths): string {
  return catalogSha256(readFileSync(paths.runtimeCatalogPath));
}
