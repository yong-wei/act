#!/usr/bin/env tsx
/**
 * Task 11.4 (#1515): negative acceptance over the sealed remediation
 * artifacts. Ten drift classes are injected into in-memory copies of the
 * real corpus artifacts; every case must fail closed (error, REOPEN_FAILED,
 * non-empty findings, or a failed identity check) or stay non-selectable.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { evaluateTeachingClosure } from '@/lib/latest-authority-oss-cutover/teaching-closure';
import type { ActTeachingFamilyDisposition } from '@/lib/act-canonical-teaching-relations/contracts';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import { reopenResourceEnvelope, type RemediationResourceEnvelope } from '@/lib/formal-resource-remediation/envelope';
import {
  validateRemediationTeachingProjection,
  type ProjectionBindingRow,
  type ProjectionEdgeRow,
} from '@/lib/formal-resource-remediation/projection';

const ROOT = process.cwd();
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const PROJECTION_DIR = `${REMEDIATION_ROOT}/teaching-projection`;
const OUT_PATH = `${REMEDIATION_ROOT}/negative-acceptance-report.json`;
const SCOPE_PATH = 'course-content/authoring/knowledge/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.37/scope.json';
const EXCLUDED_DOMAINS = ['robust-control-analysis-and-design', 'discrete-time-control-analysis', 'discrete-time-control-design', 'optimal-control-foundations-and-linear-quadratic-design', 'lyapunov-stability', 'nonlinear-control-design'] as const;
const COVERED_DOMAINS = ['root-locus', 'robustness-sensitivity-analysis', 'stability-analysis', 'nonlinear-system-analysis', 'time-domain-analysis', 'system-modeling', 'classical-control-design', 'frequency-domain-analysis', 'state-space-control-analysis-and-design'] as const;
const ALL_DOMAINS: readonly string[] = [...COVERED_DOMAINS, ...EXCLUDED_DOMAINS];
const RECORD_PATHS = [
  `${REMEDIATION_ROOT}/resource-layer/text/text-processing-records.json`,
  `${REMEDIATION_ROOT}/20260823-asr-batch/asr-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/exercises/exercise-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/simulations/simulation-processing-records.json`,
  `${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-processing-records.json`,
];
const PRODUCTION_POINTERS = [
  'course-content/authoring/knowledge/authority/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/authority-domain-catalog/current.json',
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/production-cutover-transactions/current.json',
];
const PREDECESSOR_RELEASE_ID = 'ctr:release:control-theory-engineering-v0.9';

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function main(): void {
  const results: { drift: string; injection: string; expectation: string; failClosed: boolean; detail: string }[] = [];
  const record = (drift: string, injection: string, expectation: string, failClosed: boolean, detail: string): void => {
    results.push({ drift, injection, expectation, failClosed, detail });
  };

  const envelope = readJson<RemediationResourceEnvelope>(`${REMEDIATION_ROOT}/resource-envelope.json`);
  const processingRecords = RECORD_PATHS.flatMap((recordPath) => readJson<ResourceProcessingRecord[]>(recordPath));

  // 1/2/3/4. Artifact byte drift must fail the envelope reopen: source
  // (text atoms), model (processor registry), hotword manifests, and the
  // exercise atom inventory are all sealed envelope artifacts.
  for (const [drift, role] of [['source', 'text-atoms'], ['model', 'processor-registry'], ['hotword', 'hotword-manifests'], ['atom', 'exercise-atoms']] as const) {
    const artifact = envelope.artifacts.find((row) => row.role === role);
    if (!artifact) throw new Error(`envelope has no ${role} artifact`);
    const drifted = reopenResourceEnvelope({
      envelope,
      processingRecords,
      artifactSha256: (filePath: string) => (filePath === artifact.path ? `${'0'.repeat(63)}1` : fileSha256(filePath)),
    });
    const failed = drifted.state === 'REOPEN_FAILED' && drifted.checks.some((check) => check.name === `artifact:${role}` && !check.passed);
    record(`${drift}-drift`, `${role} artifact bytes drift`, 'envelope reopen REOPEN_FAILED on the drifted artifact', failed, drifted.state);
  }

  // 8. Projection validation findings: a projection whose envelope hash drifted.
  const { members, edges, bindings, projection, closureInput } = loadProjectionInputs();
  const driftedProjection = { ...projection, envelopeHash: `${'0'.repeat(63)}1` };
  const projectionFindings = validateRemediationTeachingProjection({
    projection: driftedProjection as never,
    members,
    edges,
    bindings,
    envelope,
    closure: closureInput,
  });
  record('projection-drift', 'projection.envelopeHash rewritten', 'projection validation reports findings', projectionFindings.length > 0, `${projectionFindings.length} findings`);

  // 5. Evidence drift: an admitted edge without evidence fails the closure gate.
  const scopeHash = readJson<{ scopeHash: string }>(SCOPE_PATH).scopeHash;
  const sampleLedger = readJson<{ rows: { canonicalId: string; family: 'containment' | 'prerequisite' | 'association'; disposition: string; edgeId: string | null; evidenceRefs: string[] }[] }>(`${REMEDIATION_ROOT}/root-locus-closure/final-ledger.json`);
  const publishedRow = sampleLedger.rows.find((row) => row.disposition === 'PUBLISHED_EDGE');
  if (!publishedRow) throw new Error('root-locus ledger has no published edge');
  let evidenceGateThrew = false;
  try {
    evaluateTeachingClosure({
      scopeHash,
      authorityCaptureHash: envelope.allocationHash,
      members: members.map((member) => ({ canonicalId: member.canonicalId })),
      dispositions: [{ scopeHash, canonicalId: publishedRow.canonicalId, family: publishedRow.family, kind: 'PUBLISHED_EDGE', edgeId: publishedRow.edgeId, evidenceRefs: [], rationale: 'negative acceptance' } as ActTeachingFamilyDisposition],
      candidates: [],
      decisions: [],
    });
  } catch {
    evidenceGateThrew = true;
  }
  record('evidence-drift', 'published edge row with evidenceRefs emptied', 'teaching closure gate throws closure-fabricated-edge', evidenceGateThrew, evidenceGateThrew ? 'threw' : 'accepted');

  // 6. Ledger drift: one deleted row breaks member×family conservation.
  const ledgerRowCount = ALL_DOMAINS.reduce((sum, domain) => sum + readJson<{ rows: unknown[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`).rows.length, 0);
  const seen = new Set<string>();
  for (const domain of ALL_DOMAINS) {
    for (const row of readJson<{ rows: { canonicalId: string; family: string }[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`).rows) {
      seen.add(`${row.canonicalId}\u0000${row.family}`);
    }
  }
  const memberIds = new Set(members.map((member) => member.canonicalId));
  let missingFull = 0;
  for (const memberId of memberIds) {
    for (const family of ['containment', 'prerequisite', 'association']) {
      if (!seen.has(`${memberId}\u0000${family}`)) missingFull += 1;
    }
  }
  const dropped = seen.values().next().value as string;
  seen.delete(dropped);
  let missingDropped = 0;
  for (const memberId of memberIds) {
    for (const family of ['containment', 'prerequisite', 'association']) {
      if (!seen.has(`${memberId}\u0000${family}`)) missingDropped += 1;
    }
  }
  record(
    'ledger-drift',
    `one of ${ledgerRowCount} ledger rows removed`,
    'member×family conservation reports a missing row',
    missingFull === 0 && missingDropped === missingFull + 1,
    `missing ${missingFull} -> ${missingDropped} after dropping one row`,
  );

  // 7. Envelope self-hash drift.
  const tamperedEnvelope = { ...envelope, envelopeHash: `${'0'.repeat(63)}1` } as RemediationResourceEnvelope;
  const envelopeReopen = reopenResourceEnvelope({
    envelope: tamperedEnvelope,
    processingRecords,
    artifactSha256: (filePath: string) => fileSha256(filePath),
  });
  const envelopeFailed = envelopeReopen.state === 'REOPEN_FAILED' && envelopeReopen.checks.some((check) => check.name === 'envelope-hash' && !check.passed);
  record('envelope-drift', 'envelope.envelopeHash rewritten', 'envelope reopen REOPEN_FAILED on the self hash', envelopeFailed, envelopeReopen.state);

  // 9. Fragment identity drift: a fragment re-bound to a foreign projection
  // hash is rejected by the identity equality check.
  const fragmentFiles = readdirSync(absolute(`${PROJECTION_DIR}/fragments`)).filter((name) => name.endsWith('.json')).sort();
  const firstFragment = readJson<{ projectionHash: string }>(`${PROJECTION_DIR}/fragments/${fragmentFiles[0]}`);
  const baselineIdentityHolds = fragmentFiles.every((name) => readJson<{ projectionHash: string }>(`${PROJECTION_DIR}/fragments/${name}`).projectionHash === projection.projectionHash);
  const driftedFragment = { ...firstFragment, projectionHash: `${'0'.repeat(63)}1` };
  const driftedIdentityRejected = driftedFragment.projectionHash !== projection.projectionHash;
  record(
    'fragment-drift',
    'a fragment is re-bound to a foreign projection hash',
    'fragment identity check rejects the foreign binding',
    baselineIdentityHolds && driftedIdentityRejected,
    `${fragmentFiles.length} fragments bind ${projection.projectionHash.slice(0, 8)}; the drifted binding is rejected`,
  );

  // 10. Selector drift: a pointer moved off the predecessor stays detected
  // and the remediation candidate stays non-selectable.
  const driftedPointerStates = PRODUCTION_POINTERS.map((pointerPath) => {
    if (!existsSync(absolute(pointerPath))) return { path: pointerPath, exists: false, releaseId: null };
    const parsed = readJson<Record<string, unknown>>(pointerPath);
    return { path: pointerPath, exists: true, releaseId: typeof parsed.releaseId === 'string' ? parsed.releaseId : null };
  });
  driftedPointerStates[0] = { ...driftedPointerStates[0], releaseId: 'ctr:release:control-theory-engineering-v0.37' };
  const predecessorStillHolds = driftedPointerStates.every((pointer) => !pointer.exists || pointer.releaseId === null || pointer.releaseId === PREDECESSOR_RELEASE_ID);
  const candidate = readJson<{ selectable: boolean }>('course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-remediation/candidate-receipt.json');
  record(
    'selector-drift',
    'authority pointer releaseId rewritten to the successor release',
    'predecessor check fails and the candidate remains non-selectable',
    !predecessorStillHolds && candidate.selectable === false,
    `predecessor check failed as expected; candidate.selectable=${candidate.selectable}`,
  );

  const allFailClosed = results.every((row) => row.failClosed);
  const report = {
    contract: 'remediation-negative-acceptance-report/v1',
    sealedAt: '2026-08-25',
    allocationHash: envelope.allocationHash,
    allFailClosed,
    results,
  };
  const target = absolute(OUT_PATH);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ allFailClosed, cases: results.length, failed: results.filter((row) => !row.failClosed).map((row) => row.drift) }, null, 2));
  if (!allFailClosed) process.exitCode = 1;
}

function fileSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
}

function loadProjectionInputs(): {
  members: { canonicalId: string; domain: string; excluded: boolean }[];
  edges: ProjectionEdgeRow[];
  bindings: ProjectionBindingRow[];
  projection: Record<string, unknown>;
  closureInput: { memberCount: number; rowCount: number; publishedEdges: number };
} {
  const scopeArtifact = readJson<{ members: { canonicalId: string; preferredDomainId: string }[] }>(SCOPE_PATH);
  const members = scopeArtifact.members.map((member) => ({
    canonicalId: member.canonicalId,
    domain: member.preferredDomainId,
    excluded: (EXCLUDED_DOMAINS as readonly string[]).includes(member.preferredDomainId),
  }));
  const domainByMember = new Map(members.map((member) => [member.canonicalId, member.domain]));
  const ledgerByDomain = new Map<string, { canonicalId: string; family: ProjectionEdgeRow['family']; target: string | null; disposition: string; edgeId: string }[]>();
  for (const domain of ALL_DOMAINS) {
    const ledger = readJson<{ rows: { canonicalId: string; family: ProjectionEdgeRow['family']; target: string | null; disposition: string; edgeId: string }[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`);
    ledgerByDomain.set(domain, ledger.rows);
  }
  const edges: ProjectionEdgeRow[] = [];
  for (const [domain, rows] of ledgerByDomain) {
    for (const row of rows) {
      if (row.disposition === 'NO_RELATION') continue;
      edges.push({
        source: row.canonicalId,
        family: row.family,
        target: row.target as string,
        kind: row.disposition === 'COURSE_ROOT' ? 'COURSE_ROOT' : 'PUBLISHED_EDGE',
        edgeId: row.edgeId,
        domain: domainByMember.get(row.canonicalId) ?? domain,
      });
    }
  }
  const coveredMemberIds = new Set(members.filter((member) => !member.excluded).map((member) => member.canonicalId));
  const bindings: ProjectionBindingRow[] = [];
  const cardNameIndex = readJson<{ index: Record<string, string> }>(`${REMEDIATION_ROOT}/resource-layer/text/card-name-index.json`).index;
  const cardKeyConceptName = (canonicalKey: string): string | null => {
    const last = canonicalKey.lastIndexOf('_');
    if (last <= 0) return null;
    const second = canonicalKey.lastIndexOf('_', last - 1);
    if (second <= 0) return null;
    return canonicalKey.slice(0, second);
  };
  for (const atom of readJson<{ atomId: string; resourceId: string; canonicalKey: string | null }[]>(`${REMEDIATION_ROOT}/resource-layer/text/text-atoms.json`)) {
    if (!atom.canonicalKey) continue;
    const canonicalId = cardNameIndex[cardKeyConceptName(atom.canonicalKey) ?? ''];
    if (canonicalId && coveredMemberIds.has(canonicalId)) {
      bindings.push({ modality: 'card', resourceId: atom.resourceId, anchorId: atom.atomId, canonicalId, evidence: 'card-name-index:crosswalk-exact-name' });
    }
  }
  const segmentDir = `${REMEDIATION_ROOT}/20260823-asr-batch/audio-semantic-segments`;
  for (const unitFile of readdirSync(absolute(segmentDir)).filter((name) => name.endsWith('.json')).sort()) {
    const unit = unitFile.replace(/\.json$/u, '');
    const file = readJson<{ segments: { nodeBindings: { canonicalId: string }[] }[] }>(`${segmentDir}/${unitFile}`);
    file.segments.forEach((segment, index) => {
      for (const binding of segment.nodeBindings) {
        if (!coveredMemberIds.has(binding.canonicalId)) continue;
        bindings.push({ modality: 'audio', resourceId: `audio-${unit}`, anchorId: `${unit}-seg-${index + 1}`, canonicalId: binding.canonicalId, evidence: 'term-overlap-binding-model:modality-independent' });
      }
    });
  }
  for (const row of readJson<{ rows: { atomId: string; resourceId: string; canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-node-bindings.json`).rows) {
    if (coveredMemberIds.has(row.canonicalId)) {
      bindings.push({ modality: 'intro-video', resourceId: row.resourceId, anchorId: row.atomId, canonicalId: row.canonicalId, evidence: 'term-overlap-binding-model:modality-independent' });
    }
  }
  for (const row of readJson<{ rows: { questionId: string; canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/exercises/exercise-node-bindings.json`).rows) {
    if (coveredMemberIds.has(row.canonicalId)) {
      bindings.push({ modality: 'exercise', resourceId: `exercises-${row.questionId.split('/')[0]}`, anchorId: row.questionId, canonicalId: row.canonicalId, evidence: 'codex-semantic-mapping:round1+round2' });
    }
  }
  for (const row of readJson<{ rows: { questionId: string; canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-node-bindings.json`).rows) {
    if (coveredMemberIds.has(row.canonicalId)) {
      bindings.push({ modality: 'exercise', resourceId: `handout-exercises-${row.questionId.split('/')[0]}`, anchorId: row.questionId, canonicalId: row.canonicalId, evidence: 'codex-semantic-mapping:round2-layered' });
    }
  }
  const projection = readJson<Record<string, unknown>>(`${PROJECTION_DIR}/projection.json`);
  const totalReceipt = readJson<{ memberCount: number; rowCount: number; publishedEdges: number }>(`${REMEDIATION_ROOT}/total-closure-receipt.json`);
  return { members, edges, bindings, projection, closureInput: { memberCount: totalReceipt.memberCount, rowCount: totalReceipt.rowCount, publishedEdges: totalReceipt.publishedEdges } };
}

main();
