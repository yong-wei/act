export type ClassAttributionMode = 'explicit' | 'inferred' | 'mixed' | 'unassigned';

export interface ClassAttributionInput {
  sessionClassId?: string | null;
  participantClassIds: Array<string | null | undefined>;
  inferenceThreshold?: number;
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

export function resolveClassAttribution({
  sessionClassId,
  participantClassIds,
  inferenceThreshold = 0.6,
}: ClassAttributionInput): ClassAttributionResult {
  const classCounts: Record<string, number> = {};
  for (const value of participantClassIds) {
    const classId = readClassId(value);
    if (!classId) continue;
    classCounts[classId] = (classCounts[classId] ?? 0) + 1;
  }

  const studentCount = Object.values(classCounts).reduce((sum, count) => sum + count, 0);
  const explicitClassId = readClassId(sessionClassId);

  if (explicitClassId) {
    return {
      classId: explicitClassId,
      mode: 'explicit',
      confidence: 1,
      studentCount,
      classCounts,
    };
  }

  if (studentCount === 0) {
    return {
      classId: null,
      mode: 'unassigned',
      confidence: 0,
      studentCount: 0,
      classCounts,
    };
  }

  const [dominantClassId, dominantCount] = Object.entries(classCounts).sort(
    ([, left], [, right]) => right - left,
  )[0];
  const confidence = dominantCount / studentCount;

  if (confidence >= inferenceThreshold) {
    return {
      classId: dominantClassId,
      mode: 'inferred',
      confidence,
      studentCount,
      classCounts,
    };
  }

  return {
    classId: null,
    mode: 'mixed',
    confidence,
    studentCount,
    classCounts,
  };
}
