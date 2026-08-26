import type { DiagnosisReportReadModel } from '@/lib/diagnosis-persistence';
import type { ReadTeacherDiagnosisReportHistoryInput } from '../public-api';

export type TeacherDiagnosisReportRecord = Omit<DiagnosisReportReadModel, 'inputSummary'>;

export interface TeacherDiagnosisReportReader {
  read(input: ReadTeacherDiagnosisReportHistoryInput): Promise<TeacherDiagnosisReportRecord[]>;
}
