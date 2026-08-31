import type { Prisma } from '@prisma/client';

import { ALL_PRESETS } from '@/features/teacher/preset-lessons';
import { canAccessClassroomSession } from '@/features/classroom/session';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import { prisma } from '@/lib/prisma';
import { getRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { resolvePlanRuntimeBindings } from '@/lib/lesson-plan-runtime-binding';
import { loadRuntimeLessonManifestSnapshot } from '@/lib/session-lesson-snapshot';

type JsonRecord = Record<string, unknown>;

export interface TrustedControlWorkbenchContext {
  sessionId: string;
  classId?: string;
  lessonPlanId: string;
  manifestHash: string;
  lessonId: string;
  stepId: string;
  moduleId: string;
  capabilityId: string;
  registryId: string;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function resolveTrustedControlWorkbenchContext(input: {
  user: {
    id: string;
    role?: unknown;
    profile?: { classId?: string | null } | null;
  };
  sessionId: string;
  lessonId: string;
  stepId: string;
  moduleId: string;
  capabilityId: string;
  requireActive?: boolean;
}): Promise<TrustedControlWorkbenchContext | null> {
  const [classSession, profile] = await Promise.all([
    prisma.classSession.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        classId: true,
        teacherId: true,
        status: true,
        manifestHash: true,
        plan: {
          select: {
            id: true,
            items: {
              select: {
                overrideConfig: true,
                resource: {
                  select: {
                    registryId: true,
                    teacherOnly: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    input.user.profile
      ? Promise.resolve(input.user.profile)
      : prisma.studentProfile.findUnique({
        where: { userId: input.user.id },
        select: { classId: true },
      }),
  ]);
  if (
    !classSession
    || (input.requireActive !== false && classSession.status !== 'ACTIVE')
    || (classSession.classId !== null && profile?.classId !== classSession.classId)
    || !canAccessClassroomSession(classSession, { ...input.user, profile })
  ) {
    return null;
  }

  const planBindings = resolvePlanRuntimeBindings(classSession.plan.items);
  if (planBindings.state !== 'valid') return null;
  const targetBindings = planBindings.items.filter(({ binding }) =>
    binding.runtimeStepId === input.stepId);
  if (targetBindings.length !== 1) return null;
  const targetBinding = targetBindings[0];

  const requestedIdentity = resolveInteractiveLessonIdentity(input.lessonId);
  const boundIdentity = resolveInteractiveLessonIdentity({
    kind: 'runtimeLessonDir',
    value: planBindings.runtimeLessonId,
  });
  if (
    requestedIdentity.status !== 'resolved'
    || boundIdentity.status !== 'resolved'
    || requestedIdentity.record.canonicalId !== boundIdentity.record.canonicalId
    || boundIdentity.record.canonicalId !== planBindings.runtimeLessonId
    || !boundIdentity.record.presetKeys.includes(planBindings.sourcePresetKey)
  ) {
    return null;
  }

  const preset = ALL_PRESETS.find((candidate) =>
    candidate.key === planBindings.sourcePresetKey);
  if (!preset) return null;

  const runtimeSnapshot = loadRuntimeLessonManifestSnapshot(planBindings.runtimeLessonId);
  if (
    !runtimeSnapshot
    || !classSession.manifestHash
    || runtimeSnapshot.snapshot.manifestHash !== classSession.manifestHash
  ) {
    return null;
  }
  const manifest = normalizeInteractiveRuntimeManifest(runtimeSnapshot.manifest);
  if (!manifest || manifest.lessonId !== planBindings.runtimeLessonId) return null;
  const stepIndex = manifest?.steps.findIndex((step) => step.id === input.stepId) ?? -1;
  if (stepIndex < 0) return null;

  const step = manifest.steps[stepIndex];
  const runtimeModule = step.modules.find((candidate) => candidate.id === input.moduleId);
  const capabilityId = runtimeModule
    ? stringValue(record(runtimeModule.payload).capabilityRef)
    : null;
  if (!runtimeModule || capabilityId !== input.capabilityId) return null;

  const expectedRegistryId = preset.items.find((item) =>
    item.runtimeStepId === input.stepId)?.registryId;
  const targetResource = targetBinding.item.resource;
  if (
    !expectedRegistryId
    || !getRegisteredResourceMetadata(expectedRegistryId)
    || !targetResource
    || targetResource.teacherOnly
    || targetResource.registryId !== expectedRegistryId
  ) {
    return null;
  }

  return {
    sessionId: classSession.id,
    ...(classSession.classId ? { classId: classSession.classId } : {}),
    lessonPlanId: classSession.plan.id,
    manifestHash: classSession.manifestHash,
    lessonId: manifest.lessonId,
    stepId: step.id,
    moduleId: runtimeModule.id,
    capabilityId,
    registryId: expectedRegistryId,
  };
}

export function persistedControlWorkbenchRunMatchesContext(
  run: {
    sessionId: string | null;
    resourceId: string | null;
    taskSpecSnapshot: Prisma.JsonValue | null;
  },
  context: TrustedControlWorkbenchContext,
): boolean {
  const taskSpec = record(run.taskSpecSnapshot);
  const launchContext = record(taskSpec.launchContext);
  const objectives = Array.isArray(taskSpec.objectives) ? taskSpec.objectives : [];
  return run.sessionId === context.sessionId
    && run.resourceId === context.registryId
    && stringValue(taskSpec.scenarioId) === context.capabilityId
    && stringValue(launchContext.lessonPlanId) === context.lessonPlanId
    && stringValue(launchContext.manifestHash) === context.manifestHash
    && stringValue(launchContext.lessonId) === context.lessonId
    && stringValue(launchContext.stepId) === context.stepId
    && stringValue(launchContext.moduleId) === context.moduleId
    && stringValue(launchContext.registryId) === context.registryId
    && objectives.includes(context.capabilityId);
}
