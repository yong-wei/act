import type { DiagnosisReportBody, DiagnosisRiskSummary } from '@/lib/diagnosis-persistence';

export interface DiagnosisReportApiItem {
  id: string;
  scopeType: 'class' | 'student';
  scopeId: string;
  classId: string;
  targetUserId: string | null;
  reportBody: DiagnosisReportBody;
  riskSummary: DiagnosisRiskSummary;
  evidenceCutoff: string;
  generatedAt: string;
  generatorVersion: string;
  ruleVersion?: string | null;
  generationReason?: string | null;
  forceReason?: string | null;
  previousReportId?: string | null;
}

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
