#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import {
  activateAuthoritySnapshot,
  emptyTeachingSelectorFingerprint,
  loadStagedAuthoritySnapshot,
  resolveActiveAuthoritySnapshot,
  resolveAuthorityStorePaths,
  stageAuthoritySnapshotArtifacts,
  type AuthorityEngineeringBody,
  type AuthoritySnapshotManifest,
} from '../../src/lib/authoritative-knowledge';
import {
  buildTeachingResourceLaunchMaps,
} from '../../src/lib/layered-graph/course-page-context';
import {
  executeFirstActivation,
  readFirstActivationPointerIdentity,
  rollbackCommittedFirstActivation,
  type FirstActivationStep,
} from '../../src/lib/knowledge-cutover/first-activation';
import {
  activatePrerequisitePublication,
  buildPrerequisitePublication,
  parseCoreNodesDocument,
  parseEdgesDocument,
  resolvePrerequisiteStorePaths,
  stagePrerequisitePublication,
  type PrerequisitePublicationBuildInput,
} from '../../src/lib/teaching-projection/prerequisites';
import {
  buildTeachingProjection,
  type TeachingProjectionAuthoringInput,
} from '../../src/lib/teaching-projection';
import {
  activateTeachingProjection,
  loadStagedTeachingProjection,
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
  stageTeachingProjectionArtifacts,
} from '../../src/lib/teaching-projection/store';
import {
  assertBlueprintBindingsMatchRevision,
  loadActkgCutoverBlueprintBindings,
} from '../../src/lib/teaching-projection/actkg-cutover-blueprint-bindings';
import {
  defaultAuthorDecisionsPath,
  loadAuthorDecisionsFromFile,
} from '../../src/lib/teaching-projection/author-decisions';
import { loadCardCrosswalk } from '../../src/lib/teaching-projection/cards/crosswalk';
import { loadLegacyCrosswalk } from '../../src/lib/teaching-projection/crosswalk';
import {
  loadAndBuildTextbookLocatorProjection,
  textbookProjectionToTeachingAuthoring,
} from '../../src/lib/teaching-projection/textbook-locators/builder';
import {
  buildTeachingProjectionCandidate,
  loadStagedAuthority,
} from './prepare-actkg-cutover-teaching-projection';
import {
  activateConsumerActivation,
  assertShadowNoWriteInvariants,
  buildStagedActivationManifest,
  resolveActiveConsumerActivation,
  resolveConsumerActivation,
  resolveConsumerActivationStorePaths,
  runConsumerActivationShadow,
  shadowViewsFromManifest,
  stageConsumerActivation,
  type ConsumerActivationId,
  type StagedActivationArtifactSet,
} from '../../src/lib/versioned-knowledge-activation';

const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ACTIVE_RESOURCE_COUNT = 551;
const ACTIVE_BOUND_COUNT = 519;
const ACTIVE_EXPLICIT_NONE_COUNT = 32;
const ACTIVE_PACKAGE_COUNT = 32;
const DEFAULTS = {
  authority: 'course-content/authoring/knowledge/authority',
  projection: 'course-content/runtime/knowledge/projection',
  prerequisite: 'course-content/runtime/knowledge/prerequisites',
  consumer: 'course-content/runtime/knowledge/consumer-activation',
  retirement: 'course-content/runtime/knowledge/legacy-retirement',
} as const;

function fail(message: string): never {
  throw new Error(`ActKG → ACT first activation rejected: ${message}`);
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith('--')) fail(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function relative(repoRoot: string, target: string): string {
  const value = path.relative(path.resolve(repoRoot), path.resolve(target));
  return value === '' ? '.' : value.split(path.sep).join('/');
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    fail(`cannot read ${relative(process.cwd(), filePath)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeCanonical(filePath: string, value: unknown): Promise<void> {
  return mkdir(path.dirname(filePath), { recursive: true })
    .then(() => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'));
}

function assertCaptureHead(repoRoot: string, captureRevision: string): void {
  const head = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== captureRevision) fail(`HEAD differs from captureRevision: ${head}`);
}

function assertAbsent(pointerPath: string, label: string): void {
  if (existsSync(pointerPath)) fail(`${label} must be absent for first activation`);
}

function assertFirstActivationPrestate(repoRoot: string): void {
  assertAbsent(path.join(repoRoot, DEFAULTS.authority, 'current.json'), 'Authority current.json');
  assertAbsent(path.join(repoRoot, DEFAULTS.projection, 'current.json'), 'Teaching Projection current.json');
  assertAbsent(path.join(repoRoot, DEFAULTS.prerequisite, 'current.json'), 'prerequisite current.json');
  assertAbsent(path.join(repoRoot, DEFAULTS.consumer, 'current.json'), 'consumer activation current.json');
  assertAbsent(path.join(repoRoot, DEFAULTS.retirement, 'current.json'), 'legacy retirement current.json');
}

function requiredHash(hash: string, label: string): string {
  if (!SHA256.test(hash)) fail(`${label} must be a SHA-256 hex digest`);
  return hash;
}

function pointerTarget(component: FirstActivationStep['component'], id: string, hash: string) {
  return { component, id, hash: requiredHash(hash, `${component} hash`) } as const;
}

function assertion(value: boolean, message: string): void {
  if (!value) fail(message);
}

function buildPrerequisiteInput(input: {
  repoRoot: string;
  captureRevision: string;
  authority: AuthoritySnapshotManifest;
  authorityNodes: ReturnType<typeof buildTeachingProjectionCandidate>['authorityNodes'];
}): PrerequisitePublicationBuildInput {
  const inventoryRoot = path.join(
    input.repoRoot,
    'course-content/authoring/knowledge/teaching-projection/prerequisites/inventory',
  );
  const core = parseCoreNodesDocument(parseYaml(readFileSync(path.join(inventoryRoot, 'core-nodes.yaml'), 'utf8')));
  const edges = parseEdgesDocument(parseYaml(readFileSync(path.join(inventoryRoot, 'edges.yaml'), 'utf8')));
  const decisions = readJson(path.join(inventoryRoot, 'actkg-cutover-decisions.json'));
  if (!Array.isArray(decisions)) fail('prerequisite decisions must be an array');
  return {
    scopeId: core.scopeId,
    authoringRevision: input.captureRevision,
    authorityReleaseId: input.authority.releaseId,
    projectionCaptureId: input.authority.snapshotId,
    authorityNodes: input.authorityNodes,
    coreNodes: core.nodes,
    edges: edges.edges,
    decisions,
    candidates: [],
  };
}

function buildGlobalAuthoring(input: {
  repoRoot: string;
  captureRevision: string;
  authority: AuthoritySnapshotManifest;
  authorityNodes: ReturnType<typeof buildTeachingProjectionCandidate>['authorityNodes'];
  packageAuthoring: ReturnType<typeof buildTeachingProjectionCandidate>['packageAuthoring'];
  prerequisite: ReturnType<typeof buildPrerequisitePublication>;
  cards: ReadonlyArray<{
    cardId: string;
    canonicalId: string;
    active: boolean;
    sourceEvidence?: string | null;
  }>;
}): TeachingProjectionAuthoringInput {
  const canonicalIds = new Set(
    input.authorityNodes
      .filter((node) => !['retired', 'draft'].includes(String(node.lifecycleStatus).toLowerCase()))
      .map((node) => node.canonicalId),
  );
  const textbook = loadAndBuildTextbookLocatorProjection({
    scopeId: 'act-control-theory-active-courses',
    repoRoot: input.repoRoot,
    authorityCanonicalIds: canonicalIds,
    projectionBuildId: `cutover-textbook-${input.authority.snapshotHash.slice(0, 16)}`,
  });
  const textbookAuthoring = textbookProjectionToTeachingAuthoring({ projection: textbook });
  if (!textbookAuthoring.included) fail(textbookAuthoring.reason ?? 'textbook slice is not publishable');
  const packageRows = input.packageAuthoring.map((entry) => entry.authoring);
  const requiredCoreIds = new Set(
    input.prerequisite.projectionCoreNodes
      .filter((node) => node.cardPolicy === 'required')
      .map((node) => node.canonicalId),
  );
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: 'act-control-theory-active-courses',
    authoringRevision: input.captureRevision,
    authorityReleaseId: input.authority.releaseId,
    authorityReleaseSetId: input.authority.releaseSetId,
    authoritySnapshotId: input.authority.snapshotId,
    authoritySnapshotHash: input.authority.snapshotHash,
    resources: [
      ...packageRows.flatMap((entry) => entry.resources ?? []),
      ...textbookAuthoring.resources,
    ],
    bindings: [
      ...packageRows.flatMap((entry) => entry.bindings ?? []),
      ...textbookAuthoring.bindings,
    ],
    prerequisites: input.prerequisite.projectionPrerequisites,
    coreNodes: input.prerequisite.projectionCoreNodes,
    cards: input.cards.map((card) => ({
      cardId: card.cardId,
      canonicalId: card.canonicalId,
      active: card.active,
      required: requiredCoreIds.has(card.canonicalId),
      sourcePath: card.sourceEvidence ?? undefined,
    })),
    authorityNodes: input.authorityNodes,
  };
}

function projectionArtifactPaths(releaseDir: string): Record<string, string> {
  return Object.fromEntries([
    'projection-manifest.json',
    'resources.jsonl',
    'bindings.jsonl',
    'cards-index.json',
    'prerequisites.jsonl',
    'core-nodes.json',
    'impact-report.json',
    'gate.json',
  ].map((name) => [name, path.join(releaseDir, name)]));
}

function activationArtifacts(input: {
  captureRevision: string;
  authority: ReturnType<typeof stageAuthoritySnapshotArtifacts>;
  projection: ReturnType<typeof stageTeachingProjectionArtifacts>;
}): StagedActivationArtifactSet {
  const projectionPaths = projectionArtifactPaths(input.projection.releaseDir);
  const routeMaps = buildTeachingResourceLaunchMaps(input.projection.artifacts.resources);
  const launchable = input.projection.artifacts.resources.filter((resource) => (
    resource.resourceType === 'lesson'
    || resource.resourceType === 'handout'
    || resource.resourceType === 'step'
  ));
  const missingLaunches = launchable
    .filter((resource) => !routeMaps.resourceLaunchTargets[resource.resourceId])
    .map((resource) => resource.resourceId)
    .sort();
  const routeSmoke = {
    'engineering-graph': {
      ok: input.authority.engineering.objects.length > 0,
      reasons: input.authority.engineering.objects.length > 0 ? [] : ['authority-objects-empty'],
    },
    'engineering-rag': {
      ok: input.authority.engineering.evidence.length > 0,
      reasons: input.authority.engineering.evidence.length > 0 ? [] : ['authority-evidence-empty'],
    },
    'course-runtime': {
      ok: missingLaunches.length === 0,
      reasons: missingLaunches.map((resourceId) => `missing-launch:${resourceId}`),
    },
    konling: {
      ok: existsSync(projectionPaths['cards-index.json']),
      reasons: existsSync(projectionPaths['cards-index.json']) ? [] : ['cards-index-missing'],
    },
    'teaching-resource-rag': {
      ok: existsSync(projectionPaths['cards-index.json']),
      reasons: existsSync(projectionPaths['cards-index.json']) ? [] : ['cards-index-missing'],
    },
    'learning-path': {
      ok: input.projection.artifacts.prerequisites.length > 0,
      reasons: input.projection.artifacts.prerequisites.length > 0 ? [] : ['prerequisites-empty'],
    },
  } satisfies Record<ConsumerActivationId, { ok: boolean; reasons: string[] }>;
  return {
    captureRevision: input.captureRevision,
    authority: {
      present: true,
      releaseId: input.authority.manifest.releaseId,
      snapshotId: input.authority.snapshotId,
      snapshotHash: input.authority.snapshotHash,
      captureRevision: input.authority.manifest.captureRevision,
      artifactHashes: {
        'manifest.json': sha256(readFileSync(input.authority.manifestPath)),
        'engineering.json': sha256(readFileSync(input.authority.engineeringPath)),
      },
      artifactPaths: {
        'manifest.json': input.authority.manifestPath,
        'engineering.json': input.authority.engineeringPath,
      },
    },
    projection: {
      present: true,
      projectionId: input.projection.projectionId,
      projectionHash: input.projection.projectionHash,
      authorityReleaseId: input.projection.artifacts.manifest.authorityReleaseId,
      captureRevision: input.projection.artifacts.manifest.authoringRevision,
      gatePassed: input.projection.artifacts.gate.passed,
      artifactHashes: Object.fromEntries(
        Object.entries(projectionPaths).map(([name, filePath]) => [name, sha256(readFileSync(filePath))]),
      ),
      artifactPaths: projectionPaths,
      hasResources: input.projection.artifacts.resources.length > 0,
      hasCardsIndex: true,
      hasPrerequisites: input.projection.artifacts.prerequisites.length > 0,
      hasImpactReport: true,
    },
    routeSmoke,
  };
}

function assertReadyConsumerSet(input: {
  repoRoot: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
  projectionId: string;
  projectionHash: string;
}): Record<string, string> {
  const paths = resolveConsumerActivationStorePaths(path.join(input.repoRoot, DEFAULTS.consumer));
  const active = resolveActiveConsumerActivation(paths);
  assertion(active.status === 'available' && active.manifest !== null, 'consumer activation did not resolve after commit');
  const results: Record<string, string> = {};
  for (const consumerId of [
    'engineering-graph',
    'engineering-rag',
    'course-runtime',
    'konling',
    'teaching-resource-rag',
    'learning-path',
  ] as const) {
    const resolved = resolveConsumerActivation(paths, consumerId);
    assertion(resolved.status === 'ready', `${consumerId} is not READY after commit`);
    assertion(resolved.combination?.authoritySnapshotId === input.authoritySnapshotId, `${consumerId} Authority snapshot mismatch`);
    assertion(resolved.combination?.authoritySnapshotHash === input.authoritySnapshotHash, `${consumerId} Authority hash mismatch`);
    if (consumerId !== 'engineering-graph' && consumerId !== 'engineering-rag') {
      assertion(resolved.combination?.projectionId === input.projectionId, `${consumerId} Projection id mismatch`);
      assertion(resolved.combination?.projectionHash === input.projectionHash, `${consumerId} Projection hash mismatch`);
    }
    results[consumerId] = resolved.status;
  }
  return results;
}

function buildConsumerActivation(input: {
  root: string;
  artifacts: StagedActivationArtifactSet;
  stagedAt: string;
  activationId: string;
}) {
  const preflight = buildStagedActivationManifest({
    artifacts: input.artifacts,
    stagedAt: input.stagedAt,
    activationId: input.activationId,
  });
  if (preflight.status !== 'staged' || !preflight.manifest) {
    fail(`consumer preflight staging failed: ${preflight.reasons.join(',')}`);
  }
  const preflightManifest = preflight.manifest;
  const shadow = runConsumerActivationShadow({
    activationId: preflightManifest.activationId,
    previousActivationId: null,
    previous: [],
    next: shadowViewsFromManifest(preflightManifest),
    comparedAt: input.stagedAt,
  });
  assertShadowNoWriteInvariants(shadow);
  assertion(shadow.discrepancies.length === 0, 'first-activation shadow reported a discrepancy');
  return stageConsumerActivation(
    resolveConsumerActivationStorePaths(path.join(input.root, DEFAULTS.consumer)),
    {
      artifacts: input.artifacts,
      stagedAt: input.stagedAt,
      activationId: input.activationId,
      shadowReport: shadow,
    },
  );
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(option('--repo-root'));
  const captureRevision = option('--capture-revision');
  const authorityManifestPath = path.resolve(option('--authority-manifest'));
  const outputRoot = path.resolve(option('--output-root'));
  if (!COMMIT.test(captureRevision)) fail('captureRevision must be a 40-character Git SHA');
  assertCaptureHead(repoRoot, captureRevision);
  assertFirstActivationPrestate(repoRoot);

  const authorityCandidate = loadStagedAuthority({
    manifestPath: authorityManifestPath,
    authorityCaptureRevision: captureRevision,
  });
  const legacy = loadLegacyCrosswalk(path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/legacy-crosswalk.jsonl'));
  const cardDocument = loadCardCrosswalk(path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/cards/card-crosswalk.jsonl'));
  const cards = cardDocument.entries.map((entry) => ({
    cardId: entry.cardId ?? entry.legacyNodeId,
    canonicalId: entry.canonicalId,
    active: !entry.stale,
    legacyNodeId: entry.legacyNodeId,
  }));
  const decisions = loadAuthorDecisionsFromFile(defaultAuthorDecisionsPath(path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection')));
  const bindings = loadActkgCutoverBlueprintBindings({ repoRoot });
  assertBlueprintBindingsMatchRevision({ repoRoot, authoringRevision: captureRevision });
  const candidate = buildTeachingProjectionCandidate({
    repoRoot,
    authoringRevision: captureRevision,
    authority: authorityCandidate,
    crosswalk: legacy.entries,
    cards,
    authorDecisions: decisions,
    authorDecisionContextDigest: bindings.digest,
    assertRealInventoryCounts: true,
  });
  assertion(candidate.inventory.packageCount === ACTIVE_PACKAGE_COUNT, 'active package denominator changed');
  assertion(candidate.inventory.resourceCount === ACTIVE_RESOURCE_COUNT, 'active resource denominator changed');
  assertion(candidate.migration.summary.boundCount === ACTIVE_BOUND_COUNT, 'active BOUND count changed');
  assertion(candidate.migration.summary.explicitNoneCount === ACTIVE_EXPLICIT_NONE_COUNT, 'active EXPLICIT_NONE count changed');
  assertion(candidate.migration.summary.reviewRequiredCount === 0, 'active REVIEW_REQUIRED remains');
  assertion(candidate.packageReports.every((report) => report.ready), 'one or more package gates are not ready');

  const prerequisiteInput = buildPrerequisiteInput({
    repoRoot,
    captureRevision,
    authority: authorityCandidate.manifest,
    authorityNodes: candidate.authorityNodes,
  });
  const prerequisiteArtifacts = buildPrerequisitePublication(prerequisiteInput);
  assertion(prerequisiteArtifacts.gate.passed, 'prerequisite publication gate failed');

  const globalAuthoring = buildGlobalAuthoring({
    repoRoot,
    captureRevision,
    authority: authorityCandidate.manifest,
    authorityNodes: candidate.authorityNodes,
    packageAuthoring: candidate.packageAuthoring,
    prerequisite: prerequisiteArtifacts,
    cards: cardDocument.entries.map((entry) => ({
      cardId: entry.cardId ?? entry.legacyNodeId,
      canonicalId: entry.canonicalId,
      active: !entry.stale,
      sourceEvidence: entry.sourceEvidence,
    })),
  });
  const globalArtifacts = buildTeachingProjection(globalAuthoring);
  assertion(globalArtifacts.gate.passed, 'global Teaching Projection gate failed');
  assertion(globalArtifacts.resources.filter((resource) => resource.resourceId.startsWith('act:')).length >= ACTIVE_RESOURCE_COUNT, 'global Teaching Projection lost active resources');

  const stagedAt = new Date().toISOString();
  const authorityPaths = resolveAuthorityStorePaths(path.join(repoRoot, DEFAULTS.authority));
  const projectionPaths = resolveTeachingProjectionStorePaths(path.join(repoRoot, DEFAULTS.projection));
  const prerequisitePaths = resolvePrerequisiteStorePaths(path.join(repoRoot, DEFAULTS.prerequisite));
  const consumerPaths = resolveConsumerActivationStorePaths(path.join(repoRoot, DEFAULTS.consumer));
  const stagedAuthority = stageAuthoritySnapshotArtifacts(authorityPaths, {
    manifest: authorityCandidate.manifest,
    engineering: authorityCandidate.engineering,
  }, { stagedAt });
  const stagedProjection = stageTeachingProjectionArtifacts(projectionPaths, globalArtifacts);
  const stagedPrerequisite = stagePrerequisitePublication(prerequisitePaths, prerequisiteInput);
  assertion(stagedPrerequisite.artifacts.gate.passed, 'staged prerequisite publication gate failed');
  const artifacts = activationArtifacts({
    captureRevision,
    authority: stagedAuthority,
    projection: stagedProjection,
  });
  const activationId = `first-cutover-${stagedAuthority.snapshotHash.slice(0, 12)}-${stagedProjection.projectionHash.slice(0, 12)}`;
  const stagedConsumer = buildConsumerActivation({
    root: repoRoot,
    artifacts,
    stagedAt,
    activationId,
  });
  assertion(stagedConsumer.manifest.impact.readyConsumerIds.length === 6, 'six consumers are not READY in staged activation');

  const transactionId = `first-cutover-${stagedAuthority.snapshotHash.slice(0, 24)}`;
  const exerciseRoot = path.join(outputRoot, 'first-activation-exercise');
  const exerciseAuthority = stageAuthoritySnapshotArtifacts(
    resolveAuthorityStorePaths(path.join(exerciseRoot, DEFAULTS.authority)),
    { manifest: authorityCandidate.manifest, engineering: authorityCandidate.engineering },
    { stagedAt },
  );
  const exerciseProjection = stageTeachingProjectionArtifacts(
    resolveTeachingProjectionStorePaths(path.join(exerciseRoot, DEFAULTS.projection)),
    globalArtifacts,
  );
  const exercisePrerequisite = stagePrerequisitePublication(
    resolvePrerequisiteStorePaths(path.join(exerciseRoot, DEFAULTS.prerequisite)),
    prerequisiteInput,
  );
  const exerciseArtifacts = activationArtifacts({
    captureRevision,
    authority: exerciseAuthority,
    projection: exerciseProjection,
  });
  const exerciseConsumer = buildConsumerActivation({
    root: exerciseRoot,
    artifacts: exerciseArtifacts,
    stagedAt,
    activationId,
  });
  const exerciseAuthorityPaths = resolveAuthorityStorePaths(path.join(exerciseRoot, DEFAULTS.authority));
  const exerciseProjectionPaths = resolveTeachingProjectionStorePaths(path.join(exerciseRoot, DEFAULTS.projection));
  const exercisePrerequisitePaths = resolvePrerequisiteStorePaths(path.join(exerciseRoot, DEFAULTS.prerequisite));
  const exerciseConsumerPaths = resolveConsumerActivationStorePaths(path.join(exerciseRoot, DEFAULTS.consumer));
  const exerciseSteps: FirstActivationStep[] = [
    {
      component: 'authority',
      pointerPath: exerciseAuthorityPaths.currentPointer,
      target: pointerTarget('authority', exerciseAuthority.snapshotId, exerciseAuthority.snapshotHash),
      activate: () => {
        const result = activateAuthoritySnapshot(exerciseAuthorityPaths, {
          snapshotId: exerciseAuthority.snapshotId,
          teachingSelectors: emptyTeachingSelectorFingerprint(),
          activatedAt: stagedAt,
          activationReceiptId: `${transactionId}-exercise-authority`,
        });
        assertion(result.status === 'activated', 'exercise Authority activation failed');
      },
    },
    {
      component: 'projection',
      pointerPath: exerciseProjectionPaths.currentPointer,
      target: pointerTarget('projection', exerciseProjection.projectionId, exerciseProjection.projectionHash),
      activate: () => {
        const result = activateTeachingProjection(exerciseProjectionPaths, { projectionId: exerciseProjection.projectionId, activatedAt: stagedAt });
        assertion(result.status === 'activated', 'exercise Teaching Projection activation failed');
      },
    },
    {
      component: 'prerequisite',
      pointerPath: exercisePrerequisitePaths.currentPointer,
      target: pointerTarget('prerequisite', exercisePrerequisite.publicationId, exercisePrerequisite.publicationHash),
      activate: () => { activatePrerequisitePublication(exercisePrerequisitePaths, exercisePrerequisite.publicationId, { activatedAt: stagedAt }); },
    },
    {
      component: 'consumer-activation',
      pointerPath: exerciseConsumerPaths.currentPointer,
      target: pointerTarget('consumer-activation', exerciseConsumer.activationId, exerciseConsumer.activationHash),
      activate: () => {
        const result = activateConsumerActivation(exerciseConsumerPaths, {
          activationId: exerciseConsumer.activationId,
          activatedAt: stagedAt,
          activationReceiptId: `${transactionId}-exercise-consumers`,
        });
        assertion(result.status === 'activated', 'exercise consumer activation failed');
      },
    },
  ];
  const exerciseJournalPath = path.join(exerciseRoot, DEFAULTS.consumer, 'first-activation-transactions', `${transactionId}.json`);
  const exerciseJournal = executeFirstActivation({
    repoRoot: exerciseRoot,
    journalPath: exerciseJournalPath,
    lockPath: path.join(exerciseRoot, DEFAULTS.consumer, '.first-activation.lock'),
    transactionId: `${transactionId}-exercise`,
    createdAt: stagedAt,
    steps: exerciseSteps,
    postCommit: () => {
      assertion(resolveActiveAuthoritySnapshot(exerciseAuthorityPaths).status === 'available', 'exercise Authority post-read failed');
      assertion(resolveActiveTeachingProjection(exerciseProjectionPaths).status === 'available', 'exercise Projection post-read failed');
      assertReadyConsumerSet({
        repoRoot: exerciseRoot,
        authoritySnapshotId: exerciseAuthority.snapshotId,
        authoritySnapshotHash: exerciseAuthority.snapshotHash,
        projectionId: exerciseProjection.projectionId,
        projectionHash: exerciseProjection.projectionHash,
      });
    },
  });
  assertion(exerciseJournal.status === 'COMMITTED', 'exercise did not commit');
  const exerciseRollback = rollbackCommittedFirstActivation({
    journalPath: exerciseJournalPath,
    lockPath: path.join(exerciseRoot, DEFAULTS.consumer, '.first-activation.lock'),
  });
  assertion(exerciseRollback.status === 'ROLLED_BACK', 'exercise did not return to all-ABSENT');
  for (const step of exerciseSteps) {
    assertion(readFirstActivationPointerIdentity(step) === null, `exercise pointer remained after rollback: ${step.component}`);
  }

  const actualSteps: FirstActivationStep[] = [
    {
      component: 'authority',
      pointerPath: authorityPaths.currentPointer,
      target: pointerTarget('authority', stagedAuthority.snapshotId, stagedAuthority.snapshotHash),
      activate: () => {
        const result = activateAuthoritySnapshot(authorityPaths, {
          snapshotId: stagedAuthority.snapshotId,
          teachingSelectors: emptyTeachingSelectorFingerprint(),
          activatedAt: stagedAt,
          activationReceiptId: `${transactionId}-authority`,
        });
        assertion(result.status === 'activated', 'Authority activation failed');
      },
    },
    {
      component: 'projection',
      pointerPath: projectionPaths.currentPointer,
      target: pointerTarget('projection', stagedProjection.projectionId, stagedProjection.projectionHash),
      activate: () => {
        const result = activateTeachingProjection(projectionPaths, { projectionId: stagedProjection.projectionId, activatedAt: stagedAt });
        assertion(result.status === 'activated', 'Teaching Projection activation failed');
      },
    },
    {
      component: 'prerequisite',
      pointerPath: prerequisitePaths.currentPointer,
      target: pointerTarget('prerequisite', stagedPrerequisite.publicationId, stagedPrerequisite.publicationHash),
      activate: () => { activatePrerequisitePublication(prerequisitePaths, stagedPrerequisite.publicationId, { activatedAt: stagedAt }); },
    },
    {
      component: 'consumer-activation',
      pointerPath: consumerPaths.currentPointer,
      target: pointerTarget('consumer-activation', stagedConsumer.activationId, stagedConsumer.activationHash),
      activate: () => {
        const result = activateConsumerActivation(consumerPaths, {
          activationId: stagedConsumer.activationId,
          activatedAt: stagedAt,
          activationReceiptId: `${transactionId}-consumers`,
        });
        assertion(result.status === 'activated', 'consumer activation failed');
      },
    },
  ];
  const journalPath = path.join(repoRoot, DEFAULTS.consumer, 'first-activation-transactions', `${transactionId}.json`);
  const journal = executeFirstActivation({
    repoRoot,
    journalPath,
    lockPath: path.join(repoRoot, DEFAULTS.consumer, '.first-activation.lock'),
    transactionId,
    createdAt: stagedAt,
    steps: actualSteps,
    postCommit: () => {
      assertion(resolveActiveAuthoritySnapshot(authorityPaths).status === 'available', 'Authority post-read failed');
      assertion(resolveActiveTeachingProjection(projectionPaths).status === 'available', 'Teaching Projection post-read failed');
      assertion(!existsSync(path.join(repoRoot, DEFAULTS.retirement, 'current.json')), 'legacy retirement pointer changed');
      assertReadyConsumerSet({
        repoRoot,
        authoritySnapshotId: stagedAuthority.snapshotId,
        authoritySnapshotHash: stagedAuthority.snapshotHash,
        projectionId: stagedProjection.projectionId,
        projectionHash: stagedProjection.projectionHash,
      });
    },
  });
  const consumers = assertReadyConsumerSet({
    repoRoot,
    authoritySnapshotId: stagedAuthority.snapshotId,
    authoritySnapshotHash: stagedAuthority.snapshotHash,
    projectionId: stagedProjection.projectionId,
    projectionHash: stagedProjection.projectionHash,
  });
  const report = {
    contract: 'actkg-to-act-first-activation-report/v1',
    status: 'COMMITTED',
    captureRevision,
    sourceRelease: {
      releaseSetId: stagedAuthority.manifest.releaseSetId,
      releaseId: stagedAuthority.manifest.releaseId,
      releaseHash: stagedAuthority.manifest.releaseHash,
      bundleDigest: stagedAuthority.manifest.bundleDigest,
    },
    authority: { snapshotId: stagedAuthority.snapshotId, snapshotHash: stagedAuthority.snapshotHash },
    teachingProjection: {
      projectionId: stagedProjection.projectionId,
      projectionHash: stagedProjection.projectionHash,
      activeResourceCount: candidate.inventory.resourceCount,
      boundCount: candidate.migration.summary.boundCount,
      explicitNoneCount: candidate.migration.summary.explicitNoneCount,
      reviewRequiredCount: candidate.migration.summary.reviewRequiredCount,
      textbookResourceCount: globalArtifacts.resources.length - candidate.inventory.resourceCount,
    },
    prerequisite: { publicationId: stagedPrerequisite.publicationId, publicationHash: stagedPrerequisite.publicationHash },
    consumers,
    shadow: { discrepancies: 0, writes: false },
    rollback: {
      exercise: exerciseRollback.status,
      actualJournal: relative(repoRoot, journalPath),
      protocol: 'identity-constrained-first-activation-compensation',
    },
    legacyRetirementPointer: 'ABSENT',
    journalHash: journal.journalHash,
  };
  await writeCanonical(path.join(outputRoot, 'first-activation-report.json'), report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
