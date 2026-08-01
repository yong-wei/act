#!/usr/bin/env tsx
/**
 * Issue #1126 — ACT Crosswalk + binding generator / assembler (NOT a reviewer).
 *
 * Modes:
 *   --worklist-only
 *     Generate the Crosswalk semantic worklist only. Groups identical Canonical
 *     profiles by canonicalId. Never writes ACCEPT/AMBIGUOUS/UNSUPPORTED/etc.
 *     Joins inventory structural entries to runtime-resource-projections.jsonl
 *     for exact title/family/source/hash/audit/graph/excerpt evidence.
 *
 *   --assemble-crosswalk-reviews --review-file <path>
 *     Validate separately authored Grok crosswalk decisions and write the
 *     controlled active crosswalk review artifact.
 *
 *   --worklist-bindings
 *     Generate the binding worklist ONLY after a valid assembled Crosswalk
 *     active review exists (and ACCEPT candidates pass structural gates).
 *     Never chooses EXPLAINS/PRACTICES/ASSESSES/REFERENCES.
 *
 *   --assemble-binding-reviews --review-file <path>
 *     Validate separately authored Grok binding decisions and write the
 *     controlled active binding review artifact.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assembleBindingFromReview,
  assembleCrosswalkFromReview,
  boundExcerpt,
  buildCrosswalkDerivedCandidateLookup,
  contentSha256,
  CROSSWALK_WORKLIST_GENERATOR_VERSION,
  finalizeBindingWorklist,
  finalizeCrosswalkWorklist,
  isBindingEligibleCrosswalkCandidate,
  ALLOWED_BINDING_ROLES,
  type ActiveCrosswalkReviewsDocument,
  type BindingReviewDecisionsDocument,
  type BindingWorklistItem,
  type CrosswalkCandidateEvidence,
  type CrosswalkReviewDecisionsDocument,
  type CrosswalkWorklistGroup,
  type CourseCoverageRole,
} from '../../src/lib/aggregate-governance';
import {
  AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
  generateSemanticAlignmentCandidates,
  referenceOpaqueUpstream,
  sha256Canonical,
  selectCanonicalObjectMembership,
  structuralUnitEvidenceKey,
  tripleKey,
  type SemanticUnitEvidenceText,
} from '../../src/lib/aggregate-governance';
import { buildStructuralUnitIndexFromInventory } from '../../src/lib/aggregate-governance/structural-index';
import {
  AGGREGATE_BINDING_REVIEWS_PATH,
  AGGREGATE_BINDING_WORKLIST_PATH,
  AGGREGATE_COVERAGE_ACTIVE_PATH,
  AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH,
  AGGREGATE_CROSSWALK_WORKLIST_PATH,
  loadProjectionNodes,
  RUNTIME_RESOURCE_PROJECTION_ARTIFACT_PATH,
  type ProjectionNodeLike,
} from './aggregate-coverage';
import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  generateCandidatesForCanonicalChanges,
  type CanonicalObjectIndexEntry,
  type ResourceBindingInventory,
} from '../../src/lib/canonical-resource-binding';

const DELTA_DEFAULT =
  'delta-receipt:340280e950af341d3c402c01f783d0ed1735335eb1b1da019002b9bf460214ef';
const RELEASE_SET_ID = 'actkg-authoritative-candidate-v3-r2';
const RELEASE_ID = 'ctr:release:control-theory-engineering-v0.3';
const EXCERPT_LIMIT = 480;
/** Bounded tracked text used for ranking only (not model-generated). */
const RANKING_TEXT_LIMIT = 6000;
const MAX_CANDIDATES_PER_GROUP = 8;
/** Same authority as review-workflow CROSSWALK_WORKLIST_GENERATOR_VERSION. */
const GENERATOR_VERSION = CROSSWALK_WORKLIST_GENERATOR_VERSION;
/** Same authority as production pipeline candidateId resolution. */
const SEMANTIC_GENERATOR_PROMPT_VERSION =
  AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION;

/**
 * Normalize projection source paths onto the Git-tracked course-content tree.
 * Projections sometimes emit `/course-runtime/...` while files live under
 * `course-content/runtime/...`.
 */
function resolveTrackedSourcePath(sourcePathOrUrl: string | null | undefined): string | null {
  if (!sourcePathOrUrl) return null;
  let p = sourcePathOrUrl.trim();
  if (!p || /^https?:\/\//iu.test(p)) return null;
  p = p.replace(/^\//u, '');
  if (p.startsWith('course-runtime/')) {
    p = `course-content/runtime/${p.slice('course-runtime/'.length)}`;
  }
  return p;
}

function graphNodeIdList(graphNodeRefs: unknown, key: 'knowledge' | 'capability'): string[] {
  if (!graphNodeRefs || typeof graphNodeRefs !== 'object') return [];
  const raw = (graphNodeRefs as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'en'));
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i < 0 ? undefined : process.argv[i + 1];
}
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function shaLike(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

async function writeJson(root: string, relative: string, value: unknown): Promise<void> {
  const abs = path.join(root, relative);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

interface ProjectionRow {
  id: string;
  title: string | null;
  family: string | null;
  sourcePathOrUrl: string | null;
  sourceHash: string | null;
  sourceRef: string | null;
  sourceRecord: string | null;
  graphNodeRefs: unknown | null;
  reviewAudit: {
    status?: string | null;
    reviewerId?: string | null;
    reviewBatchId?: string | null;
    reviewedSourceHash?: string | null;
    reviewedVersionRef?: string | null;
  } | null;
}

async function loadRuntimeProjections(root: string): Promise<{
  byId: Map<string, ProjectionRow>;
  artifactHash: string;
  raw: string;
}> {
  const rel = RUNTIME_RESOURCE_PROJECTION_ARTIFACT_PATH;
  const raw = await readFile(path.join(root, rel), 'utf8');
  const artifactHash = contentSha256(raw);
  const byId = new Map<string, ProjectionRow>();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = String(row.id ?? '');
    if (!id) continue;
    byId.set(id, {
      id,
      title: row.title == null ? null : String(row.title),
      family: row.family == null ? null : String(row.family),
      sourcePathOrUrl: row.sourcePathOrUrl == null ? null : String(row.sourcePathOrUrl),
      sourceHash: row.sourceHash == null ? null : String(row.sourceHash).replace(/^sha256:/u, ''),
      sourceRef: row.sourceRef == null ? null : String(row.sourceRef),
      sourceRecord: row.sourceRecord == null ? null : String(row.sourceRecord),
      graphNodeRefs: row.graphNodeRefs ?? null,
      reviewAudit: (row.reviewAudit as ProjectionRow['reviewAudit']) ?? null,
    });
  }
  return { byId, artifactHash, raw };
}

function decodeAtomicProjectionId(atomicResourceId: string | null | undefined): string | null {
  if (!atomicResourceId) return null;
  // runtime_resource_projection:<urlencoded resourceId>:...
  const m = atomicResourceId.match(/^runtime_resource_projection:([^:]+)/u);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * Inventory resource IDs and runtime projection IDs are related but not always equal.
 * Resolve only via exact IDs and known stable renames — never fuzzy text match.
 */
function resolveProjectionRow(
  byId: Map<string, ProjectionRow>,
  input: {
    resourceId: string | null;
    structuralUnitId: string | null;
    atomicResourceId: string | null;
    segmentId: string | null;
  },
): ProjectionRow | undefined {
  const aliases = new Set<string>();
  for (const value of [
    input.resourceId,
    input.structuralUnitId,
    decodeAtomicProjectionId(input.atomicResourceId),
    input.segmentId,
  ]) {
    if (!value) continue;
    aliases.add(value);
    if (value.startsWith('lesson-step:')) {
      aliases.add(value.replace(/^lesson-step:/u, 'runtime-step:'));
    }
    if (value.startsWith('runtime-step:')) {
      aliases.add(value.replace(/^runtime-step:/u, 'lesson-step:'));
    }
    // Inventory sometimes stores the projection family-less segment key.
    if (value.includes(':') && !value.startsWith('runtime-') && !value.startsWith('knowledge-')) {
      aliases.add(`runtime-step:${value}`);
      aliases.add(`runtime-module:${value}`);
    }
  }

  const ordered = [...aliases].sort((a, b) => a.localeCompare(b, 'en'));
  for (const id of ordered) {
    const hit = byId.get(id);
    if (hit) return hit;
  }
  return undefined;
}

function resolveJsonPointer(doc: unknown, pointer: string): unknown {
  if (!pointer || pointer === '' || pointer === '/') return doc;
  const parts = pointer.replace(/^\//u, '').split('/').map((part) => (
    part.replace(/~1/gu, '/').replace(/~0/gu, '~')
  ));
  let cur: unknown = doc;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return null;
      cur = cur[idx];
    } else {
      cur = (cur as Record<string, unknown>)[part];
    }
  }
  return cur;
}

async function loadSourceEvidence(
  root: string,
  projection: ProjectionRow | undefined,
  cache: Map<string, { text: string; hash: string; isJson: boolean; json?: unknown }>,
  rankingTerms: readonly string[] = [],
): Promise<{
  sourcePath: string | null;
  sourceHash: string | null;
  sourceSelector: string | null;
  selectedJsonValue: unknown | null;
  sourceExcerpt: string | null;
  sourceExcerptHash: string | null;
  rankingText: string | null;
}> {
  if (!projection?.sourcePathOrUrl) {
    return {
      sourcePath: null,
      sourceHash: projection?.sourceHash ?? null,
      sourceSelector: projection?.sourceRef ?? null,
      selectedJsonValue: null,
      sourceExcerpt: projection?.title ?? null,
      sourceExcerptHash: projection?.title ? contentSha256(projection.title) : null,
      rankingText: projection?.title ?? null,
    };
  }

  const sourcePath = resolveTrackedSourcePath(projection.sourcePathOrUrl)
    ?? projection.sourcePathOrUrl.replace(/^\//u, '');
  const selector = projection.sourceRef ?? projection.sourceRecord ?? null;
  let cached = cache.get(sourcePath);
  if (!cached) {
    try {
      const abs = path.join(root, sourcePath);
      const text = await readFile(abs, 'utf8');
      const isJson = /\.jsonl?$/iu.test(sourcePath);
      let json: unknown;
      if (isJson && !sourcePath.endsWith('.jsonl')) {
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
      }
      cached = {
        text,
        hash: contentSha256(text),
        isJson: Boolean(json !== undefined),
        json,
      };
      cache.set(sourcePath, cached);
    } catch {
      return {
        sourcePath,
        sourceHash: projection.sourceHash ?? null,
        sourceSelector: selector,
        selectedJsonValue: null,
        sourceExcerpt: projection.title ?? null,
        sourceExcerptHash: projection.title ? contentSha256(projection.title) : null,
        rankingText: projection.title ?? null,
      };
    }
  }

  let selectedJsonValue: unknown | null = null;
  let sourceExcerpt: string | null = null;
  let rankingText: string | null = null;

  if (cached.isJson && cached.json != null && selector) {
    // Prefer JSON-pointer style when selector looks like one; else try shallow key match.
    if (selector.startsWith('/')) {
      selectedJsonValue = resolveJsonPointer(cached.json, selector);
    } else {
      // Common runtime pattern: sourceRef is a logical key; fall back to title + sourceRef.
      selectedJsonValue = {
        sourceRef: selector,
        title: projection.title,
        family: projection.family,
      };
    }
    const serialized = JSON.stringify(selectedJsonValue);
    sourceExcerpt = boundExcerpt(serialized, EXCERPT_LIMIT);
    rankingText = boundExcerpt(
      [projection.title, serialized].filter(Boolean).join('\n'),
      RANKING_TEXT_LIMIT,
    );
  } else {
    // Markdown / text: exact bounded excerpt from tracked file bytes.
    const text = cached.text;
    rankingText = boundExcerpt(
      [projection.title, text].filter(Boolean).join('\n'),
      RANKING_TEXT_LIMIT,
    );
    let anchor = -1;
    // Prefer a window around the strongest ranking term, then selector token.
    for (const term of rankingTerms) {
      if (!term || term.length < 2) continue;
      const idx = text.indexOf(term);
      if (idx >= 0) {
        anchor = idx;
        break;
      }
    }
    if (anchor < 0 && selector) {
      const idx = text.indexOf(selector);
      if (idx >= 0) anchor = idx;
    }
    if (anchor >= 0) {
      const start = Math.max(0, anchor - 80);
      sourceExcerpt = boundExcerpt(text.slice(start, start + EXCERPT_LIMIT), EXCERPT_LIMIT);
    } else {
      sourceExcerpt = boundExcerpt(text, EXCERPT_LIMIT);
    }
  }

  return {
    sourcePath,
    sourceHash: projection.sourceHash ?? cached.hash,
    sourceSelector: selector,
    selectedJsonValue,
    sourceExcerpt,
    sourceExcerptHash: sourceExcerpt ? contentSha256(sourceExcerpt) : null,
    rankingText,
  };
}

function nodeProfile(node: ProjectionNodeLike | undefined) {
  return {
    entityType: node?.entity_type == null && node?.entityType == null
      ? null
      : String(node?.entity_type ?? node?.entityType),
    conceptKind: node?.concept_kind == null && node?.conceptKind == null
      ? null
      : String(node?.concept_kind ?? node?.conceptKind),
    semanticName: node?.semantic_name == null && node?.semanticName == null
      ? null
      : String(node?.semantic_name ?? node?.semanticName),
    displayName: node?.display_name == null && node?.displayName == null
      ? null
      : String(node?.display_name ?? node?.displayName),
    description: node?.description == null ? null : String(node.description),
  };
}

async function loadOptionalCoverageRoles(
  root: string,
): Promise<Map<string, CourseCoverageRole>> {
  const out = new Map<string, CourseCoverageRole>();
  try {
    const raw = JSON.parse(
      await readFile(path.join(root, AGGREGATE_COVERAGE_ACTIVE_PATH), 'utf8'),
    ) as { entries?: Array<{ canonicalId: string; role: string }> };
    for (const entry of raw.entries ?? []) {
      out.set(entry.canonicalId, entry.role as CourseCoverageRole);
    }
  } catch {
    // Active coverage may be pending; generator still emits full worklist.
  }
  return out;
}

async function generateCrosswalkWorklist(input: {
  root: string;
  authoringRevision: string;
  deltaReceiptId: string;
  inventoryRunId: string;
}): Promise<{
  path: string;
  groupCount: number;
  objectTriples: number;
  relationTriples: number;
  inputDigest: string;
  bytes: number;
}> {
  const { root, authoringRevision, deltaReceiptId, inventoryRunId } = input;
  const projectionPath =
    'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.act-projection.json';
  const releasePath =
    'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.release.json';

  const nodesRaw = await loadProjectionNodes(root, projectionPath);
  const byId = new Map(nodesRaw.map((n) => {
    const id = String(n.entity_id ?? n.entityId ?? '');
    return [id, n] as const;
  }).filter(([id]) => id));

  const release = JSON.parse(await readFile(path.join(root, releasePath), 'utf8')) as {
    entries?: Array<{ entity?: string; entity_role?: string }>;
  };
  const membership = selectCanonicalObjectMembership({
    projectionNodes: nodesRaw.map((n) => ({ entityId: String(n.entity_id ?? n.entityId ?? '') })),
    releaseEntries: (release.entries ?? []).map((e) => ({
      entityId: String(e.entity ?? ''),
      entityRole: e.entity_role ?? null,
    })),
  });
  const memberSet = new Set(membership.canonicalIds);
  const coverageRoles = await loadOptionalCoverageRoles(root);
  const projections = await loadRuntimeProjections(root);
  const sourceCache = new Map<string, { text: string; hash: string; isJson: boolean; json?: unknown }>();

  const db = createPrismaClient({ log: ['error'] });
  try {
    const run = await db.resourceBindingInventoryRun.findUnique({ where: { id: inventoryRunId } });
    if (!run) throw new Error(`Inventory run not found: ${inventoryRunId}`);
    const items = await db.resourceBindingInventoryItem.findMany({
      where: { runId: inventoryRunId },
      orderBy: { atomicResourceId: 'asc' },
    });
    const inventory: ResourceBindingInventory = {
      schemaVersion: 'canonical-resource-binding-inventory/v1',
      runId: run.id,
      captureRevision: run.captureRevision,
      capturedAt: run.capturedAt.toISOString(),
      dbWatermark: run.dbWatermark,
      sourceHash: run.sourceHash,
      complete: run.complete,
      cutoverReady: run.cutoverReady,
      authorityState: 'SHADOW',
      summary: {
        itemCount: run.itemCount,
        includedCount: run.includedCount,
        excludedCount: run.excludedCount,
        unresolvedCount: run.unresolvedCount,
      },
      items: items.map((item) => ({
        atomicResourceId: item.atomicResourceId,
        resourceId: item.resourceId,
        structuralUnitId: item.structuralUnitId,
        segmentId: item.segmentId,
        resourceSegmentHash: item.resourceSegmentHash,
        disposition: item.disposition as 'INCLUDED' | 'EXCLUDED' | 'UNRESOLVED',
        reasonCodes: item.reasonCodes as string[],
        sourceObservations: item.sourceObservations as ResourceBindingInventory['items'][number]['sourceObservations'],
        observationDigest: item.observationDigest,
      })),
    };
    // Semantic recall index: INCLUDED + content-bearing knowledge/textbook units.
    const structural = buildStructuralUnitIndexFromInventory({
      inventory,
      mode: 'semantic-recall',
    });
    const entryByUnit = new Map(
      structural.entries.map((entry) => [
        structuralUnitEvidenceKey(entry),
        entry,
      ] as const),
    );

    // Preload tracked source evidence for every structural unit (deterministic).
    const unitEvidenceByKey = new Map<string, SemanticUnitEvidenceText>();
    for (const entry of structural.entries) {
      const key = structuralUnitEvidenceKey(entry);
      const projection = resolveProjectionRow(projections.byId, {
        resourceId: entry.resourceId,
        structuralUnitId: entry.structuralUnitId,
        atomicResourceId: entry.atomicResourceId,
        segmentId: entry.segmentId,
      });
      const sourceEvidence = await loadSourceEvidence(root, projection, sourceCache);
      unitEvidenceByKey.set(key, {
        title: projection?.title ?? null,
        family: projection?.family
          ?? (entry.structuralUnitId.includes(':')
            ? entry.structuralUnitId.split(':')[0]
            : null),
        sourcePath: sourceEvidence.sourcePath,
        sourceText: sourceEvidence.rankingText,
        knowledgeNodeIds: graphNodeIdList(projection?.graphNodeRefs, 'knowledge'),
        capabilityTargetIds: graphNodeIdList(projection?.graphNodeRefs, 'capability'),
      });
    }

    const upstream = await db.actkgUpstreamRagReference.findMany({
      where: { releaseId: RELEASE_ID },
      orderBy: [
        { publishedEntityId: 'asc' },
        { retrievalChunkId: 'asc' },
        { citationTargetId: 'asc' },
      ],
      select: {
        publishedEntityId: true,
        retrievalChunkId: true,
        citationTargetId: true,
      },
    });

    // Group by canonicalId (identical Canonical profile).
    const groups = new Map<string, {
      canonicalId: string;
      profile: ReturnType<typeof nodeProfile>;
      profileDigest: string;
      tripleKeys: string[];
      upstreams: Array<{ publishedEntityId: string; retrievalChunkId: string; citationTargetId: string }>;
      coverageRoleHint: CourseCoverageRole | null;
      coverageExcluded: boolean;
    }>();

    let objectTriples = 0;
    let relationTriples = 0;

    for (const row of upstream) {
      const upstreamRef = referenceOpaqueUpstream(row);
      const key = tripleKey(upstreamRef);
      if (!memberSet.has(row.publishedEntityId)) {
        relationTriples += 1;
        continue;
      }
      objectTriples += 1;
      const node = byId.get(row.publishedEntityId);
      const profile = nodeProfile(node);
      const profileDigest = sha256Canonical(profile);
      const existing = groups.get(row.publishedEntityId);
      if (existing) {
        existing.tripleKeys.push(key);
        existing.upstreams.push(upstreamRef);
      } else {
        const role = coverageRoles.get(row.publishedEntityId) ?? null;
        groups.set(row.publishedEntityId, {
          canonicalId: row.publishedEntityId,
          profile,
          profileDigest,
          tripleKeys: [key],
          upstreams: [upstreamRef],
          coverageRoleHint: role,
          coverageExcluded: role === 'excluded_with_rationale',
        });
      }
    }

    const finalizedGroups: CrosswalkWorklistGroup[] = [];
    for (const group of [...groups.values()].sort((a, b) => (
      a.canonicalId.localeCompare(b.canonicalId, 'en')
    ))) {
      // Use first upstream only for candidateId formula stability; candidates are
      // shared across the group via the same structural units. Candidate IDs still
      // embed one representative upstream for determinism of the generator cache key.
      const representativeUpstream = group.upstreams[0]!;
      const profileText = [
        group.profile.description,
        group.profile.displayName,
        group.profile.semanticName,
      ].filter(Boolean).join(' ');

      const candidates = generateSemanticAlignmentCandidates({
        upstream: representativeUpstream,
        canonicalId: group.canonicalId,
        canonicalProfileDigest: group.profileDigest,
        index: structural.entries,
        generatorPromptVersion: SEMANTIC_GENERATOR_PROMPT_VERSION,
        profileText,
        maxCandidates: MAX_CANDIDATES_PER_GROUP,
        unitEvidenceByKey,
        minScore: 5,
      });

      const annotated: CrosswalkCandidateEvidence[] = [];
      for (let generatorRank = 0; generatorRank < candidates.length; generatorRank += 1) {
        const c = candidates[generatorRank]!;
        const entry = entryByUnit.get(
          structuralUnitEvidenceKey({
            structuralUnitId: c.structuralUnitId,
            structuralUnitVersion: c.structuralUnitVersion,
            structuralUnitHash: c.structuralUnitHash,
          }),
        );
        const resourceId = entry?.resourceId ?? null;
        const projection = resolveProjectionRow(projections.byId, {
          resourceId,
          structuralUnitId: entry?.structuralUnitId ?? c.structuralUnitId,
          atomicResourceId: entry?.atomicResourceId ?? null,
          segmentId: entry?.segmentId ?? null,
        });
        const profileTerms = [
          group.profile.displayName,
          group.profile.semanticName,
          ...(group.profile.description?.match(/[\u4e00-\u9fff]{2,8}/gu) ?? []),
        ].filter((t): t is string => Boolean(t));
        const sourceEvidence = await loadSourceEvidence(
          root,
          projection,
          sourceCache,
          profileTerms,
        );

        annotated.push({
          candidateId: c.candidateId,
          structuralUnitId: c.structuralUnitId,
          structuralUnitVersion: c.structuralUnitVersion,
          structuralUnitHash: c.structuralUnitHash,
          resourceId,
          segmentId: entry?.segmentId ?? null,
          atomicResourceId: entry?.atomicResourceId ?? null,
          resourceSegmentHash: entry?.resourceSegmentHash ?? null,
          inventoryDisposition: entry?.inventoryDisposition ?? 'UNRESOLVED',
          reasonCodes: [...(entry?.reasonCodes ?? [])].sort((a, b) => a.localeCompare(b, 'en')),
          title: projection?.title ?? null,
          family: projection?.family
            ?? unitEvidenceByKey.get(structuralUnitEvidenceKey({
              structuralUnitId: c.structuralUnitId,
              structuralUnitVersion: c.structuralUnitVersion,
              structuralUnitHash: c.structuralUnitHash,
            }))?.family
            ?? null,
          sourcePath: sourceEvidence.sourcePath,
          sourceHash: sourceEvidence.sourceHash,
          sourceSelector: sourceEvidence.sourceSelector,
          selectedJsonValue: sourceEvidence.selectedJsonValue,
          sourceExcerpt: sourceEvidence.sourceExcerpt,
          sourceExcerptHash: sourceEvidence.sourceExcerptHash,
          reviewAuditLocator: projection?.reviewAudit
            ? {
              status: projection.reviewAudit.status ?? null,
              reviewerId: projection.reviewAudit.reviewerId ?? null,
              reviewBatchId: projection.reviewAudit.reviewBatchId ?? null,
              reviewedSourceHash: projection.reviewAudit.reviewedSourceHash ?? null,
              reviewedVersionRef: projection.reviewAudit.reviewedVersionRef ?? null,
            }
            : null,
          graphNodeRefs: projection?.graphNodeRefs ?? null,
          generatorRank,
        });
      }

      finalizedGroups.push({
        groupId: group.canonicalId,
        canonicalId: group.canonicalId,
        profile: group.profile,
        profileDigest: group.profileDigest,
        tripleKeys: group.tripleKeys,
        upstreams: group.upstreams,
        coverageRoleHint: group.coverageRoleHint,
        coverageExcluded: group.coverageExcluded,
        candidates: annotated,
        groupInputDigest: '',
      });
    }

    const worklist = finalizeCrosswalkWorklist({
      schemaVersion: 'act-crosswalk-semantic-worklist/v2',
      generatorVersion: GENERATOR_VERSION,
      deltaReceiptId,
      authoringRevision,
      inventoryRunId,
      releaseSetId: RELEASE_SET_ID,
      releaseId: RELEASE_ID,
      runtimeProjectionArtifactPath: RUNTIME_RESOURCE_PROJECTION_ARTIFACT_PATH,
      runtimeProjectionArtifactHash: projections.artifactHash,
      structuralIndexVersion: structural.version,
      objectTripleCount: objectTriples,
      relationTripleCount: relationTriples,
      groupCount: finalizedGroups.length,
      groups: finalizedGroups,
    });

    const outRel = argValue('--worklist-out') ?? AGGREGATE_CROSSWALK_WORKLIST_PATH;
    await writeJson(root, outRel, worklist);
    return {
      path: outRel,
      groupCount: worklist.groupCount,
      objectTriples,
      relationTriples,
      inputDigest: worklist.inputDigest,
      bytes: Buffer.byteLength(`${JSON.stringify(worklist, null, 2)}\n`, 'utf8'),
    };
  } finally {
    await db.$disconnect();
  }
}

async function assembleCrosswalk(
  root: string,
  reviewFile: string,
  worklistPath: string,
): Promise<{ activePath: string; reviewCount: number }> {
  const worklist = JSON.parse(await readFile(path.join(root, worklistPath), 'utf8'));
  const review = JSON.parse(
    await readFile(path.isAbsolute(reviewFile) ? reviewFile : path.join(root, reviewFile), 'utf8'),
  ) as CrosswalkReviewDecisionsDocument;
  const active = assembleCrosswalkFromReview({ worklist, review });
  await writeJson(root, AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH, active);
  return {
    activePath: AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH,
    reviewCount: active.summary.reviewCount,
  };
}

async function generateBindingWorklist(input: {
  root: string;
  authoringRevision: string;
  deltaReceiptId: string;
  inventoryRunId: string;
}): Promise<{
  path: string;
  itemCount: number;
  inputDigest: string;
  bytes: number;
  bindingEligibleAcceptCount: number;
  bindingSkippedByReason: Record<string, number>;
}> {
  const { root, authoringRevision, deltaReceiptId, inventoryRunId } = input;

  // Binding worklist requires assembled valid Crosswalk reviews.
  const crosswalkActivePath = AGGREGATE_CROSSWALK_SEMANTIC_REVIEWS_PATH;
  let crosswalkActive: ActiveCrosswalkReviewsDocument;
  try {
    crosswalkActive = JSON.parse(
      await readFile(path.join(root, crosswalkActivePath), 'utf8'),
    ) as ActiveCrosswalkReviewsDocument;
  } catch {
    throw new Error(
      `Binding worklist requires assembled Crosswalk reviews at ${crosswalkActivePath}`,
    );
  }
  if (crosswalkActive.schemaVersion !== 'act-crosswalk-semantic-reviews/v1') {
    throw new Error('Binding worklist rejected: crosswalk active schema invalid');
  }
  if (crosswalkActive.deltaReceiptId !== deltaReceiptId) {
    throw new Error('Binding worklist rejected: crosswalk active deltaReceiptId drift');
  }
  if (Object.keys(crosswalkActive.reviews).length === 0) {
    throw new Error('Binding worklist rejected: crosswalk active reviews empty');
  }

  const worklistPath = argValue('--crosswalk-worklist') ?? AGGREGATE_CROSSWALK_WORKLIST_PATH;
  const crosswalkWorklist = JSON.parse(await readFile(path.join(root, worklistPath), 'utf8')) as {
    inputDigest: string;
    groups: Array<{
      groupId: string;
      canonicalId: string;
      upstreams: Array<{
        publishedEntityId: string;
        retrievalChunkId: string;
        citationTargetId: string;
      }>;
      candidates: CrosswalkCandidateEvidence[];
    }>;
  };
  if (crosswalkActive.worklistInputDigest !== crosswalkWorklist.inputDigest) {
    throw new Error(
      'Binding worklist rejected: crosswalk active worklistInputDigest does not match worklist',
    );
  }

  const projectionPath =
    'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.act-projection.json';
  const releasePath =
    'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.release.json';
  const nodesRaw = await loadProjectionNodes(root, projectionPath);
  const byId = new Map(nodesRaw.map((n) => {
    const id = String(n.entity_id ?? n.entityId ?? '');
    return [id, n] as const;
  }).filter(([id]) => id));
  const release = JSON.parse(await readFile(path.join(root, releasePath), 'utf8')) as {
    entries?: Array<{ entity?: string; entity_role?: string }>;
  };
  const membership = selectCanonicalObjectMembership({
    projectionNodes: nodesRaw.map((n) => ({ entityId: String(n.entity_id ?? n.entityId ?? '') })),
    releaseEntries: (release.entries ?? []).map((e) => ({
      entityId: String(e.entity ?? ''),
      entityRole: e.entity_role ?? null,
    })),
  });

  const projections = await loadRuntimeProjections(root);
  const sourceCache = new Map<string, { text: string; hash: string; isJson: boolean; json?: unknown }>();

  // Full derived-id index: representative worklist IDs + per-upstream production IDs.
  const candidateById = buildCrosswalkDerivedCandidateLookup(crosswalkWorklist.groups);

  // Binding uses #1124 effective resources only: ACCEPT + complete tuple + INCLUDED.
  // EXCLUDED/audit-only and UNRESOLVED Crosswalk evidence is never promoted silently.
  const validatedPairs: Array<{
    canonicalId: string;
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    atomicResourceId: string;
    candidate: CrosswalkCandidateEvidence;
  }> = [];
  const bindingSkipReasons: Record<string, number> = {};

  for (const [key, review] of Object.entries(crosswalkActive.reviews)) {
    if (review.outcome !== 'ACCEPT' || !review.candidateId) continue;
    const candidate = candidateById.get(review.candidateId);
    if (!candidate) {
      throw new Error(
        `Binding worklist rejected: ACCEPT candidate ${review.candidateId} missing from worklist (key=${key})`,
      );
    }
    const eligibility = isBindingEligibleCrosswalkCandidate(candidate);
    if (!eligibility.eligible) {
      bindingSkipReasons[eligibility.reason] = (bindingSkipReasons[eligibility.reason] ?? 0) + 1;
      continue;
    }
    const publishedEntityId = key.split('\u001f')[0]!;
    validatedPairs.push({
      canonicalId: publishedEntityId,
      resourceId: candidate.resourceId!,
      structuralUnitId: candidate.structuralUnitId,
      segmentId: candidate.segmentId!,
      resourceSegmentHash: candidate.resourceSegmentHash!,
      atomicResourceId: candidate.atomicResourceId!,
      candidate,
    });
  }

  const resourceIndex = validatedPairs.map((pair) => ({
    resourceId: pair.resourceId,
    structuralUnitId: pair.structuralUnitId,
    segmentId: pair.segmentId,
    resourceSegmentHash: pair.resourceSegmentHash,
    candidateCanonicalIds: [pair.canonicalId],
    deterministicRole: null as null,
    evidenceIds: [pair.atomicResourceId],
  }));

  // Collapse duplicate resource rows with multi-canonical sets.
  const collapsed = new Map<string, typeof resourceIndex[number]>();
  for (const row of resourceIndex) {
    const k = `${row.resourceId}\u001f${row.structuralUnitId}\u001f${row.segmentId}`;
    const existing = collapsed.get(k);
    if (existing) {
      existing.candidateCanonicalIds = [...new Set([
        ...existing.candidateCanonicalIds,
        ...row.candidateCanonicalIds,
      ])].sort();
    } else {
      collapsed.set(k, { ...row, candidateCanonicalIds: [...row.candidateCanonicalIds] });
    }
  }

  const db = createPrismaClient({ log: ['error'] });
  try {
    const dbNodes = await db.actkgProjectionNode.findMany({
      where: { releaseId: RELEASE_ID },
      select: { entityId: true, entityType: true, payload: true },
    });
    const dbById = new Map(dbNodes.map((n) => [n.entityId, n]));
    const canonicalIndex: CanonicalObjectIndexEntry[] = membership.canonicalIds.map((id) => {
      const dbNode = dbById.get(id);
      return {
        releaseSetId: RELEASE_SET_ID,
        releaseId: RELEASE_ID,
        canonicalId: id,
        objectRevision: shaLike(dbNode?.payload ?? byId.get(id) ?? null),
        canonicalType: String(
          dbNode?.entityType
          ?? byId.get(id)?.entity_type
          ?? byId.get(id)?.entityType
          ?? 'DomainConcept',
        ),
      };
    });

    const acceptedCanonicalIds = new Set(validatedPairs.map((p) => p.canonicalId));
    const generated = generateCandidatesForCanonicalChanges({
      changedObjects: canonicalIndex.filter((c) => acceptedCanonicalIds.has(c.canonicalId)),
      resourceIndex: [...collapsed.values()],
      generatorPromptVersion: 'aggregate-binding/v1',
    });

    const bindingItems: BindingWorklistItem[] = [];
    for (const candidate of generated.candidates) {
      const node = byId.get(candidate.canonicalId);
      const profile = nodeProfile(node);
      const projection = projections.byId.get(candidate.resourceId)
        ?? projections.byId.get(
          decodeAtomicProjectionId(
            validatedPairs.find((p) => (
              p.resourceId === candidate.resourceId
              && p.segmentId === candidate.segmentId
            ))?.atomicResourceId,
          ) ?? '',
        );
      const sourceEvidence = await loadSourceEvidence(root, projection, sourceCache);
      const atomicResourceId = validatedPairs.find((p) => (
        p.canonicalId === candidate.canonicalId
        && p.resourceId === candidate.resourceId
        && p.segmentId === candidate.segmentId
      ))?.atomicResourceId ?? null;

      bindingItems.push({
        pairId: candidate.pairId,
        canonicalId: candidate.canonicalId,
        resourceId: candidate.resourceId,
        structuralUnitId: candidate.structuralUnitId,
        segmentId: candidate.segmentId,
        resourceSegmentHash: candidate.resourceSegmentHash,
        atomicResourceId,
        profile,
        resourceEvidence: {
          title: projection?.title ?? null,
          family: projection?.family ?? null,
          sourcePath: sourceEvidence.sourcePath,
          sourceHash: sourceEvidence.sourceHash,
          sourceSelector: sourceEvidence.sourceSelector,
          sourceExcerpt: sourceEvidence.sourceExcerpt,
          sourceExcerptHash: sourceEvidence.sourceExcerptHash,
          graphNodeRefs: projection?.graphNodeRefs ?? null,
          reviewAuditLocator: projection?.reviewAudit
            ? {
              status: projection.reviewAudit.status ?? null,
              reviewerId: projection.reviewAudit.reviewerId ?? null,
              reviewBatchId: projection.reviewAudit.reviewBatchId ?? null,
              reviewedSourceHash: projection.reviewAudit.reviewedSourceHash ?? null,
            }
            : null,
        },
        allowedRoles: [...ALLOWED_BINDING_ROLES],
        itemInputDigest: '',
      });
    }

    const worklist = finalizeBindingWorklist({
      schemaVersion: 'act-resource-binding-worklist/v2',
      generatorVersion: 'act-resource-binding-worklist-generator/v1',
      deltaReceiptId,
      authoringRevision,
      inventoryRunId,
      crosswalkWorklistInputDigest: crosswalkWorklist.inputDigest,
      crosswalkActiveReviewsDigest: sha256Canonical(crosswalkActive),
      items: bindingItems,
    });

    const outRel = argValue('--binding-worklist-out') ?? AGGREGATE_BINDING_WORKLIST_PATH;
    await writeJson(root, outRel, worklist);
    return {
      path: outRel,
      itemCount: worklist.items.length,
      inputDigest: worklist.inputDigest,
      bytes: Buffer.byteLength(`${JSON.stringify(worklist, null, 2)}\n`, 'utf8'),
      bindingEligibleAcceptCount: validatedPairs.length,
      bindingSkippedByReason: bindingSkipReasons,
    };
  } finally {
    await db.$disconnect();
  }
}

async function assembleBindings(
  root: string,
  reviewFile: string,
  worklistPath: string,
): Promise<{ activePath: string; reviewCount: number }> {
  const worklist = JSON.parse(await readFile(path.join(root, worklistPath), 'utf8'));
  const review = JSON.parse(
    await readFile(path.isAbsolute(reviewFile) ? reviewFile : path.join(root, reviewFile), 'utf8'),
  ) as BindingReviewDecisionsDocument;
  const active = assembleBindingFromReview({ worklist, review });
  await writeJson(root, AGGREGATE_BINDING_REVIEWS_PATH, active);
  return {
    activePath: AGGREGATE_BINDING_REVIEWS_PATH,
    reviewCount: Object.keys(active.reviews).length,
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const deltaReceiptId = argValue('--delta-receipt-id') ?? DELTA_DEFAULT;
  const authoringRevision = argValue('--authoring-revision');
  if (!authoringRevision || !/^[a-f0-9]{40}$/u.test(authoringRevision)) {
    throw new Error('--authoring-revision <40-hex> is required');
  }
  const inventoryRunId = argValue('--inventory-run-id')
    ?? 'resource-binding-inventory:ca42502e15df87cddd12cd0e039fcf7bddf22656:a8400e926bb8ad2865c7a4b7a906e144efd3d4391605a5921503524d38fd7c5f';

  const worklistOnly = hasFlag('--worklist-only');
  const assembleCrosswalkReviews = hasFlag('--assemble-crosswalk-reviews');
  const worklistBindings = hasFlag('--worklist-bindings');
  const assembleBindingReviews = hasFlag('--assemble-binding-reviews');
  const reviewFile = argValue('--review-file');
  const modes = [worklistOnly, assembleCrosswalkReviews, worklistBindings, assembleBindingReviews]
    .filter(Boolean).length;
  if (modes !== 1) {
    throw new Error(
      'Specify exactly one mode: --worklist-only | --assemble-crosswalk-reviews | --worklist-bindings | --assemble-binding-reviews',
    );
  }

  if (worklistOnly) {
    const result = await generateCrosswalkWorklist({
      root,
      authoringRevision,
      deltaReceiptId,
      inventoryRunId,
    });
    console.log(JSON.stringify({
      mode: 'worklist-only',
      generator: true,
      manufacturesOutcomes: false,
      inventoryRunId,
      ...result,
      pendingReviewPath:
        'course-content/authoring/knowledge/course-coverage/aggregate/reviews/pending/act-crosswalk-review-decisions.json',
    }, null, 2));
    return;
  }

  if (assembleCrosswalkReviews) {
    if (!reviewFile) throw new Error('--assemble-crosswalk-reviews requires --review-file');
    const worklistPath = argValue('--worklist') ?? AGGREGATE_CROSSWALK_WORKLIST_PATH;
    const result = await assembleCrosswalk(root, reviewFile, worklistPath);
    console.log(JSON.stringify({
      mode: 'assemble-crosswalk-reviews',
      ...result,
      worklistPath,
      reviewFile,
    }, null, 2));
    return;
  }

  if (worklistBindings) {
    const result = await generateBindingWorklist({
      root,
      authoringRevision,
      deltaReceiptId,
      inventoryRunId,
    });
    console.log(JSON.stringify({
      mode: 'worklist-bindings',
      generator: true,
      manufacturesRoles: false,
      inventoryRunId,
      ...result,
      pendingReviewPath:
        'course-content/authoring/knowledge/course-coverage/aggregate/reviews/pending/resource-binding-review-decisions.json',
    }, null, 2));
    return;
  }

  if (assembleBindingReviews) {
    if (!reviewFile) throw new Error('--assemble-binding-reviews requires --review-file');
    const worklistPath = argValue('--worklist') ?? AGGREGATE_BINDING_WORKLIST_PATH;
    const result = await assembleBindings(root, reviewFile, worklistPath);
    console.log(JSON.stringify({
      mode: 'assemble-binding-reviews',
      ...result,
      worklistPath,
      reviewFile,
    }, null, 2));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
