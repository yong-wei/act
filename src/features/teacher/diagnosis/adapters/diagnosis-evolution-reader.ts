import { readDiagnosisReportEvolution } from '@/lib/diagnosis-persistence';

import type { TeacherDiagnosisEvolutionReader } from '../ports/evolution-reader';

export function createDiagnosisEvolutionReader(): TeacherDiagnosisEvolutionReader {
  return {
    async read(input) {
      const rows = await readDiagnosisReportEvolution({
        teacherId: input.teacherId,
        classId: input.classId,
        limit: input.limit,
      });
      return rows.map((row) => ({
        id: row.id,
        scopeType: row.scopeType,
        scopeId: row.scopeId,
        evidenceCutoff: row.evidenceCutoff,
        generatedAt: row.generatedAt,
        metricSnapshot: row.metricSnapshot
          ? {
              id: row.metricSnapshot.id,
              schemaVersion: row.metricSnapshot.schemaVersion,
              computationVersion: row.metricSnapshot.computationVersion,
              scopeType: row.metricSnapshot.scopeType,
              scopeId: row.metricSnapshot.scopeId,
              memberSetFingerprint: row.metricSnapshot.memberSetFingerprint,
              evidenceCutoff: row.metricSnapshot.evidenceCutoff,
              metrics: row.metricSnapshot.metrics,
              generatedAt: row.metricSnapshot.generatedAt,
            }
          : null,
      }));
    },
  };
}
