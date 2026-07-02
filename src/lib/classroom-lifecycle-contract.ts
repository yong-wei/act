export type ClassroomIdentityKind = 'class-bound' | 'temporary';

export interface ClassroomIdentityPayload {
  kind: ClassroomIdentityKind;
  label: string;
  summaryLabel: string;
  lessonTitle: string;
  classId: string | null;
  className: string | null;
  sessionId?: string;
  joinCode?: string;
}

export interface BuildClassroomIdentityInput {
  id?: string | null;
  joinCode?: string | null;
  classId?: string | null;
  class?: {
    name?: string | null;
  } | null;
  plan?: {
    title?: string | null;
  } | null;
  planTitle?: string | null;
}

export function buildClassroomIdentityPayload(input: BuildClassroomIdentityInput): ClassroomIdentityPayload {
  const lessonTitle = input.plan?.title?.trim() || input.planTitle?.trim() || '未命名课程';
  const className = input.class?.name?.trim() || null;
  const classId = input.classId ?? null;
  const kind: ClassroomIdentityKind = classId ? 'class-bound' : 'temporary';
  const label = kind === 'class-bound'
    ? `${className ?? '未命名班级'} · 班级课堂`
    : '临时课堂';

  return {
    kind,
    label,
    summaryLabel: `${label} · ${lessonTitle}`,
    lessonTitle,
    classId,
    className,
    sessionId: input.id ?? undefined,
    joinCode: input.joinCode ?? undefined,
  };
}

export type ClassroomLifecycleEventType =
  | 'start-class'
  | 'page-change'
  | 'copy-code'
  | 'release-interaction'
  | 'online-panel'
  | 'submit'
  | 'end-class';

export interface ClassroomLifecycleEvidenceInput {
  eventType: ClassroomLifecycleEventType | string;
  actorRole: string;
  sessionId: string;
  stepId?: string | null;
  cardId?: string | null;
  clientEventId: string;
  sourceLogId?: string | null;
  clientEventAt: number | string;
  dedupeIdentity?: string | null;
}

export interface ClassroomLifecycleEvidenceFields {
  eventType: string;
  actorRole: string;
  sessionId: string;
  stepId: string | null;
  cardId: string | null;
  clientEventId: string;
  sourceLogId: string | null;
  clientEventAt: number | string;
  dedupeIdentity: string;
}

export function normalizeClassroomLifecycleClientEventAt(value: unknown): number | string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : trimmed;
  }
  return null;
}

export function buildClassroomLifecycleEvidenceFields(
  input: ClassroomLifecycleEvidenceInput,
): ClassroomLifecycleEvidenceFields {
  const clientEventId = input.clientEventId.trim();
  if (!clientEventId) {
    throw new Error('Classroom lifecycle evidence requires clientEventId');
  }

  const clientEventAt = normalizeClassroomLifecycleClientEventAt(input.clientEventAt);
  if (clientEventAt === null) {
    throw new Error('Classroom lifecycle evidence requires clientEventAt');
  }

  const targetId = input.cardId ?? input.stepId ?? 'session';
  const sourceLogId = input.sourceLogId?.trim() || null;
  const dedupeIdentity = [input.sessionId, input.eventType, input.actorRole, targetId, sourceLogId ?? clientEventId].join(':');

  return {
    eventType: input.eventType,
    actorRole: input.actorRole,
    sessionId: input.sessionId,
    stepId: input.stepId ?? null,
    cardId: input.cardId ?? null,
    clientEventId,
    sourceLogId,
    clientEventAt,
    dedupeIdentity,
  };
}
