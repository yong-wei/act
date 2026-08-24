import { createHash } from 'node:crypto';

import type { TeacherAiGradingControlledQuestionStratum } from './teacher-ai-grading-lab-controlled-experiment';

export const TEACHER_AI_GRADING_CONTROLLED_STRATA_VERSION = 'teacher-ai-grading-controlled-strata.v1' as const;

export interface TeacherAiGradingQuestionStructure {
  sampleId: string;
  questionId: string;
  imageCount: number;
  formulaCount: number;
}

export interface TeacherAiGradingControlledStrataSnapshot {
  schemaVersion: typeof TEACHER_AI_GRADING_CONTROLLED_STRATA_VERSION;
  strata: TeacherAiGradingControlledQuestionStratum[];
  contentHash: string;
}

export function createTeacherAiGradingControlledStrataSnapshot(
  structures: readonly TeacherAiGradingQuestionStructure[],
): TeacherAiGradingControlledStrataSnapshot {
  if (!Array.isArray(structures) || structures.length === 0) {
    throw new Error('teacher-ai-grading-controlled-strata-missing');
  }
  const seen = new Set<string>();
  const strata = structures.map((structure) => {
    assertToken(structure.sampleId, 'teacher-ai-grading-controlled-strata-sample-missing');
    assertToken(structure.questionId, 'teacher-ai-grading-controlled-strata-question-missing');
    assertNonNegativeInteger(structure.imageCount, 'teacher-ai-grading-controlled-strata-image-count-invalid');
    assertNonNegativeInteger(structure.formulaCount, 'teacher-ai-grading-controlled-strata-formula-count-invalid');
    const sampleId = structure.sampleId.trim();
    const questionId = structure.questionId.trim();
    const key = `${sampleId}\u0000${questionId}`;
    if (seen.has(key)) throw new Error('teacher-ai-grading-controlled-strata-duplicate');
    seen.add(key);
    return {
      sampleId,
      questionId,
      questionType: questionId === 'T2-3'
        ? 'hand-drawn-or-diagram'
        : structure.formulaCount > 0
          ? 'formula-response'
          : 'text-response',
      hasVisualEvidence: structure.imageCount > 0,
    };
  }).sort((left, right) => `${left.sampleId}\u0000${left.questionId}`.localeCompare(`${right.sampleId}\u0000${right.questionId}`));
  const body = { schemaVersion: TEACHER_AI_GRADING_CONTROLLED_STRATA_VERSION, strata };
  return { ...body, contentHash: hashJson(body) };
}

function assertToken(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code);
}

function assertNonNegativeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

function hashJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
