import {
  resolveClassAttribution,
  type ClassAttributionResult,
} from './class-attribution';

export interface SessionClassInfo {
  id: string;
  name: string;
  code?: string | null;
}

export interface ResolveSessionClassContextInput {
  sessionClassId?: string | null;
  sessionClass?: SessionClassInfo | null;
  participantClassIds: Array<string | null | undefined>;
  classesById?: Map<string, SessionClassInfo>;
  inferenceThreshold?: number;
}

export interface SessionClassContext {
  classId: string | null;
  class: SessionClassInfo | null;
  attribution: ClassAttributionResult;
}

export function resolveSessionClassContext({
  sessionClassId,
  sessionClass,
  participantClassIds,
  classesById,
  inferenceThreshold,
}: ResolveSessionClassContextInput): SessionClassContext {
  const attribution = resolveClassAttribution({
    sessionClassId,
    participantClassIds,
    inferenceThreshold,
  });
  const classInfo = attribution.classId
    ? sessionClass?.id === attribution.classId
      ? sessionClass
      : classesById?.get(attribution.classId) ?? null
    : null;

  return {
    classId: attribution.classId,
    class: classInfo,
    attribution,
  };
}

export function shouldPersistInferredClassAttribution({
  attribution,
  minStudentCount = 5,
}: {
  attribution: ClassAttributionResult;
  minStudentCount?: number;
}) {
  return Boolean(
    attribution.mode === 'inferred'
      && attribution.classId
      && attribution.studentCount >= minStudentCount
  );
}
