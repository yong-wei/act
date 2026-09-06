#!/usr/bin/env tsx
/**
 * Restage course Teaching Projection B′ from the runtime resource denominator
 * and switch every teaching-semantic consumer together.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
import type { TeachingPrerequisiteAuthoring } from '@/lib/teaching-projection/contracts';
import {
  EXTRACTION_SOURCE_BOOKS,
  planRuntimeFullBinding,
  type RuntimeBindingRow,
  type RuntimeCardRow,
  type RuntimeResourceRow,
  type TaskSimInput,
  type TextbookLocatorRow,
} from '@/lib/teaching-projection/runtime-full-binding';
const ROOT = process.cwd();
const OVERLAY_REL = 'course-content/runtime/knowledge/teaching-projection/domain-fragments';
const PROJECTION_REL = 'course-content/runtime/knowledge/projection';
const LEDGER_REL = 'course-content/authoring/knowledge/teaching-projection/runtime-binding-exception-ledger.jsonl';

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
    relatedNodeIds: (objects.get(task.objectId)?.relatedKnowledge ?? []).map((item) => item.nodeId),
  }));
  const odyssey: TaskSimInput[] = CONTROL_ODYSSEY_LEVELS.map((level) => ({
    taskKey: `odyssey:${level.id}`,
    displayName: level.name,
    source: 'odyssey',
    relatedNodeIds: [],
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

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function main(): void {
  const allowLedger = Number(option('--allow-ledger') ?? '900');
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
  const resources = readJsonl<RuntimeResourceRow>(`${releaseDir}/resources.jsonl`);
  const bindings = readJsonl<RuntimeBindingRow>(`${releaseDir}/bindings.jsonl`);
  const prerequisites = readJsonl<TeachingPrerequisiteAuthoring>(`${releaseDir}/prerequisites.jsonl`);
  const cardsIndex = readJson<{ cards: RuntimeCardRow[] }>(`${releaseDir}/cards-index.json`);
  const overlayCores = loadOverlayCores();
  const course = readCourseTeachingContent(ROOT);
  const overlayPointer = readJson<{
    projectionId: string;
    projectionHash: string;
  }>(`${OVERLAY_REL}/current.json`);

  const plan = planRuntimeFullBinding({
    scopeId: manifest.scopeId,
    authoringRevision: manifest.authoringRevision,
    authorityReleaseId: manifest.authorityReleaseId,
    authorityReleaseSetId: manifest.authorityReleaseSetId,
    authoritySnapshotId: manifest.authoritySnapshotId,
    authoritySnapshotHash: manifest.authoritySnapshotHash,
    overlayCores,
    nodeUnits: course.nodeUnits,
    resources,
    bindings,
    prerequisites,
    cards: cardsIndex.cards,
    authorityCardCanonicalIds: loadAuthorityCardCanonicalIds(),
    textbookLocators: loadTextbookLocators(),
    taskSims: loadTaskSims(),
  });

  mkdirSync(path.dirname(abs(LEDGER_REL)), { recursive: true });
  writeFileSync(
    abs(LEDGER_REL),
    `${plan.ledger.map((row) => JSON.stringify(row)).join('\n')}${plan.ledger.length ? '\n' : ''}`,
  );
  if (plan.ledger.length > allowLedger) {
    throw new Error(`exception ledger too large: ${plan.ledger.length} > ${allowLedger}`);
  }

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
    stats: plan.stats,
    ledger: plan.ledger.length,
    gate: artifacts.gate.status,
  }, null, 2)}\n`);
}

main();
