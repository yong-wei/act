export type ClassAttributionMode = 'explicit' | 'unassigned';

export interface ClassAttributionInput {
  sessionClassId?: string | null;
}

export interface ClassAttributionResult {
  classId: string | null;
  mode: ClassAttributionMode;
  confidence: number;
  studentCount: number;
  classCounts: Record<string, number>;
}

function readClassId(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function resolveClassAttribution({ sessionClassId }: ClassAttributionInput): ClassAttributionResult {
  const explicitClassId = readClassId(sessionClassId);

  if (explicitClassId) {
    return {
      classId: explicitClassId,
      mode: 'explicit',
      confidence: 1,
      studentCount: 0,
      classCounts: {},
    };
  }

  return {
    classId: null,
    mode: 'unassigned',
    confidence: 0,
    studentCount: 0,
    classCounts: {},
  };
}
