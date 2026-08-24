import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';

import type {
  LayeredGraphAuthorityInput,
  LayeredGraphPayload,
  LayeredGraphProjectionInput,
  LayeredGraphScope,
} from './contracts';
import {
  resolveStepDrawerEntries,
  type ResolveStepDrawerInput,
  type StepDrawerResolution,
} from './drawer';
import { buildLayeredGraphPayload } from './payload';

export function extractStepKnowledgeRefsFromLessonRuntime(
  lessonRuntime: RuntimeLessonEntryBundle,
  currentStepId: string,
  orderedStepIds: readonly string[],
): string[] {
  const directMap = new Map<string, string[]>();

  for (const group of lessonRuntime.graphOverlay.groups) {
    for (const stepId of group.step_ids) {
      directMap.set(stepId, [...group.node_ids]);
    }
  }

  if (orderedStepIds.every((stepId) => directMap.has(stepId))) {
    return directMap.get(currentStepId) ?? [];
  }

  const flatStepIds = lessonRuntime.graphOverlay.groups.flatMap(
    (group) => group.step_ids,
  );
  const looksLikeLegacySequence = flatStepIds.every((stepId) =>
    /^step-\d+$/i.test(stepId),
  );
  if (!looksLikeLegacySequence || flatStepIds.length !== orderedStepIds.length) {
    return directMap.get(currentStepId) ?? [];
  }

  const fallbackMap = new Map<string, string[]>();
  for (const group of lessonRuntime.graphOverlay.groups) {
    const translatedStepIds = group.step_ids
      .map((stepId) => {
        const match = /^step-(\d+)$/i.exec(stepId);
        if (!match) return null;
        return orderedStepIds[Number(match[1]) - 1] ?? null;
      })
      .filter((stepId): stepId is string => Boolean(stepId));

    for (const stepId of translatedStepIds) {
      fallbackMap.set(stepId, [...group.node_ids]);
    }
  }

  return fallbackMap.get(currentStepId) ?? [];
}

export function buildLessonRuntimeLayeredPayload(input: {
  lessonRuntime: RuntimeLessonEntryBundle;
  scope: LayeredGraphScope;
}): LayeredGraphPayload {
  const lessonId =
    input.lessonRuntime.graphOverlay.lesson_id
    || input.lessonRuntime.lesson.lesson_id
    || input.scope.lessonKey
    || 'lesson';
  const projectionId = `legacy-runtime-graph-overlay:${lessonId}`;
  const authority: LayeredGraphAuthorityInput = {
    status: 'unavailable',
    releaseId: null,
    releaseSetId: null,
    snapshotId: null,
    snapshotHash: null,
    engineering: null,
    reason: 'course-page-uses-lesson-runtime-legacy-adapter',
  };
  const projection: LayeredGraphProjectionInput = {
    status: 'fallback',
    source: 'legacy',
    projectionId,
    projectionHash: null,
    authorityReleaseId: null,
    scopeId: input.scope.scopeId,
    manifest: null,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes: input.lessonRuntime.graphOverlay.nodes.map((node) => ({
      canonicalId: node.id,
      pathEligible: true,
      cardPolicy: 'optional' as const,
      moduleId: null,
      scopeId: input.scope.scopeId,
      rationale: null,
      projectionStatus: 'PROJECTED' as const,
    })),
    cards: [],
    notProjectedCanonicalIds: [],
    reasons: ['using-lesson-runtime-graph-overlay-legacy'],
    fallback: {
      kind: 'legacy',
      adapterId: 'legacy-lesson-runtime-graph-overlay',
      authorityReleaseId: null,
      projectionId,
      projectionHash: null,
      scopeId: input.scope.scopeId,
      reasons: ['using-lesson-runtime-graph-overlay-legacy'],
    },
  };
  return buildLayeredGraphPayload({
    authority,
    projection,
    request: { scope: input.scope, includeTeaching: true },
  });
}

export function resolveCoursePageLayeredDrawerEntries(input: {
  lessonRuntime: RuntimeLessonEntryBundle;
  currentStepId: string;
  orderedStepIds: readonly string[];
  scope: LayeredGraphScope;
  payload?: LayeredGraphPayload | null;
  resourceLaunchTargets?: ResolveStepDrawerInput['resourceLaunchTargets'];
  resourceRegistryIds?: ResolveStepDrawerInput['resourceRegistryIds'];
}): StepDrawerResolution[] {
  const knowledgeRefs = extractStepKnowledgeRefsFromLessonRuntime(
    input.lessonRuntime,
    input.currentStepId,
    input.orderedStepIds,
  );
  if (knowledgeRefs.length === 0) return [];

  const payload = input.payload ?? buildLessonRuntimeLayeredPayload({
    lessonRuntime: input.lessonRuntime,
    scope: {
      ...input.scope,
      stepId: input.currentStepId,
      knowledgeRefs,
    },
  });

  const canonicalTitles: Record<string, string> = {};
  const canonicalDescriptions: Record<string, string> = {};
  for (const node of input.lessonRuntime.graphOverlay.nodes) {
    canonicalTitles[node.id] = node.name;
    if (node.description) canonicalDescriptions[node.id] = node.description;
  }

  return resolveStepDrawerEntries({
    payload,
    stepId: input.currentStepId,
    knowledgeRefs,
    resourceLaunchTargets: input.resourceLaunchTargets,
    resourceRegistryIds: input.resourceRegistryIds,
    canonicalTitles,
    canonicalDescriptions,
  });
}
