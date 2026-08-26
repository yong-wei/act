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
      id: report.id,
      scopeType: report.scopeType,
      scopeId: report.scopeId,
      classId: report.classId,
      targetUserId: report.targetUserId,
      reportBody: report.reportBody,
      riskSummary: report.riskSummary,
      evidenceCutoff: report.evidenceCutoff.toISOString(),
      generatedAt: report.generatedAt.toISOString(),
      generatorVersion: report.generatorVersion,
      ruleVersion: report.ruleVersion,
      generationReason: report.generationReason,
      forceReason: report.forceReason,
      previousReportId: report.previousReportId,
    })),
  };
}
