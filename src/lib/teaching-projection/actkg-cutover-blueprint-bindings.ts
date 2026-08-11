/**
 * ACT-authored package semantics used to finish the first ActKG cutover.
 *
 * The Release owns engineering identities.  This module owns only the
 * pedagogical decision that an active course resource practices/covers a
 * selected released identity.  A policy byte digest is part of every author
 * decision input so policy edits cannot silently reuse an old decision.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  createAuthorSemanticDecision,
} from './author-decisions';
import { computeMappingInputDigest } from './mapping';
import type {
  ActiveCourseInventory,
  AuthorSemanticDecision,
  MappingContext,
  MigrationStatusRecord,
} from './migration-contracts';

export const ACTKG_CUTOVER_BLUEPRINT_BINDINGS_CONTRACT =
  'actkg-cutover-blueprint-bindings/v1' as const;

export const DEFAULT_ACTKG_CUTOVER_BLUEPRINT_BINDINGS_PATH =
  'course-content/authoring/knowledge/teaching-projection/actkg-cutover-blueprint-bindings.json';

export interface ActkgCutoverBlueprintBinding {
  packageId: string;
  canonicalIds: string[];
  rationale: string;
}

export interface ActkgCutoverBlueprintBindings {
  contract: typeof ACTKG_CUTOVER_BLUEPRINT_BINDINGS_CONTRACT;
  scopeId: string;
  packages: ActkgCutoverBlueprintBinding[];
}

export interface LoadedActkgCutoverBlueprintBindings {
  path: string;
  digest: string;
  document: ActkgCutoverBlueprintBindings;
}

export class ActkgCutoverBlueprintBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActkgCutoverBlueprintBindingError';
  }
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeDocument(value: unknown): ActkgCutoverBlueprintBindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ActkgCutoverBlueprintBindingError('blueprint binding document must be an object');
  }
  const raw = value as Record<string, unknown>;
  if (raw.contract !== ACTKG_CUTOVER_BLUEPRINT_BINDINGS_CONTRACT) {
    throw new ActkgCutoverBlueprintBindingError('blueprint binding contract is invalid');
  }
  if (typeof raw.scopeId !== 'string' || raw.scopeId.trim().length === 0) {
    throw new ActkgCutoverBlueprintBindingError('blueprint binding scopeId is required');
  }
  if (!Array.isArray(raw.packages)) {
    throw new ActkgCutoverBlueprintBindingError('blueprint binding packages must be an array');
  }
  const packages = raw.packages.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ActkgCutoverBlueprintBindingError(`blueprint binding package ${index} is invalid`);
    }
    const row = item as Record<string, unknown>;
    const packageId = typeof row.packageId === 'string' ? row.packageId.trim() : '';
    const canonicalIds = Array.isArray(row.canonicalIds)
      ? row.canonicalIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    const rationale = typeof row.rationale === 'string' ? row.rationale.trim() : '';
    if (!packageId || canonicalIds.length === 0 || !rationale) {
      throw new ActkgCutoverBlueprintBindingError(`blueprint binding package ${index} is incomplete`);
    }
    return { packageId, canonicalIds: [...new Set(canonicalIds)].sort(), rationale };
  });
  const ids = packages.map((row) => row.packageId);
  if (new Set(ids).size !== ids.length) {
    throw new ActkgCutoverBlueprintBindingError('blueprint binding packageId must be unique');
  }
  return { contract: ACTKG_CUTOVER_BLUEPRINT_BINDINGS_CONTRACT, scopeId: raw.scopeId.trim(), packages };
}

export function loadActkgCutoverBlueprintBindings(input: {
  repoRoot: string;
  relativePath?: string;
}): LoadedActkgCutoverBlueprintBindings {
  const relativePath = input.relativePath ?? DEFAULT_ACTKG_CUTOVER_BLUEPRINT_BINDINGS_PATH;
  const filePath = join(input.repoRoot, relativePath);
  if (!existsSync(filePath)) {
    throw new ActkgCutoverBlueprintBindingError(`blueprint binding file is missing: ${relativePath}`);
  }
  const bytes = readFileSync(filePath);
  return { path: relativePath, digest: sha256(bytes), document: normalizeDocument(JSON.parse(bytes.toString('utf8'))) };
}

/** Reject a policy that is dirty or not present in the captured source revision. */
export function assertBlueprintBindingsMatchRevision(input: {
  repoRoot: string;
  authoringRevision: string;
  relativePath?: string;
}): void {
  const relativePath = input.relativePath ?? DEFAULT_ACTKG_CUTOVER_BLUEPRINT_BINDINGS_PATH;
  const absolutePath = join(input.repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new ActkgCutoverBlueprintBindingError(`blueprint binding file is missing: ${relativePath}`);
  }
  let revisionBytes: Buffer;
  try {
    revisionBytes = execFileSync('git', ['show', `${input.authoringRevision}:${relativePath}`], {
      cwd: input.repoRoot,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as Buffer;
  } catch {
    throw new ActkgCutoverBlueprintBindingError(
      `blueprint binding file is absent from authoringRevision ${input.authoringRevision}`,
    );
  }
  if (sha256(readFileSync(absolutePath)) !== sha256(revisionBytes)) {
    throw new ActkgCutoverBlueprintBindingError(
      `blueprint binding file differs from authoringRevision ${input.authoringRevision}`,
    );
  }
}

function roleFor(record: MigrationStatusRecord): 'COVERS' | 'PRACTICES' {
  return record.resourceType === 'lesson' ? 'COVERS' : 'PRACTICES';
}

/**
 * Turn only unresolved active-course rows into formal AUTHOR_DECISION rows.
 * Existing deterministic mappings and projectionMode=NONE stay untouched.
 */
export function buildActkgCutoverBlueprintAuthorDecisions(input: {
  repoRoot: string;
  inventory: ActiveCourseInventory;
  records: readonly MigrationStatusRecord[];
  mappingContext: MappingContext;
  bindings: LoadedActkgCutoverBlueprintBindings;
}): AuthorSemanticDecision[] {
  const policyByPackage = new Map(
    input.bindings.document.packages.map((binding) => [binding.packageId, binding]),
  );
  const activePackageIds = input.inventory.packages.map((pkg) => pkg.packageId).sort();
  if (policyByPackage.size !== activePackageIds.length || activePackageIds.some((id) => !policyByPackage.has(id))) {
    throw new ActkgCutoverBlueprintBindingError('blueprint policy must cover every active package exactly once');
  }
  const resourceById = new Map(
    input.inventory.packages.flatMap((pkg) => pkg.resources).map((resource) => [resource.resourceId, resource]),
  );
  const decisions: AuthorSemanticDecision[] = [];
  for (const record of input.records) {
    if (record.status !== 'REVIEW_REQUIRED') continue;
    const resource = resourceById.get(record.resourceId);
    const policy = policyByPackage.get(record.packageId);
    if (!resource || !policy) {
      throw new ActkgCutoverBlueprintBindingError(`missing resource or policy for ${record.resourceId}`);
    }
    const unavailable = policy.canonicalIds.filter((id) => !input.mappingContext.authorityCanonicalIds.has(id));
    if (unavailable.length > 0) {
      throw new ActkgCutoverBlueprintBindingError(
        `package ${policy.packageId} binds unavailable Authority endpoint(s): ${unavailable.join(', ')}`,
      );
    }
    const sourcePath = resource.blueprintPath ?? resource.sourcePath;
    decisions.push(createAuthorSemanticDecision({
      resourceId: record.resourceId,
      scopeId: record.scopeId,
      inputDigest: computeMappingInputDigest(
        resource,
        record.candidates,
        input.bindings.digest,
      ),
      kind: 'BIND',
      bindings: policy.canonicalIds.map((canonicalId, index) => ({
        canonicalId,
        role: roleFor(record),
        primary: index === 0,
        rationale: policy.rationale,
        sourcePath,
      })),
      rationale: `${policy.rationale} 教学蓝图：${relative(input.repoRoot, join(input.repoRoot, sourcePath.split('#')[0] ?? sourcePath))}`,
      decidedAt: null,
    }));
  }
  return decisions.sort((a, b) => a.decisionId.localeCompare(b.decisionId));
}
