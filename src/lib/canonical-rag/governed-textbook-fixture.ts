/**
 * Locked production-shaped governed evidence fixture for #1112 E2E.
 *
 * Crosswalk and structural observation are built independently:
 * - structural target is derived from unit + adapted SourcePackItem + inventory
 * - Crosswalk row is assembled from known unit/item/inventory facts separately
 * Mutating either observation or Crosswalk endpoints fails closed.
 */

import { createHash } from 'node:crypto';

import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';
import { buildKaqArtifactVersionRefs } from '@/lib/kaq-artifact-versioning';
import {
  loadStructuredTextbookBook,
  STRUCTURED_TEXTBOOK_RUNTIME_VERSION,
  type TextbookStructureUnitProjection,
} from '@/lib/structured-textbook-runtime';
import { adaptTextbookStructureUnit } from '@/lib/source-pack/corpus-adapters';
import type { SourcePackItem } from '@/lib/source-pack/types';

import { buildCandidateContextFingerprint } from './context-fingerprint';
import type {
  ActStructuralCitationTarget,
  CanonicalRagCoverageEntry,
  CanonicalRagObject,
  CanonicalRagRelation,
  CanonicalRagReleaseContext,
  CanonicalRagShadowInput,
  UpstreamRagReferenceSeed,
  VersionBoundCrosswalk,
} from './contracts';
import type { ActStructuralUnitCrosswalkRecord } from '@/lib/aggregate-governance/contracts';
import {
  deriveStructuralTargetFromObservations,
  type InventoryResourceSegmentObservation,
} from './loaders';
import { bindCandidateContextForFixtureOnly } from './version-context';

export const GOVERNED_TEXTBOOK_FIXTURE_ID =
  'canonical-rag-governed-textbook-fixture.v1' as const;
export const GOVERNED_TEXTBOOK_FIXTURE_KIND =
  'production-shaped-governed-evidence-fixture' as const;

const FIXTURE_CAPTURE = 'e'.repeat(40);
const FIXTURE_DELTA = 'delta-receipt:issue-1112-governed-textbook-fixture';
const FIXTURE_RELEASE_HASH = 'f'.repeat(64);
const FIXTURE_INVENTORY = `inventory:${GOVERNED_TEXTBOOK_FIXTURE_ID}`;
const FIXTURE_COVERAGE_SOURCE_HASH = '2'.repeat(64);

export const FIXTURE_BOOK_ID = 'hu-shousong-auto-control-8th';
export const FIXTURE_UNIT_PATH_SUFFIX = 'section-4.1';

export interface GovernedTextbookFixture {
  kind: typeof GOVERNED_TEXTBOOK_FIXTURE_KIND;
  fixtureId: typeof GOVERNED_TEXTBOOK_FIXTURE_ID;
  liveProductionProof: false;
  query: string;
  irrelevantQuery: string;
  release: CanonicalRagReleaseContext;
  unit: TextbookStructureUnitProjection;
  irrelevantUnit: TextbookStructureUnitProjection;
  productionItem: SourcePackItem;
  irrelevantItem: SourcePackItem;
  inventory: InventoryResourceSegmentObservation;
  shadowCandidatePool: SourcePackItem[];
  shadowInput: CanonicalRagShadowInput;
  independentStructuralTarget: ActStructuralCitationTarget;
  crosswalk: VersionBoundCrosswalk;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function projectUnit(
  book: Awaited<ReturnType<typeof loadStructuredTextbookBook>>,
  unitId: string,
): TextbookStructureUnitProjection {
  const unit = book.units.find((row) => row.id === unitId);
  if (!unit) throw new Error(`Fixture unit not found: ${unitId}`);
  const contentHash = sha256(unit.markdown);
  const href = `/textbooks/${encodeURIComponent(book.manifest.bookId)}/${encodeURIComponent(book.manifest.edition)}/${unit.structuralPath.map(encodeURIComponent).join('/')}`;
  return {
    id: unit.id,
    kind: unit.kind,
    title: unit.title,
    href,
    text: unit.markdown,
    contentHash,
    identity: {
      bookId: book.manifest.bookId,
      edition: book.manifest.edition,
      sourceRevision: book.manifest.sourceRevision,
      unitId: unit.id,
      fragmentId: null,
    },
    fragments: book.fragments.filter((fragment) => fragment.owningUnitId === unit.id),
    resourceProjection: {
      resourceId: unit.id,
      segmentRef: unit.id,
      citationTargetRef: unit.id,
      knowledgeNodeRefs: [],
      capabilityTargetRefs: [],
      contentHash,
      versionRefs: buildKaqArtifactVersionRefs({
        resourceProjectionVersion: STRUCTURED_TEXTBOOK_RUNTIME_VERSION,
        resourceRegistryVersion: book.manifest.sourceRevision,
        citationVersion: STRUCTURED_TEXTBOOK_RUNTIME_VERSION,
      }),
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: unit.id,
      href,
      locator: unit.naturalNumber ?? unit.id,
      contentHash,
    },
    metadata: {
      bookId: book.manifest.bookId,
      edition: book.manifest.edition,
      sourceRevision: book.manifest.sourceRevision,
      unitId: unit.id,
      chapterId: unit.chapterId,
      naturalNumber: unit.naturalNumber,
      structuralPath: [...unit.structuralPath],
    },
  };
}

export async function loadGovernedTextbookFixture(): Promise<GovernedTextbookFixture> {
  const book = await loadStructuredTextbookBook(FIXTURE_BOOK_ID);
  const unitRow = book.units.find((row) => (
    row.structuralPath.some((part) => part.includes(FIXTURE_UNIT_PATH_SUFFIX))
    && row.title.includes('根轨迹')
    && row.kind === 'section'
  )) ?? book.units.find((row) => row.title === '根轨迹法的基本概念');
  if (!unitRow) {
    throw new Error('Could not locate 根轨迹法的基本概念 unit in textbooks-v2 runtime');
  }

  const irrelevantRow = book.units.find((row) => (
    row.kind === 'section'
    && row.chapterId === 'chapter-01'
    && row.title.includes('基本原理')
  )) ?? book.units.find((row) => row.kind === 'section' && row.chapterId === 'chapter-01');
  if (!irrelevantRow) {
    throw new Error('Could not locate irrelevant chapter-01 section');
  }

  const unit = projectUnit(book, unitRow.id);
  const irrelevantUnit = projectUnit(book, irrelevantRow.id);

  // Real adapted SourcePack item (governed citation hydration).
  const productionItem = adaptTextbookStructureUnit(unit).item;
  const irrelevantItem = adaptTextbookStructureUnit(irrelevantUnit).item;
  if (!productionItem.retrievalChunkId || !productionItem.citationTargetId || !productionItem.citation) {
    throw new Error('Adapted textbook SourcePack item missing retrieval/citation identity');
  }

  // Independent inventory observation from unit resource projection + fixture run.
  const inventory: InventoryResourceSegmentObservation = {
    inventoryRunId: FIXTURE_INVENTORY,
    atomicResourceId: `atomic:${unit.id}`,
    resourceId: unit.resourceProjection.resourceId,
    segmentId: unit.resourceProjection.segmentRef,
    resourceSegmentHash: sha256(`${unit.id}:segment:${FIXTURE_INVENTORY}`),
    captureRevision: FIXTURE_CAPTURE,
  };

  const release = buildCandidateContextFingerprint({
    releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    releaseId: CURRENT_AGGREGATE_RELEASE_ID,
    releaseHash: FIXTURE_RELEASE_HASH,
    sourceDatasetHash: sha256(book.manifest.sourceRevision),
    // Mirrors AuthoritativeProjectionIdentityRecord runtime identity fields.
    projectionId: `projection:${GOVERNED_TEXTBOOK_FIXTURE_ID}:runtime`,
    projectionProfile: 'domain-semantic-runtime',
    projectionDigest: sha256(GOVERNED_TEXTBOOK_FIXTURE_ID),
    deltaReceiptId: FIXTURE_DELTA,
    coverageOverlayId: 'automatic-control-aggregate-coverage-v1',
    coverageOverlayVersion: 'automatic-control-aggregate-coverage-v1@fixture',
    coverageSourceHash: FIXTURE_COVERAGE_SOURCE_HASH,
    coverageCaptureRevision: FIXTURE_CAPTURE,
    inventoryRunId: FIXTURE_INVENTORY,
  });

  // Derive structural target from concrete observations only.
  const independentStructuralTarget = deriveStructuralTargetFromObservations({
    unit,
    sourcePackItem: productionItem,
    inventory,
    context: release,
  });

  // Crosswalk assembled separately from known unit/item/inventory facts
  // (not by copying the derived target object into the Crosswalk builder).
  const rawCrosswalk: ActStructuralUnitCrosswalkRecord = {
    id: `xw:${GOVERNED_TEXTBOOK_FIXTURE_ID}:root-locus`,
    releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
    releaseId: CURRENT_AGGREGATE_RELEASE_ID,
    deltaReceiptId: FIXTURE_DELTA,
    publishedEntityId: 'upstream:ctr:root-locus',
    retrievalChunkId: productionItem.retrievalChunkId,
    citationTargetId: productionItem.citationTargetId,
    canonicalId: 'ctr:root-locus',
    sourceEditionId: `${unit.identity.bookId}:${unit.identity.edition}`,
    sourceVersion: unit.identity.sourceRevision,
    structuralUnitId: unit.id,
    structuralUnitVersion: unit.identity.sourceRevision,
    structuralUnitHash: unit.contentHash.replace(/^sha256:/u, ''),
    evidenceContentHash: unit.contentHash.replace(/^sha256:/u, ''),
    inventoryRunId: inventory.inventoryRunId,
    atomicResourceId: inventory.atomicResourceId,
    resourceId: inventory.resourceId,
    segmentId: inventory.segmentId,
    resourceSegmentHash: inventory.resourceSegmentHash,
    captureRevision: FIXTURE_CAPTURE,
    resolutionState: 'DETERMINISTIC',
    validationState: 'VALIDATED',
    validationDigest: sha256(JSON.stringify({ unit: unit.id, hash: unit.contentHash })),
    reviewIdentity: 'issue-1112-governed-textbook-fixture',
    evidenceDigest: sha256(unit.text.slice(0, 512)),
    lifecycleState: 'CURRENT',
  };
  const crosswalk: VersionBoundCrosswalk = { ...release, row: rawCrosswalk };

  const objects: CanonicalRagObject[] = [
    bindCandidateContextForFixtureOnly({
      canonicalId: 'ctr:root-locus',
      canonicalType: 'DomainConcept',
      label: '根轨迹',
      aliases: ['root locus', '根轨迹法'],
      summary: 'Graph summary of root locus — never citable.',
    }, release),
    bindCandidateContextForFixtureOnly({
      canonicalId: 'ctr:nyquist-stability',
      canonicalType: 'DomainConcept',
      label: '奈奎斯特稳定性',
      aliases: ['Nyquist'],
      summary: 'Graph summary — never citable.',
    }, release),
  ];

  const relations: CanonicalRagRelation[] = [
    bindCandidateContextForFixtureOnly({
      relationId: 'rel:fixture-root-locus-is-a-nyquist',
      predicate: 'is_a',
      sourceId: 'ctr:root-locus',
      targetId: 'ctr:nyquist-stability',
    }, release),
    bindCandidateContextForFixtureOnly({
      relationId: 'rel:fixture-mentions-unsupported',
      predicate: 'mentions',
      sourceId: 'ctr:root-locus',
      targetId: 'ctr:nyquist-stability',
    }, release),
  ];

  const coverage: CanonicalRagCoverageEntry[] = [
    bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:root-locus', role: 'formal_objective' }, release),
    bindCandidateContextForFixtureOnly({ canonicalId: 'ctr:nyquist-stability', role: 'necessary_prerequisite' }, release),
  ];

  const upstreamByCanonicalId: Map<string, UpstreamRagReferenceSeed[]> = new Map([
    ['ctr:root-locus', [{
      publishedEntityId: rawCrosswalk.publishedEntityId,
      retrievalChunkId: rawCrosswalk.retrievalChunkId,
      citationTargetId: rawCrosswalk.citationTargetId,
      canonicalId: 'ctr:root-locus',
      context: release,
    }]],
  ]);

  const query = '请解释根轨迹法的基本概念';
  const irrelevantQuery = '自动控制的基本原理与开环闭环定义';

  // Pool item keeps adapted identities (same as used for derivation).
  const relevantPoolItem: SourcePackItem = {
    ...productionItem,
    metadata: {
      ...productionItem.metadata,
      contentHash: unit.contentHash,
      sourceVersion: unit.identity.sourceRevision,
      resourceId: unit.resourceProjection.resourceId,
      segmentRef: unit.resourceProjection.segmentRef,
    },
  };

  return {
    kind: GOVERNED_TEXTBOOK_FIXTURE_KIND,
    fixtureId: GOVERNED_TEXTBOOK_FIXTURE_ID,
    liveProductionProof: false,
    query,
    irrelevantQuery,
    release,
    unit,
    irrelevantUnit,
    productionItem: relevantPoolItem,
    irrelevantItem,
    inventory,
    shadowCandidatePool: [relevantPoolItem, irrelevantItem],
    independentStructuralTarget,
    crosswalk,
    shadowInput: {
      query,
      release,
      objects,
      relations,
      coverage,
      upstreamByCanonicalId,
      crosswalks: [crosswalk],
      structuralUnits: [independentStructuralTarget],
      authorityConsumer: 'SHADOW_COMPARISON',
      maxHops: 1,
      latencyBudgetMs: 250,
    },
  };
}
