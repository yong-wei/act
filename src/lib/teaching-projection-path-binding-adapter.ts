import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { ResourceCandidatePoolSourceStatus } from './teacher-resource-node-data';
import type {
  ArenaTaskResourceNodeInput,
  KnowledgeCardResourceNodeInput,
  LightweightResourceNodeInput,
  ResourceNodeRegistryInput,
  RuntimeLessonNodeInput,
  SimulationResourceNodeInput,
} from './resource-node-registry';
import { resolveConfiguredTeachingProjectionRoot } from './teaching-projection/live-course-pointer';
import type { TeachingBindingRuntime, TeachingResourceRuntime } from './teaching-projection/contracts';
import {
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from './teaching-projection/store';
import {
  CLASSROOM_SIMULATION_PATH_NODE_IDS,
  mapActResourceIdToNodeId,
  setCanonicalTargetBridge,
  type TeachingProjectionBindingSkipFamily,
} from './teaching-projection-path-node-ids';

export {
  CLASSROOM_SIMULATION_PATH_NODE_IDS,
  mapActResourceIdToNodeId,
  resolveCanonicalGoalTargets,
  setCanonicalTargetBridge,
} from './teaching-projection-path-node-ids';
export type { TeachingProjectionBindingSkipFamily } from './teaching-projection-path-node-ids';

export const TEACHING_PROJECTION_BINDING_FAMILY = 'teaching-projection-bindings';
export const DENOMINATOR_BRIDGE_LIMITATION = 'denominator-bridge-limited';

const CUTOVER_DENOMINATOR_RELATIVE =
  'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5/denominator.json';

export interface TeachingProjectionBindingMapInput {
  resources: readonly TeachingResourceRuntime[];
  bindings: readonly TeachingBindingRuntime[];
  classroomSimulationNodeIds?: Readonly<Record<string, string>>;
}

export interface TeachingProjectionBindingMapResult {
  extraInput: ResourceNodeRegistryInput;
  skipCounts: Record<TeachingProjectionBindingSkipFamily, number>;
  patchCount: number;
}

interface DenominatorBridgeFile {
  contract?: string;
  baselineHash?: string;
  denominatorHash?: string;
  entries?: Array<{ resourceId?: string }>;
}

export function setCanonicalTargetBridgeForTests(bridge: Map<string, string> | null): void {
  setCanonicalTargetBridge(bridge);
}

export function mapTeachingProjectionBindingsToRegistryInput(
  input: TeachingProjectionBindingMapInput,
): TeachingProjectionBindingMapResult {
  const classroomMap = input.classroomSimulationNodeIds ?? CLASSROOM_SIMULATION_PATH_NODE_IDS;
  const bindingsByResource = new Map<string, string[]>();
  for (const binding of input.bindings) {
    const list = bindingsByResource.get(binding.resourceId) ?? [];
    list.push(binding.canonicalId, binding.bindingId);
    bindingsByResource.set(binding.resourceId, list);
  }

  const skipCounts: Record<TeachingProjectionBindingSkipFamily, number> = {
    'classroom-simulation': 0,
    'textbook-container': 0,
    unmapped: 0,
  };
  const knowledgeCards: KnowledgeCardResourceNodeInput[] = [];
  const runtimeLessons: RuntimeLessonNodeInput[] = [];
  const simulations: SimulationResourceNodeInput[] = [];
  const arenaTasks: ArenaTaskResourceNodeInput[] = [];
  const exercises: LightweightResourceNodeInput[] = [];

  for (const resource of input.resources) {
    const mapped = mapActResourceIdToNodeId(resource.resourceId, classroomMap);
    if ('skip' in mapped) {
      skipCounts[mapped.skip] += 1;
      continue;
    }
    const coverage = unique([
      ...(bindingsByResource.get(resource.resourceId) ?? []),
      mapped.nodeId,
    ]);
    const title = resource.title?.trim() || resource.resourceId;
    const href = resource.sourcePath;
    if (mapped.kind === 'handout') {
      const lessonId = mapped.nodeId.slice('runtime-handout:'.length);
      runtimeLessons.push({
        lessonId,
        title,
        knowledgeNodeIds: coverage,
        handoutPath: href ?? `/interactive-learning/courses/${lessonId}`,
      });
      continue;
    }
    if (mapped.kind === 'card') {
      knowledgeCards.push({
        id: mapped.nodeId.slice('knowledge-card:'.length),
        title,
        sourceRef: resource.resourceId,
        knowledgeNodeIds: coverage,
        launchTarget: href,
        renderTarget: href,
      });
      continue;
    }
    if (mapped.kind === 'video' || mapped.kind === 'audio') {
      const rest = mapped.nodeId.slice('runtime-media:'.length);
      const sep = rest.indexOf(':');
      const lessonId = rest.slice(0, sep);
      const mediaId = rest.slice(sep + 1);
      runtimeLessons.push({
        lessonId,
        title,
        knowledgeNodeIds: coverage,
        mediaResources: [{
          id: mediaId,
          title,
          kind: mapped.kind,
          url: href,
        }],
      });
      continue;
    }
    if (mapped.kind === 'arena') {
      arenaTasks.push({
        id: mapped.nodeId.slice('arena-task:'.length),
        title,
        launchTarget: href ?? `/arena/challenges/${mapped.nodeId.slice('arena-task:'.length)}`,
        knowledgeNodeIds: coverage,
      });
      continue;
    }
    if (mapped.kind === 'simulation') {
      const id = mapped.nodeId.startsWith('simulation:')
        ? mapped.nodeId.slice('simulation:'.length)
        : mapped.nodeId;
      simulations.push({
        id,
        title,
        launchTarget: href ?? `/simulations/${id}`,
        knowledgeNodeIds: coverage,
      });
      continue;
    }
    exercises.push({
      id: mapped.nodeId.slice('exercise:'.length),
      title,
      sourceRef: resource.resourceId,
      knowledgeNodeIds: coverage,
      launchTarget: href ?? `/exercises/${mapped.nodeId.slice('exercise:'.length)}`,
      renderTarget: href,
    });
  }

  const extraInput: ResourceNodeRegistryInput = {
    knowledgeCards,
    runtimeLessons,
    simulations,
    arenaTasks,
    exercises,
  };
  const patchCount = knowledgeCards.length
    + runtimeLessons.length
    + simulations.length
    + arenaTasks.length
    + exercises.length;
  return { extraInput, skipCounts, patchCount };
}

export async function loadTeachingProjectionBindingFamily(): Promise<{
  extraInput: ResourceNodeRegistryInput;
  status: ResourceCandidatePoolSourceStatus;
}> {
  const empty: ResourceNodeRegistryInput = {};
  const projection = resolveActiveTeachingProjection(
    resolveTeachingProjectionStorePaths(resolveConfiguredTeachingProjectionRoot()),
  );
  if (projection.status !== 'available' || !projection.staged) {
    setCanonicalTargetBridge(null);
    return {
      extraInput: empty,
      status: {
        family: TEACHING_PROJECTION_BINDING_FAMILY,
        status: 'missing',
        count: 0,
        reason: `missing-source-family:${TEACHING_PROJECTION_BINDING_FAMILY}`,
      },
    };
  }

  const bridge = loadDenominatorBridge(process.cwd());
  setCanonicalTargetBridge(bridge.ok ? bridge.map : null);
  const mapped = mapTeachingProjectionBindingsToRegistryInput({
    resources: projection.staged.artifacts.resources,
    bindings: projection.staged.artifacts.bindings,
  });
  return {
    extraInput: mapped.extraInput,
    status: {
      family: TEACHING_PROJECTION_BINDING_FAMILY,
      status: mapped.patchCount > 0 ? 'loaded' : 'empty',
      count: mapped.patchCount,
      reason: bridge.ok ? null : DENOMINATOR_BRIDGE_LIMITATION,
      skipCounts: mapped.skipCounts,
    },
  };
}

export function mergeResourceNodeRegistryInput(
  ...inputs: Array<ResourceNodeRegistryInput | undefined>
): ResourceNodeRegistryInput {
  const merged: ResourceNodeRegistryInput = {};
  for (const input of inputs) {
    if (!input) continue;
    merged.knowledgeCards = [...(merged.knowledgeCards ?? []), ...(input.knowledgeCards ?? [])];
    merged.runtimeLessons = [...(merged.runtimeLessons ?? []), ...(input.runtimeLessons ?? [])];
    merged.simulations = [...(merged.simulations ?? []), ...(input.simulations ?? [])];
    merged.arenaTasks = [...(merged.arenaTasks ?? []), ...(input.arenaTasks ?? [])];
    merged.textbookSections = [...(merged.textbookSections ?? []), ...(input.textbookSections ?? [])];
    merged.exercises = [...(merged.exercises ?? []), ...(input.exercises ?? [])];
    merged.registeredResources = [...(merged.registeredResources ?? []), ...(input.registeredResources ?? [])];
    merged.knowledgeNodes = [...(merged.knowledgeNodes ?? []), ...(input.knowledgeNodes ?? [])];
    merged.teachingResources = [...(merged.teachingResources ?? []), ...(input.teachingResources ?? [])];
    merged.runtimeResourceProjections = [
      ...(merged.runtimeResourceProjections ?? []),
      ...(input.runtimeResourceProjections ?? []),
    ];
    merged.textbooks = [...(merged.textbooks ?? []), ...(input.textbooks ?? [])];
    merged.controlWorkbenchTasks = [
      ...(merged.controlWorkbenchTasks ?? []),
      ...(input.controlWorkbenchTasks ?? []),
    ];
    merged.reflectionPrompts = [...(merged.reflectionPrompts ?? []), ...(input.reflectionPrompts ?? [])];
    merged.checkpoints = [...(merged.checkpoints ?? []), ...(input.checkpoints ?? [])];
    merged.aiInterventions = [...(merged.aiInterventions ?? []), ...(input.aiInterventions ?? [])];
    merged.konlingSupports = [...(merged.konlingSupports ?? []), ...(input.konlingSupports ?? [])];
    merged.projects = [...(merged.projects ?? []), ...(input.projects ?? [])];
    merged.externalResources = [...(merged.externalResources ?? []), ...(input.externalResources ?? [])];
    if (input.auditOptions) merged.auditOptions = input.auditOptions;
  }
  return merged;
}

function loadDenominatorBridge(repoRoot: string): { ok: boolean; map: Map<string, string> } {
  const filePath = path.join(repoRoot, CUTOVER_DENOMINATOR_RELATIVE);
  if (!existsSync(filePath)) return { ok: false, map: new Map() };
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as DenominatorBridgeFile;
    if (
      parsed.contract !== 'successor-resource-denominator/v1'
      || typeof parsed.baselineHash !== 'string'
      || parsed.baselineHash.length === 0
      || typeof parsed.denominatorHash !== 'string'
      || parsed.denominatorHash.length === 0
      || !Array.isArray(parsed.entries)
    ) {
      return { ok: false, map: new Map() };
    }
    const map = new Map<string, string>();
    for (const entry of parsed.entries) {
      if (typeof entry.resourceId !== 'string') continue;
      const mapped = mapActResourceIdToNodeId(entry.resourceId);
      if ('nodeId' in mapped) map.set(entry.resourceId, mapped.nodeId);
    }
    return { ok: true, map };
  } catch {
    return { ok: false, map: new Map() };
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
