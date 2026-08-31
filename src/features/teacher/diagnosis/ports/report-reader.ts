import type { DiagnosisReportBody, DiagnosisRiskSummary } from '@/lib/diagnosis-persistence';
import type { ReadTeacherDiagnosisReportHistoryInput } from '../public-api';

export interface TeacherDiagnosisReportRecord {
  id: string;
  scopeType: 'class' | 'student';
  scopeId: string;
  classId: string;
  targetUserId: string | null;
  reportBody: DiagnosisReportBody;
  riskSummary: DiagnosisRiskSummary;
  evidenceCutoff: Date;
  generatedAt: Date;
  generatorVersion: string;
  ruleVersion: string | null;
  generationReason: string | null;
  forceReason: string | null;
  previousReportId: string | null;
}

export interface TeacherDiagnosisReportReader {
  read(input: ReadTeacherDiagnosisReportHistoryInput): Promise<TeacherDiagnosisReportRecord[]>;
}
