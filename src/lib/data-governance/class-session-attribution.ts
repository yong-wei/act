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
}

export interface SessionClassContext {
  classId: string | null;
  class: SessionClassInfo | null;
  attribution: ClassAttributionResult;
}

export function resolveSessionClassContext({
  sessionClassId,
  sessionClass,
}: ResolveSessionClassContextInput): SessionClassContext {
  const attribution = resolveClassAttribution({
    sessionClassId,
  });
  const classInfo = attribution.classId
    ? sessionClass?.id === attribution.classId
      ? sessionClass
      : null
    : null;

  return {
    classId: attribution.classId,
    class: classInfo,
    attribution,
  };
}
