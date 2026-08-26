import type { DiagnosisReportsPayload, ReadTeacherDiagnosisReportHistoryInput } from '../public-api';
import type { TeacherDiagnosisReportReader } from '../ports/report-reader';

export async function readTeacherDiagnosisReportHistory(input: {
  reader: TeacherDiagnosisReportReader;
} & ReadTeacherDiagnosisReportHistoryInput): Promise<DiagnosisReportsPayload> {
  const reports = await input.reader.read({
    teacherId: input.teacherId,
    classId: input.classId,
    targetStudentId: input.targetStudentId,
    limit: input.limit,
  });
  return {
    reports: reports.map((report) => ({
      ...report,
      evidenceCutoff: report.evidenceCutoff.toISOString(),
      generatedAt: report.generatedAt.toISOString(),
    })),
  };
}
