#!/usr/bin/env tsx
/**
 * Materialize the v0.37 runtime knowledge surfaces for the coordinated
 * cutover (#1509 section 9, first surface). Stages the Teaching Projection
 * store release from the remediation projection artifacts bound to the
 * v0.37 Authority snapshot snap-e955b1ca…: 1058 governance resources,
 * the 2575 modality bindings rebuilt from the sealed binding sources, the
 * prerequisite-family published edges, and the 7476 authority endpoints.
 *
 * Candidate-only: writes course-content/runtime/knowledge/projection/
 * releases/<projectionId>/ and never touches a current pointer.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  resolveTeachingProjectionStorePaths,
  stageTeachingProjection,
} from '@/lib/teaching-projection/store';
import {
  resolvePrerequisiteStorePaths,
  stagePrerequisitePublication,
} from '@/lib/teaching-projection/prerequisites/store';
import { createPrerequisiteAuthorDecision } from '@/lib/teaching-projection/prerequisites/publication';
import {
  resolveConsumerActivationStorePaths,
  stageConsumerActivation,
} from '@/lib/versioned-knowledge-activation/store';
import type {
  CoreNodeAuthoringRow,
  PrerequisiteAuthorDecision,
  PrerequisiteEdgeAuthoring,
} from '@/lib/teaching-projection/prerequisites/contracts';
import type {
  AuthorityNodeIndexEntry,
  TeachingBindingAuthoring,
  TeachingCardAuthoring,
  TeachingPrerequisiteAuthoring,
  TeachingProjectionAuthoringInput,
  TeachingResourceAuthoring,
} from '@/lib/teaching-projection/contracts';

const ROOT = process.cwd();
const REMEDIATION_ROOT = 'course-content/authoring/knowledge/formal-resource-remediation';
const PROJECTION_DIR = `${REMEDIATION_ROOT}/teaching-projection`;
const TEACHING_STORE_ROOT = 'course-content/runtime/knowledge/projection';
const PREREQ_STORE_ROOT = 'course-content/runtime/knowledge/prerequisites';
const CURATOR_ID = 'course-owner';
const CONSUMER_STORE_ROOT = 'course-content/runtime/knowledge/consumer-activation';
// The shared capture identity is the ACT-side build revision that the
// authority snapshot sealed as its captureRevision (same source as
// authoringRevision below); the ActKG source commit stays on the bundle only.
const SCOPE_ID = 'act-control-theory';
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
const RESOURCE_TYPE_BY_SUBTYPE: Record<string, TeachingResourceAuthoring['resourceType']> = {
  handout: 'handout',
  card: 'card',
  audio: 'audio',
  exercise: 'exercise',
  'intro-video': 'video',
  'simulation-interactive': 'simulation',
  'handout-exercise': 'exercise',
};
const ROLE_BY_MODALITY: Record<string, TeachingBindingAuthoring['role']> = {
  card: 'COVERS',
  audio: 'EXPLAINS',
  'intro-video': 'EXPLAINS',
  exercise: 'PRACTICES',
};

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(absolute(filePath), 'utf8')) as T;
}

function parseArgs(argv: readonly string[]): {
  readonly snapshotDir: string;
  readonly scopePath: string;
  readonly governanceOut: string;
  readonly stagedAt: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--') || values.has(key)) {
      throw new Error(`invalid argument near ${key ?? '<end>'}`);
    }
    values.set(key, value);
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) throw new Error(`missing ${key}`);
    return value;
  };
  for (const key of values.keys()) {
    if (!['--snapshot-dir', '--scope-path', '--governance-out', '--staged-at'].includes(key)) {
      throw new Error(`unknown option ${key}`);
    }
  }
  const stagedAt = required('--staged-at');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(stagedAt)) {
    throw new Error('--staged-at must be a millisecond RFC3339 UTC timestamp');
  }
  return {
    snapshotDir: required('--snapshot-dir'),
    scopePath: required('--scope-path'),
    governanceOut: required('--governance-out'),
    stagedAt,
  };
}

/**
 * Deterministic remediation-id -> teaching-projection-id normalization.
 * The projection store requires act:<type>:<slug>; the remediation ids stay
 * recoverable from the slug (they never contain ':' or whitespace).
 */
function normalizeResourceId(resourceId: string, subtype: string): string {
  if (subtype === 'handout') return `act:handout:${resourceId.replace(/^handout-/u, '')}`;
  if (subtype === 'card') return `act:card:${resourceId.replace(/^card-/u, '')}`;
  if (subtype === 'audio') return `act:audio:${resourceId.replace(/^media-/u, '').replace(/-audio$/u, '')}`;
  if (subtype === 'exercise') return `act:exercise:${resourceId.replace(/^exercises-/u, '')}`;
  if (subtype === 'intro-video') return `act:video:${resourceId.replace(/^intro-video-/u, '')}`;
  if (subtype === 'simulation-interactive') return `act:simulation:${resourceId.replace(/^launcher-/u, '')}`;
  if (subtype === 'handout-exercise') return `act:exercise:handout-${resourceId.replace(/^handout-exercises-/u, '')}`;
  throw new Error(`no id normalization for subtype ${subtype}`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readJson<{
    readonly releaseId: string;
    readonly releaseSetId: string;
    readonly snapshotId: string;
    readonly snapshotHash: string;
    readonly captureRevision: string;
  }>(path.join(args.snapshotDir, 'manifest.json'));
  if (!/^[a-f0-9]{40}$/u.test(manifest.captureRevision)) {
    throw new Error('snapshot manifest captureRevision must be a Git commit');
  }
  const engineering = readJson<{ readonly objects: readonly { canonicalId: string; publicationStatus: string | null }[] }>(path.join(args.snapshotDir, 'engineering.json'));
  const authoringRevision = manifest.captureRevision;

  // Resources: every remediation governance resource enters the projection
  // surface; resources without bindings stay OPTIONAL (honest, ungated).
  interface ProcessingRow { readonly resourceId: string; readonly resourceSubtype: string; readonly sourceIdentity: string }
  const processingRows = RECORD_PATHS.flatMap((recordPath) => readJson<ProcessingRow[]>(recordPath));
  const bindingCountByResource = new Map<string, number>();
  const normalizedIdByRaw = new Map<string, string>();
  for (const row of processingRows) {
    normalizedIdByRaw.set(row.resourceId, normalizeResourceId(row.resourceId, row.resourceSubtype));
    bindingCountByResource.set(normalizedIdByRaw.get(row.resourceId) as string, 0);
  }
  const resources: TeachingResourceAuthoring[] = processingRows.map((row) => {
    const resourceType = RESOURCE_TYPE_BY_SUBTYPE[row.resourceSubtype];
    if (!resourceType) throw new Error(`unknown remediation subtype ${row.resourceSubtype}`);
    return {
      resourceId: normalizedIdByRaw.get(row.resourceId) as string,
      resourceType,
      scopeId: SCOPE_ID,
      projectionMode: 'OPTIONAL',
      sourcePath: row.sourceIdentity,
    };
  });

  // Bindings: rebuild the modality-independent rows from the sealed binding
  // sources (same sources the projection seal used). Audio anchor ids are
  // normalized onto the envelope resource id form media-<unit>-audio.
  const scopeArtifact = readJson<{
    scopeHash: string;
    authority: { releaseId: string; releaseSetId: string; snapshotId: string; snapshotHash: string };
    members: { canonicalId: string; preferredDomainId: string }[];
  }>(args.scopePath);
  if (scopeArtifact.authority.releaseId !== manifest.releaseId
    || scopeArtifact.authority.releaseSetId !== manifest.releaseSetId
    || scopeArtifact.authority.snapshotId !== manifest.snapshotId
    || scopeArtifact.authority.snapshotHash !== manifest.snapshotHash) {
    throw new Error('scope Authority identity does not match the staged snapshot');
  }
  const coveredMemberIds = new Set(
    scopeArtifact.members
      .filter((member) => !(EXCLUDED_DOMAINS as readonly string[]).includes(member.preferredDomainId))
      .map((member) => member.canonicalId),
  );
  const bindings: TeachingBindingAuthoring[] = [];
  const cardNameIndex = readJson<{ readonly index: Record<string, string> }>(`${REMEDIATION_ROOT}/resource-layer/text/card-name-index.json`).index;
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
      bindings.push({ resourceId: normalizedIdByRaw.get(atom.resourceId) ?? atom.resourceId, canonicalId, role: 'COVERS', scopeId: SCOPE_ID });
    }
  }
  const segmentDir = `${REMEDIATION_ROOT}/20260823-asr-batch/audio-semantic-segments`;
  for (const unitFile of readdirSync(absolute(segmentDir)).filter((name) => name.endsWith('.json')).sort()) {
    const unit = unitFile.replace(/\.json$/u, '');
    const file = readJson<{ segments: { nodeBindings: { canonicalId: string }[] }[] }>(`${segmentDir}/${unitFile}`);
    file.segments.forEach((segment) => {
      for (const binding of segment.nodeBindings) {
        if (!coveredMemberIds.has(binding.canonicalId)) continue;
        bindings.push({ resourceId: normalizedIdByRaw.get(`media-${unit}-audio`) ?? `media-${unit}-audio`, canonicalId: binding.canonicalId, role: 'EXPLAINS', scopeId: SCOPE_ID });
      }
    });
  }
  for (const row of readJson<{ rows: { atomId: string; resourceId: string; canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/intro-videos/intro-video-node-bindings.json`).rows) {
    if (coveredMemberIds.has(row.canonicalId)) {
      bindings.push({ resourceId: normalizedIdByRaw.get(row.resourceId) ?? row.resourceId, canonicalId: row.canonicalId, role: 'EXPLAINS', scopeId: SCOPE_ID });
    }
  }
  for (const row of readJson<{ rows: { questionId: string; canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/exercises/exercise-node-bindings.json`).rows) {
    if (coveredMemberIds.has(row.canonicalId)) {
      bindings.push({ resourceId: normalizedIdByRaw.get(`exercises-${row.questionId.split('/')[0]}`) ?? `exercises-${row.questionId.split('/')[0]}`, canonicalId: row.canonicalId, role: 'PRACTICES', scopeId: SCOPE_ID });
    }
  }
  for (const row of readJson<{ rows: { questionId: string; canonicalId: string }[] }>(`${REMEDIATION_ROOT}/resource-layer/handout-exercises/handout-exercise-node-bindings.json`).rows) {
    if (coveredMemberIds.has(row.canonicalId)) {
      bindings.push({ resourceId: normalizedIdByRaw.get(`handout-exercises-${row.questionId.split('/')[0]}`) ?? `handout-exercises-${row.questionId.split('/')[0]}`, canonicalId: row.canonicalId, role: 'PRACTICES', scopeId: SCOPE_ID });
    }
  }
  // Atom- and segment-level hits aggregate onto resource-level identities;
  // one resource binds one concept once per role.
  const seenBindingKeys = new Set<string>();
  const dedupedBindings: TeachingBindingAuthoring[] = [];
  for (const binding of bindings) {
    const key = `${binding.resourceId}\u0000${binding.canonicalId}\u0000${binding.role}\u0000${binding.scopeId}`;
    if (seenBindingKeys.has(key)) continue;
    seenBindingKeys.add(key);
    dedupedBindings.push(binding);
  }
  bindings.length = 0;
  bindings.push(...dedupedBindings);
  for (const binding of bindings) {
    bindingCountByResource.set(binding.resourceId, (bindingCountByResource.get(binding.resourceId) ?? 0) + 1);
  }
  for (const resource of resources) {
    if ((bindingCountByResource.get(resource.resourceId) ?? 0) > 0) {
      resource.projectionMode = 'REQUIRED';
    }
  }

  // Prerequisites: the prerequisite-family published edges from the sealed
  // fifteen-domain ledgers (evidence refs travel with each row).
  const prerequisites: TeachingPrerequisiteAuthoring[] = [];
  const suppressedSelfLoopPrerequisites: {
    canonicalId: string;
    edgeId: string;
    evidenceRefs: readonly string[];
  }[] = [];
  for (const domain of ALL_DOMAINS) {
    const ledger = readJson<{ rows: { canonicalId: string; family: string; disposition: string; target: string | null; evidenceRefs: string[] }[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`);
    for (const row of ledger.rows) {
      if (row.family !== 'prerequisite' || row.disposition !== 'PUBLISHED_EDGE' || !row.target) continue;
      if (row.target === row.canonicalId) {
        suppressedSelfLoopPrerequisites.push({
          canonicalId: row.canonicalId,
          edgeId: row.edgeId,
          evidenceRefs: row.evidenceRefs,
        });
        continue;
      }
      prerequisites.push({
        sourceCanonicalId: row.canonicalId,
        targetCanonicalId: row.target,
        strength: 'RECOMMENDED',
        evidenceRef: row.evidenceRefs[0] ?? null,
        scopeId: SCOPE_ID,
      });
    }
  }

  // Cards index: card-typed resources carry their first bound concept.
  const firstBindingByResource = new Map<string, string>();
  for (const binding of bindings) {
    if (!firstBindingByResource.has(binding.resourceId)) firstBindingByResource.set(binding.resourceId, binding.canonicalId);
  }
  const cardCandidates = processingRows
    .filter((row) => row.resourceSubtype === 'card' && firstBindingByResource.has(normalizedIdByRaw.get(row.resourceId) ?? ''))
    .map((row) => {
      const resourceId = normalizedIdByRaw.get(row.resourceId) as string;
      return {
      resourceId,
      cardId: resourceId.replace(/^act:card:/u, ''),
      canonicalId: firstBindingByResource.get(normalizedIdByRaw.get(row.resourceId) ?? '') as string,
      required: false,
      };
    })
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const firstActiveCardByCanonical = new Map<string, string>();
  for (const card of cardCandidates) {
    if (!firstActiveCardByCanonical.has(card.canonicalId)) {
      firstActiveCardByCanonical.set(card.canonicalId, card.resourceId);
    }
  }
  const cards: TeachingCardAuthoring[] = cardCandidates.map((card) => ({
    cardId: card.cardId,
    canonicalId: card.canonicalId,
    active: firstActiveCardByCanonical.get(card.canonicalId) === card.resourceId,
    required: card.required,
  }));

  const authorityNodes: AuthorityNodeIndexEntry[] = engineering.objects.map((object) => ({
    canonicalId: object.canonicalId,
    lifecycleStatus: 'active',
    successorCanonicalId: null,
  }));

  const input: TeachingProjectionAuthoringInput = {
    scopeId: SCOPE_ID,
    authoringRevision,
    authorityReleaseId: manifest.releaseId,
    authorityReleaseSetId: manifest.releaseSetId,
    authoritySnapshotId: manifest.snapshotId,
    authoritySnapshotHash: manifest.snapshotHash,
    resources,
    bindings,
    prerequisites,
    cards,
    authorityNodes,
  };

  // Self-check: canonical JSON rejects explicit-undefined fields; find them
  // before the library does.
  const findUndefined = (value: unknown, trail: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => findUndefined(item, `${trail}[${index}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (inner === undefined) throw new Error(`undefined field at ${trail}.${key}`);
        findUndefined(inner, `${trail}.${key}`);
      }
    }
  };
  findUndefined(input, 'input');

  const paths = resolveTeachingProjectionStorePaths(absolute(TEACHING_STORE_ROOT));
  const staged = stageTeachingProjection(paths, input);

  // ---- Prerequisites publication surface ----
  // Published prerequisite edges come from the prerequisite-family ledger
  // rows; the #1515 owner rulings provide the author decisions, and the edge
  // endpoints form the core-node denominator (sourceKind PREREQUISITE_ENDPOINT).
  const rationaleByMember = new Map<string, string>();
  for (const domain of ALL_DOMAINS) {
    const decisionsPath = absolute(`${REMEDIATION_ROOT}/${domain}-closure/decisions.jsonl`);
    if (!existsSync(decisionsPath)) continue;
    for (const line of readFileSync(decisionsPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const decision = JSON.parse(line) as { canonicalId: string; rationale?: string };
      rationaleByMember.set(decision.canonicalId, decision.rationale ?? `domain-closure:${domain}`);
    }
  }
  const prerequisiteEdges: PrerequisiteEdgeAuthoring[] = [];
  const coreNodeEvidence = new Map<string, Set<string>>();
  for (const domain of ALL_DOMAINS) {
    const ledger = readJson<{ rows: { canonicalId: string; family: string; disposition: string; target: string | null; edgeId: string; evidenceRefs: string[] }[] }>(`${REMEDIATION_ROOT}/${domain}-closure/final-ledger.json`);
    for (const row of ledger.rows) {
      if (row.family !== 'prerequisite' || row.disposition !== 'PUBLISHED_EDGE' || !row.target || row.target === row.canonicalId) continue;
      const decisionId = `dec-${row.edgeId.slice(0, 24)}`;
      prerequisiteEdges.push({
        edgeId: row.edgeId,
        sourceNodeId: row.canonicalId,
        targetNodeId: row.target,
        strength: 'RECOMMENDED',
        scopeId: SCOPE_ID,
        evidenceRefs: row.evidenceRefs,
        status: 'PUBLISHED',
        authorDecisionId: decisionId,
      });
      for (const endpoint of [row.canonicalId, row.target]) {
        const evidence = coreNodeEvidence.get(endpoint) ?? new Set<string>();
        for (const ref of row.evidenceRefs) evidence.add(ref);
        coreNodeEvidence.set(endpoint, evidence);
      }
    }
  }
  const publicationDecisions: PrerequisiteAuthorDecision[] = prerequisiteEdges.map((edge) => createPrerequisiteAuthorDecision({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    strength: edge.strength,
    scopeId: edge.scopeId,
    evidenceRefs: edge.evidenceRefs,
    curatorId: CURATOR_ID,
    rationale: rationaleByMember.get(edge.sourceNodeId) ?? 'prerequisite-family closure ruling (#1515 domain ledger)',
    authorityReleaseId: manifest.releaseId,
    projectionCaptureId: staged.projectionId,
    authoringRevision,
    decisionId: edge.authorDecisionId ?? undefined,
    decidedAt: args.stagedAt,
  }));
  const coreNodeRows: CoreNodeAuthoringRow[] = [...coreNodeEvidence.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([canonicalId, evidence]) => ({
      canonicalId,
      scopeId: SCOPE_ID,
      pathEligible: true,
      cardPolicy: 'OPTIONAL',
      moduleId: null,
      rationale: rationaleByMember.get(canonicalId) ?? 'prerequisite endpoint of the #1515 three-family closure',
      sourceKind: 'PREREQUISITE_ENDPOINT',
      sourceEvidence: [...evidence].sort(),
    }));

  const prereqStore = resolvePrerequisiteStorePaths(absolute(PREREQ_STORE_ROOT));
  const publication = stagePrerequisitePublication(prereqStore, {
    useCurrentAsPrior: false,
    scopeId: SCOPE_ID,
    authoringRevision,
    authorityReleaseId: manifest.releaseId,
    projectionCaptureId: staged.projectionId,
    authorityNodes,
    coreNodes: coreNodeRows,
    edges: prerequisiteEdges,
    decisions: publicationDecisions,
  });

  const governanceAdjustment = {
    contract: 'act-coordinated-projection-adjustments/v1',
    scopeHash: scopeArtifact.scopeHash,
    authoritySnapshotHash: manifest.snapshotHash,
    stagedAt: args.stagedAt,
    suppressedSelfLoopPrerequisites,
    inactiveDuplicateCards: cardCandidates
      .filter((card) => firstActiveCardByCanonical.get(card.canonicalId) !== card.resourceId)
      .map((card) => ({ resourceId: card.resourceId, canonicalId: card.canonicalId })),
  };
  const governanceOut = absolute(args.governanceOut);
  mkdirSync(path.dirname(governanceOut), { recursive: true });
  const governanceContent = `${JSON.stringify(governanceAdjustment, null, 2)}\n`;
  if (existsSync(governanceOut) && readFileSync(governanceOut, 'utf8') !== governanceContent) {
    throw new Error(`refusing to overwrite immutable governance adjustment ${governanceOut}`);
  }
  if (!existsSync(governanceOut)) writeFileSync(governanceOut, governanceContent, 'utf8');

  console.log(JSON.stringify({
    projectionId: staged.projectionId,
    projectionHash: staged.projectionHash.slice(0, 16),
    reused: staged.reused,
    resources: resources.length,
    bindings: bindings.length,
    prerequisites: prerequisites.length,
    cards: cards.length,
    suppressedSelfLoopPrerequisites: suppressedSelfLoopPrerequisites.length,
    inactiveDuplicateCards: governanceAdjustment.inactiveDuplicateCards.length,
    authorityNodes: authorityNodes.length,
    authoritySnapshotId: manifest.snapshotId,
    pointerWritten: false,
    prerequisitePublication: {
      publicationId: publication.publicationId,
      publicationHash: publication.publicationHash.slice(0, 16),
      reused: publication.reused,
      edges: prerequisiteEdges.length,
      coreNodes: coreNodeRows.length,
      decisions: publicationDecisions.length,
      pointerWritten: false,
    },
  }, null, 2));

  // ---- Consumer activation surface ----
  // Stages the shared-consumer activation manifest over the rehashed
  // authority snapshot and teaching projection artifacts (six consumers).
  const snapshotDirAbs = absolute(args.snapshotDir);
  const projectionDirAbs = absolute(`${TEACHING_STORE_ROOT}/releases/${staged.projectionId}`);
  const stagedProjectionManifest = readJson<{ gatePassed: boolean; projectionHash: string }>(`${TEACHING_STORE_ROOT}/releases/${staged.projectionId}/projection-manifest.json`);
  const hashFile = (filePath: string): string => createHash('sha256').update(readFileSync(absolute(filePath))).digest('hex');
  const projectionArtifactNames = [
    'projection-manifest.json',
    'resources.jsonl',
    'bindings.jsonl',
    'cards-index.json',
    'prerequisites.jsonl',
    'core-nodes.json',
    'impact-report.json',
    'gate.json',
  ] as const;
  const consumerStore = resolveConsumerActivationStorePaths(absolute(CONSUMER_STORE_ROOT));
  const activation = stageConsumerActivation(consumerStore, {
    artifacts: {
      captureRevision: authoringRevision,
      authority: {
        present: true,
        releaseId: manifest.releaseId,
        snapshotId: manifest.snapshotId,
        snapshotHash: manifest.snapshotHash,
        captureRevision: authoringRevision,
        artifactHashes: {
          'manifest.json': hashFile(path.join(args.snapshotDir, 'manifest.json')),
          'engineering.json': hashFile(path.join(args.snapshotDir, 'engineering.json')),
        },
        artifactPaths: {
          'manifest.json': `${snapshotDirAbs}/manifest.json`,
          'engineering.json': `${snapshotDirAbs}/engineering.json`,
        },
      },
      projection: {
        present: true,
        projectionId: staged.projectionId,
        projectionHash: stagedProjectionManifest.projectionHash,
        authorityReleaseId: manifest.releaseId,
        captureRevision: null,
        gatePassed: stagedProjectionManifest.gatePassed,
        artifactHashes: Object.fromEntries(projectionArtifactNames.map((name) => [name, hashFile(`${TEACHING_STORE_ROOT}/releases/${staged.projectionId}/${name}`)])),
        artifactPaths: Object.fromEntries(projectionArtifactNames.map((name) => [name, `${projectionDirAbs}/${name}`])),
        hasResources: true,
        hasCardsIndex: true,
        hasPrerequisites: true,
        hasImpactReport: true,
      },
    },
    stagedAt: args.stagedAt,
  });

  console.log(JSON.stringify({
    consumerActivation: {
      activationId: activation.activationId,
      activationHash: activation.activationHash.slice(0, 16),
      consumers: activation.manifest.consumers.map((consumer: { consumerId?: string; id?: string; status?: string }) => ({ id: consumer.consumerId ?? consumer.id ?? 'unknown', status: consumer.status })),
      pointerWritten: false,
    },
  }, null, 2));
}

main();
