import { readDiagnosisReports } from '@/lib/diagnosis-persistence';

import type { TeacherDiagnosisReportReader, TeacherDiagnosisReportRecord } from '../ports/report-reader';

export function createDiagnosisReportReader(): TeacherDiagnosisReportReader {
  return {
    async read(input): Promise<TeacherDiagnosisReportRecord[]> {
      const reports = await readDiagnosisReports({
        teacherId: input.teacherId,
        classId: input.classId,
        targetStudentId: input.targetStudentId,
        limit: input.limit,
      });
      return reports.map((report) => ({
        id: report.id,
        scopeType: report.scopeType,
        scopeId: report.scopeId,
        classId: report.classId,
        targetUserId: report.targetUserId,
        reportBody: report.reportBody,
        riskSummary: report.riskSummary,
        evidenceCutoff: report.evidenceCutoff,
        generatedAt: report.generatedAt,
        generatorVersion: report.generatorVersion,
        ruleVersion: report.ruleVersion,
        generationReason: report.generationReason,
        forceReason: report.forceReason,
        previousReportId: report.previousReportId,
      }));
    },
  };
}
