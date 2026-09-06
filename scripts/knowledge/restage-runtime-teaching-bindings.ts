#!/usr/bin/env tsx
/**
 * Restage course Teaching Projection B′ from the runtime resource denominator
 * and switch every teaching-semantic consumer together.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { ARENA_CHALLENGE_OBJECTS, ARENA_CHALLENGE_TASKS } from '@/features/arena/data/seed-challenges';
import { CONTROL_ODYSSEY_LEVELS } from '@/resources/interactive-learning/control-odyssey/level-data';
import { GENERIC_CONTROL_WORKBENCH_TASK_KEY } from '@/lib/data-governance/simulation-task-catalog';
import { readCourseTeachingContent } from '@/lib/teaching-projection/domain-fragments/build-overview-teaching-order';
import {
  buildTeachingProjection,
} from '@/lib/teaching-projection/builder';
import {
  activateTeachingProjection,
  resolveTeachingProjectionStorePaths,
  stageTeachingProjectionArtifacts,
} from '@/lib/teaching-projection/store';
import { buildActiveCourseInventory } from '@/lib/teaching-projection/active-inventory';
import type { TeachingCoreNodeAuthoring, TeachingPrerequisiteAuthoring } from '@/lib/teaching-projection/contracts';
import {
  EXTRACTION_SOURCE_BOOKS,
  evaluateLedgerQuotas,
  planRuntimeFullBinding,
  type CardCrosswalkInput,
  type CardExemptionInput,
  type ClassroomSimExemptionInput,
  type InfographAuthorityInput,
  type InfographLegacyInput,
  type LessonStepInventoryInput,
  type RuntimeBindingRow,
  type RuntimeCardRow,
  type RuntimeResourceRow,
  type SimCanonicalDeclarationInput,
  type TaskSimInput,
  type TextbookLocatorRow,
} from '@/lib/teaching-projection/runtime-full-binding';
const ROOT = process.cwd();
const OVERLAY_REL = 'course-content/runtime/knowledge/teaching-projection/domain-fragments';
const PROJECTION_REL = 'course-content/runtime/knowledge/projection';
const PREREQ_REL = 'course-content/runtime/knowledge/prerequisites';
const LEDGER_REL = 'course-content/authoring/knowledge/teaching-projection/runtime-binding-exception-ledger.jsonl';
const QUOTAS_REL = 'course-content/authoring/knowledge/teaching-projection/ledger-quotas.json';
const GOVERNANCE_REPORT_REL = 'course-content/authoring/knowledge/teaching-projection/ledger-governance-report.json';

function abs(rel: string): string {
  return path.join(ROOT, rel);
}

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(abs(rel), 'utf8')) as T;
}

function readJsonl<T>(rel: string): T[] {
  return readFileSync(abs(rel), 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => JSON.parse(line) as T);
}

function writeJson(rel: string, value: unknown): void {
  mkdirSync(path.dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), `${JSON.stringify(value, null, 2)}\n`);
}

function loadOverlayCores(): string[] {
  const pointer = readJson<{ projectionId: string }>(`${OVERLAY_REL}/current.json`);
  const composed = readJson<{ fragments: Array<{ fragmentId: string }> }>(
    `${OVERLAY_REL}/releases/${pointer.projectionId}/composed-manifest.json`,
  );
  const cores = new Set<string>();
  for (const fragment of composed.fragments) {
    const body = readJson<{ coreNodes?: Array<{ canonicalId: string }> }>(
      `${OVERLAY_REL}/releases/${pointer.projectionId}/fragments/${fragment.fragmentId}.json`,
    );
    for (const node of body.coreNodes ?? []) cores.add(node.canonicalId);
  }
  return [...cores];
}

function loadAuthorityCardCanonicalIds(): string[] {
  const dir = abs('course-content/runtime/knowledge/cards/authority/nodes');
  if (!existsSync(dir)) return [];
  const ids: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const token = name.slice(0, -3);
    ids.push(token.replace(/_/g, ':'));
  }
  return ids;
}

function loadTextbookLocators(): TextbookLocatorRow[] {
  return readJsonl<TextbookLocatorRow>(
    'course-content/authoring/knowledge/teaching-projection/textbook-locators/source-resource-crosswalk.jsonl',
  ).filter((row) => (EXTRACTION_SOURCE_BOOKS as readonly string[]).includes(row.sourceDocumentId));
}

function loadTaskSims(): TaskSimInput[] {
  const objects = new Map(ARENA_CHALLENGE_OBJECTS.map((object) => [object.id, object]));
  const arena: TaskSimInput[] = ARENA_CHALLENGE_TASKS.map((task) => ({
    taskKey: `arena:${task.id}`,
    displayName: task.title,
    source: 'arena',
    relatedNodeIds: (objects.get(task.objectId)?.relatedKnowledge ?? []).flatMap((item) => item.canonicalIds ?? []),
  }));
  const odyssey: TaskSimInput[] = CONTROL_ODYSSEY_LEVELS.map((level) => ({
    taskKey: `odyssey:${level.id}`,
    displayName: level.name,
    source: 'odyssey',
    relatedNodeIds: level.relatedCanonicalIds ?? [],
  }));
  return [
    ...arena,
    ...odyssey,
    {
      taskKey: GENERIC_CONTROL_WORKBENCH_TASK_KEY,
      displayName: '自由控制工作台',
      source: 'control-workbench',
      relatedNodeIds: [],
    },
  ];
}

/** Canonical labels from the authority domain shards; used for readable infograph titles (#2042). */
function loadCanonicalLabels(): Map<string, string> {
  const labels = new Map<string, string>();
  const setsDir = abs('course-content/runtime/knowledge/authority-domain-shards/sets');
  if (!existsSync(setsDir)) return labels;
  for (const setName of readdirSync(setsDir)) {
    const domainsDir = path.join(setsDir, setName, 'domains');
    if (!existsSync(domainsDir)) continue;
    for (const domainName of readdirSync(domainsDir)) {
      const file = path.join(domainsDir, domainName, 'default.json');
      if (!existsSync(file)) continue;
      const shard = JSON.parse(readFileSync(file, 'utf8')) as {
        objects?: Array<{ id: string; label?: string | null }>;
      };
      for (const object of shard.objects ?? []) {
        if (object.label && !labels.has(object.id)) labels.set(object.id, object.label);
      }
    }
  }
  return labels;
}

/** Card frontmatter names for legacy infograph titles (#2042). */
function loadCardNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const sub of ['nodes', 'authority']) {
    const dir = abs(`course-content/authoring/knowledge/cards/${sub}`);
    if (!existsSync(dir)) continue;
    const walk = (current: string) => {
      for (const name of readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, name.name);
        if (name.isDirectory()) {
          walk(full);
          continue;
        }
        if (!name.name.endsWith('.md')) continue;
        const token = name.name.slice(0, -'.md'.length);
        const head = readFileSync(full, 'utf8').slice(0, 1200);
        const match = head.match(/^name:\s*(.+)$/mu);
        if (match) names.set(token, match[1].trim());
      }
    };
    walk(dir);
  }
  return names;
}

/** Authority infographs bind by canonical token; the filename encodes it (#2042 task 2.2). */
function loadInfographsAuthority(): InfographAuthorityInput[] {
  const dir = abs('course-content/runtime/knowledge/infographs/authority/nodes');
  if (!existsSync(dir)) return [];
  const labels = loadCanonicalLabels();
  const entries: InfographAuthorityInput[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.png')) continue;
    const token = name.slice(0, -'.png'.length);
    const canonicalId = token.replace(/_/g, ':');
    entries.push({
      resourceId: `act:infographic:${token}`,
      canonicalId,
      title: labels.get(canonicalId) ?? null,
    });
  }
  return entries;
}

/** Legacy infographs keep card-style ids and bind through the card crosswalk channel (#2042 task 2.3). */
function loadInfographsLegacy(): InfographLegacyInput[] {
  const dir = abs('course-content/runtime/knowledge/infographs/nodes');
  if (!existsSync(dir)) return [];
  const cardNames = loadCardNames();
  const entries: InfographLegacyInput[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.png')) continue;
    const cardId = name.slice(0, -'.png'.length);
    entries.push({
      resourceId: `act:infographic:${cardId}`,
      cardId,
      title: cardNames.get(cardId) ?? null,
    });
  }
  return entries;
}

/**
 * Core nodes feed back from the prerequisite publication (#2042 task 3.2).
 * The publication identity must match the projection Authority release or the restage fails closed.
 */
function loadPublicationCoreNodes(projectionAuthorityReleaseId: string): {
  publicationId: string;
  coreNodes: TeachingCoreNodeAuthoring[];
} {
  const pointer = readJson<{ publicationId: string; authorityReleaseId: string }>(`${PREREQ_REL}/current.json`);
  if (pointer.authorityReleaseId !== projectionAuthorityReleaseId) {
    throw new Error(
      `prerequisite publication ${pointer.publicationId} authority ${pointer.authorityReleaseId} does not match projection authority ${projectionAuthorityReleaseId}`,
    );
  }
  const raw = readJson<Array<{
    canonicalId: string;
    pathEligible?: boolean;
    cardPolicy?: string;
    moduleId?: string | null;
    scopeId?: string;
    rationale?: string | null;
  }>>(`${PREREQ_REL}/releases/${pointer.publicationId}/core-nodes.json`);
  const normalizePolicy = (value: string | undefined): TeachingCoreNodeAuthoring['cardPolicy'] => {
    const lowered = (value ?? 'optional').toLowerCase();
    return lowered === 'required' || lowered === 'none' ? lowered : 'optional';
  };
  return {
    publicationId: pointer.publicationId,
    coreNodes: raw.map((row) => ({
      canonicalId: row.canonicalId,
      pathEligible: row.pathEligible ?? false,
      cardPolicy: normalizePolicy(row.cardPolicy),
      moduleId: row.moduleId ?? null,
      scopeId: row.scopeId ?? 'act-control-theory',
      rationale: row.rationale ?? null,
    })),
  };
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function main(): void {
  const pointer = readJson<{
    projectionId: string;
    projectionHash: string;
    authorityReleaseId: string;
  }>(`${PROJECTION_REL}/current.json`);
  const releaseDir = `${PROJECTION_REL}/releases/${pointer.projectionId}`;
  const manifest = readJson<{
    scopeId: string;
    authoringRevision: string;
    authorityReleaseId: string;
    authorityReleaseSetId: string;
    authoritySnapshotId: string;
    authoritySnapshotHash: string;
  }>(`${releaseDir}/projection-manifest.json`);
  const retiredLesson02 = readJsonl<{ resourceId: string }>(
    'course-content/authoring/knowledge/teaching-projection/simulations/retired-sim-exclusions.jsonl',
  );
  if (retiredLesson02.length > 0) {
    // lesson02 launcher rows are retired wholesale (user ruling 2026-09-06):
    // every act:simulation:lesson02-* resource leaves the denominator (#2042 decision 6).
    retiredLesson02.forEach((row) => {
      if (!/^launcher-lesson02-/u.test(row.resourceId)) {
        throw new Error(`retired-sim-exclusions must only contain lesson02 launcher rows: ${row.resourceId}`);
      }
    });
  }
  const resources = readJsonl<RuntimeResourceRow>(`${releaseDir}/resources.jsonl`)
    .filter((row) => !row.resourceId.startsWith('act:simulation:lesson02-'))
    // infographs are re-enumerated from the runtime filesystem each run; stale
    // input rows (e.g. identifier titles) must not shadow the fresh titles (#2042).
    .filter((row) => row.resourceType !== 'infographic');
  const bindings = readJsonl<RuntimeBindingRow>(`${releaseDir}/bindings.jsonl`);
  const prerequisites = readJsonl<TeachingPrerequisiteAuthoring>(`${releaseDir}/prerequisites.jsonl`);
  const cardsIndex = readJson<{ cards: RuntimeCardRow[] }>(`${releaseDir}/cards-index.json`);
  const overlayCores = loadOverlayCores();
  const course = readCourseTeachingContent(ROOT);
  const overlayPointer = readJson<{
    projectionId: string;
    projectionHash: string;
  }>(`${OVERLAY_REL}/current.json`);

  const { publicationId, coreNodes } = loadPublicationCoreNodes(manifest.authorityReleaseId);
  const cardCrosswalk = readJsonl<CardCrosswalkInput>(
    'course-content/authoring/knowledge/teaching-projection/cards/card-crosswalk.jsonl',
  );
  const cardExemptions = readJsonl<CardExemptionInput>(
    'course-content/authoring/knowledge/teaching-projection/cards/card-exemptions.jsonl',
  );
  const simCanonicalDeclarations = readJsonl<SimCanonicalDeclarationInput>(
    'course-content/authoring/knowledge/teaching-projection/simulations/sim-canonical-declarations.jsonl',
  );
  const classroomSimExemptions = readJsonl<ClassroomSimExemptionInput>(
    'course-content/authoring/knowledge/teaching-projection/simulations/classroom-sim-exemptions.jsonl',
  );
  const exemptEndpointIds = new Set(
    readJsonl<{ canonicalId: string }>(
      'course-content/authoring/knowledge/teaching-projection/textbook-locators/endpoint-exemptions.jsonl',
    ).map((row) => row.canonicalId),
  );
  const overlaySet = new Set(overlayCores);
  const exemptTextbookSections = new Set<string>();
  for (const locator of loadTextbookLocators()) {
    const hits = locator.canonicalIds.filter((id) => overlaySet.has(id));
    const exemptHits = locator.canonicalIds.filter((id) => exemptEndpointIds.has(id));
    if (hits.length === 0 && exemptHits.length > 0) {
      exemptTextbookSections.add(`act:textbook-section:${locator.sourceAnchorId.replace(/^cts:/u, 'cts.')}`);
    }
  }

  const inventory = buildActiveCourseInventory({
    repoRoot: ROOT,
    authoringRevision: currentHead(),
  });
  const lessonStepInventory: LessonStepInventoryInput[] = inventory.packages
    .flatMap((pkg) => pkg.resources)
    .filter((row) => row.resourceType === 'lesson' || row.resourceType === 'step')
    .map((row) => ({
      resourceId: row.resourceId,
      resourceType: row.resourceType,
      title: row.title,
      sourcePath: row.sourcePath,
    }));

  const plan = planRuntimeFullBinding({
    scopeId: manifest.scopeId,
    // B′′ binds to the working-tree HEAD: this change's data and code are part of the new projection (#2042).
    authoringRevision: currentHead(),
    authorityReleaseId: manifest.authorityReleaseId,
    authorityReleaseSetId: manifest.authorityReleaseSetId,
    authoritySnapshotId: manifest.authoritySnapshotId,
    authoritySnapshotHash: manifest.authoritySnapshotHash,
    overlayCores,
    nodeUnitSets: course.nodeUnitSets,
    nodeUnits: course.nodeUnits,
    resources,
    bindings,
    prerequisites,
    cards: cardsIndex.cards,
    authorityCardCanonicalIds: loadAuthorityCardCanonicalIds(),
    textbookLocators: loadTextbookLocators(),
    taskSims: loadTaskSims(),
    cardCrosswalk,
    cardExemptions,
    simCanonicalDeclarations,
    classroomSimExemptions,
    infographsAuthority: loadInfographsAuthority(),
    infographsLegacy: loadInfographsLegacy(),
    lessonStepInventory,
    coreNodes,
    exemptTextbookSections,
  });

  mkdirSync(path.dirname(abs(LEDGER_REL)), { recursive: true });
  writeFileSync(
    abs(LEDGER_REL),
    `${plan.ledger.map((row) => JSON.stringify(row)).join('\n')}${plan.ledger.length ? '\n' : ''}`,
  );

  // Ledger governance: per-reason quotas (#2042 task 6) and a first-class report.
  const quotas = existsSync(abs(QUOTAS_REL))
    ? readJson<Record<string, number>>(QUOTAS_REL)
    : {};
  const quotaResult = evaluateLedgerQuotas(plan.ledger, quotas);
  if (option('--allow-ledger')) {
    const total = Number(option('--allow-ledger'));
    if (plan.ledger.length > total) {
      throw new Error(`exception ledger too large: ${plan.ledger.length} > ${total}`);
    }
  }
  if (!quotaResult.passed) {
    throw new Error(`exception ledger category quotas exceeded: ${quotaResult.breaches.join('; ')}`);
  }
  writeJson(GOVERNANCE_REPORT_REL, {
    contract: 'teaching-projection-ledger-governance-report/v1',
    generatedAt: new Date().toISOString(),
    ledgerPath: LEDGER_REL,
    quotas,
    total: plan.ledger.length,
    countsByReason: quotaResult.countsByReason,
    entries: plan.ledger,
  });

  const artifacts = buildTeachingProjection(plan.authoring);
  if (!artifacts.gate.passed) {
    throw new Error(`B′ gate failed: ${artifacts.gate.findings.filter((item) => item.severity === 'error').map((item) => item.code).join(',')}`);
  }
  const projectionPaths = resolveTeachingProjectionStorePaths(abs(PROJECTION_REL));
  const staged = stageTeachingProjectionArtifacts(projectionPaths, artifacts);
  const activated = activateTeachingProjection(projectionPaths, {
    projectionId: staged.projectionId,
    activatedAt: new Date().toISOString(),
  });
  if (activated.status !== 'activated' || !activated.pointer) {
    throw new Error(`activate B′ failed: ${activated.reasons.join('; ')}`);
  }

  const sidecarRel = `${OVERLAY_REL}/releases/${overlayPointer.projectionId}/inspector-sidecar.json`;
  const sidecar = readJson<{
    contract: string;
    envelopeProjectionId: string;
    envelopeProjectionHash: string;
    courseProjectionId: string;
    courseProjectionHash: string;
    authorityReleaseId: string;
    authorityReleaseSetId: string;
    authoritySnapshotId: string;
    authoritySnapshotHash: string;
  }>(sidecarRel);
  sidecar.courseProjectionId = staged.projectionId;
  sidecar.courseProjectionHash = staged.projectionHash;
  writeJson(sidecarRel, sidecar);

  const currentProjection = readJson<{ projectionId: string }>(`${PROJECTION_REL}/current.json`);
  const liveSidecar = readJson<{ courseProjectionId: string; envelopeProjectionId: string }>(sidecarRel);
  const liveActivation = readJson<{ activationId: string }>(
    'course-content/runtime/knowledge/consumer-activation/current.json',
  );
  if (
    currentProjection.projectionId !== staged.projectionId
    || liveSidecar.courseProjectionId !== staged.projectionId
    || liveSidecar.envelopeProjectionId !== overlayPointer.projectionId
    || liveActivation.activationId !== 'activation-0b72f577a3d58647e6b67246'
  ) {
    throw new Error('teaching pointers were not switched together without moving sealed consumer-activation');
  }

  process.stdout.write(`${JSON.stringify({
    projectionId: staged.projectionId,
    projectionHash: staged.projectionHash,
    prerequisitePublicationId: publicationId,
    stats: plan.stats,
    ledger: plan.ledger.length,
    ledgerCountsByReason: quotaResult.countsByReason,
    gate: artifacts.gate.status,
  }, null, 2)}\n`);
}

main();
