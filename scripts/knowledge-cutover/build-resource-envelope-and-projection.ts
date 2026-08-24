#!/usr/bin/env tsx
/**
 * W3: seal the formal resource envelope and build the capture-bound
 * remediation Teaching Projection (#1515, task families 7.5–7.6 and
 * 10.1–10.7) from the real corpus artifacts. Run after
 * `remediate-formal-resources.ts process-text` has replayed the text
 * layer under the v0.37 scope allocation.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ActTeachingScope } from '@/lib/act-canonical-teaching-relations/contracts';
import { assertScopeIntegrity } from '@/lib/act-canonical-teaching-relations/scope';
import {
  rebindHotwordManifestsToAllocation,
  rebindProcessingRecordsToAllocation,
  reopenResourceEnvelope,
  sealResourceEnvelope,
  type RemediationResourceEnvelope,
} from '@/lib/formal-resource-remediation/envelope';
import {
  buildDomainFragment,
  buildRemediationTeachingProjection,
  deriveProjectionCompleteness,
  projectionEdges,
  validateRemediationTeachingProjection,
  type FinalLedgerProjectionRow,
  type ProjectionBindingRow,
} from '@/lib/formal-resource-remediation/projection';
import type { RemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { reopenRemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import { projectionDigest } from '@/lib/teaching-projection/hash';

const ROOT = process.cwd();
const SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37/scope.json';
const ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const ASR_BATCH = `${REMEDIATION_ROOT}/20260823-asr-batch`;
const TEXT_LAYER = `${REMEDIATION_ROOT}/resource-layer/text`;
const PROJECTION_DIR = `${REMEDIATION_ROOT}/teaching-projection`;
const EXCLUDED_DOMAINS = [
  'robust-control-analysis-and-design',
  'discrete-time-control-analysis',
  'discrete-time-control-design',
  'optimal-control-foundations-and-linear-quadratic-design',
  'lyapunov-stability',
  'nonlinear-control-design',
] as const;
const COVERED_DOMAINS = [
  'root-locus',
  'robustness-sensitivity-analysis',
  'stability-analysis',
  'nonlinear-system-analysis',
  'time-domain-analysis',
  'system-modeling',
  'classical-control-design',
  'frequency-domain-analysis',
  'state-space-control-analysis-and-design',
] as const;
const ALL_DOMAINS: readonly string[] = [...COVERED_DOMAINS, ...EXCLUDED_DOMAINS];
const SEALED_AT = '2026-08-24T19:30:00.000Z';
const ENVELOPE_LIMITATIONS = [
  'exercise atoms cover 455 of 528 activity cards under the current allocation; 73 open-ended cards without reference answers carry explicit per-card exclusions; exercise semantic Canonical mapping is pending (atoms have no canonicalKey yet)',
  'simulation and interactive-resource registry launchers are not yet processed (task family 6.4-6.5 pending)',
  'intro-video production-source import is not yet processed (task family 3 pending)',
  'handout atoms carry no canonicalKey yet; they await the semantic Canonical mapping pass',
  'course-to-authority-map resolves 31 of 220 course nodes by exact name; unresolved card keys stay unbound',
  'audio bindings cover 355 of 1170 spoken segments (term-overlap model, modality independent; 741 binding rows because a segment may bind up to three nodes)',
];

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function writeDeterministicJson(filePath: string, value: unknown): 'created' | 'skipped' {
  const target = absolute(filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, bytes);
  return 'created';
}

interface TextAtom {
  readonly atomId: string;
  readonly resourceId: string;
  readonly subtype: string;
  readonly canonicalKey: string | null;
}

interface AudioSegmentFile {
  readonly unit: string;
  readonly segmentCount: number;
  readonly boundSegmentCount: number;
  readonly segments: readonly { readonly nodeBindings: readonly { readonly canonicalId: string }[] }[];
}

/** Strip the trailing `_<layer>_<hash>` segments; concept names may contain underscores. */
function cardKeyToConceptName(canonicalKey: string): string | null {
  const last = canonicalKey.lastIndexOf('_');
  if (last <= 0) return null;
  const second = canonicalKey.lastIndexOf('_', last - 1);
  if (second <= 0) return null;
  return canonicalKey.slice(0, second);
}

function main(): void {
  // Reopen the v0.37 scope, allocation, and total closure receipts.
  const scopeArtifact = readJson<ActTeachingScope & { readonly memberCount: number }>(SCOPE_PATH);
  const reopened = reopenScopeArtifact({
    courseId: 'act-control-theory',
    scope: scopeArtifact,
    expectedAuthorityReleaseId: 'ctr:release:control-theory-engineering-v0.37',
    expectedAuthoritySnapshotHash: 'cc73fa150a94fb0a3891c4b5d26eba9ca190f28334782a974333016f734fea39',
  });
  if (reopened.memberCount !== 7476) throw new Error(`scope has ${reopened.memberCount} members`);
  const scope: ActTeachingScope = {
    contract: scopeArtifact.contract,
    courseId: scopeArtifact.courseId,
    authority: scopeArtifact.authority,
    catalog: scopeArtifact.catalog,
    contractVersion: scopeArtifact.contractVersion,
    members: reopened.members,
    memberIds: reopened.members.map((member) => member.canonicalId),
    scopeHash: reopened.scopeHash,
  };
  assertScopeIntegrity(scope);
  const allocation = readJson<RemediationAllocation>(ALLOCATION_PATH);
  reopenRemediationAllocation(allocation);
  if (allocation.scopeHash !== scope.scopeHash) throw new Error('allocation and scope hashes differ');
  const totalReceipt = readJson<{
    readonly allocationHash: string;
    readonly memberCount: number;
    readonly rowCount: number;
    readonly unresolved: number;
    readonly publishedEdges: number;
    readonly closureComplete: boolean;
    readonly domainReceipts: readonly { readonly domain: string }[];
  }>(`${REMEDIATION_ROOT}/total-closure-receipt.json`);
  const conservation = readJson<{ readonly ledgerRowCount: number; readonly duplicates: number; readonly missingRowCount: number }>(`${REMEDIATION_ROOT}/total-conservation-check.json`);

  // Refresh the ASR records and hotword manifests into the current allocation.
  const asrRecordsPath = `${ASR_BATCH}/asr-processing-records.json`;
  const hotwordsPath = `${ASR_BATCH}/hotword-manifests.json`;
  const asrRecordsRaw = readJson<ResourceProcessingRecord[]>(asrRecordsPath);
  const hotwordsRaw = readJson<Parameters<typeof rebindHotwordManifestsToAllocation>[0][number][]>(hotwordsPath);
  const asrRecords = rebindProcessingRecordsToAllocation(asrRecordsRaw, allocation.allocationHash);
  const hotwords = rebindHotwordManifestsToAllocation(hotwordsRaw, allocation.allocationHash, (manifest, allocationHash) => projectionDigest({
    allocationHash,
    resourceId: manifest.resourceId,
    sourceResourceId: manifest.sourceResourceId,
    sourceContentSha256: manifest.sourceContentSha256,
    locale: manifest.locale,
    extractorVersion: manifest.extractorVersion,
    extractorConfigDigest: manifest.extractorConfigDigest,
    terminologyRegistryId: manifest.terminologyRegistryId,
    entries: manifest.entries,
    exclusions: manifest.exclusions,
  }));
  writeFileSync(absolute(asrRecordsPath), `${JSON.stringify(asrRecords, null, 1)}\n`);
  writeFileSync(absolute(hotwordsPath), `${JSON.stringify(hotwords, null, 1)}\n`);

  // Load the replayed text layer under the current allocation.
  const textRecords = readJson<ResourceProcessingRecord[]>(`${TEXT_LAYER}/text-processing-records.json`);
  const textAtoms = readJson<TextAtom[]>(`${TEXT_LAYER}/text-atoms.json`);
  if (textRecords.some((record) => record.allocationHash !== allocation.allocationHash)) {
    throw new Error('text records are not bound to the current allocation; run process-text first');
  }
  const exerciseDir = `${REMEDIATION_ROOT}/resource-layer/exercises`;
  const exerciseRecords = readJson<ResourceProcessingRecord[]>(`${exerciseDir}/exercise-processing-records.json`);
  const exerciseAtomsCount = readJson<{ readonly atomCount: number }>(`${exerciseDir}/exercise-run-summary.json`).atomCount;
  if (exerciseRecords.some((record) => record.allocationHash !== allocation.allocationHash)) {
    throw new Error('exercise records are not bound to the current allocation; run process-exercises first');
  }
  const processingRecords = [...textRecords, ...asrRecords, ...exerciseRecords];

  // Build the modality-independent binding rows.
  const authorityMap = readJson<Record<string, string>>(`${ASR_BATCH}/course-to-authority-map.json`);
  const cardBindings: ProjectionBindingRow[] = [];
  for (const atom of textAtoms) {
    if (!atom.canonicalKey) continue;
    const conceptName = cardKeyToConceptName(atom.canonicalKey);
    const canonicalId = conceptName ? authorityMap[conceptName] : undefined;
    if (!canonicalId) continue;
    cardBindings.push({
      modality: 'card',
      resourceId: atom.resourceId,
      anchorId: atom.atomId,
      canonicalId,
      evidence: 'course-to-authority-map:exact-name',
    });
  }
  const audioBindings: ProjectionBindingRow[] = [];
  const segmentDir = `${ASR_BATCH}/audio-semantic-segments`;
  const unitNames = readdirSync(absolute(segmentDir)).filter((name) => name.endsWith('.json')).sort();
  let audioSegmentCount = 0;
  for (const unitName of unitNames) {
    const unit = unitName.replace(/\.json$/u, '');
    const file = readJson<AudioSegmentFile>(`${segmentDir}/${unitName}`);
    audioSegmentCount += file.segmentCount;
    file.segments.forEach((segment, index) => {
      for (const binding of segment.nodeBindings) {
        audioBindings.push({
          modality: 'audio',
          resourceId: `audio-${unit}`,
          anchorId: `${unit}-seg-${index + 1}`,
          canonicalId: binding.canonicalId,
          evidence: 'term-overlap-binding-model:modality-independent',
        });
      }
    });
  }
  const bindings = [...cardBindings, ...audioBindings];

  // Seal the formal resource envelope over the refreshed resource layer.
  const artifactRoles: readonly { readonly role: string; readonly path: string }[] = [
    { role: 'text-atoms', path: `${TEXT_LAYER}/text-atoms.json` },
    { role: 'text-processing-records', path: `${TEXT_LAYER}/text-processing-records.json` },
    { role: 'text-run-summary', path: `${TEXT_LAYER}/text-run-summary.json` },
    { role: 'asr-processing-records', path: asrRecordsPath },
    { role: 'hotword-manifests', path: hotwordsPath },
    { role: 'processor-registry', path: `${ASR_BATCH}/processor-registry.json` },
    { role: 'qualification-receipt', path: `${ASR_BATCH}/qualification-receipt.json` },
    { role: 'crosswalk-v037', path: `${ASR_BATCH}/crosswalk-v037.json` },
    { role: 'course-to-authority-map', path: `${ASR_BATCH}/course-to-authority-map.json` },
    { role: 'audio-segmentation-summary', path: `${ASR_BATCH}/audio-segmentation-summary.json` },
    { role: 'excluded-domains-decisions', path: `${REMEDIATION_ROOT}/excluded-domains-decisions.jsonl` },
    { role: 'exercise-atoms', path: `${exerciseDir}/exercise-atoms.json` },
    { role: 'exercise-processing-records', path: `${exerciseDir}/exercise-processing-records.json` },
    { role: 'exercise-answer-digests', path: `${exerciseDir}/exercise-answer-digests.json` },
    { role: 'exercise-exclusions', path: `${exerciseDir}/exercise-exclusions.json` },
    { role: 'exercise-run-summary', path: `${exerciseDir}/exercise-run-summary.json` },
  ];
  const envelope = sealResourceEnvelope({
    sealedAt: SEALED_AT,
    allocationHash: allocation.allocationHash,
    scopeHash: scope.scopeHash,
    processingRecords,
    atomCount: textAtoms.length + exerciseAtomsCount,
    bindingCount: bindings.length,
    artifacts: artifactRoles.map((artifact) => ({ ...artifact, sha256: sha256File(artifact.path) })),
    limitations: ENVELOPE_LIMITATIONS,
  });
  const envelopeState = writeDeterministicJson(`${REMEDIATION_ROOT}/resource-envelope.json`, envelope);

  // Build the capture-bound projection from reopened artifacts only.
  const members = scope.members.map((member) => ({
    canonicalId: member.canonicalId,
    domain: member.preferredDomainId,
    excluded: (EXCLUDED_DOMAINS as readonly string[]).includes(member.preferredDomainId),
  }));
  const finalLedgerRows = ALL_DOMAINS.map((domain) => {
    const ledger = readJson<{ readonly rows: readonly FinalLedgerProjectionRow[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`);
    return { domain, rows: ledger.rows };
  });
  const totalClosureReceiptSha256 = sha256File(`${REMEDIATION_ROOT}/total-closure-receipt.json`);
  const totalConservationCheckSha256 = sha256File(`${REMEDIATION_ROOT}/total-conservation-check.json`);
  const projection = buildRemediationTeachingProjection({
    sealedAt: SEALED_AT,
    allocationHash: allocation.allocationHash,
    scopeHash: scope.scopeHash,
    members,
    finalLedgerRows,
    bindings,
    envelope,
    totalClosureReceiptSha256,
    totalConservationCheckSha256,
    limitations: [
      ...ENVELOPE_LIMITATIONS,
      '2221 members across six domains are excluded by course-owner D1 ruling and carry NO_RELATION dispositions only',
    ],
  });
  const projectionState = writeDeterministicJson(`${PROJECTION_DIR}/projection.json`, projection);

  // Independently versioned domain fragments (task 10.4).
  const edges = projectionEdges(members, finalLedgerRows);
  const fragmentStates: Record<string, string> = {};
  const crosswalk = readJson<{ readonly entries: Record<string, { readonly domain: string; readonly label: string }> }>(`${ASR_BATCH}/crosswalk-v037.json`);
  for (const domain of ALL_DOMAINS) {
    const fragment = buildDomainFragment({ domain, projection, members, edges, bindings });
    const domainMembers = members.filter((member) => member.domain === domain);
    const domainMemberIds = new Set(domainMembers.map((member) => member.canonicalId));
    const fragmentBody = {
      ...fragment,
      members: domainMembers.map((member) => ({
        canonicalId: member.canonicalId,
        excluded: member.excluded,
        label: crosswalk.entries[member.canonicalId]?.label ?? null,
        zeroResource: !bindings.some((binding) => binding.canonicalId === member.canonicalId),
      })),
      edges: edges.filter((edge) => domainMemberIds.has(edge.source)),
      bindings: bindings.filter((binding) => domainMemberIds.has(binding.canonicalId)),
    };
    fragmentStates[domain] = writeDeterministicJson(`${PROJECTION_DIR}/fragments/${domain}.json`, fragmentBody);
  }

  // Consumer projections from the same complete identity (task 10.5).
  const boundMemberIds = new Set(bindings.map((binding) => binding.canonicalId));
  const graphViewState = writeDeterministicJson(`${PROJECTION_DIR}/consumers/graph-view.json`, {
    contract: 'remediation-teaching-projection-consumer/v1',
    consumer: 'graph',
    projectionHash: projection.projectionHash,
    nodes: members.map((member) => ({
      id: member.canonicalId,
      domain: member.domain,
      label: crosswalk.entries[member.canonicalId]?.label ?? null,
      excluded: member.excluded,
      hasResource: boundMemberIds.has(member.canonicalId),
    })),
    edges: edges.map((edge) => ({ source: edge.source, family: edge.family, target: edge.target, kind: edge.kind })),
  });
  const prerequisiteEdges = edges.filter((edge) => edge.family === 'prerequisite');
  const prerequisiteState = writeDeterministicJson(`${PROJECTION_DIR}/consumers/prerequisite-publication.json`, {
    contract: 'remediation-teaching-projection-consumer/v1',
    consumer: 'prerequisite-publication',
    projectionHash: projection.projectionHash,
    edgeCount: prerequisiteEdges.length,
    edges: prerequisiteEdges,
    limitations: projection.limitations,
  });

  // Derived completeness (task 10.1) and validation (task 10.6).
  const reopenedEnvelope = reopenResourceEnvelope({
    envelope,
    processingRecords,
    artifactSha256: (artifactPath) => sha256File(artifactPath),
  });
  if (reopenedEnvelope.state !== 'SEALED') {
    throw new Error(`envelope reopen failed: ${reopenedEnvelope.checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`).join('; ')}`);
  }
  const completeness = deriveProjectionCompleteness({
    reopenedScope: { scopeHash: scope.scopeHash, memberCount: reopened.memberCount },
    reopenedEnvelope: { state: reopenedEnvelope.state, envelope },
    closure: {
      allocationHash: totalReceipt.allocationHash,
      memberCount: totalReceipt.memberCount,
      rowCount: totalReceipt.rowCount,
      unresolved: totalReceipt.unresolved,
      closureComplete: totalReceipt.closureComplete,
      domainReceiptCount: totalReceipt.domainReceipts.length,
    },
    conservation,
    allocationHash: allocation.allocationHash,
    projection,
  });
  const validationFindings = validateRemediationTeachingProjection({
    projection,
    members,
    edges,
    bindings,
    envelope,
    closure: { memberCount: totalReceipt.memberCount, rowCount: totalReceipt.rowCount, publishedEdges: totalReceipt.publishedEdges },
  });
  const report = {
    contract: 'remediation-teaching-projection-validation-report/v1',
    sealedAt: SEALED_AT,
    projectionHash: projection.projectionHash,
    derivedState: completeness.state,
    completenessChecks: completeness.checks,
    validationFindings,
    audioSegmentCount,
    counts: {
      members: members.length,
      covered: projection.membership.coveredMemberCount,
      excluded: projection.membership.excludedMemberCount,
      edges: projection.relations.edgeCount,
      courseRoots: projection.relations.courseRootCount,
      bindings: bindings.length,
      cardBindings: cardBindings.length,
      audioBindings: audioBindings.length,
      zeroResourceNodes: projection.zeroResourceNodes.count,
    },
    artifactStates: { envelopeState, projectionState, graphViewState, prerequisiteState, fragments: fragmentStates },
  };
  if (completeness.state !== 'COMPLETE' || validationFindings.length > 0) {
    throw new Error(`projection validation failed: ${JSON.stringify({ state: completeness.state, findings: validationFindings })}`);
  }
  writeDeterministicJson(`${PROJECTION_DIR}/projection-validation-report.json`, report);
  console.log(JSON.stringify({ state: completeness.state, counts: report.counts, artifactStates: report.artifactStates }, null, 2));
}

main();
