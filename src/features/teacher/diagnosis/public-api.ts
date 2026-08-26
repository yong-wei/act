import type { DiagnosisReportReadModel } from '@/lib/diagnosis-persistence';

export type DiagnosisReportApiItem = Omit<
  DiagnosisReportReadModel,
  | 'evidenceCutoff'
  | 'generatedAt'
  | 'inputSummary'
  | 'ruleVersion'
  | 'generationReason'
  | 'forceReason'
  | 'previousReportId'
> & {
  evidenceCutoff: string;
  generatedAt: string;
  ruleVersion?: string | null;
  generationReason?: string | null;
  forceReason?: string | null;
  previousReportId?: string | null;
};

export interface DiagnosisReportsPayload {
  reports: DiagnosisReportApiItem[];
}

export interface ReadTeacherDiagnosisReportHistoryInput {
  teacherId: string;
  classId: string;
  targetStudentId?: string | null;
  limit?: number;
}

export type TeacherDiagnosisReportErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid-limit'
  | 'scope'
  | 'invalid-report';
