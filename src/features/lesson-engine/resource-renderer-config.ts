import type { Prisma } from '@prisma/client';

import type { InteractiveResourceConfig } from '@/features/interactive';

const RESERVED_COMPONENT_PROP_KEYS = new Set([
  'titleOverride',
  'descriptionOverride',
  'props',
  'ai',
  'tracking',
  'completion',
  'layout',
]);

export interface ResourceRendererLaunchContextInput {
  resourceId: string;
  registryId: string | null;
  sessionId?: string | null;
  lessonItemId?: string | null;
  lessonPlanId?: string | null;
  classId?: string | null;
  stage?: string | null;
}

export interface ResourceRendererLaunchContext {
  provenance: 'db-boppps' | 'standalone';
  contextState: 'course-bound' | 'context-limited';
  resourceId: string;
  registryId: string | null;
  sessionId: string | null;
  lessonItemId: string | null;
  lessonPlanId: string | null;
  classId: string | null;
  stage: string | null;
}

export function asPlainRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function extractComponentProps(config: unknown): Record<string, unknown> {
  const record = asPlainRecord(config);
  const nestedProps = asPlainRecord(record.props);
  const topLevelProps = Object.fromEntries(
    Object.entries(record).filter(([key]) => !RESERVED_COMPONENT_PROP_KEYS.has(key)),
  );

  return {
    ...topLevelProps,
    ...nestedProps,
  };
}

export function resolveInteractiveResourceConfig({
  registryDefaultConfig,
  resourceConfig,
  overrideConfig,
}: {
  registryDefaultConfig?: Record<string, unknown> | null;
  resourceConfig?: Prisma.JsonValue | null;
  overrideConfig?: Prisma.JsonValue | null;
}): InteractiveResourceConfig {
  const resourceRecord = asPlainRecord(resourceConfig);
  const overrideRecord = asPlainRecord(overrideConfig);

  return {
    ...resourceRecord,
    ...overrideRecord,
    ai: {
      ...asPlainRecord(resourceRecord.ai),
      ...asPlainRecord(overrideRecord.ai),
    },
    tracking: {
      ...asPlainRecord(resourceRecord.tracking),
      ...asPlainRecord(overrideRecord.tracking),
    },
    completion: {
      ...asPlainRecord(resourceRecord.completion),
      ...asPlainRecord(overrideRecord.completion),
    },
    layout: {
      ...asPlainRecord(resourceRecord.layout),
      ...asPlainRecord(overrideRecord.layout),
    },
    props: {
      ...(registryDefaultConfig || {}),
      ...extractComponentProps(resourceRecord),
      ...extractComponentProps(overrideRecord),
    },
  };
}

export function buildResourceRendererLaunchContext({
  resourceId,
  registryId,
  sessionId,
  lessonItemId,
  lessonPlanId,
  classId,
  stage,
}: ResourceRendererLaunchContextInput): ResourceRendererLaunchContext {
  const hasCourseContext = Boolean(sessionId || lessonItemId || lessonPlanId || classId);

  return {
    provenance: hasCourseContext ? 'db-boppps' : 'standalone',
    contextState: sessionId ? 'course-bound' : 'context-limited',
    resourceId,
    registryId,
    sessionId: sessionId ?? null,
    lessonItemId: lessonItemId ?? null,
    lessonPlanId: lessonPlanId ?? null,
    classId: classId ?? null,
    stage: stage ?? null,
  };
}
