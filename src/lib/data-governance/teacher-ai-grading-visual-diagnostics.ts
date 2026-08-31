export type TeacherAiGradingVisualEvidenceKind =
  | 'TEXT_OR_FORMULA'
  | 'EMBEDDED_IMAGE'
  | 'SCANNED_OR_HAND_DRAWN'
  | 'INDEPENDENT_IMAGE_ATTACHMENT'
  | 'CONVERSION_FAILED';

export interface TeacherAiGradingVisualDiagnosticExecution {
  ordinal: 1 | 2 | 3;
  state: 'SUCCEEDED' | 'FAILED' | 'RETRYABLE' | 'QUEUED' | 'RUNNING';
  score: number | null;
  inputHash: string | null;
}

export interface TeacherAiGradingVisualDiagnosticRecord {
  anonymousSampleId: string;
  questionId: string;
  maxScore: number;
  teacherScore: number;
  visualEvidenceKind: TeacherAiGradingVisualEvidenceKind;
  embeddedImageCount: number;
  formulaCount: number;
  visualEvidenceDelivered: boolean;
  conversion: {
    status: 'SUCCEEDED' | 'FAILED' | 'UNAVAILABLE';
    sourceHash: string | null;
    renderedPdfChecksum: string | null;
    markdownChecksum: string | null;
    markdownLength: number | null;
    evidenceBlockCount: number | null;
    anchorVersion: string | null;
    processorVersion: string | null;
    errorCode: string | null;
  };
  executions: readonly TeacherAiGradingVisualDiagnosticExecution[];
}

export interface TeacherAiGradingVisualDiagnosisInput {
  partition: 'tuning' | 'hidden';
  dataset: { id: string; version: string };
  run: { configurationId: string; batchId: string; processorVersion: string };
  records: readonly TeacherAiGradingVisualDiagnosticRecord[];
}

export interface TeacherAiGradingVisualQuestionMetrics {
  questionId: string;
  recordCount: number;
  completeThreeRunCount: number;
  failedOrIncompleteCount: number;
  meanAbsoluteError: number | null;
  meanRunVariance: number | null;
  visualRecordCount: number;
  visualEvidenceUndeliveredCount: number;
  conversionFailureCount: number;
}

export interface TeacherAiGradingVisualDiagnosis {
  schemaVersion: 'teacher-ai-grading-visual-diagnosis.v1';
  partition: 'tuning';
  dataset: { id: string; version: string };
  run: { configurationId: string; batchId: string; processorVersion: string };
  records: TeacherAiGradingVisualDiagnosticRecord[];
  questionMetrics: TeacherAiGradingVisualQuestionMetrics[];
  rootCause: {
    code: 'VISUAL_EVIDENCE_NOT_DELIVERED' | 'CONVERSION_FAILURE' | 'INSUFFICIENT_EVIDENCE';
    rationale: string;
  };
}

export function buildTeacherAiGradingVisualDiagnosis(
  input: TeacherAiGradingVisualDiagnosisInput,
): TeacherAiGradingVisualDiagnosis {
  if (input.partition !== 'tuning') {
    throw new Error('teacher-ai-grading-visual-diagnosis-hidden-partition-forbidden');
  }
  const records = input.records.map(normalizeRecord);
  const questionMetrics = [...new Set(records.map((record) => record.questionId))]
    .sort((left, right) => left.localeCompare(right))
    .map((questionId) => metricsForQuestion(records.filter((record) => record.questionId === questionId), questionId));
  return {
    schemaVersion: 'teacher-ai-grading-visual-diagnosis.v1',
    partition: 'tuning',
    dataset: input.dataset,
    run: input.run,
    records,
    questionMetrics,
    rootCause: determineRootCause(records),
  };
}

function normalizeRecord(record: TeacherAiGradingVisualDiagnosticRecord): TeacherAiGradingVisualDiagnosticRecord {
  if (!/^sample-[a-z0-9]{4,32}$/u.test(record.anonymousSampleId)) {
    throw new Error('teacher-ai-grading-visual-diagnosis-sample-id-invalid');
  }
  if (!record.questionId.trim() || !Number.isFinite(record.maxScore) || record.maxScore <= 0
    || !Number.isFinite(record.teacherScore) || record.teacherScore < 0 || record.teacherScore > record.maxScore) {
    throw new Error('teacher-ai-grading-visual-diagnosis-score-invalid');
  }
  const ordinals = new Set(record.executions.map((execution) => execution.ordinal));
  if (record.executions.length !== ordinals.size || [...ordinals].some((ordinal) => ![1, 2, 3].includes(ordinal))) {
    throw new Error('teacher-ai-grading-visual-diagnosis-execution-ordinal-invalid');
  }
  return {
    ...record,
    executions: [...record.executions].sort((left, right) => left.ordinal - right.ordinal),
  };
}

function metricsForQuestion(
  records: readonly TeacherAiGradingVisualDiagnosticRecord[],
  questionId: string,
): TeacherAiGradingVisualQuestionMetrics {
  const complete = records.filter(hasThreeSuccessfulScores);
  const absoluteErrors = complete.flatMap((record) => record.executions.map((execution) => Math.abs(execution.score! - record.teacherScore)));
  const runVariances = complete.map((record) => variance(record.executions.map((execution) => execution.score!)));
  const visualRecords = records.filter((record) => record.visualEvidenceKind !== 'TEXT_OR_FORMULA');
  return {
    questionId,
    recordCount: records.length,
    completeThreeRunCount: complete.length,
    failedOrIncompleteCount: records.length - complete.length,
    meanAbsoluteError: mean(absoluteErrors),
    meanRunVariance: mean(runVariances),
    visualRecordCount: visualRecords.length,
    visualEvidenceUndeliveredCount: visualRecords.filter((record) => !record.visualEvidenceDelivered).length,
    conversionFailureCount: records.filter((record) => record.conversion.status === 'FAILED').length,
  };
}

function determineRootCause(records: readonly TeacherAiGradingVisualDiagnosticRecord[]) {
  const visualRecords = records.filter((record) => record.visualEvidenceKind !== 'TEXT_OR_FORMULA');
  if (visualRecords.some((record) => !record.visualEvidenceDelivered)) {
    return {
      code: 'VISUAL_EVIDENCE_NOT_DELIVERED' as const,
      rationale: '至少一份含视觉证据的调优样本未将视觉内容送入评分输入；该链路不能据此得出自动评分结论。',
    };
  }
  if (records.some((record) => record.conversion.status === 'FAILED')) {
    return {
      code: 'CONVERSION_FAILURE' as const,
      rationale: '存在转换失败的调优样本，评分差异不能与完整证据链区分。',
    };
  }
  return {
    code: 'INSUFFICIENT_EVIDENCE' as const,
    rationale: '当前匿名诊断未证明视觉证据、转换质量或评分模型中的任一层是唯一根因。',
  };
}

function hasThreeSuccessfulScores(record: TeacherAiGradingVisualDiagnosticRecord): boolean {
  return record.executions.length === 3
    && record.executions.every((execution) => execution.state === 'SUCCEEDED' && execution.score !== null);
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function variance(values: readonly number[]): number {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return round(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
