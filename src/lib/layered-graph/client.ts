/**
 * Client-safe layered graph helpers for interactive course pages.
 *
 * Keep this module limited to serializable contracts and pure view-model
 * transforms. Server routes resolve the payload (including the explicit
 * lesson-runtime Legacy fallback) before passing it to these helpers.
 */

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';

import {
  resolveStepDrawerEntries,
  type ResolveStepDrawerInput,
  type StepDrawerResolution,
} from './drawer';
import type { LayeredGraphPayload, LayeredGraphScope } from './contracts';

export {
  resolveStepDrawerContent,
  resolveStepDrawerEntries,
  teachingResourceTypeLabel,
  teachingRoleLabel,
} from './drawer';

export type {
  DrawerCardStatus,
  ResolveStepDrawerInput,
  StepDrawerResolution,
} from './drawer';

export type { LayeredGraphPayload, LayeredGraphScope } from './contracts';

/**
 * Canonical package scope for an interactive lesson package id (e.g. `1-1`).
 * This copy is intentionally independent from the server page-context module
 * so client components never pull in store or resolver imports.
 */
export function buildCoursePackageLayeredScope(input: {
  packageCanonicalId: string;
  lessonKey?: string | null;
  stepId?: string | null;
  knowledgeRefs?: readonly string[];
}): LayeredGraphScope {
  return {
    scopeId: `course-package:${input.packageCanonicalId}`,
    lessonKey: input.lessonKey ?? input.packageCanonicalId,
    stepId: input.stepId ?? null,
    knowledgeRefs: input.knowledgeRefs,
  };
}

/**
 * Map lesson-runtime graph-overlay groups to step knowledgeRefs (Canonical
 * IDs), including the legacy `step-N` sequence translation.
 */
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
        const index = Number(match[1]) - 1;
        return orderedStepIds[index] ?? null;
      })
      .filter((stepId): stepId is string => Boolean(stepId));

    for (const stepId of translatedStepIds) {
      fallbackMap.set(stepId, [...group.node_ids]);
    }
  }

  return fallbackMap.get(currentStepId) ?? [];
}

/**
 * Resolve the current course step's drawer entries on the client.
 *
 * The payload is deliberately required: App Router server routes always pass
 * `resolveCoursePageLayeredGraphContext(...).payload`, whose teaching layer
 * may already carry the named lesson-runtime Legacy fallback. Reconstructing
 * that payload here would import the server resolver/store boundary.
 */
export function resolveCoursePageLayeredDrawerEntries(input: {
  lessonRuntime: RuntimeLessonEntryBundle;
  currentStepId: string;
  orderedStepIds: readonly string[];
  scope: LayeredGraphScope;
  payload: LayeredGraphPayload;
  resourceLaunchTargets?: ResolveStepDrawerInput['resourceLaunchTargets'];
  resourceRegistryIds?: ResolveStepDrawerInput['resourceRegistryIds'];
}): StepDrawerResolution[] {
  const knowledgeRefs = extractStepKnowledgeRefsFromLessonRuntime(
    input.lessonRuntime,
    input.currentStepId,
    input.orderedStepIds,
  );
  if (knowledgeRefs.length === 0) return [];

  const canonicalTitles: Record<string, string> = {};
  const canonicalDescriptions: Record<string, string> = {};
  for (const node of input.lessonRuntime.graphOverlay.nodes) {
    canonicalTitles[node.id] = node.name;
    if (node.description) {
      canonicalDescriptions[node.id] = node.description;
    }
  }

  const payload = input.payload.requestedScope
    ? input.payload
    : { ...input.payload, requestedScope: input.scope };

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
