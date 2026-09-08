import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { ResourceCandidatePoolSourceStatus } from './teacher-resource-node-data';
import { TEXTBOOK_ID_ALIASES } from './engineering-textbook-mapping/aliases';
import { resolveInteractiveLessonIdentity } from './interactive-lesson-identity';
import type {
  ArenaTaskResourceNodeInput,
  KnowledgeCardResourceNodeInput,
  LightweightResourceNodeInput,
  RegisteredResourceNodeInput,
  ResourceNodeRegistryInput,
  RuntimeLessonNodeInput,
  SimulationResourceNodeInput,
  TextbookSectionResourceNodeInput,
} from './resource-node-registry';
import { getRegisteredResourceMetadata } from './resource-registry-metadata';
import { resolveConfiguredTeachingProjectionRoot } from './teaching-projection/live-course-pointer';
import type { TeachingBindingRuntime, TeachingResourceRuntime } from './teaching-projection/contracts';
import {
  resolveActiveTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from './teaching-projection/store';
import { fromResourceIdToken } from './teaching-projection/textbook-locators/identity';
import {
  CLASSROOM_SIMULATION_PATH_NODE_IDS,
  mapActResourceIdToNodeId,
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

const CUTOVER_CANDIDATE_DIR =
  'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5';
const CUTOVER_DENOMINATOR_RELATIVE = `${CUTOVER_CANDIDATE_DIR}/denominator.json`;
const CUTOVER_CAPTURE_RECEIPT_RELATIVE = `${CUTOVER_CANDIDATE_DIR}/candidate-receipt.json`;
const CAPTURE_REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;

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
  captureRevision?: string;
  entries?: Array<{ resourceId?: string }>;
}

interface CutoverCaptureReceiptFile {
  authorityCaptureHash?: string;
  captureRevision?: string;
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
  const textbookSections: TextbookSectionResourceNodeInput[] = [];
  const registeredResources: RegisteredResourceNodeInput[] = [];

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
    const href = studentFacingHref(resource.sourcePath);
    if (mapped.kind === 'handout') {
      const lessonId = mapped.nodeId.slice('runtime-handout:'.length);
      runtimeLessons.push({
        lessonId,
        title,
        knowledgeNodeIds: coverage,
        handoutPath: href ?? courseHrefForLessonToken(lessonId),
      });
      continue;
    }
    if (mapped.kind === 'card') {
      knowledgeCards.push({
        id: mapped.nodeId.slice('knowledge-card:'.length),
        title,
        sourceRef: resource.resourceId,
        knowledgeNodeIds: coverage,
        launchTarget: href && href.startsWith('/') ? href : '/knowledge',
        renderTarget: href && href.startsWith('/') ? href : '/knowledge',
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
          url: href && href.startsWith('/') ? href : courseHrefForLessonToken(lessonId),
        }],
      });
      continue;
    }
    if (mapped.kind === 'arena') {
      const taskId = mapped.nodeId.slice('arena-task:'.length);
      arenaTasks.push({
        id: taskId,
        title,
        launchTarget: href && href.startsWith('/') ? href : `/arena/challenges/${taskId}`,
        knowledgeNodeIds: coverage,
      });
      continue;
    }
    if (mapped.kind === 'textbook-section') {
      const rest = mapped.nodeId.slice('textbook-section:'.length);
      const sep = rest.indexOf(':');
      textbookSections.push({
        bookId: rest.slice(0, sep),
        sectionId: rest.slice(sep + 1),
        title,
        citationHref: textbookSectionCitationHref(resource.resourceId, href),
        knowledgeNodeIds: coverage,
      });
      continue;
    }
    if (mapped.kind === 'simulation') {
      if (mapped.nodeId.startsWith('registry:')) {
        const registryId = mapped.nodeId.slice('registry:'.length);
        const metadata = getRegisteredResourceMetadata(registryId);
        registeredResources.push({
          id: registryId,
          label: title,
          type: metadata?.type ?? 'SIMULATION_APP',
          launchTarget: href && href.startsWith('/')
            ? href
            : metadata?.launchTarget ?? `/interactive-learning/resources/${registryId}`,
          knowledgeNodeIds: coverage,
        });
        continue;
      }
      const id = mapped.nodeId.startsWith('simulation:')
        ? mapped.nodeId.slice('simulation:'.length)
        : mapped.nodeId;
      simulations.push({
        id,
        title,
        launchTarget: href && href.startsWith('/') ? href : `/simulations/${id}`,
        knowledgeNodeIds: coverage,
      });
      continue;
    }
    exercises.push({
      id: mapped.nodeId.slice('exercise:'.length),
      title,
      sourceRef: resource.resourceId,
      knowledgeNodeIds: coverage,
      launchTarget: href && href.startsWith('/') ? href : '/assessment/adaptive-practice',
      renderTarget: href && href.startsWith('/') ? href : '/assessment/adaptive-practice',
    });
  }

  const extraInput: ResourceNodeRegistryInput = {
    knowledgeCards,
    runtimeLessons,
    simulations,
    arenaTasks,
    exercises,
    textbookSections,
    registeredResources,
  };
  const patchCount = knowledgeCards.length
    + runtimeLessons.length
    + simulations.length
    + arenaTasks.length
    + exercises.length
    + textbookSections.length
    + registeredResources.length;
  return { extraInput, skipCounts, patchCount };
}

export async function loadTeachingProjectionBindingFamily(): Promise<{
  extraInput: ResourceNodeRegistryInput;
  status: ResourceCandidatePoolSourceStatus;
  bridge: ReadonlyMap<string, string> | null;
}> {
  const empty: ResourceNodeRegistryInput = {};
  try {
    const projection = resolveActiveTeachingProjection(
      resolveTeachingProjectionStorePaths(resolveConfiguredTeachingProjectionRoot()),
    );
    if (projection.status !== 'available' || !projection.staged) {
      return {
        extraInput: empty,
        status: {
          family: TEACHING_PROJECTION_BINDING_FAMILY,
          status: 'missing',
          count: 0,
          reason: `missing-source-family:${TEACHING_PROJECTION_BINDING_FAMILY}`,
        },
        bridge: null,
      };
    }

    const bridge = loadDenominatorBridge(process.cwd());
    if (!bridge.ok) {
      return {
        extraInput: empty,
        status: {
          family: TEACHING_PROJECTION_BINDING_FAMILY,
          status: 'empty',
          count: 0,
          reason: DENOMINATOR_BRIDGE_LIMITATION,
        },
        bridge: null,
      };
    }
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
        reason: null,
        skipCounts: mapped.skipCounts,
      },
      bridge: bridge.map,
    };
  } catch {
    return {
      extraInput: empty,
      status: {
        family: TEACHING_PROJECTION_BINDING_FAMILY,
        status: 'error',
        count: 0,
        reason: `loader-error:${TEACHING_PROJECTION_BINDING_FAMILY}`,
      },
      bridge: null,
    };
  }
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

export function loadDenominatorBridge(repoRoot: string): { ok: boolean; map: Map<string, string> } {
  const filePath = path.join(repoRoot, CUTOVER_DENOMINATOR_RELATIVE);
  const receiptPath = path.join(repoRoot, CUTOVER_CAPTURE_RECEIPT_RELATIVE);
  if (!existsSync(filePath) || !existsSync(receiptPath)) return { ok: false, map: new Map() };
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as DenominatorBridgeFile;
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as CutoverCaptureReceiptFile;
    const captureRevision = receipt.authorityCaptureHash
      ?? receipt.captureRevision
      ?? parsed.captureRevision;
    if (
      parsed.contract !== 'successor-resource-denominator/v1'
      || typeof parsed.baselineHash !== 'string'
      || !/^[a-f0-9]{64}$/u.test(parsed.baselineHash)
      || typeof parsed.denominatorHash !== 'string'
      || !/^[a-f0-9]{64}$/u.test(parsed.denominatorHash)
      || typeof captureRevision !== 'string'
      || !CAPTURE_REVISION_PATTERN.test(captureRevision)
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

function studentFacingHref(href: string | null | undefined): string | null {
  if (!href) return null;
  if (
    href.startsWith('/interactive-learning/')
    || href.startsWith('/knowledge')
    || href.startsWith('/assessment/')
    || href.startsWith('/simulations/')
    || href.startsWith('/arena/')
    || href.startsWith('/textbooks/')
    || href.startsWith('/profile/')
    || href.startsWith('/course-runtime/')
    || href.startsWith('course-content/runtime/')
  ) {
    return href;
  }
  return null;
}

function courseHrefForLessonToken(lessonId: string): string {
  const resolved = resolveInteractiveLessonIdentity({ kind: 'runtimeLessonDir', value: lessonId });
  if (resolved.status === 'resolved') {
    return `/interactive-learning/courses/${resolved.record.routeSegments[0]}`;
  }
  const byKey = resolveInteractiveLessonIdentity({ kind: 'lessonKey', value: lessonId });
  if (byKey.status === 'resolved') {
    return `/interactive-learning/courses/${byKey.record.routeSegments[0]}`;
  }
  return `/interactive-learning/courses/${lessonId}`;
}

function textbookSectionCitationHref(resourceId: string, href: string | null | undefined): string {
  if (href && (href.startsWith('/') || href.startsWith('course-content/runtime/'))) return href;
  const token = resourceId.slice('act:textbook-section:'.length);
  if (!token || token.includes(':')) return '/knowledge';
  try {
    const segments = fromResourceIdToken(token).split(':');
    if (segments.length < 2 || segments.some((segment) => !segment)) return '/knowledge';
    const alias = TEXTBOOK_ID_ALIASES.find((row) => row.readerBookId === segments[0]);
    if (!alias) return '/knowledge';
    return `/${[
      'textbooks',
      alias.readerBookId,
      encodeURIComponent(alias.edition),
      ...segments.slice(1).map(encodeURIComponent),
    ].join('/')}`;
  } catch {
    return '/knowledge';
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
