/**
 * Deterministic Teaching Projection builder (#1267).
 *
 * Authoring → normalized runtime artifacts + manifest + impact report.
 * Byte-stable given identical authoring, Authority identity, and builder version.
 */

import {
  TEACHING_PROJECTION_AUTHORING_CONTRACT,
  TEACHING_PROJECTION_BUILDER_VERSION,
  TEACHING_PROJECTION_MANIFEST_CONTRACT,
  TEACHING_PROJECTION_MODES,
  type TeachingBindingRuntime,
  type TeachingCardIndexEntry,
  type TeachingCoreNodeRuntime,
  type TeachingPrerequisiteRuntime,
  type TeachingProjectionArtifacts,
  type TeachingProjectionAuthoringInput,
  type TeachingProjectionGateFinding,
  type TeachingProjectionImpactRecord,
  type TeachingProjectionImpactReport,
  type TeachingProjectionManifest,
  type TeachingProjectionManifestBody,
  type TeachingProjectionSourceHashes,
  type TeachingResourceRuntime,
} from './contracts';
import { evaluateTeachingProjectionGate } from './gate';
import { isSha256Hex, projectionDigest } from './hash';
import {
  TeachingProjectionIdentityError,
  assertValidResourceId,
  deriveBindingId,
  derivePrerequisiteId,
  deriveResourceId,
  isTeachingProjectionRole,
  normalizeBindingAuthoring,
  projectionIdFromHash,
} from './identity';

export class TeachingProjectionBuildError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeachingProjectionBuildError';
    this.code = code;
  }
}

/**
 * Locale-independent stable sort by key (UTF-16 code-unit / code-point order).
 * Avoids localeCompare so projection digests stay deterministic across locales.
 */
function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function bindingScopeKey(resourceId: string, scopeId: string): string {
  return `${resourceId}\u001f${scopeId}`;
}

function assertProjectionMode(value: unknown, resourceLabel: string): void {
  if (typeof value !== 'string' || !(TEACHING_PROJECTION_MODES as readonly string[]).includes(value)) {
    throw new TeachingProjectionBuildError(
      'schema-invalid',
      `${resourceLabel}: invalid projectionMode ${String(value)}`,
    );
  }
}

function normalizeAuthorityNodes(
  input: TeachingProjectionAuthoringInput,
): TeachingProjectionAuthoringInput['authorityNodes'] {
  const nodes = [...(input.authorityNodes ?? [])];
  return sortBy(nodes, (n) => n.canonicalId).map((node) => ({
    canonicalId: node.canonicalId,
    lifecycleStatus: node.lifecycleStatus,
    successorCanonicalId: node.successorCanonicalId ?? null,
  }));
}

function buildResources(
  input: TeachingProjectionAuthoringInput,
  bindingCounts: Map<string, number>,
): TeachingResourceRuntime[] {
  const seen = new Set<string>();
  const resources: TeachingResourceRuntime[] = [];

  for (const raw of input.resources ?? []) {
    assertProjectionMode(raw.projectionMode, raw.resourceId ?? raw.resourceType);
    let resourceId: string;
    try {
      resourceId = deriveResourceId(raw);
    } catch (error) {
      if (error instanceof TeachingProjectionIdentityError) {
        throw new TeachingProjectionBuildError(error.code, error.message);
      }
      throw error;
    }
    if (seen.has(resourceId)) {
      throw new TeachingProjectionBuildError(
        'duplicate-resource-id',
        `duplicate resource ID ${resourceId}`,
      );
    }
    seen.add(resourceId);

    if (!raw.scopeId || raw.scopeId.trim().length === 0) {
      throw new TeachingProjectionBuildError(
        'schema-invalid',
        `resource ${resourceId} missing scopeId`,
      );
    }

    // Only bindings that share this resource's teaching scope satisfy it.
    const bindingCount = bindingCounts.get(bindingScopeKey(resourceId, raw.scopeId)) ?? 0;
    let bindingStatus: TeachingResourceRuntime['bindingStatus'];
    if (raw.projectionMode === 'NONE') {
      bindingStatus = bindingCount > 0 ? 'BOUND' : 'NONE';
    } else {
      bindingStatus = bindingCount > 0 ? 'BOUND' : 'UNBOUND';
    }

    resources.push({
      resourceId,
      resourceType: raw.resourceType,
      projectionMode: raw.projectionMode,
      scopeId: raw.scopeId,
      title: raw.title ?? null,
      sourcePath: raw.sourcePath ?? null,
      legacyCrosswalkRef: raw.legacyCrosswalkRef ?? null,
      bindingCount,
      bindingStatus,
    });
  }

  return sortBy(resources, (r) => r.resourceId);
}

function buildBindings(
  input: TeachingProjectionAuthoringInput,
): TeachingBindingRuntime[] {
  const seenKeys = new Set<string>();
  const bindings: TeachingBindingRuntime[] = [];

  for (const raw of input.bindings ?? []) {
    if (!isTeachingProjectionRole(raw.role)) {
      throw new TeachingProjectionBuildError(
        'unsupported-role',
        `unsupported binding role: ${String(raw.role)}`,
      );
    }
    try {
      normalizeBindingAuthoring(raw);
      assertValidResourceId(raw.resourceId);
    } catch (error) {
      if (error instanceof TeachingProjectionIdentityError) {
        throw new TeachingProjectionBuildError(error.code, error.message);
      }
      throw error;
    }

    const bindingId = deriveBindingId({
      resourceId: raw.resourceId,
      canonicalId: raw.canonicalId,
      role: raw.role,
      scopeId: raw.scopeId,
    });
    const key = [raw.resourceId, raw.canonicalId, raw.role, raw.scopeId].join('\u001f');
    if (seenKeys.has(key)) {
      throw new TeachingProjectionBuildError(
        'duplicate-binding',
        `duplicate binding identity for ${key.replace(/\u001f/g, ' + ')}`,
      );
    }
    seenKeys.add(key);

    bindings.push({
      bindingId,
      resourceId: raw.resourceId,
      canonicalId: raw.canonicalId,
      role: raw.role,
      scopeId: raw.scopeId,
      sourcePath: raw.sourcePath ?? null,
      primary: raw.primary === true,
      rationale: raw.rationale ?? null,
    });
  }

  return sortBy(bindings, (b) => b.bindingId);
}

function buildPrerequisites(
  input: TeachingProjectionAuthoringInput,
): TeachingPrerequisiteRuntime[] {
  const seen = new Set<string>();
  const rows: TeachingPrerequisiteRuntime[] = [];

  for (const raw of input.prerequisites ?? []) {
    if (raw.strength !== 'REQUIRED' && raw.strength !== 'RECOMMENDED') {
      throw new TeachingProjectionBuildError(
        'schema-invalid',
        `invalid prerequisite strength: ${String(raw.strength)}`,
      );
    }
    const prerequisiteId = raw.prerequisiteId
      ?? derivePrerequisiteId({
        sourceCanonicalId: raw.sourceCanonicalId,
        targetCanonicalId: raw.targetCanonicalId,
        strength: raw.strength,
        scopeId: raw.scopeId,
      });
    if (seen.has(prerequisiteId)) {
      throw new TeachingProjectionBuildError(
        'duplicate-prerequisite',
        `duplicate prerequisite ${prerequisiteId}`,
      );
    }
    seen.add(prerequisiteId);
    rows.push({
      prerequisiteId,
      sourceCanonicalId: raw.sourceCanonicalId,
      targetCanonicalId: raw.targetCanonicalId,
      strength: raw.strength,
      evidenceRef: raw.evidenceRef ?? null,
      rationale: raw.rationale ?? null,
      scopeId: raw.scopeId ?? null,
    });
  }

  return sortBy(rows, (r) => r.prerequisiteId);
}

function buildCoreNodes(
  input: TeachingProjectionAuthoringInput,
): TeachingCoreNodeRuntime[] {
  const seen = new Set<string>();
  const rows: TeachingCoreNodeRuntime[] = [];

  for (const raw of input.coreNodes ?? []) {
    if (seen.has(raw.canonicalId)) {
      throw new TeachingProjectionBuildError(
        'duplicate-core-node',
        `duplicate core-node ${raw.canonicalId}`,
      );
    }
    seen.add(raw.canonicalId);
    if (!['required', 'optional', 'none'].includes(raw.cardPolicy)) {
      throw new TeachingProjectionBuildError(
        'schema-invalid',
        `invalid cardPolicy for core-node ${raw.canonicalId}`,
      );
    }
    rows.push({
      canonicalId: raw.canonicalId,
      pathEligible: raw.pathEligible === true,
      cardPolicy: raw.cardPolicy,
      moduleId: raw.moduleId ?? null,
      scopeId: raw.scopeId,
      rationale: raw.rationale ?? null,
      projectionStatus: 'PROJECTED',
    });
  }

  return sortBy(rows, (r) => r.canonicalId);
}

function buildCardsIndex(
  input: TeachingProjectionAuthoringInput,
): TeachingCardIndexEntry[] {
  const seen = new Set<string>();
  const rows: TeachingCardIndexEntry[] = [];

  for (const raw of input.cards ?? []) {
    if (seen.has(raw.cardId)) {
      throw new TeachingProjectionBuildError(
        'duplicate-card',
        `duplicate card ${raw.cardId}`,
      );
    }
    seen.add(raw.cardId);
    const resourceId = `act:card:${raw.cardId}`;
    rows.push({
      cardId: raw.cardId,
      resourceId,
      canonicalId: raw.canonicalId,
      active: raw.active === true,
      required: raw.required === true,
      sourcePath: raw.sourcePath ?? null,
      title: raw.title ?? null,
    });
  }

  return sortBy(rows, (c) => c.cardId);
}

function computeSourceHashes(input: {
  resources: TeachingResourceRuntime[];
  bindings: TeachingBindingRuntime[];
  prerequisites: TeachingPrerequisiteRuntime[];
  coreNodes: TeachingCoreNodeRuntime[];
  cards: TeachingCardIndexEntry[];
  authorityNodes: ReturnType<typeof normalizeAuthorityNodes>;
  authoringBody: unknown;
  gate: ReturnType<typeof evaluateTeachingProjectionGate>;
}): TeachingProjectionSourceHashes {
  return {
    resources: projectionDigest(input.resources),
    bindings: projectionDigest(input.bindings),
    prerequisites: projectionDigest(input.prerequisites),
    coreNodes: projectionDigest(input.coreNodes),
    cards: projectionDigest(input.cards),
    authorityNodes: projectionDigest(input.authorityNodes ?? []),
    authoringBody: projectionDigest(input.authoringBody),
    // Full gate artifact integrity: tampering gate.json must invalidate projectionHash.
    gate: projectionDigest(input.gate),
  };
}

function buildImpactReport(input: {
  projectionId: string;
  projectionHash: string;
  resources: TeachingResourceRuntime[];
  bindings: TeachingBindingRuntime[];
  prerequisites: TeachingPrerequisiteRuntime[];
  coreNodes: TeachingCoreNodeRuntime[];
  cards: TeachingCardIndexEntry[];
  gate: ReturnType<typeof evaluateTeachingProjectionGate>;
}): TeachingProjectionImpactReport {
  const records: TeachingProjectionImpactRecord[] = [];

  for (const resource of input.resources) {
    if (resource.projectionMode === 'REQUIRED' && resource.bindingStatus === 'UNBOUND') {
      records.push({
        kind: 'resource',
        id: resource.resourceId,
        effect: 'unbound-required',
        detail: 'REQUIRED resource has no binding',
      });
    } else if (resource.projectionMode === 'OPTIONAL' && resource.bindingStatus === 'UNBOUND') {
      records.push({
        kind: 'resource',
        id: resource.resourceId,
        effect: 'unbound-optional',
        detail: 'OPTIONAL resource remains unbound',
      });
    } else {
      records.push({
        kind: 'resource',
        id: resource.resourceId,
        effect: 'included',
        detail: `mode=${resource.projectionMode}; bindings=${resource.bindingCount}`,
      });
    }
  }

  for (const binding of input.bindings) {
    records.push({
      kind: 'binding',
      id: binding.bindingId,
      effect: 'included',
      detail: `${binding.role} ${binding.resourceId} → ${binding.canonicalId}`,
    });
  }

  for (const edge of input.prerequisites) {
    records.push({
      kind: 'prerequisite',
      id: edge.prerequisiteId,
      effect: 'included',
      detail: `${edge.sourceCanonicalId} ⇒ ${edge.targetCanonicalId} (${edge.strength})`,
    });
  }

  for (const core of input.coreNodes) {
    records.push({
      kind: 'core-node',
      id: core.canonicalId,
      effect: 'included',
      detail: `pathEligible=${core.pathEligible}`,
    });
  }

  for (const card of input.cards) {
    records.push({
      kind: 'card',
      id: card.cardId,
      effect: 'included',
      detail: `active=${card.active}; required=${card.required}`,
    });
  }

  for (const canonicalId of input.gate.notProjectedCanonicalIds) {
    records.push({
      kind: 'authority-node',
      id: canonicalId,
      effect: 'not-projected',
      detail: 'Authority node not referenced by ACT projection',
    });
  }

  for (const finding of input.gate.findings) {
    if (finding.severity === 'error') {
      records.push({
        kind: finding.resourceId
          ? 'resource'
          : finding.bindingId
            ? 'binding'
            : finding.prerequisiteId
              ? 'prerequisite'
              : finding.cardId
                ? 'card'
                : 'authority-node',
        id:
          finding.resourceId
          ?? finding.bindingId
          ?? finding.prerequisiteId
          ?? finding.cardId
          ?? finding.canonicalId
          ?? finding.code,
        effect: 'gate-error',
        detail: finding.message,
      });
    }
  }

  const sorted = sortBy(records, (r) => `${r.kind}:${r.id}:${r.effect}`);
  const gateErrorCount = sorted.filter((r) => r.effect === 'gate-error').length;

  return {
    contract: 'act-teaching-projection-impact/v1',
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    records: sorted,
    summary: {
      includedResourceCount: input.resources.length,
      includedBindingCount: input.bindings.length,
      notProjectedAuthorityNodeCount: input.gate.notProjectedCanonicalIds.length,
      gateErrorCount,
    },
  };
}

/**
 * Build a complete deterministic Teaching Projection from authoring input.
 * Does not write files; use store.ts for staged directory materialization.
 */
export function buildTeachingProjection(
  input: TeachingProjectionAuthoringInput,
): TeachingProjectionArtifacts {
  if (!input.scopeId || input.scopeId.trim().length === 0) {
    throw new TeachingProjectionBuildError('schema-invalid', 'scopeId is required');
  }
  if (!input.authoringRevision || input.authoringRevision.trim().length === 0) {
    throw new TeachingProjectionBuildError(
      'schema-invalid',
      'authoringRevision is required',
    );
  }
  if (!input.authorityReleaseId || input.authorityReleaseId.trim().length === 0) {
    throw new TeachingProjectionBuildError(
      'schema-invalid',
      'authorityReleaseId is required',
    );
  }
  if (
    input.authoritySnapshotHash != null
    && input.authoritySnapshotHash !== ''
    && !isSha256Hex(input.authoritySnapshotHash)
  ) {
    throw new TeachingProjectionBuildError(
      'hash-invalid',
      'authoritySnapshotHash must be 64 lowercase hex characters when provided',
    );
  }

  const authorityNodes = normalizeAuthorityNodes(input);
  const bindings = buildBindings(input);
  const bindingCounts = new Map<string, number>();
  for (const binding of bindings) {
    const key = bindingScopeKey(binding.resourceId, binding.scopeId);
    bindingCounts.set(key, (bindingCounts.get(key) ?? 0) + 1);
  }

  const resources = buildResources(input, bindingCounts);
  const prerequisites = buildPrerequisites(input);
  const coreNodes = buildCoreNodes(input);
  const cards = buildCardsIndex(input);

  // Fail closed if bindings reference unknown resources (unless card-only binding targets).
  // Also enforce resource/binding teaching-scope consistency.
  const resourceById = new Map(resources.map((r) => [r.resourceId, r]));
  for (const binding of bindings) {
    const resource = resourceById.get(binding.resourceId);
    if (resource) {
      if (resource.scopeId !== binding.scopeId) {
        throw new TeachingProjectionBuildError(
          'scope-mismatch',
          `binding ${binding.bindingId} scope ${binding.scopeId} does not match resource ${binding.resourceId} scope ${resource.scopeId}`,
        );
      }
    } else {
      // Allow bindings to card resource IDs declared only via cards index.
      const cardMatch = cards.some((c) => c.resourceId === binding.resourceId);
      if (!cardMatch) {
        throw new TeachingProjectionBuildError(
          'unknown-resource',
          `binding ${binding.bindingId} references unknown resource ${binding.resourceId}`,
        );
      }
    }
  }

  const gate = evaluateTeachingProjectionGate({
    resources,
    bindings,
    prerequisites,
    coreNodes,
    cards,
    authorityNodes: authorityNodes ?? [],
  });

  const authoringBody = {
    contract: input.contract ?? TEACHING_PROJECTION_AUTHORING_CONTRACT,
    scopeId: input.scopeId,
    authoringRevision: input.authoringRevision,
    authorityReleaseId: input.authorityReleaseId,
    authorityReleaseSetId: input.authorityReleaseSetId ?? null,
    authoritySnapshotId: input.authoritySnapshotId ?? null,
    authoritySnapshotHash: input.authoritySnapshotHash ?? null,
    resources: sortBy([...(input.resources ?? [])], (r) =>
      r.resourceId ?? `${r.resourceType}:${r.lessonKey ?? ''}:${r.stepId ?? ''}:${r.cardId ?? ''}`),
    bindings: sortBy([...(input.bindings ?? [])], (b) =>
      `${b.resourceId}|${b.canonicalId}|${b.role}|${b.scopeId}`),
    prerequisites: sortBy([...(input.prerequisites ?? [])], (p) =>
      `${p.sourceCanonicalId}|${p.targetCanonicalId}|${p.strength}`),
    coreNodes: sortBy([...(input.coreNodes ?? [])], (c) => c.canonicalId),
    cards: sortBy([...(input.cards ?? [])], (c) => c.cardId),
    authorityNodes,
  };

  const sourceHashes = computeSourceHashes({
    resources,
    bindings,
    prerequisites,
    coreNodes,
    cards,
    authorityNodes,
    authoringBody,
    gate,
  });

  const manifestBody: TeachingProjectionManifestBody = {
    contract: TEACHING_PROJECTION_MANIFEST_CONTRACT,
    builderVersion: TEACHING_PROJECTION_BUILDER_VERSION,
    scopeId: input.scopeId,
    authoringRevision: input.authoringRevision,
    authorityReleaseId: input.authorityReleaseId,
    authorityReleaseSetId: input.authorityReleaseSetId ?? null,
    authoritySnapshotId: input.authoritySnapshotId ?? null,
    authoritySnapshotHash: input.authoritySnapshotHash ?? null,
    sourceHashes,
    resourceCount: resources.length,
    bindingCount: bindings.length,
    prerequisiteCount: prerequisites.length,
    coreNodeCount: coreNodes.length,
    cardCount: cards.length,
    gateStatus: gate.status,
    gatePassed: gate.passed,
  };

  const projectionHash = projectionDigest(manifestBody);
  const projectionId = projectionIdFromHash(projectionHash);

  const manifest: TeachingProjectionManifest = {
    ...manifestBody,
    projectionId,
    projectionHash,
  };

  const impactReport = buildImpactReport({
    projectionId,
    projectionHash,
    resources,
    bindings,
    prerequisites,
    coreNodes,
    cards,
    gate,
  });

  return {
    resources,
    bindings,
    prerequisites,
    coreNodes,
    cardsIndex: {
      contract: 'act-teaching-projection-cards-index/v1',
      cards,
    },
    manifest,
    impactReport,
    gate,
  };
}

/**
 * Force additional gate findings that fail activation (e.g. unresolved rebase
 * REVIEW_REQUIRED items). Re-seals gate/sourceHashes/manifest/impact so
 * verifyTeachingProjectionArtifacts remains consistent.
 *
 * When `extraFindings` is empty and the existing gate already fails, returns
 * the input unchanged. When extra findings exist (or forceFail), always marks
 * gate passed=false and status=REVIEW_REQUIRED.
 */
export function applyTeachingProjectionGateFindings(
  artifacts: TeachingProjectionArtifacts,
  extraFindings: readonly TeachingProjectionGateFinding[],
  options: { forceFail?: boolean } = {},
): TeachingProjectionArtifacts {
  const forceFail = options.forceFail === true || extraFindings.length > 0;
  if (!forceFail) {
    return artifacts;
  }

  const findings = sortBy(
    [...artifacts.gate.findings, ...extraFindings],
    (f) => `${f.severity}:${f.code}:${f.message}:${f.resourceId ?? ''}:${f.bindingId ?? ''}:${f.canonicalId ?? ''}`,
  );

  const gate = {
    ...artifacts.gate,
    status: 'REVIEW_REQUIRED' as const,
    passed: false,
    findings,
  };

  const sourceHashes: TeachingProjectionSourceHashes = {
    ...artifacts.manifest.sourceHashes,
    gate: projectionDigest(gate),
  };

  const manifestBody: TeachingProjectionManifestBody = {
    contract: artifacts.manifest.contract,
    builderVersion: artifacts.manifest.builderVersion,
    scopeId: artifacts.manifest.scopeId,
    authoringRevision: artifacts.manifest.authoringRevision,
    authorityReleaseId: artifacts.manifest.authorityReleaseId,
    authorityReleaseSetId: artifacts.manifest.authorityReleaseSetId,
    authoritySnapshotId: artifacts.manifest.authoritySnapshotId,
    authoritySnapshotHash: artifacts.manifest.authoritySnapshotHash,
    sourceHashes,
    resourceCount: artifacts.manifest.resourceCount,
    bindingCount: artifacts.manifest.bindingCount,
    prerequisiteCount: artifacts.manifest.prerequisiteCount,
    coreNodeCount: artifacts.manifest.coreNodeCount,
    cardCount: artifacts.manifest.cardCount,
    gateStatus: gate.status,
    gatePassed: false,
  };

  const projectionHash = projectionDigest(manifestBody);
  const projectionId = projectionIdFromHash(projectionHash);
  const manifest: TeachingProjectionManifest = {
    ...manifestBody,
    projectionId,
    projectionHash,
  };

  const impactReport = buildImpactReport({
    projectionId,
    projectionHash,
    resources: artifacts.resources,
    bindings: artifacts.bindings,
    prerequisites: artifacts.prerequisites,
    coreNodes: artifacts.coreNodes,
    cards: artifacts.cardsIndex.cards,
    gate,
  });

  return {
    ...artifacts,
    manifest,
    impactReport,
    gate,
  };
}

/**
 * Verify that loaded runtime artifacts match their manifest hashes.
 * Rejects source/projection drift before activation.
 * Gate and impact content are fully integrity-checked (not only projectionHash fields).
 */
export function verifyTeachingProjectionArtifacts(
  artifacts: TeachingProjectionArtifacts,
): void {
  const { manifest } = artifacts;

  const recomputedResources = projectionDigest(artifacts.resources);
  const recomputedBindings = projectionDigest(artifacts.bindings);
  const recomputedPrerequisites = projectionDigest(artifacts.prerequisites);
  const recomputedCoreNodes = projectionDigest(artifacts.coreNodes);
  const recomputedCards = projectionDigest(artifacts.cardsIndex.cards);
  const recomputedGate = projectionDigest(artifacts.gate);

  if (recomputedResources !== manifest.sourceHashes.resources) {
    throw new TeachingProjectionBuildError(
      'source-drift',
      'resources artifact does not match manifest source hash',
    );
  }
  if (recomputedBindings !== manifest.sourceHashes.bindings) {
    throw new TeachingProjectionBuildError(
      'source-drift',
      'bindings artifact does not match manifest source hash',
    );
  }
  if (recomputedPrerequisites !== manifest.sourceHashes.prerequisites) {
    throw new TeachingProjectionBuildError(
      'source-drift',
      'prerequisites artifact does not match manifest source hash',
    );
  }
  if (recomputedCoreNodes !== manifest.sourceHashes.coreNodes) {
    throw new TeachingProjectionBuildError(
      'source-drift',
      'core-nodes artifact does not match manifest source hash',
    );
  }
  if (recomputedCards !== manifest.sourceHashes.cards) {
    throw new TeachingProjectionBuildError(
      'source-drift',
      'cards-index artifact does not match manifest source hash',
    );
  }
  if (
    !manifest.sourceHashes.gate
    || recomputedGate !== manifest.sourceHashes.gate
  ) {
    throw new TeachingProjectionBuildError(
      'source-drift',
      'gate artifact does not match manifest source hash',
    );
  }
  if (
    artifacts.gate.passed !== manifest.gatePassed
    || artifacts.gate.status !== manifest.gateStatus
  ) {
    throw new TeachingProjectionBuildError(
      'gate-manifest-mismatch',
      'gate.json status/passed does not match projection-manifest',
    );
  }

  const body: TeachingProjectionManifestBody = {
    contract: manifest.contract,
    builderVersion: manifest.builderVersion,
    scopeId: manifest.scopeId,
    authoringRevision: manifest.authoringRevision,
    authorityReleaseId: manifest.authorityReleaseId,
    authorityReleaseSetId: manifest.authorityReleaseSetId,
    authoritySnapshotId: manifest.authoritySnapshotId,
    authoritySnapshotHash: manifest.authoritySnapshotHash,
    sourceHashes: manifest.sourceHashes,
    resourceCount: manifest.resourceCount,
    bindingCount: manifest.bindingCount,
    prerequisiteCount: manifest.prerequisiteCount,
    coreNodeCount: manifest.coreNodeCount,
    cardCount: manifest.cardCount,
    gateStatus: manifest.gateStatus,
    gatePassed: manifest.gatePassed,
  };

  const expectedHash = projectionDigest(body);
  if (expectedHash !== manifest.projectionHash) {
    throw new TeachingProjectionBuildError(
      'projection-hash-mismatch',
      'projectionHash does not match recomputed manifest body digest',
    );
  }
  if (projectionIdFromHash(expectedHash) !== manifest.projectionId) {
    throw new TeachingProjectionBuildError(
      'projection-id-mismatch',
      'projectionId does not match projectionHash',
    );
  }
  if (artifacts.impactReport.projectionHash !== manifest.projectionHash) {
    throw new TeachingProjectionBuildError(
      'impact-hash-mismatch',
      'impact-report projectionHash does not match manifest',
    );
  }

  // Full impact-report integrity: recompute from verified artifacts and compare.
  const expectedImpact = buildImpactReport({
    projectionId: manifest.projectionId,
    projectionHash: manifest.projectionHash,
    resources: artifacts.resources,
    bindings: artifacts.bindings,
    prerequisites: artifacts.prerequisites,
    coreNodes: artifacts.coreNodes,
    cards: artifacts.cardsIndex.cards,
    gate: artifacts.gate,
  });
  if (projectionDigest(expectedImpact) !== projectionDigest(artifacts.impactReport)) {
    throw new TeachingProjectionBuildError(
      'impact-content-mismatch',
      'impact-report.json content does not match recomputed impact from artifacts',
    );
  }
}
