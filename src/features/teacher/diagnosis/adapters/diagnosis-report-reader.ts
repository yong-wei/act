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
      return reports.map((report) => {
        const { inputSummary: _inputSummary, ...safeReport } = report;
        return safeReport;
      });
    },
  };
}
